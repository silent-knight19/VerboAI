/*
================================================================================
USER SERVICE
================================================================================
ROLE: Handle all Firestore operations related to users.
WHY:  Keeps database logic in one place, separate from route handlers.
      This is the "Single Source of Truth" for user CRUD operations.
HOW:  We export functions that interact with the Firestore `users` collection.
================================================================================

GOLDEN RULE:
  Users are ONLY created here, on the backend, after token verification.
  The frontend NEVER writes to the users collection directly.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  db - Firestore database instance from our config
  
  ROLE: Used to read/write documents in Firestore
*/
const { db } = require('../config/firebase.config');


// =============================================================================
// CONSTANTS
// =============================================================================

/*
  USERS_COLLECTION - The name of our users collection in Firestore
  
  WHY: Using a constant prevents typos and makes refactoring easier
*/
const USERS_COLLECTION = 'users';

const roles = require('../config/roles');
// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/*
  findUserByUid(uid)
  
  ROLE: Retrieve a user document from Firestore by their Firebase UID
  WHY:  We need to check if a user already exists before creating them
  
  PARAMS:
    - uid: The Firebase UID (string)
  
  RETURNS: 
    - The user data object if found
    - null if the user doesn't exist
*/
async function findUserByUid(uid) {
  console.log(`🔍 UserService: Looking for user with UID: ${uid}`);
  
  try {
    /*
      db.collection('users').doc(uid).get()
      
      ROLE: Fetch a single document by its ID
      WHY:  We use the UID as the document ID for direct lookup (O(1) operation)
      RETURNS: A DocumentSnapshot
    */
    const docRef = db.collection(USERS_COLLECTION).doc(uid);
    const docSnap = await docRef.get();
    
    /*
      docSnap.exists - Boolean indicating if the document exists
    */
    if (!docSnap.exists) {
      console.log(`📭 UserService: User ${uid} not found in Firestore`);
      return null;
    }
    
    console.log(`✅ UserService: Found user ${uid}`);
    
    /*
      docSnap.data() - Returns the document's data as a plain object
    */
    return docSnap.data();
    
  } catch (error) {
    console.error(`❌ UserService: Error finding user ${uid}:`, error);
    throw error;
  }
}


/*
  createUser(userData)
  
  ROLE: Create a new user document in Firestore
  WHY:  First-time users need a profile created in our database
  
  PARAMS:
    - userData: Object with user details (uid, email, displayName, etc.)
  
  RETURNS: The full user document that was created
  
  IMPORTANT:
    - Document ID = uid (Firebase UID)
    - This ensures 1:1 mapping between Firebase Auth and Firestore
*/
async function createUser(userData) {
  console.log(`📝 UserService: Creating new user: ${userData.uid}`);
  
  /*
    Build the complete user document
    
    We set sensible defaults for all fields here.
    This is the SINGLE place where user schema is defined.
  */
  const now = new Date();
  
  const newUser = {
    // Core Identity (from Firebase Auth)
    uid: userData.uid,
    email: userData.email || null,
    displayName: userData.displayName || null,
    photoURL: userData.photoURL || null,
    lastHeartbeatAt: null,
    
    // Auth Metadata
    authProvider: userData.authProvider || 'google',
    
    // Timestamps
    createdAt: now,
    lastLoginAt: now,
    
    // App-specific flags
    onboardingCompleted: false,
    role: roles.USER,
    dailyTimeLimitSec: 1800, // Default 30 mins
    dailyTimeUsedSec: 0,
    lastResetDate: new Date().toISOString().split('T')[0], // "YYYY-MM-DD"
    activeSessionId: null
  };
  
  try {
    /*
      db.collection('users').doc(uid).set(data)
      
      ROLE: Create or overwrite a document with a specific ID
      WHY:  We want the document ID to be the Firebase UID
            Using set() with the UID ensures no duplicates
    */
    const docRef = db.collection(USERS_COLLECTION).doc(newUser.uid);
    await docRef.set(newUser);
    
    console.log(`✅ UserService: User ${newUser.uid} created successfully`);
    
    return newUser;
    
  } catch (error) {
    console.error(`❌ UserService: Error creating user ${userData.uid}:`, error);
    throw error;
  }
}


/*
  updateLastLogin(uid)
  
  ROLE: Update the lastLoginAt timestamp for a returning user
  WHY:  Tracks user engagement and activity
  
  PARAMS:
    - uid: The Firebase UID (string)
  
  RETURNS: The updated timestamp
*/
async function updateLastLogin(uid) {
  console.log(`🕐 UserService: Updating lastLoginAt for user: ${uid}`);
  
  const now = new Date();
  
  try {
    /*
      db.collection('users').doc(uid).update(data)
      
      ROLE: Update specific fields without overwriting the whole document
      WHY:  We only want to change lastLoginAt, not reset everything
    */
    const docRef = db.collection(USERS_COLLECTION).doc(uid);
    await docRef.update({
      lastLoginAt: now
    });
    
    console.log(`✅ UserService: lastLoginAt updated for ${uid}`);
    
    return now;
    
  } catch (error) {
    console.error(`❌ UserService: Error updating lastLoginAt for ${uid}:`, error);
    throw error;
  }
}


/*
  getOrCreateUser(userData)
  
  ROLE: The main "sync" function — get user if exists, create if not
  WHY:  This is the logic called by /api/me
        It handles both first-time and returning users in one function
  
  PARAMS:
    - userData: Object with { uid, email, displayName, photoURL, authProvider }
  
  RETURNS: 
    - { user, isNewUser } 
    - user: The user document
    - isNewUser: Boolean indicating if this was a first-time login
*/
async function getOrCreateUser(userData) {
  // First, try to find existing user
  const existingUser = await findUserByUid(userData.uid);
  
  if (existingUser) {
    // Returning user: just update the login timestamp
    await updateLastLogin(userData.uid);
    
    return {
      user: {
        ...existingUser,
        lastLoginAt: new Date() // Return the updated timestamp
      },
      isNewUser: false
    };
  }
  
  // New user: create their profile
  const newUser = await createUser(userData);
  
  return {
    user: newUser,
    isNewUser: true
  };
}


/*
  [NEW] Helper: Check daily reset
  ROLE: If it's a new day, reset the user's used time to 0.
*/
async function checkAndResetDailyBudget(user) {
  const today = new Date().toISOString().split('T')[0];
  
  if (user.lastResetDate !== today) {
    console.log(`📅 New day detected for ${user.uid}. Resetting budget.`);
    // Reset usage and update date
    await db.collection(USERS_COLLECTION).doc(user.uid).update({
      dailyTimeUsedSec: 0,
      lastResetDate: today
    });
    return true; // Budget was reset
  }
  return false;
}

/*
  [NEW] startInterviewSession(uid)
  ROLE: Try to start a session. Fails if budget empty or already active.
*/
async function startInterviewSession(uid) {
  const user = await findUserByUid(uid);
  if (!user) throw new Error('User not found');

  // 1. Lazy Reset (Check if it's a new day)
  await checkAndResetDailyBudget(user);

  // 2. Refresh user data after potential reset
  // In a real app, you might optimize this, but for safety we re-fetch or just proceed
  // For simplicity, let's assume we proceed with the checked values.
  
  // 3. Check for Active Session (Moved to Step 5 with Zombie Logic)
  // We don't check here anymore because we need to check if it's a zombie first.

  // 4. Check Budget
  if (user.dailyTimeUsedSec >= user.dailyTimeLimitSec) {
    throw new Error('Daily time budget exceeded. Come back tomorrow!');
  }

  // 5. Lock the Session with Start Time
  const now = Date.now();
  const sessionId = `sess_${now}`;

  // [NEW] Zombie Check
  // If a session exists, check if it's dead (no heartbeat for 2 minutes)
  if (user.activeSessionId) {
    const lastHeartbeat = user.lastHeartbeatAt || 0; // Default to 0 if null
    const timeSinceHeartbeat = now - lastHeartbeat;
    const ZOMBIE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

    if (timeSinceHeartbeat > ZOMBIE_THRESHOLD_MS) {
      console.log(`🧟‍♂️ Zombie session detected for ${uid}. Overwriting...`);
      // It's a zombie, so we allow proceeding (we'll overwrite it below)
    } else {
      // It is a valid, active session. Block the new request.
      throw new Error('You already have an active session running.');
    }
  }
  
  await db.collection(USERS_COLLECTION).doc(uid).update({
    lastHeartbeatAt: now,
    activeSessionId: sessionId,
    currentSessionStartTime: now // [SECURITY] Store start time to prevent client spoofing
  });

  return sessionId;
}
async function updateHeartbeat(uid) {
   // Just update the timestamp to right now
   await db.collection(USERS_COLLECTION).doc(uid).update({
     lastHeartbeatAt: Date.now()
   });
}
/*
  [NEW] endInterviewSession(uid)
  ROLE: Conclusion. Deduct time and unlock.
  SECURITY: Calculates duration server-side to prevent tampering.
*/
async function endInterviewSession(uid) {
  const user = await findUserByUid(uid);
  
  if (!user.activeSessionId || !user.currentSessionStartTime) {
    console.warn(`⚠️ Security warning: User ${uid} tried to end invalid session`);
    return;
  }

  // Calculate actual duration
  const now = Date.now();
  const durationMs = now - user.currentSessionStartTime;
  const durationSec = Math.ceil(durationMs / 1000); // Round up to nearest second

  // Update time used and unlock (clear activeSessionId)
  const admin = require('firebase-admin'); 
  
  await db.collection(USERS_COLLECTION).doc(uid).update({
    dailyTimeUsedSec: admin.firestore.FieldValue.increment(durationSec),
    activeSessionId: null,
    currentSessionStartTime: null // Clear start time
  });
  
  console.log(`✅ Session ended for ${uid}. Used ${durationSec}s.`);
}
// =============================================================================
// EXPORTS
// =============================================================================

/*
  Export all service functions
  
  USAGE:
    const UserService = require('./services/user.service');
    const { user, isNewUser } = await UserService.getOrCreateUser(userData);
*/
module.exports = {
  findUserByUid,
  createUser,
  updateLastLogin,
  getOrCreateUser,
  startInterviewSession,
  endInterviewSession,
  checkAndResetDailyBudget,
  updateHeartbeat
};
