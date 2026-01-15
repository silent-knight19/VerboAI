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
    
    // Auth Metadata
    authProvider: userData.authProvider || 'google',
    
    // Timestamps
    createdAt: now,
    lastLoginAt: now,
    
    // App-specific flags
    onboardingCompleted: false,
    role: 'user'
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
  getOrCreateUser
};
