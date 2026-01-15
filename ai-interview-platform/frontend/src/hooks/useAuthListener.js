/*
================================================================================
CUSTOM HOOK: useAuthListener
================================================================================
ROLE: This hook starts the Firebase auth listener when our app loads.
WHY:  We want to automatically detect if a user is already logged in
      from a previous session (even after closing the browser).
HOW:  Uses React's useEffect to run code when the component mounts,
      and cleans up the listener when it unmounts.
================================================================================

WHAT IS A CUSTOM HOOK?
- A custom hook is just a function that uses other React hooks
- By convention, its name starts with "use"
- It lets us reuse stateful logic across components
- This hook doesn't return anything; it just sets up the listener
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  useEffect - React hook for side effects
  
  ROLE: Runs code when component mounts, updates, or unmounts
  WHY:  Starting a Firebase listener is a "side effect" (it's not rendering)
  HOW:  Takes a function to run, and optionally a "dependencies" array
*/
import { useEffect } from "react";

/*
  useAuthStore - Our Zustand store for auth state
  
  ROLE: Gives us access to the init() function
  WHY:  init() sets up the Firebase listener; we need to call it
*/
import useAuthStore from "../store/auth.store";


// =============================================================================
// THE HOOK
// =============================================================================

/*
  useAuthListener() - Starts listening for auth changes
  
  ROLE: When called, it sets up the Firebase auth listener
  WHY:  We call this once in App.jsx so the auth state is monitored globally
  HOW:  
    1. Gets the init function from our store
    2. Calls init() inside useEffect when component mounts
    3. Returns the unsubscribe function for cleanup
  
  USAGE:
    function App() {
      useAuthListener();  // Just call it at the top of App
      // ... rest of your component
    }
*/
function useAuthListener() {
  
  /*
    Get the init and fetchProfile functions from our auth store
    
    ROLE: 
      - init() starts the Firebase listener
      - fetchProfile() calls /api/me to sync with Firestore
  */
  const initFunction = useAuthStore(function (state) {
    return state.init;
  });
  
  const fetchProfileFunction = useAuthStore(function (state) {
    return state.fetchProfile;
  });

  /*
    Get the current user to know when to fetch the profile
  */
  const user = useAuthStore(function (state) {
    return state.user;
  });
  
  const loading = useAuthStore(function (state) {
    return state.loading;
  });

  /*
    Effect 1: Start the Firebase auth listener on mount
  */
  useEffect(function () {
    
    console.log("🎧 useAuthListener: Setting up Firebase auth listener...");

    const stopListening = initFunction();

    return function cleanup() {
      console.log("🧹 useAuthListener: Cleaning up auth listener...");
      stopListening();
    };

  }, []);

  /*
    Effect 2: Fetch profile from backend when user is detected
    
    ROLE: Sync the user with Firestore via /api/me
    WHY:  
      - First login: Creates the user in Firestore
      - Returning login: Updates lastLoginAt
      - Both: Populates the `profile` state with app-specific data
    
    WHEN: Runs after Firebase auth confirms we have a user
    DEPENDENCIES: [user, loading] - re-runs when these change
  */
  useEffect(function () {
    
    // Wait until Firebase finishes checking auth state
    if (loading) {
      return;
    }
    
    // Only fetch if we have a user
    if (user) {
      console.log("📡 useAuthListener: User detected, syncing with backend...");
      fetchProfileFunction();
    }
    
  }, [user, loading]);
  // ^^^ Re-runs when user or loading changes

}


// =============================================================================
// EXPORT
// =============================================================================

/*
  Export the hook as default
  
  USAGE:
    import useAuthListener from './hooks/useAuthListener';
    
    function App() {
      useAuthListener();  // Start listening for auth changes
      // ...
    }
*/
export default useAuthListener;
