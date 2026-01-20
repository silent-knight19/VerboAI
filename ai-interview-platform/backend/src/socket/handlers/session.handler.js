/*
================================================================================
SESSION HANDLER (Backend)
================================================================================
ROLE: The Conductor 🎻

WHY:  
  - When the frontend says "Start", "Heartbeat", or "End", we need to react.
  - This file defines what happens for each socket event.
  - It's like a switchboard operator routing calls to the right department.

HOW:
  - We export a function that takes `io` and `socket` as arguments.
  - Inside, we set up listeners for specific events using `socket.on(...)`.
  - Each listener calls the appropriate function in UserService.

FLOW:
  1. User connects (handled by socket.server.js).
  2. This handler is registered for that socket.
  3. User emits 'session:start' -> We call UserService.startInterviewSession().
  4. User emits 'session:heartbeat' -> We call UserService.updateHeartbeat().
  5. User emits 'session:end' -> We call UserService.endInterviewSession().
  6. User disconnects -> We log it (but don't force-end the session).
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  UserService - Our database logic for users.
  
  ROLE: Contains functions like startInterviewSession, updateHeartbeat, etc.
  WHY:  Keeps database logic separate from socket logic (separation of concerns).
*/
const UserService = require('../../services/user.service');


// =============================================================================
// THE HANDLER
// =============================================================================

/*
  module.exports = (io, socket) => { ... }
  
  WHAT: Exports a function that sets up event listeners for a specific socket.
  
  PARAMS:
    - io:     The Socket.io server instance (for broadcasting to others, if needed).
    - socket: The specific socket connection for one user.
  
  WHY: Each connected user gets their own socket. We attach listeners to it.
*/
module.exports = (io, socket) => {

  // ---------------------------------------------------------------------------
  // EXTRACT USER ID
  // ---------------------------------------------------------------------------
  /*
    socket.user was attached by our socketAuth middleware.
    If we reach this point, we KNOW the user is authenticated.
  */
  const uid = socket.user.uid;


  // ---------------------------------------------------------------------------
  // RATE LIMITING SETUP (Security)
  // ---------------------------------------------------------------------------
  /*
    lastStartRequest: A Map to track the last time a user requested to start a session.
    
    WHY:
      - Prevents users from spamming the "Start" button.
      - Without this, a malicious user could flood our server with requests.
    
    HOW:
      - We store the timestamp of the last request.
      - If a new request comes within 5 seconds, we reject it.
    
    NOTE: In a multi-server setup, you'd use Redis instead of a Map.
          A Map only works for a single server instance.
  */
  const lastStartRequest = new Map();


  // ===========================================================================
  // EVENT: session:start
  // ===========================================================================
  /*
    Fires when: User clicks "Start Interview" on the frontend.
    
    ROLE: Attempt to start a new interview session.
    
    PARAMS:
      - callback: Function to call with the response (Socket.io acknowledgement).
    
    FLOW:
      1. Check rate limit (prevent spam).
      2. Call UserService.startInterviewSession(uid).
      3. If success: Reply with sessionId.
      4. If error: Reply with error message.
  */
  socket.on('session:start', async (callback) => {
    console.log(`🔌 Socket: ${uid} requested session start`);

    // -------------------------------------------------------------------------
    // STEP 1: Rate Limiting Check
    // -------------------------------------------------------------------------
    const now = Date.now();
    const lastRequest = lastStartRequest.get(uid) || 0;
    const RATE_LIMIT_MS = 5000; // 5 seconds between requests

    if (now - lastRequest < RATE_LIMIT_MS) {
      console.warn(`🛑 Socket: Rate limit exceeded for ${uid}`);
      
      // Reply with error (if callback exists).
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Please wait before starting a new session.' });
      }
      return; // Stop here, don't proceed.
    }
    
    // Record the time of this request.
    lastStartRequest.set(uid, now);
    
    // -------------------------------------------------------------------------
    // STEP 2: Attempt to Start Session
    // -------------------------------------------------------------------------
    try {
      // UserService handles: budget check, zombie check, session locking.
      const sessionId = await UserService.startInterviewSession(uid);
      
      // Reply with success.
      if (typeof callback === 'function') {
        callback({ success: true, sessionId: sessionId });
      }
      
      // Optional: Join a "room" for this session.
      // Useful for sending targeted messages later (e.g., to just this session).
      socket.join(sessionId);
      
    } catch (error) {
      console.error(`❌ Socket: Session start failed for ${uid}:`, error.message);
      
      // Reply with error.
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });


  // ===========================================================================
  // EVENT: session:heartbeat
  // ===========================================================================
  /*
    Fires when: Frontend sends a "pulse" every 15 seconds.
    
    ROLE: Update the lastHeartbeatAt timestamp in the database.
    
    WHY:
      - If the backend doesn't hear from the user for 2 minutes, it assumes they're gone.
      - This prevents "zombie" sessions from staying alive forever.
    
    NOTE: We don't send a response (fire and forget). Saves bandwidth.
  */
  socket.on('session:heartbeat', async () => {
    // We intentionally don't log every heartbeat to avoid spamming the console.
    // console.log(`💓 Socket: Heartbeat from ${uid}`);
    
    try {
      await UserService.updateHeartbeat(uid);
    } catch (error) {
      // Silent fail is okay for heartbeat.
      // The backend's hard time limit will catch any abuse.
      console.error(`⚠️ Socket: Heartbeat failed for ${uid}:`, error.message);
    }
  });


  // ===========================================================================
  // EVENT: session:end
  // ===========================================================================
  /*
    Fires when: User clicks "End Interview" on the frontend.
    
    ROLE: Properly close the session, deduct time from budget, unlock user.
    
    PARAMS:
      - callback: Function to call with the response.
  */
  socket.on('session:end', async (callback) => {
    console.log(`🛑 Socket: ${uid} ending session`);
    
    try {
      // UserService handles: duration calculation, time deduction, unlocking.
      await UserService.endInterviewSession(uid);
      
      // Reply with success.
      if (typeof callback === 'function') {
        callback({ success: true });
      }
      
    } catch (error) {
      console.error(`❌ Socket: Session end failed for ${uid}:`, error.message);
      
      // Reply with error.
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });


  // ===========================================================================
  // EVENT: disconnect
  // ===========================================================================
  /*
    Fires when: The WebSocket connection is lost.
    
    POSSIBLE REASONS:
      - User closed the browser tab.
      - User's internet dropped.
      - User refreshed the page.
    
    IMPORTANT DESIGN DECISION:
      - We do NOT automatically end the session here.
      - WHY? The user might just be refreshing the page. Ending the session
        would immediately deduct time and force them to start a new one.
      - INSTEAD: We rely on the "Zombie" logic. If no heartbeat is received
        for 2 minutes, the backend considers the session dead and cleans it up
        the next time that user tries to start a new session.
  */
  socket.on('disconnect', () => {
    console.log(`👋 Socket: ${uid} disconnected`);
    // No action taken. Zombie logic handles cleanup.
  });
};
