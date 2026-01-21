/*
================================================================================
DASHBOARD PAGE
================================================================================
ROLE: This is the main page users see after logging in.
WHY:  We need a home base for the user.
HOW:  It displays user info and typical dashboard actions with premium styling.
================================================================================
*/

import { useNavigate } from 'react-router-dom';
import useAuthStore from "../store/auth.store";
import { AuthService } from "../services/auth.service";

function DashboardPage() {
  const navigate = useNavigate();
  
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);

  // Handler for logout
  function handleLogout() {
    console.log("🚪 DashboardPage: Logging out...");
    AuthService.logout();
  }

  if (!user) return null;

  return (
    // Outer Container: Deep Dark Background with subtle ambient light
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl transform translate-y-1/2"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Navigation */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 border border-white/10">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">VerboAI</h2>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Interview Mastery</span>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/50 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-300 backdrop-blur-md"
          >
            <span className="text-sm font-medium text-slate-400 group-hover:text-red-400 transition-colors">Sign Out</span>
          </button>
        </header>

        {/* Hero Section */}
        <section className="mb-12 relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
          {/* Decorative Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-transparent to-cyan-600/10 opacity-50"></div>
          
          <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 z-10">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <img 
                src={user.photoURL || "https://ui-avatars.com/api/?name=" + user.displayName + "&background=random"} 
                alt="Profile" 
                className="relative w-28 h-28 rounded-full border-4 border-slate-900 shadow-xl object-cover"
              />
            </div>
            
            <div className="text-center md:text-left space-y-2 flex-1">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">{user.displayName?.split(' ')[0] || 'Friend'}</span>!
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl">
                Your AI interviewer is prepped and ready. Let's sharpen those skills.
              </p>
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Stats & Info */}
          <div className="space-y-8">
            {/* User Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profile</h3>
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase">
                  {profile?.role || "Free Plan"}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">Email</p>
                  <p className="text-slate-200 text-sm font-medium truncate">{user.email}</p>
                </div>
                
                <div className="p-3 rounded-xl bg-slate-900/30 border border-slate-800/30">
                  <p className="text-xs text-slate-500 mb-1">User ID</p>
                  <code className="text-[10px] text-slate-400 font-mono block truncate opacity-70">
                    {profile?.uid || "Loading..."}
                  </code>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs text-slate-400">Account Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Actions (Spans 2 cols) */}
          <div className="md:col-span-2 space-y-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider ml-1">Quick Actions</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* START PRACTICE CARD */}
              <button 
                onClick={() => navigate('/interview')}
                className="group relative flex flex-col items-start p-8 bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute inset-0 bg-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="mb-6 p-4 rounded-2xl bg-violet-500/10 text-violet-400 group-hover:scale-110 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform">Start Interview</h3>
                <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                  Launch a new AI-driven mock interview session. Real-time feedback and voice interaction.
                </p>
                
                <div className="mt-6 flex items-center gap-2 text-violet-400 text-sm font-bold group-hover:gap-3 transition-all">
                  <span>Begin Session</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </button>

              {/* PERFORMANCE CARD */}
              <button 
                className="group relative flex flex-col items-start p-8 bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute inset-0 bg-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform">My Analytics</h3>
                <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                  Touch base with your progress. View past scores, feedback history, and improvement areas.
                </p>

                <div className="mt-6 flex items-center gap-2 text-emerald-400 text-sm font-bold group-hover:gap-3 transition-all">
                  <span>View Stats</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-16 text-center">
            <p className="text-slate-600 text-sm">© {(new Date()).getFullYear()} VerboAI. All systems operational.</p>
        </footer>

      </div>
    </div>
  );
}

export default DashboardPage;
