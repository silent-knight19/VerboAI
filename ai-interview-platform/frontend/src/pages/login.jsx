/*
================================================================================
LOGIN PAGE (PREMIUM REDESIGN)
================================================================================
ROLE: This is the dedicated page where users sign in to the platform.
WHY:  We need a specific URL (/login) to redirect unauthorized users to.
      A high-quality login page builds trust and provides a "premium" first impression.
HOW:  1. Checks if a user is already logged in (redirects if yes).
      2. Handles the Google Sign-In button click through AuthService.
      3. Displays the "VerboAI" brand and modern dark-themed UI.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  useEffect, useState - React core hooks
  
  ROLE: useEffect handles side effects (mount animation, auto-redirect)
        useState handles local component state (like the entry animation toggle)
*/
import { useEffect, useState } from "react";

/*
  useNavigate, useLocation - React Router hooks
  
  ROLE: useNavigate is for changing URL (redirecting after login)
        useLocation is for knowing which page the user came from (AuthGuard context)
*/
import { useNavigate, useLocation } from "react-router-dom";

/*
  useAuthStore - Global state manager (Zustand)
  
  ROLE: Gives us access to the 'user', 'loading', and 'error' states globally.
  WHY:  We need to know the login status to decide if we should redirect.
*/
import useAuthStore from "../store/auth.store";

/*
  AuthService - Firebase interaction layer
  
  ROLE: Performs the actual logic of opening the Google login popup.
*/
import { AuthService } from "../services/auth.service";


// =============================================================================
// COMPONENT
// =============================================================================

function LoginPage() {
  
  // ===========================================================================
  // HOOKS & STATE
  // ===========================================================================
  
  const navigate = useNavigate();
  const location = useLocation();

  /*
    isMounted state
    
    ROLE: Triggers the CSS entry animation.
    HOW:  When null (false), component is invisible. When true, it fades/slides in.
    WHY:  Gives the page a "premium" feel as it loads.
  */
  const [isMounted, setIsMounted] = useState(false);

  /*
    Retrieve global auth state from useAuthStore
  */
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const error = useAuthStore(state => state.error);

  
  // ===========================================================================
  // SIDE EFFECTS
  // ===========================================================================

  /*
    Effect 1: Entry Animation
    
    ROLE: Sets isMounted to true after the component loads in the browser.
    WHY:  Triggers the Tailwind 'translate-y-0' and 'opacity-100' classes.
  */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /*
    Effect 2: Auto-Redirect
    
    ROLE: Automatically sends logged-in users away from the login page.
    WHY:  If you are already logged in, you don't need to see the "Log in" button.
    HOW:  Checks if 'user' exists. If yes, finds the 'origin' (where they came from)
          and uses navigate(origin) to send them there.
  */
  useEffect(() => {
    // If Firebase is still checking auth state, do nothing yet
    if (loading) return;

    // If we have a user (logged in!), move them to the next page
    if (user) {
      console.log("✅ LoginPage: User detected, redirecting to destination...");
      
      // origin = where they were before (set by AuthGuard) OR home base "/"
      const origin = location.state?.from?.pathname || "/";
      
      // replace: true ensures the user can't click "back" to get to login again
      navigate(origin, { replace: true });
    }
  }, [user, loading, navigate, location]);


  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /*
    handleGoogleLogin
    
    ROLE: Connects the big white button to our Firebase login logic.
    WHY:  It's an 'async' function because talking to Google takes time.
    HOW:  Calls AuthService.loginWithGoogle(). The global store (useAuthStore)
          will automatically catch the new user data once successful.
  */
  async function handleGoogleLogin() {
    console.log("👆 LoginPage: Login button clicked");
    try {
      // Real AuthService call (replaces any mock logic)
      await AuthService.loginWithGoogle();
    } catch (err) {
      // Error is logged; useAuthStore will hold the message for the UI to show
      console.error("❌ LoginPage: Login failed", err);
    }
  }


  // ===========================================================================
  // RENDER LOGIC
  // ===========================================================================

  /*
    CASE: Loading State
    
    ROLE: Show a branded spinner while checking auth status or signing in.
    WHY:  Users need feedback that the app is "working" and hasn't crashed.
  */
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
        {/* Dark radial glow for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black"></div>
        
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center animate-pulse shadow-2xl overflow-hidden">
               <img src="/logo.png" alt="VerboAI Logo" className="w-full h-full object-contain scale-125" />
          </div>
          <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase animate-pulse">Initializing Workspace</p>
        </div>
      </div>
    );
  }

  /*
    CASE: Normal Login UI
    
    ROLE: The actual "Welcome Back" card.
    STYLE: Premium glassmorphism with dark accents.
  */
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] font-sans selection:bg-indigo-500/30 text-white relative overflow-hidden">
      
      {/* 1. Background Visuals (Non-interactive) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Subtle noise texture for "grit" and realism */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        
        {/* Blue Spotlight Glow behind the card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px]"></div>
        
        {/* Bottom dark fade */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-black/50 to-black"></div>
      </div>

      {/* 2. Main Authentication Card */}
      <div 
        className={`
          relative w-full max-w-[400px] mx-4
          transition-all duration-1000 ease-out transform
          ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}
      >
        {/* Glass Card Background with a very thin white border */}
        <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-2xl shadow-black ring-1 ring-white/5"></div>
        
        {/* Card Body */}
        <div className="relative z-10 p-8 md:p-12 flex flex-col items-center text-center">
          
          {/* Branded Logo */}
          <div className="mb-8 relative group cursor-default">
            {/* Glow effect that increases when you hover near the logo */}
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-zinc-800 to-black border border-white/10 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
              <img src="/logo.png" alt="VerboAI Logo" className="w-full h-full object-contain scale-125" />
            </div>
          </div>

          {/* Welcome Text */}
          <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
            Welcome back
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10">
            Sign in to access your VerboAI workspace.
          </p>

          {/* Error Prompt (Only shows if something went wrong) */}
          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/10 rounded-xl p-3 mb-6 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse"></div>
              <p className="text-red-400 text-xs font-medium text-left">{error}</p>
            </div>
          )}

          {/* Login Actions */}
          <div className="w-full space-y-6">
            
            {/* GOOGLE SIGN-IN BUTTON */}
            {/* Note: 'cursor-pointer' turns the mouse into a palm hand on hover */}
            <button 
              onClick={handleGoogleLogin} 
              className="group relative w-full h-14 flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-black rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-indigo-500/10 cursor-pointer"
            >
              {/* Official Multi-Colored Google Logo */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Separator / Branding Footer */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5"></span>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-[#18181b] px-2 text-zinc-500 font-medium rounded">VerboAI Secure Access</span>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      {/* Sticky Bottom Date Mark */}
      <div className="absolute bottom-6 left-0 w-full text-center">
        <p className="text-zinc-700 text-[10px] font-medium tracking-widest">© {new Date().getFullYear()} VERBOAI PLATFORM</p>
      </div>

    </div>
  );
}

export default LoginPage;