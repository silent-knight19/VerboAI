/*
================================================================================
LOGIN PAGE (PREMIUM REBRANDING)
================================================================================
ROLE: This is the entry point for users. It is designed to look professional,
clean, and trustworthy, setting a high standard for the rest of the app.

DESIGN PRINCIPLES:
1. Typography: Uses 'Outfit' for titles/branding and 'Inter' for body/labels.
2. Aesthetic: Deep dark theme (#09090b) with subtle indigo light leaks.
3. Clarity: No emojis; uses clean, high-contrast layouts.
================================================================================
*/

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/auth.store";
import { AuthService } from "../services/auth.service";

/**
 * --- LOGIN PAGE COMPONENT ---
 * 
 * WHY: This page provides a secure and branded way for users to log in via Google.
 */
function LoginPage() {
  
  // 1. Initializing Routing & Navigation Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // 2. Local State for UI animations (Fade-in effect on load)
  const [isMounted, setIsMounted] = useState(false);

  // 3. Extracting Global Auth State from our Zustand Store
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const error = useAuthStore(state => state.error);

  /**
   * SIDE EFFECT: Trigger Entry Animation
   * HOW: We set isMounted to true after the component first renders.
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * SIDE EFFECT: Auto-Redirect
   * ROLE: If a user is already logged in, we shouldn't show them the login button.
   */
  useEffect(() => {
    // If still checking with Firebase, wait...
    if (loading) return;

    // If 'user' exists, they are logged in! Send them to their destination.
    if (user) {
      // Find the page they tried to visit before being redirected here
      const origin = location.state?.from?.pathname || "/";
      navigate(origin, { replace: true });
    }
  }, [user, loading, navigate, location]);

  /**
   * HANDLER: handleGoogleLogin
   * ROLE: Fires when the 'Continue with Google' button is clicked.
   */
  async function handleGoogleLogin() {
    try {
      // Calls our AuthService which talks to Firebase
      await AuthService.loginWithGoogle();
    } catch (err) {
      console.error("Authentication Error:", err);
    }
  }

  // --- RENDER 1: LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center space-y-6">
        {/* Clean, minimalist loading orb */}
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="font-outfit text-[10px] tracking-[0.4em] text-slate-500 uppercase">Authenticating</p>
      </div>
    );
  }

  // --- RENDER 2: MAIN LOGIN UI ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] text-slate-100 selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* BACKGROUND DECORATION: Subtle indigo light leak for a premium feel */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* AUTHENTICATION CARD */}
      <div 
        className={`
          relative w-full max-w-[420px] mx-6 p-8 md:p-12
          bg-zinc-900/40 backdrop-blur-2xl border border-white/[0.05] rounded-[40px] shadow-2xl
          transition-all duration-1000 ease-out transform
          ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        `}
      >
        {/* BRANDING SECTION */}
        <div className="flex flex-col items-center mb-12">
          {/* Logo Frame: Clean and minimalist */}
          <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-black p-4 rounded-3xl border border-white/10 shadow-xl mb-8">
            <img src="/logo.png" alt="VerboAI" className="w-full h-full object-contain brightness-110" />
          </div>
          
          <h1 className="text-4xl font-outfit font-bold tracking-tight text-white mb-3">
            Verbo<span className="text-indigo-500">AI</span>
          </h1>
          <p className="text-slate-400 font-inter text-sm tracking-wide">
            Your journey to interview mastery begins here.
          </p>
        </div>

        {/* ERROR DISPLAY (If authentication fails) */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
             <p className="text-red-400 text-xs font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* SOCIAL LOGIN BUTTON: Google */}
        <button 
          onClick={handleGoogleLogin} 
          className="w-full h-14 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-bold font-inter text-sm flex items-center justify-center gap-4 transition-all shadow-lg hover:shadow-indigo-500/5 hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
        >
          {/* Standard Google Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span className="tracking-tight">Get Started with Google</span>
        </button>

        {/* FOOTER: Security confirmation */}
        <div className="mt-12 pt-8 border-t border-white/[0.05] flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
            <p className="text-[10px] font-outfit font-bold uppercase tracking-[0.3em] text-slate-600">Secure Access Point</p>
          </div>
          <p className="text-[9px] font-inter text-slate-700 text-center uppercase tracking-widest leading-relaxed">
            Authorized Personnel Only • Encrypted Session
          </p>
        </div>
      </div>

      {/* COPYRIGHT TEXT: Bottom corner */}
      <div className="absolute bottom-8 left-0 w-full text-center">
        <p className="text-slate-800 text-[10px] font-bold font-outfit tracking-[0.5em] uppercase">
          © {new Date().getFullYear()} VerboAI Engineering
        </p>
      </div>

    </div>
  );
}

export default LoginPage;