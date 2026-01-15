/*
================================================================================
AUTH GUARD COMPONENT
================================================================================
ROLE: This component protects routes that require authentication.
WHY:  Some pages should only be visible to logged-in users (like Dashboard).
      If someone tries to visit these pages without logging in, we redirect them.
HOW:  It wraps around protected content and checks if user is logged in.
================================================================================

USAGE:
  <AuthGuard>
    <Dashboard />   {/* Only visible to logged-in users */}
  </AuthGuard>

THIS IS CALLED A "HIGHER-ORDER COMPONENT" (HOC) PATTERN:
  - It takes some components as children
  - It adds extra logic (checking auth)
  - It either renders the children or redirects
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  Navigate - Component that redirects to another page
  
  ROLE: Programmatically navigates to a different route
  WHY:  If user isn't logged in, we want to send them to /login
  HOW:  <Navigate to="/login" /> immediately redirects to /login
*/
import { Navigate, useLocation } from "react-router-dom";

/*
  useLocation - Hook to get current URL location
  
  ROLE: Tells us what page the user is trying to visit
  WHY:  After they log in, we want to redirect them BACK to where they wanted to go
  HOW:  Returns { pathname, search, hash, state, key }
*/

/*
  useAuthStore - Our Zustand store for auth state
  
  ROLE: Gives us access to user and loading state
  WHY:  We need to check if user is logged in
*/
import useAuthStore from "../../store/auth.store";


// =============================================================================
// THE COMPONENT
// =============================================================================

/*
  AuthGuard(props) - Protected route wrapper component
  
  ROLE: Wraps content that should only be visible to authenticated users
  WHY:  Security - we don't want unauthorized users seeing private pages
  HOW:
    1. Check if we're still loading (checking auth status)
       - If yes, show loading spinner
    2. Check if user is logged in
       - If no, redirect to /login
    3. If user is logged in
       - Render the children (the protected content)
  
  PROPS:
    - children: The content to show if user is logged in
                Example: <AuthGuard><Dashboard /></AuthGuard>
                Here, <Dashboard /> is the children
*/
function AuthGuard(props) {
  
  /*
    Extract children from props
    
    ROLE: Get the content we're supposed to protect
    WHY:  Whatever is inside <AuthGuard>...</AuthGuard> becomes props.children
    
    EXAMPLE:
      <AuthGuard>
        <SecretPage />
      </AuthGuard>
      
      Here, props.children = <SecretPage />
  */
  const children = props.children;

  /*
    Get user from the auth store
    
    ROLE: Check if someone is logged in
    WHY:  We need to know if we should show the content or redirect
    HOW:  useAuthStore takes a selector function
          state => state.user means "give me just the user property"
  */
  const user = useAuthStore(function (state) {
    return state.user;
  });
  
  /*
    Get loading state from the auth store
    
    ROLE: Check if we're still determining auth status
    WHY:  On app load, we don't immediately know if user is logged in
          Firebase needs a moment to check
          We don't want to redirect during this check
  */
  const isLoading = useAuthStore(function (state) {
    return state.loading;
  });

  /*
    Get current location (URL)
    
    ROLE: Remember where the user was trying to go
    WHY:  After login, we can redirect them back here
    HOW:  We pass this to the login page in the state
          The login page can then redirect here after successful login
  */
  const currentLocation = useLocation();


  // ===========================================================================
  // RENDER LOGIC
  // ===========================================================================

  /*
    CASE 1: Still loading
    
    ROLE: Show loading indicator while we check auth status
    WHY:  On first load, Firebase needs time to check if there's an active session
          (The user might already be logged in from before)
          If we immediately redirected, logged-in users would briefly see login page
    HOW:  Return a simple loading UI
  */
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Checking authentication...</p>
      </div>
    );
  }

  /*
    CASE 2: Not logged in
    
    ROLE: Redirect to login page
    WHY:  User is trying to access protected content without being logged in
    HOW:  Render a <Navigate> component which causes a redirect
    
    IMPORTANT PROPS:
    - to="/login": Where to redirect
    - state={{ from: currentLocation }}: Pass current location to login page
      This lets login page redirect back here after login
    - replace: Replace current history entry instead of adding new one
      This prevents "back button loops" (clicking back just goes to login again)
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
    CASE 3: User is logged in
    
    ROLE: Show the protected content
    WHY:  User has passed the auth check, they're allowed to see this
    HOW:  Just return the children (the content inside <AuthGuard>)
  */
  console.log("✅ AuthGuard: User authenticated, showing content");
  return children;
}


// =============================================================================
// STYLES
// =============================================================================

/*
  Inline styles object
  
  ROLE: Defines the CSS styles for our loading state
  WHY:  Simple approach for small components (no external CSS needed)
  HOW:  We pass these to the "style" prop of elements
*/
const styles = {
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",       // Full viewport height
    backgroundColor: "#f3f4f6"
  },
  loadingText: {
    fontSize: "1.25rem",
    color: "#374151"
  }
};


// =============================================================================
// EXPORT
// =============================================================================

/*
  Default export
  
  USAGE:
    import AuthGuard from './components/shared/AuthGuard';
    
    // In your routing:
    <AuthGuard>
      <ProtectedPage />
    </AuthGuard>
*/
export default AuthGuard;
