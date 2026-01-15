/*
================================================================================
AUTHENTICATION STORE (Using Zustand)
================================================================================
ROLE: This file manages our app's authentication state globally.
WHY:  Instead of passing user data through every component (prop drilling),
      we store it in one place that any component can access.
HOW:  We use Zustand, a simple state management library, to create a "store".
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  create - Function from Zustand to create a new store
  
  ROLE: Creates a global state container
  WHY:  Zustand is simpler than Redux, perfect for beginners
  HOW:  We call create() with a function that returns our state and actions
*/
import { create } from 'zustand';

/*
  auth - Our Firebase auth instance from firebase.js
  
  ROLE: Gives us access to Firebase Authentication
  WHY:  We need it to listen for auth changes and sign out
*/
import { auth } from '../services/firebase';

/*
  onAuthStateChanged - Firebase function to listen for login/logout
  signOut - Firebase function to log the user out
  
  ROLE: onAuthStateChanged tells us whenever auth state changes
  WHY:  Users can be logged in from a previous session (cookies/local storage)
        We need to detect this when the app loads
  HOW:  It's like a subscription - Firebase calls our callback whenever something changes
*/
import { onAuthStateChanged, signOut } from 'firebase/auth';

/*
  ApiService - Our HTTP client for backend calls
  
  ROLE: Used to call /api/me to fetch the Firestore profile
*/
import { ApiService } from '../services/api.service';


// =============================================================================
// CREATE THE STORE
// =============================================================================

/*
  useAuthStore - Our custom Zustand store for authentication
  
  ROLE: Holds the current user, loading state, and auth-related functions
  WHY:  Any component can import useAuthStore and access the user
  HOW:  create() takes a function with "set" parameter
        - "set" is how we update the store's state
        - We return an object with our state values and action functions

  USAGE IN COMPONENTS:
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);
*/
const useAuthStore = create(function (set) {

  // This object is what gets stored
  return {
    
    // =========================================================================
    // STATE VALUES (Data we're keeping track of)
    // =========================================================================

    /*
      user - The currently logged-in user's data (or null if logged out)
      
      ROLE: Stores the user object from Firebase
      WHY:  Components need this to show user's name, photo, email, etc.
      STRUCTURE: { uid, email, displayName, photoURL, ... }
    */
    user: null,
    
    /*
      loading - Whether we're still checking if someone is logged in
      
      ROLE: Prevents flickering when app first loads
      WHY:  Firebase takes a moment to check if user has an active session
            During this time, we show "Loading..." instead of login page
      HOW:  Starts as true, becomes false once Firebase tells us the user state
    */
    loading: true,
    
    /*
      error - Stores any error messages
      
      ROLE: Holds error info if something goes wrong
      WHY:  We can display this to the user (like "Login failed")
    */
    error: null,

    /*
      profile - The user's profile from Firestore (via /api/me)
      
      ROLE: Contains app-specific data like role, onboardingCompleted, credits
      WHY:  Firebase Auth only knows identity; Firestore knows the "product user"
      STRUCTURE: { uid, email, displayName, role, onboardingCompleted, ... }
    */
    profile: null,

    /*
      profileLoading - Whether we're fetching the profile from the backend
      
      ROLE: Allows the UI to show a loading state during profile fetch
    */
    profileLoading: false,


    // =========================================================================
    // ACTION FUNCTIONS (Functions that change the state)
    // =========================================================================

    /*
      init() - Starts listening for authentication changes
      
      ROLE: Sets up a "listener" that watches for login/logout events
      WHY:  Firebase can automatically log in users from previous sessions
            We need to detect this when the app starts
      HOW:  
        1. We call onAuthStateChanged(auth, callback)
        2. Firebase calls our callback immediately with current user (or null)
        3. Firebase calls our callback again whenever user logs in/out
        4. We update our store with set({ user, loading: false })
      
      RETURNS: An "unsubscribe" function to stop listening
               (Important for cleanup when component unmounts)
    */
    init: function () {
      console.log("🔄 Starting auth listener...");
      
      // onAuthStateChanged returns a function to stop listening
      const stopListening = onAuthStateChanged(auth, function (currentUser) {
        
        // This runs whenever auth state changes (login, logout, or on app load)
        if (currentUser) {
          console.log("✅ User detected:", currentUser.displayName);
        } else {
          console.log("❌ No user logged in");
        }
        
        // Update our store with the user (or null) and mark loading as done
        set({
          user: currentUser,
          loading: false
        });
      });

      // Return the cleanup function
      return stopListening;
    },

    /*
      setUser(newUser) - Manually update the user
      
      ROLE: Directly set the user state
      WHY:  Rarely needed, but useful if we need to update user data manually
      HOW:  Just calls set() with the new user object
    */
    setUser: function (newUser) {
      set({ user: newUser });
    },

    /*
      logout() - Signs the user out
      
      ROLE: Logs the user out of Firebase
      WHY:  Users need a way to sign out of the app
      HOW:  
        1. Calls Firebase's signOut(auth)
        2. On success, clears the user from our store
        3. On error, stores the error message
      
      NOTE: This is an "async" function because signOut is asynchronous
            (it talks to Firebase servers, which takes time)
    */
    logout: async function () {
      console.log("🚪 Attempting to log out...");
      
      try {
        // Tell Firebase to sign out the current user
        await signOut(auth);
        
        // Clear user AND profile from our store
        set({ user: null, profile: null });
        
        console.log("✅ Logout successful");
        
      } catch (err) {
        // Something went wrong
        console.error("❌ Logout failed:", err);
        
        // Store the error so UI can display it
        set({ error: err.message });
      }
    },

    /*
      setProfile(data) - Manually set the profile
      
      ROLE: Update the profile state directly
      WHY:  Used by fetchProfile or when we need to update profile data
    */
    setProfile: function (profileData) {
      set({ profile: profileData });
    },

    /*
      fetchProfile() - Fetch the user's profile from the backend
      
      ROLE: Calls GET /api/me to sync with Firestore
      WHY:  This is how we get the "product user" data (role, onboarding, etc.)
            It also triggers user creation on first login!
      HOW:
        1. Set profileLoading to true
        2. Call ApiService.get('/api/me')
        3. Store the returned profile
        4. Handle errors gracefully
    */
    fetchProfile: async function () {
      console.log("📥 AuthStore: Fetching profile from backend...");
      
      set({ profileLoading: true });
      
      try {
        const response = await ApiService.get('/api/me');
        
        if (response.success && response.user) {
          console.log("✅ AuthStore: Profile received", response.user.uid);
          
          set({
            profile: response.user,
            profileLoading: false
          });
          
          if (response.isNewUser) {
            console.log("🎉 AuthStore: This is a new user!");
          }
          
          return response.user;
        } else {
          throw new Error('Invalid response from /api/me');
        }
        
      } catch (err) {
        console.error("❌ AuthStore: Failed to fetch profile:", err);
        
        set({
          profileLoading: false,
          error: err.message || 'Failed to load profile'
        });
        
        return null;
      }
    },

    /*
      clearError() - Removes any stored error
      
      ROLE: Clears the error state
      WHY:  After showing an error, we may want to clear it
            (For example, when user closes an error popup)
      HOW:  Simply sets error back to null
    */
    clearError: function () {
      set({ error: null });
    }
  };
});


// =============================================================================
// EXPORT
// =============================================================================

/*
  Export the store as default export
  
  USAGE:
    import useAuthStore from './store/auth.store';
    
    // In a component:
    const user = useAuthStore(state => state.user);
    const { user, loading, logout } = useAuthStore();
*/
export default useAuthStore;