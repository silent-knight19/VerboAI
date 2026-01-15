/*
================================================================================
FIREBASE CONFIGURATION FILE
================================================================================
ROLE: This file connects our app to Firebase (Google's backend service).
WHY:  We need a central place to set up Firebase once and export it everywhere.
HOW:  We configure Firebase with our project keys and export ready-to-use services.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  initializeApp - Function to start up Firebase in our app
  ROLE: Takes our config and creates a Firebase "app instance"
  WHY:  Firebase needs to be initialized before we can use any of its services
  HOW:  We call it once with our config object, and it returns an app we can use
*/
import { initializeApp } from "firebase/app";

/*
  getAuth - Function to get Firebase Authentication service
  ROLE: Lets users sign in/out with email, Google, etc.
  WHY:  We need to verify who the user is before letting them use our app
  HOW:  It takes our app instance and returns an "auth" object we can use
*/
import { getAuth } from "firebase/auth";

/*
  getFirestore - Function to get Firebase Database service
  ROLE: Stores and retrieves data (like user profiles, interview history)
  WHY:  We need somewhere to save data that persists even after refresh
  HOW:  Returns a "db" object we can use to read/write documents
*/
import { getFirestore } from "firebase/firestore";

/*
  getStorage - Function to get Firebase Storage service
  ROLE: Stores files like images, audio recordings, etc.
  WHY:  Databases are for text data; files need special storage
  HOW:  Returns a "storage" object for uploading/downloading files
*/
import { getStorage } from "firebase/storage";


// =============================================================================
// CONFIGURATION
// =============================================================================

/*
  firebaseConfig - Our project's unique settings from Firebase Console
  
  ROLE: Tells Firebase which project to connect to
  WHY:  Firebase hosts millions of projects; these keys identify ours
  HOW:  We get these values from Firebase Console > Project Settings
  
  SECURITY NOTE:
  - We store these in environment variables (.env file)
  - import.meta.env is how Vite lets us access .env values
  - The "VITE_" prefix is required for Vite to expose these variables
*/
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // apiKey: Used for API requests, like a password for our project
  
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // authDomain: The URL where Google login popup appears
  
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // projectId: Unique name of our Firebase project
  
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  // storageBucket: URL where our files are stored
  
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  // messagingSenderId: ID for push notifications (optional)
  
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // appId: Unique identifier for this specific app
  
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  // measurementId: For Google Analytics (optional)
};


// =============================================================================
// INITIALIZATION
// =============================================================================

/*
  initializeApp(firebaseConfig)
  
  ROLE: Creates and configures our Firebase app instance
  WHY:  This is the "starting point" - all other Firebase services need this
  HOW:  
    1. Takes our config object
    2. Connects to Firebase servers
    3. Returns an "app" object representing our project
*/
const firebaseApp = initializeApp(firebaseConfig);


// =============================================================================
// SERVICE EXPORTS
// =============================================================================
// We create each service once here, then export them for use anywhere in our app.
// This pattern is called "singleton" - there's only ONE instance of each service.

/*
  auth - Firebase Authentication instance
  
  ROLE: Handles all login/logout operations
  WHY:  We export this so any file can check if user is logged in
  HOW:  Other files import this and call methods like signInWithPopup(auth, ...)
*/
export const auth = getAuth(firebaseApp);

/*
  db - Firebase Firestore database instance
  
  ROLE: Handles all database read/write operations
  WHY:  We export this so any file can save or load data
  HOW:  Other files import this and call methods like getDoc(db, "collection", "id")
*/
export const db = getFirestore(firebaseApp);

/*
  storage - Firebase Storage instance
  
  ROLE: Handles file uploads and downloads
  WHY:  We export this so any file can save or load files
  HOW:  Other files import this and call methods like uploadBytes(storage, file)
*/
export const storage = getStorage(firebaseApp);

/*
  default export - The Firebase app itself
  
  ROLE: Sometimes we need the raw app for advanced configurations
  WHY:  Some Firebase features require the app instance directly
  HOW:  import firebaseApp from './firebase' (without curly braces)
*/
export default firebaseApp;