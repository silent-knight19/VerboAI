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
    Get the init function from our auth store
    
    ROLE: We need init() to start the Firebase listener
    WHY:  The listener is defined in the store, not here
    HOW:  useAuthStore takes a "selector" function that picks what we want
          state => state.init means "give me the init function"
  */
  const initFunction = useAuthStore(function (state) {
    return state.init;
  });

  /*
    useEffect - Run side effect code
    
    ROLE: Set up the auth listener when component mounts
    WHY:  We can't just call init() directly because:
          - It would run on every re-render
          - We need to clean up when component unmounts
    HOW:
      1. First argument: a function containing our code
      2. Second argument: dependency array []
         - [] means "run this only once when component mounts"
         - If we put [initFunction], it would re-run if initFunction changes
  */
  useEffect(function () {
    
    console.log("🎧 useAuthListener: Setting up Firebase auth listener...");

    /*
      Call init() to start the listener
      
      ROLE: This starts Firebase watching for auth changes
      WHY:  Firebase will tell us if user is logged in
      HOW:  init() returns an "unsubscribe" function (to stop listening later)
    */
    const stopListening = initFunction();

    /*
      Return a cleanup function
      
      ROLE: Stops the listener when component unmounts
      WHY:  Prevents MEMORY LEAKS
            - If we don't clean up, the listener keeps running forever
            - Even after the component is gone, it would still be active
            - This wastes memory and can cause bugs
      HOW:  Whatever function we return from useEffect runs on cleanup
            React calls this when:
            - The component unmounts (disappears from screen)
            - Before re-running the effect (if dependencies change)
    */
    return function cleanup() {
      console.log("🧹 useAuthListener: Cleaning up auth listener...");
      stopListening();
    };

  }, []);
  // ^^^ Empty array [] = run only once on mount
  // If we wanted to re-run when something changes, we'd put that variable here

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
