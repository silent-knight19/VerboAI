/*
================================================================================
DASHBOARD PAGE
================================================================================
ROLE: This is the main page users see after logging in.
WHY:  We need a home base for the user.
HOW:  It displays user info and typical dashboard actions with premium styling.
================================================================================
*/

import useAuthStore from "../store/auth.store";
import { AuthService } from "../services/auth.service";

function DashboardPage() {
  
  /*
    Get user and profile from store using SEPARATE selectors
    
    WHY SEPARATE? 
    If we return an object like { user, profile }, React sees 
    a "new" object every render and causes an infinite loop.
    Using separate selectors returns primitives/stable references.
  */
  const user = useAuthStore(function(state) {
    return state.user;
  });
  
  const profile = useAuthStore(function(state) {
    return state.profile;
  });

  // Handler for logout
  function handleLogout() {
    console.log("🚪 DashboardPage: Logging out...");
    AuthService.logout();
  }

  // If data is somehow missing (rare because AuthGuard protects this), return null
  if (!user) return null;

  return (
    // Outer Container: Gradient background for a premium feel
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Header Area */}
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">VerboAI</h2>
        </div>
        
        <button 
          onClick={handleLogout}
          className="text-slate-500 hover:text-red-600 font-medium transition-colors text-sm"
        >
          Sign Out
        </button>
      </div>

      {/* Main Content Card */}
      <main className="w-full max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
          
          {/* Top Banner / Hero Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <img 
                src={user.photoURL || "https://ui-avatars.com/api/?name=" + user.displayName} 
                alt="Profile" 
                className="w-24 h-24 rounded-2xl border-4 border-white/20 shadow-xl"
              />
              <div className="text-center sm:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Welcome back, {user.displayName || 'Friend'}!
                </h1>
                <p className="mt-1 text-blue-100 text-lg opacity-90">
                  Ready to master your next interview?
                </p>
              </div>
            </div>
          </div>

          {/* Action Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Profile Info Card */}
              <div className="md:col-span-1 border border-slate-100 rounded-xl p-6 bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Account</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400">Email Address</p>
                    <p className="text-slate-700 font-medium truncate">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Member Since</p>
                    <p className="text-slate-700 font-medium">
                      {profile?.createdAt 
                        ? new Date(profile.createdAt._seconds * 1000).toLocaleDateString() 
                        : 'Loading...'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">User ID</p>
                    <code className="text-[10px] bg-slate-200 p-1 rounded text-slate-600 block truncate">
                      {profile?.uid || "Syncing..."}
                    </code>
                  </div>
                  <div className="pt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {profile?.role || "User"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button className="flex flex-col items-start p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group text-left">
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className="font-bold text-slate-800">Start Practice</span>
                    <span className="text-xs text-slate-500">Practice with AI Interviewer</span>
                  </button>

                  <button className="flex flex-col items-start p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group text-left">
                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    <span className="font-bold text-slate-800">Performance</span>
                    <span className="text-xs text-slate-500">View your feedback history</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Footer Info */}
          <div className="bg-slate-50 border-t border-slate-100 px-8 py-4">
            <p className="text-center text-xs text-slate-400">
              Welcome to the VerboAI Platform. Start a session above to begin.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
