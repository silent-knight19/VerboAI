/*
================================================================================
AUTHENTICATION SERVICE
================================================================================
ROLE: This file handles all the actual login/logout API calls to Firebase.
WHY:  We separate this from components so:
      - Components stay focused on UI (displaying things)
      - Business logic (talking to Firebase) is in one place
      - If we want to change how login works, we only change this file
HOW:  We create an object with methods that call Firebase Auth functions
================================================================================

THIS IS THE "SERVICE LAYER" PATTERN:
- Components call these methods
- These methods talk to Firebase
- Components don't need to know HOW Firebase works
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  GoogleAuthProvider - Creates a Google login provider
  
  ROLE: Tells Firebase we want to log in using Google
  WHY:  Firebase supports many login methods (email, phone, Facebook, etc.)
        We need to specify which one we're using
  HOW:  We create a new instance: new GoogleAuthProvider()
*/
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

/*
  signInWithPopup - Opens a popup for login
  
  ROLE: Opens a popup window where user selects their Google account
  WHY:  This is the most user-friendly way to log in with Google
        (Alternative: signInWithRedirect, which redirects to Google's site)
  HOW:  signInWithPopup(auth, provider) -> Promise<UserCredential>
*/

/*
  signOut - Logs the user out
  
  ROLE: Tells Firebase to end the user's session
  WHY:  Users need a way to log out
  HOW:  signOut(auth) -> Promise<void>
*/

/*
  auth - Our Firebase auth instance
  
  ROLE: Reference to our Firebase Authentication service
  WHY:  All auth functions need this as their first argument
*/
import { auth } from "./firebase";


// =============================================================================
// AUTH SERVICE OBJECT
// =============================================================================

/*
  AuthService - Object containing all authentication methods
  
  ROLE: Provides a clean interface for login/logout operations
  WHY:  Grouping related functions in an object keeps code organized
  HOW:  Components import this and call AuthService.loginWithGoogle()
  
  USAGE:
    import { AuthService } from './services/auth.service';
    
    // In a button click handler:
    AuthService.loginWithGoogle();
*/
const AuthService = {
  
  /*
    loginWithGoogle() - Logs in using Google account
    
    ROLE: Opens Google login popup and returns the user
    WHY:  Google login is easy for users (no password to remember)
    HOW:
      1. Create a GoogleAuthProvider instance
      2. Call signInWithPopup() which opens the popup
      3. User selects their Google account
      4. Firebase returns the user data
      5. We return the user (or throw error if something went wrong)
    
    RETURNS: The logged-in user object
    THROWS: Error if login fails (user closed popup, network error, etc.)
    
    NOTE: This is async/await because signInWithPopup is asynchronous
          - It takes time (user has to click things in the popup)
          - We use "await" to wait for it to complete
  */
  loginWithGoogle: async function () {
    console.log("🔐 AuthService: Attempting Google login...");
    
    /*
      Create a Google provider
      
      ROLE: Configures what login method we're using
      WHY:  We could also use FacebookAuthProvider, GithubAuthProvider, etc.
    */
    const googleProvider = new GoogleAuthProvider();
    
    /*
      try/catch block
      
      ROLE: Handles errors gracefully
      WHY:  Many things can go wrong (network issues, user cancels, etc.)
            Without try/catch, errors would crash the app
      HOW:  
        - Code in "try" runs normally
        - If an error occurs, execution jumps to "catch"
        - We can then log the error and show a message to the user
    */
    try {
      
      /*
        signInWithPopup(auth, provider)
        
        ROLE: Opens popup and waits for user to log in
        WHY:  This is Firebase's built-in method for popup login
        HOW:
          - Opens a new browser window/popup
          - Popup shows Google's login page
          - User selects their account
          - Firebase handles the OAuth dance
          - Returns a "result" object with user data
        
        AWAIT: We use "await" because this takes time
               JavaScript would normally continue without waiting
               "await" pauses here until the popup is done
      */
      const result = await signInWithPopup(auth, googleProvider);
      
      /*
        result.user - The logged-in user object
        
        ROLE: Contains all the user's information from Google
        STRUCTURE: {
          uid: "unique-id-123",
          email: "user@gmail.com",
          displayName: "John Doe",
          photoURL: "https://...",
          // ... more properties
        }
      */
      const user = result.user;
      
      console.log("✅ AuthService: Login successful!", user.displayName);
      
      // Return the user so the calling code can use it
      return user;
      
    } catch (error) {
      
      /*
        Handle login errors
        
        Common errors:
        - auth/popup-closed-by-user: User closed the popup without logging in
        - auth/network-request-failed: No internet connection
        - auth/cancelled-popup-request: Another popup was already open
      */
      console.error("❌ AuthService: Login failed:", error.message);
      
      /*
        Re-throw the error
        
        ROLE: Lets the calling code handle the error too
        WHY:  The component that called this might want to show an error message
        HOW:  "throw error" passes the error up to whoever called this function
      */
      throw error;
    }
  },

  /*
    logout() - Signs out the current user
    
    ROLE: Ends the user's session
    WHY:  Users need a way to log out for privacy/security
    HOW:
      1. Call Firebase's signOut(auth)
      2. Firebase clears the session
      3. The auth listener in auth.store.js will detect this
      4. The store will update user to null
    
    NOTE: Even though we set user=null in the store's logout(),
          sometimes components call this service directly
  */
  logout: async function () {
    console.log("🚪 AuthService: Logging out...");
    
    try {
      
      /*
        signOut(auth)
        
        ROLE: Tells Firebase to end the session
        WHY:  Clears cookies/tokens that keep user logged in
        HOW:  Firebase handles all the cleanup
      */
      await signOut(auth);
      
      console.log("✅ AuthService: Logout successful!");
      
    } catch (error) {
      console.error("❌ AuthService: Logout failed:", error.message);
      throw error;
    }
  }
};


// =============================================================================
// EXPORT
// =============================================================================

/*
  Named export - We export AuthService as a named export
  
  USAGE:
    import { AuthService } from './services/auth.service';
    
    // Call methods:
    AuthService.loginWithGoogle();
    AuthService.logout();
*/
export { AuthService };
