/*
================================================================================
MAIN ROUTER (App.jsx)
================================================================================
ROLE: This is the "Traffic Controller" of our application.
WHY:  We need a way to show different pages for different URLs.
      - /login  -> Show LoginPage
      - /       -> Show DashboardPage (but only if logged in)

HOW:  We use React Router to define these rules.
      We also call useAuthListener() here to ensure auth checks happen globally.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  BrowserRouter, Routes, Route - The trio of React Router
  
  ROLE: 
  - BrowserRouter: The main wrapper that enables routing
  - Routes: A container for definitions
  - Route: A specific rule (e.g. "if URL is /login, show this")
*/
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

/*
  useAuthListener - Custom hook
  ROLE: We still call this here to start the global auth monitoring
*/
import useAuthListener from "./hooks/useAuthListener";

/*
  Pages and Components
*/
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import AuthGuard from "./components/shared/AuthGuard";
import InterviewPage from "./pages/InterviewPage";


// =============================================================================
// APP COMPONENT
// =============================================================================

function App() {
  
  /*
    Start the Auth Listener
    
    ROLE: Begins monitoring Firebase for login/logout events.
    WHY:  This needs to run as high up in the app as possible.
  */
  useAuthListener();

  /*
    RENDER THE ROUTER
    
    This is much cleaner now! instead of mixed UI code, we just define structure.
  */
  return (
    <BrowserRouter>
      <Routes>
        
        {/* 
          ROUTE: Login Page
          URL: /login
          COMPONENT: <LoginPage />
        */}
        <Route path="/login" element={<LoginPage />} />

        {/* 
          ROUTE: Dashboard (Protected)
          URL: /
          COMPONENT: <DashboardPage /> wrapped in <AuthGuard>
          
          HOW IT WORKS:
          When user visits /, AuthGuard runs first.
          - If logged in -> It renders DashboardPage
          - If NOT logged in -> It redirects to /login
        */}
        <Route 
          path="/" 
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          } 
        />

        {/* 
          ROUTE: Interview Page (Protected)
          URL: /interview
          COMPONENT: <InterviewPage /> wrapped in <AuthGuard>
        */}
        <Route 
          path="/interview" 
          element={
            <AuthGuard>
              <InterviewPage />
            </AuthGuard>
          } 
        />

        {/* 
          ROUTE: Catch-all (404)
          URL: * (anything else)
          ACTION: Redirect to / (which will decide where to go)
        */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;