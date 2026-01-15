/*
================================================================================
MAIN APP COMPONENT
================================================================================
ROLE: This is the root component of our entire application.
WHY:  React apps need one top-level component that contains everything else.
      This is like the "main()" function in other programming languages.
HOW:  We render different UI based on whether user is logged in or not.
================================================================================

COMPONENT FLOW:
1. useAuthListener() starts watching for auth changes
2. We check the loading state (show loading if still checking)
3. We check user state (show login button or welcome message)
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  useAuthListener - Our custom hook to start auth monitoring
  
  ROLE: Sets up Firebase auth listener when app loads
  WHY:  We need to know if user is already logged in from a previous session
*/
import useAuthListener from './hooks/useAuthListener';

/*
  useAuthStore - Our Zustand store for auth state
  
  ROLE: Gives us access to user and loading state
  WHY:  We need to check auth state to decide what to show
*/
import useAuthStore from './store/auth.store';

/*
  AuthService - Our service for login/logout operations
  
  ROLE: Handles the actual login/logout API calls
  WHY:  We call these when user clicks login/logout buttons
*/
import { AuthService } from './services/auth.service';


// =============================================================================
// THE COMPONENT
// =============================================================================

/*
  App() - The main application component
  
  ROLE: Renders the entire application
  WHY:  Every React app needs a root component
  HOW:  
    1. Start auth listener
    2. Check auth state
    3. Render appropriate UI
*/
function App() {
  
  /*
    Start the auth listener
    
    ROLE: Begins monitoring authentication state
    WHY:  We do this once when the app loads
          After this, our store will always know if user is logged in
    HOW:  Just calling the hook is enough - it sets up everything internally
  */
  useAuthListener();


  // ===========================================================================
  // GET STATE FROM STORE
  // ===========================================================================

  /*
    Get user from auth store
    
    ROLE: Access the current logged-in user (or null)
    WHY:  We need this to decide what to show
    HOW:  Pass a selector function to useAuthStore
          The selector picks out just the 'user' property
    
    SELECTOR EXPLANATION:
    - useAuthStore(state => state.user)
    - "state" is the entire store: { user, loading, error, init, logout, ... }
    - "state.user" is just the user part
    - This is more efficient than getting the whole store
  */
  const user = useAuthStore(function (state) {
    return state.user;
  });
  
  /*
    Get loading state from auth store
    
    ROLE: Check if we're still determining auth status
    WHY:  We show a loading screen while Firebase checks for existing sessions
  */
  const isLoading = useAuthStore(function (state) {
    return state.loading;
  });


  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================
  // These functions run when user interacts with buttons

  /*
    handleLogin() - Called when user clicks "Sign in with Google"
    
    ROLE: Starts the Google login process
    WHY:  User wants to log in
    HOW:  Calls our AuthService which handles the Firebase API call
  */
  function handleLogin() {
    console.log("👆 User clicked login button");
    AuthService.loginWithGoogle();
    // Note: The auth listener in useAuthListener will detect when login succeeds
    // and automatically update the store, which triggers a re-render
  }

  /*
    handleLogout() - Called when user clicks "Logout"
    
    ROLE: Signs the user out
    WHY:  User wants to log out
    HOW:  Calls our AuthService which handles the Firebase signOut
  */
  function handleLogout() {
    console.log("👆 User clicked logout button");
    AuthService.logout();
    // Note: Same as above - auth listener will detect the logout
  }


  // ===========================================================================
  // RENDER LOGIC
  // ===========================================================================

  /*
    CASE 1: Still loading
    
    ROLE: Show a loading screen
    WHY:  Firebase is checking if there's an existing session
          We don't know yet if user is logged in
    HOW:  Return early with loading UI
    
    "EARLY RETURN" PATTERN:
    - If a condition is met, we return immediately
    - The rest of the function doesn't run
    - This keeps code cleaner than nested if/else
  */
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  /*
    MAIN RENDER
    
    ROLE: Show the main app UI
    HOW:  We use conditional rendering to show different content
          based on whether user is logged in
  */
  return (
    <div style={styles.container}>
      
      {/* App Title */}
      <h1 style={styles.title}>AI Interview Platform</h1>

      {/*
        CONDITIONAL RENDERING with ternary operator
        
        SYNTAX: condition ? (if true) : (if false)
        
        ROLE: Show different content based on user state
        WHY:  Logged-in users see their profile; others see login button
        HOW:  
          - If user exists (truthy), show the welcome card
          - If user is null/undefined (falsy), show the login card
        
        NOTE: In JavaScript, null and undefined are "falsy"
              An object like { name: "John" } is "truthy"
      */}
      {user ? (
        
        // ==== USER IS LOGGED IN ====
        <div style={styles.card}>
          
          {/*
            User's profile image
            
            ROLE: Show the user's Google profile picture
            HOW:  user.photoURL comes from Google
                  || is the "OR" operator - if photoURL is null, use placeholder
          */}
          <img
            src={user.photoURL || "https://via.placeholder.com/150"}
            alt="Profile"
            style={styles.profileImage}
          />
          
          {/*
            Welcome message with user's name
            
            ROLE: Personalized greeting
            HOW:  {user.displayName} inserts the value into the JSX
                  (This is called "string interpolation" in JSX)
          */}
          <h2 style={styles.userName}>Welcome, {user.displayName}!</h2>
          
          {/* User's email */}
          <p style={styles.userEmail}>{user.email}</p>
          
          {/*
            Logout button
            
            ROLE: Let user sign out
            HOW:  onClick={handleLogout} calls our handler when clicked
          */}
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
        
      ) : (
        
        // ==== USER IS NOT LOGGED IN ====
        <div style={styles.card}>
          
          <p style={styles.cardText}>Please sign in to continue.</p>
          
          {/*
            Login button
            
            ROLE: Let user sign in with Google
            HOW:  onClick={handleLogin} calls our handler when clicked
          */}
          <button onClick={handleLogin} style={styles.loginButton}>
            Sign in with Google
          </button>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// STYLES
// =============================================================================

/*
  styles object - CSS-in-JS approach
  
  ROLE: Defines the visual appearance of our component
  WHY:  Keeping styles close to the component makes it self-contained
  HOW:  We pass these objects to the "style" prop of elements
  
  NOTE: In CSS-in-JS, property names use camelCase instead of kebab-case
        - backgroundColor instead of background-color
        - fontSize instead of font-size
*/
const styles = {
  // Main container - full screen with centered content
  container: {
    minHeight: "100vh",           // At least full viewport height
    backgroundColor: "#f3f4f6",   // Light gray background
    display: "flex",              // Flexbox layout
    flexDirection: "column",      // Stack children vertically
    alignItems: "center",         // Center horizontally
    justifyContent: "center",     // Center vertically
    padding: "20px"               // Some breathing room
  },
  
  // App title
  title: {
    fontSize: "2rem",             // Large text
    fontWeight: "bold",
    marginBottom: "2rem",         // Space below
    color: "#2563eb"              // Blue color
  },
  
  // Loading screen container
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f3f4f6"
  },
  
  // Loading text
  loadingText: {
    fontSize: "1.25rem",
    fontWeight: "600"
  },
  
  // Card container (for both logged in and logged out states)
  card: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "8px",          // Rounded corners
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",  // Subtle shadow
    textAlign: "center"
  },
  
  // User profile image
  profileImage: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",          // Make it circular
    marginBottom: "16px"
  },
  
  // User's name
  userName: {
    fontSize: "1.25rem",
    fontWeight: "bold",
    marginBottom: "8px"
  },
  
  // User's email
  userEmail: {
    color: "#6b7280",             // Gray color
    marginBottom: "16px"
  },
  
  // Text in the login card
  cardText: {
    color: "#374151",
    marginBottom: "16px"
  },
  
  // Login button (blue)
  loginButton: {
    padding: "10px 20px",
    backgroundColor: "#2563eb",   // Blue
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",            // Show pointer on hover
    fontSize: "1rem"
  },
  
  // Logout button (red)
  logoutButton: {
    padding: "10px 20px",
    backgroundColor: "#ef4444",   // Red
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem"
  }
};


// =============================================================================
// EXPORT
// =============================================================================

/*
  Default export
  
  ROLE: Makes this component available to other files
  WHY:  main.jsx needs to import and render this component
  HOW:  Other files can do: import App from './App'
*/
export default App;