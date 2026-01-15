/*
================================================================================
FIREBASE ADMIN SDK CONFIGURATION
================================================================================
ROLE: Initialize the Firebase Admin SDK for backend server use.
WHY:  The backend needs to VERIFY ID tokens sent by the frontend.
      Unlike the frontend SDK, Admin SDK has special privileges:
      - Verify tokens
      - Access Firestore with admin rights
      - Manage users
HOW:  We initialize using service account credentials from environment variables.
================================================================================

DIFFERENCE: FIREBASE SDK vs FIREBASE ADMIN SDK
- Firebase SDK (frontend): For end-users, limited permissions, runs in browser.
- Firebase Admin SDK (backend): For servers, full access, verifies tokens.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  firebase-admin - The server-side Firebase SDK
  
  ROLE: Provides methods like auth().verifyIdToken()
  WHY:  We need to verify that the tokens sent by frontend are real
*/
const admin = require('firebase-admin');

/*
  dotenv - For reading environment variables
  
  ROLE: Load .env file into process.env
  NOTE: This should already be called in index.js, but we ensure it here too
*/
require('dotenv').config();


// =============================================================================
// SERVICE ACCOUNT CONFIGURATION
// =============================================================================

/*
  Service Account Credentials
  
  ROLE: Authenticate our server with Firebase
  WHY:  Firebase needs to know this is OUR server, not an imposter
  HOW:  We use a service account (like a robot user for our server)
  
  WHERE TO GET THESE VALUES:
  1. Go to Firebase Console → Project Settings → Service Accounts
  2. Click "Generate new private key"
  3. Download the JSON file
  4. Copy the values into your .env file
  
  NEVER COMMIT THE ACTUAL VALUES TO GIT!
*/
const serviceAccount = {
  
  /*
    projectId - Your Firebase project identifier
    Example: "my-interview-platform-123"
  */
  projectId: process.env.FIREBASE_PROJECT_ID,
  
  /*
    clientEmail - The service account's email address
    Example: "firebase-adminsdk-xxxxx@my-project.iam.gserviceaccount.com"
  */
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  
  /*
    privateKey - The RSA private key for signing
    
    IMPORTANT: The key in .env may have literal "\n" strings or \\n.
               We need to replace them with actual newline characters.
    
    WHY: Environment variables don't support real newlines easily,
         so we store them as "\n" text and convert here.
         
    HANDLING BOTH FORMATS:
    - If the .env file has: "...KEY...\n..."  → dotenv reads it as literal \n
    - If copied directly: "...KEY...\\n..."   → needs double replacement
  */
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY
        .replace(/\\n/g, '\n')  // Handle literal \n (most common)
    : undefined
};


// =============================================================================
// INITIALIZATION
// =============================================================================

/*
  Check if already initialized
  
  ROLE: Prevent "app already exists" errors
  WHY:  If this file is imported multiple times, we don't want to re-initialize
  HOW:  admin.apps is an array of initialized apps; if empty, initialize
*/
if (!admin.apps.length) {
  
  /*
    Validate that we have credentials
    
    ROLE: Fail early with a clear message if env vars are missing
    WHY:  Better than a cryptic Firebase error later
  */
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('❌ Firebase Admin SDK: Missing environment variables!');
    console.error('   Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
    console.error('   See .env.example for the format.');
    // We don't throw here to allow the server to start for debugging
    // But auth will fail if these are missing
  } else {
    
    /*
      admin.initializeApp(config)
      
      ROLE: Initialize the Admin SDK with our credentials
      HOW:  Pass the service account via admin.credential.cert()
    */
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully');
  }
}


// =============================================================================
// EXPORTS
// =============================================================================

/*
  Export the admin object and a getter for the auth instance
  
  WHY USE A GETTER?
  If we call admin.auth() directly here and the app isn't initialized 
  (e.g., missing env vars), the whole server crashes on startup.
  A getter allows the server to start even if auth config is missing,
  failing only when an actual auth request is made.
*/
module.exports = {
  admin,
  get auth() {
    try {
      return admin.auth();
    } catch (err) {
      console.error('❌ Firebase Auth: Could not get auth instance. Is the app initialized?');
      throw err;
    }
  },
  /*
    db - Firestore database instance
    
    ROLE: Access Firestore collections and documents
    WHY:  We need to store/retrieve user profiles and app data
    HOW:  admin.firestore() returns the Firestore instance
  */
  get db() {
    try {
      return admin.firestore();
    } catch (err) {
      console.error('❌ Firebase Firestore: Could not get db instance. Is the app initialized?');
      throw err;
    }
  }
};
