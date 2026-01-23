/*
================================================================================
DASHBOARD PAGE (PREMIUM REBRANDING)
================================================================================
ROLE: This is the user's home base. It provides quick access to interviews
and analytics while maintaining the professional "VerboAI" aesthetic.

HOW IT WORKS:
1. It displays the user's profile information.
2. It provides navigation cards for 'Start Interview' and 'My Analytics'.
3. It uses a clean, grid-based layout with premium hover effects.
================================================================================
*/

import { useNavigate } from 'react-router-dom';
import useAuthStore from "../store/auth.store";
import { AuthService } from "../services/auth.service";

// --- PROFESSIONAL SVG ICONS (Replacing Emojis) ---

// Mic Icon for 'Start Interview'
const MicIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

// Chart Icon for 'Analytics'
const ChartIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Exit/Logout Icon
const ExitIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

function DashboardPage() {
  
  // 1. Initializing Navigation & Hooks
  const navigate = useNavigate();
  
  // 2. Extracting Global State from useAuthStore
  // 'user' is the Firebase user object, 'profile' is our custom DB user data.
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);

  // 3. HANDLER: Logout functionality
  function handleLogout() {
    AuthService.logout();
  }

  // Safety Check: If no user is logged in, don't render anything (AuthGuard will handle redirect)
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-inter selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* BACKGROUND AMBIENCE: Subtle glowing orbs for depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] transform translate-y-1/2"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-10">
        
        {/* HEADER SECTION: Branding & Action */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-5">
            {/* Minimalist Logo Circle */}
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden grayscale brightness-90">
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain scale-125" />
            </div>
            <div>
              <h2 className="text-2xl font-outfit font-bold text-white tracking-widest uppercase">VerboAI</h2>
              <div className="flex items-center space-x-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                 <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Deployment Active</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/5 transition-all duration-500 group"
          >
            <ExitIcon />
            <span className="text-xs font-bold font-outfit uppercase tracking-widest text-slate-400 group-hover:text-red-400 transition-colors">Terminate Session</span>
          </button>
        </header>

        {/* WELCOME SECTION: Hero Banner */}
        <section className="mb-16 relative overflow-hidden rounded-[40px] border border-white/[0.05] bg-zinc-900/40 backdrop-blur-2xl">
          <div className="p-10 md:p-16 flex flex-col md:flex-row items-center gap-12">
            
            {/* Profile Avatar with subtle ambient glow */}
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/40 transition-all duration-500"></div>
              <img 
                src={user.photoURL || "https://ui-avatars.com/api/?name=" + user.displayName + "&background=random"} 
                alt="Profile" 
                className="relative w-32 h-32 rounded-full border-2 border-white/10 shadow-2xl object-cover grayscale-[20%] group-hover:grayscale-0 transition-all"
              />
            </div>
            
            <div className="text-center md:text-left space-y-4">
              <h1 className="text-5xl font-outfit font-bold text-white tracking-tight">
                Welcome back, <span className="text-indigo-400">{user.displayName?.split(' ')[0] || 'Candidate'}</span>
              </h1>
              <p className="text-lg text-slate-400 font-inter max-w-2xl leading-relaxed">
                Your AI-powered interview environment is ready. Click below to begin your next practice session or review your progress.
              </p>
            </div>
          </div>
        </section>

        {/* DASHBOARD GRID: Split between Stats and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          
          {/* STATS PANEL (Left) */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-zinc-900/20 border border-white/[0.05] rounded-[32px] p-8 backdrop-blur-sm">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-8">Professional ID</h3>
              
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] text-slate-600 uppercase font-black mb-2">Access Role</p>
                  <p className="text-white font-outfit font-bold text-sm tracking-widest uppercase">
                    {profile?.role || "Free Candidate"}
                  </p>
                </div>
                
                <div>
                  <p className="text-[10px] text-slate-600 uppercase font-black mb-2">Primary Email</p>
                  <p className="text-slate-400 font-inter text-xs truncate">{user.email}</p>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                   <p className="text-[10px] text-slate-600 uppercase font-black">Account Status</p>
                   <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-widest">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS PANEL (Right) */}
          <div className="lg:col-span-3 space-y-8">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] ml-2">Available Operations</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* OPERATION 1: START INTERVIEW */}
              <button 
                onClick={() => navigate('/interview')}
                className="group relative flex flex-col items-start p-10 bg-zinc-900/30 border border-white/[0.05] rounded-[40px] hover:bg-zinc-900/50 hover:border-indigo-500/30 transition-all duration-700 text-left overflow-hidden shadow-2xl"
              >
                {/* Decorative background glow on hover */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700"></div>
                
                <div className="mb-8 p-5 rounded-3xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 group-hover:scale-110">
                  <MicIcon />
                </div>
                
                <h3 className="text-2xl font-outfit font-bold text-white mb-3">Launch Interview</h3>
                <p className="text-slate-400 font-inter text-sm leading-relaxed mb-8 flex-1">
                  Connect to the AI voice interface for a realism-focused technical interview. Get instant feedback on your performance.
                </p>
                
                <div className="flex items-center gap-3 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] group-hover:gap-5 transition-all duration-500">
                  <span>Start Practice Session</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </button>

              {/* OPERATION 2: VIEW ANALYTICS */}
              <button 
                className="group relative flex flex-col items-start p-10 bg-zinc-900/30 border border-white/[0.05] rounded-[40px] hover:bg-zinc-900/50 hover:border-slate-700 transition-all duration-700 text-left overflow-hidden shadow-2xl opacity-60 hover:opacity-100"
              >
                <div className="mb-8 p-5 rounded-3xl bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-white transition-all duration-500">
                  <ChartIcon />
                </div>
                
                <h3 className="text-2xl font-outfit font-bold text-white mb-3 tracking-tight">Performance Intel</h3>
                <p className="text-slate-500 font-inter text-sm leading-relaxed mb-8 flex-1">
                  Access deep-dive analytics from your historical sessions. Identify pattern-based growth areas and score trends.
                </p>

                <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] group-hover:text-white transition-all">
                  <span>Analyze Data Points</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* FOOTER: System Status */}
        <footer className="mt-24 text-center">
            <p className="text-slate-800 font-outfit text-[10px] font-bold uppercase tracking-[0.3em]">
               System Core v1.4.0 • Distributed Node Network Active
            </p>
        </footer>

      </div>
    </div>
  );
}

export default DashboardPage;
