/*
================================================================================
AUTH GUARD COMPONENT
================================================================================
ROLE: This component acts as a "Bouncer" for your protected pages.
WHY:  Certain parts of our app (like the Dashboard) are private. We don't want 
      strangers seeing them! If someone isn't logged in, they shouldn't be here.
HOW:  It wraps around a protected component. 
      - If you are logged in: It lets you through (returns 'children').
      - If you are NOT logged in: It grabs you and sends you to the Login page.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  Navigate - A specialized component for redirection
  useLocation - A hook that tells us WHERE we are currently in the app
  
  ROLE: Navigate automatically changes the URL when it's rendered.
        useLocation helps us remember where the user was trying to go 
        so we can send them back there after they log in.
*/
import { Navigate, useLocation } from "react-router-dom";

/*
  useAuthStore - Access our global authentication state
*/
import useAuthStore from "../../store/auth.store";


// =============================================================================
// COMPONENT
// =============================================================================

function AuthGuard(props) {
  
  /*
    children - The content we are trying to protect
    
    In App.jsx, we use it like this: 
    <AuthGuard><DashboardPage /></AuthGuard>
    Here, <DashboardPage /> is the "children".
  */
  const children = props.children;

  // ===========================================================================
  // STATE ACCESS
  // ===========================================================================

  /*
    Retrieve user and loading status from our global store.
  */
  const user = useAuthStore(function (state) {
    return state.user;
  });
  
  const isLoading = useAuthStore(function (state) {
    return state.loading;
  });

  /*
    Capture the current URL path.
    We'll save this and pass it to the Login page so the app can say:
    "Oh, you were trying to visit the Dashboard? I'll send you back there 
    now that you've finished logging in."
  */
  const currentLocation = useLocation();


  // ===========================================================================
  // RENDER LOGIC
  // ===========================================================================

  /*
    CASE 1: Still Checking (Loading)
    
    Firebase needs a split second to check the user's cookies. 
    During this time, we show a clean "Authenticating..." spinner so the user 
    doesn't see a "flicker" of the login page or an empty screen.
  */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  /*
    CASE 2: No User (Access Denied)
    
    If the check is finished and 'user' is still null, it means they are logged out.
    We use <Navigate /> to force the browser to go to /login.
    
    We also pass the 'currentLocation' inside the 'state' prop. 
    This is like giving the login page a "return ticket".
  */
  if (!user) {
    console.log("🚫 AuthGuard: No user found, redirecting to login...");
    return (
      <Navigate 
        to="/login" 
        state={{ from: currentLocation }} 
        replace 
      />
    );
  }

  /*
    CASE 3: User Authenticated (Access Granted!)
    
    If we reached this point, the user is valid! 
    We simply return the 'children' (e.g., the Dashboard) and let them in.
  */
  console.log("✅ AuthGuard: User authenticated, showing content");
  return children;
}

export default AuthGuard;
