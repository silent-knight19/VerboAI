/*
================================================================================
INTERVIEW PAGE (Frontend)
================================================================================
ROLE: The Interview Room 🎤

WHY:  
  - This is the main page where users conduct their mock interviews.
  - It manages the interview lifecycle: Connect -> Start -> Heartbeat -> End.

HOW:
  - Uses React hooks (useState, useEffect, useRef) to manage UI state.
  - Uses `SocketService` to communicate with the backend in real-time.
  - Uses `useAuthStore` to check if the user is logged in.

FLOW:
  1. Component mounts.
  2. Check: Is user logged in? If not, redirect to /login.
  3. If logged in, call `SocketService.connect()` with their token.
  4. User clicks "Start" -> Call `SocketService.startSession()`.
  5. If successful, start a heartbeat timer (pings every 15s).
  6. UI shows a timer counting up.
  7. User clicks "End" -> Call `SocketService.endSession()`.
  8. Time is deducted from their daily budget on the backend.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  React hooks we need:
  - useEffect: Run code when component mounts/unmounts
  - useState:  Manage local state (like status, timer, errors)
  - useRef:    Store values that persist across renders (like interval IDs)
*/
import React, { useEffect, useState, useRef } from 'react';

/*
  useNavigate: React Router hook to programmatically redirect users.
  WHY: If user is not logged in, we redirect them to /login.
*/
import { useNavigate } from 'react-router-dom';

/*
  useAuthStore: Our Zustand auth store.
  WHY: We need to check if the user is logged in and get their token.
*/
import useAuthStore from '../store/auth.store';

/*
  SocketService: Our singleton socket manager.
  WHY: We use this to connect, start session, send heartbeats, and end session.
*/
import SocketService from '../services/socket.service';
import useAudioRecorder from '../hooks/useAudioRecorder';


// =============================================================================
// THE COMPONENT
// =============================================================================

const InterviewPage = () => {

  // ---------------------------------------------------------------------------
  // HOOKS
  // ---------------------------------------------------------------------------

  // useNavigate() gives us a function to redirect the user.
  const navigate = useNavigate();
  
  // Get 'user' (Firebase user object) and 'loading' (is Firebase still checking?)
  // from our global auth store.
  const { user, loading } = useAuthStore();

  // AUDIO HOOK (The Ears & Mouth)
  const { 
    isRecording, 
    permissionError, 
    aiState, 
    aiMessage, 
    startRecording, 
    stopRecording 
  } = useAudioRecorder();


  // ---------------------------------------------------------------------------
  // LOCAL STATE (useState)
  // ---------------------------------------------------------------------------

  /*
    status: What phase are we in?
    
    POSSIBLE VALUES:
      - 'disconnected': Not connected to server.
      - 'connecting':   Trying to connect.
      - 'ready':        Connected, waiting for user to click Start.
      - 'starting':     User clicked Start, waiting for server response.
      - 'running':      Interview is in progress.
      - 'ending':       User clicked End, waiting for server response.
      - 'error':        Something went wrong.
  */
  const [status, setStatus] = useState('disconnected');

  /*
    sessionId: The unique ID of the current interview session.
    WHY: We display it on screen and use it for debugging.
  */
  const [sessionId, setSessionId] = useState(null);

  /*
    error: Error message to display to the user, if any.
  */
  const [error, setError] = useState(null);

  /*
    timeElapsed: How many seconds the current session has been running.
    WHY: We show a live timer on screen to the user.
  */
  const [timeElapsed, setTimeElapsed] = useState(0);


  // ---------------------------------------------------------------------------
  // REFS (useRef)
  // ---------------------------------------------------------------------------

  /*
    heartbeatIntervalRef: Stores the ID of the heartbeat interval.
    WHY: We need to clear this interval when the session ends.
         useRef keeps the value across re-renders without triggering re-renders.
  */
  const heartbeatIntervalRef = useRef(null);

  /*
    timerIntervalRef: Stores the ID of the timer interval.
    WHY: Same reason as heartbeat - we need to clear it on unmount.
  */
  const timerIntervalRef = useRef(null);


  // ---------------------------------------------------------------------------
  // EFFECT: AUTH CHECK & SOCKET CONNECTION
  // ---------------------------------------------------------------------------

  /*
    useEffect with [user, loading, navigate] dependency
    
    WHY:  This runs when the component mounts and whenever user/loading changes.
    WHAT: 
      1. Wait for Firebase to finish loading.
      2. If no user, redirect to login.
      3. If user exists, connect to the socket server.
  */
  useEffect(() => {
    // Guard: If Firebase is still loading, do nothing yet.
    if (loading) return;
    
    // Guard: If no user is logged in, send them to the login page.
    if (!user) {
      navigate('/login');
      return;
    }

    // ASYNC function to get token and connect
    const initSocket = async () => {
      try {
        setStatus('connecting');
        
        // getIdToken() is a Firebase method that returns the user's JWT token.
        // We pass this to the backend to prove who we are.
        const token = await user.getIdToken();
        
        // Call our SocketService to open the connection.
        SocketService.connect(token);
        
        // If no error thrown, we assume we're connected.
        // In a real app, you might wait for a 'connect' event.
        setStatus('ready');
        
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    initSocket();

    // CLEANUP FUNCTION: Runs when component unmounts (user leaves page).
    return () => {
      // Make sure the session is properly ended before leaving.
      handleEndSession();
    };
    
  }, [user, loading, navigate]); // Dependencies


  // ---------------------------------------------------------------------------
  // FUNCTION: handleStartSession
  // ---------------------------------------------------------------------------

  /*
    handleStartSession()
    
    ROLE: Called when user clicks the "Start Interview" button.
    WHY:  Kicks off the interview session on the backend.
    
    HOW:
      1. Set status to 'starting'.
      2. Call SocketService.startSession() (async).
      3. If successful: Store sessionId, set status to 'running', start timers.
      4. If failed: Show error, reset status to 'ready'.
  */
  const handleStartSession = async () => {
    try {
      setStatus('starting');
      setError(null); // Clear any previous errors.
      
      // Call the backend to start the session.
      const sid = await SocketService.startSession();
      
      // Store the session ID.
      setSessionId(sid);
      
      // 2. Start the Interview Pipeline (Deepgram STT + AI)
      SocketService.emit('interview:start');
      
      // 3. Start Audio Recording (Get Mic Access)
      await startRecording();
      
      setStatus('running');

      // -----------------------------------------------------------------------
      // START HEARTBEAT INTERVAL
      // -----------------------------------------------------------------------
      // Every 15 seconds, we ping the backend to say "I'm still here".
      // This prevents the backend from thinking we're a "zombie" session.
      heartbeatIntervalRef.current = setInterval(() => {
        SocketService.sendHeartbeat();
      }, 15000); // 15000ms = 15 seconds

      // -----------------------------------------------------------------------
      // START TIMER INTERVAL
      // -----------------------------------------------------------------------
      // Every 1 second, we increment the timeElapsed counter for the UI.
      timerIntervalRef.current = setInterval(() => {
        setTimeElapsed(previousValue => previousValue + 1);
      }, 1000); // 1000ms = 1 second

    } catch (err) {
      console.error('Error starting session:', err);
      
      // Show the error message to the user.
      setError(typeof err === 'string' ? err : err.message || 'Failed to start');
      
      // Go back to 'ready' so they can try again.
      setStatus('ready');
    }
  };


  // ---------------------------------------------------------------------------
  // FUNCTION: handleEndSession
  // ---------------------------------------------------------------------------

  /*
    handleEndSession()
    
    ROLE: Called when user clicks "End Interview" or leaves the page.
    WHY:  Properly closes the session and stops all timers.
    
    HOW:
      1. Clear the heartbeat and timer intervals.
      2. If session is running, call SocketService.endSession().
      3. Reset all state.
  */
  const handleEndSession = async () => {
    // 1. Stop Recording
    stopRecording();
    
    // -------------------------------------------------------------------------
    // STEP 1: Clear intervals (stop the timers)
    // -------------------------------------------------------------------------
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // -------------------------------------------------------------------------
    // STEP 2: End the session on the backend (if we're in an active session)
    // -------------------------------------------------------------------------
    if (status === 'running' || status === 'starting') {
      setStatus('ending');
      try {
        await SocketService.endSession();
      } catch (err) {
        console.error('Error ending session:', err);
        // We still proceed even if there's an error.
      }
    } else {
      // If not in a session, just disconnect the socket.
      SocketService.disconnect();
    }
    
    // -------------------------------------------------------------------------
    // STEP 3: Reset state
    // -------------------------------------------------------------------------
    setStatus('disconnected');
    setSessionId(null);
    setTimeElapsed(0);
  };


  // ---------------------------------------------------------------------------
  // HELPER: formatTime
  // ---------------------------------------------------------------------------

  /*
    formatTime(seconds)
    
    ROLE: Converts a number of seconds into a "M:SS" format string.
    WHY:  Makes the timer look nice (e.g., "1:05" instead of "65").
    
    EXAMPLE: formatTime(65) => "1:05"
  */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    // Pad seconds with a leading zero if less than 10 (e.g., "05").
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };


  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  // If Firebase is still loading, show a simple loading message.
  if (loading) {
    return <div className="p-10 text-center">Loading authentication...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      
      {/* ============================== MAIN CARD ============================== */}
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center transition-all duration-300">
        
        {/* Title */}
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Mock Interview</h1>
        
        {/* ------------------------- STATUS INDICATOR ------------------------- */}
        {/* Shows the current status (READY, RUNNING, etc.) in a colored badge. */}
        <div className={`mb-6 text-sm font-medium px-3 py-1 rounded-full inline-block
          ${status === 'running' ? 'bg-green-100 text-green-700' : 
            status === 'error' ? 'bg-red-100 text-red-700' : 
            'bg-blue-50 text-blue-600'}`}>
          Status: {status.toUpperCase()}
        </div>

        {/* ------------------------- ERROR MESSAGE ------------------------- */}
        {/* If there's an error, show it in a red box. */}
        {(error || permissionError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100">
            {error || permissionError}
          </div>
        )}

        {/* ------------------------- ACTIVE SESSION UI ------------------------- */}
        {/* Only shown when the session is running. */}
        {status === 'running' && (
          <div className="mb-8 space-y-6">
            
            {/* TIMER */}
            <div className="text-5xl font-mono font-light text-gray-700">
              {formatTime(timeElapsed)}
            </div>
            
            {/* AI STATUS INDICATOR (The "Brain" State) */}
            <div className="flex flex-col items-center justify-center space-y-2">
               <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
                 ${aiState === 'LISTENING' ? 'bg-blue-100 border-4 border-blue-200 animate-pulse' : 
                   aiState === 'THINKING' ? 'bg-yellow-100 border-4 border-yellow-200' : 
                   aiState === 'SPEAKING' ? 'bg-purple-100 border-4 border-purple-200 shadow-lg scale-110' : 
                   'bg-gray-100'}`}>
                 
                 <span className="text-3xl">
                   {aiState === 'LISTENING' ? '👂' : 
                    aiState === 'THINKING' ? '🧠' : 
                    aiState === 'SPEAKING' ? '🗣️' : '😴'}
                 </span>
               </div>
               
               <p className="font-semibold text-gray-700">
                 {aiState === 'LISTENING' ? 'Listening...' : 
                  aiState === 'THINKING' ? 'Thinking...' : 
                  aiState === 'SPEAKING' ? 'Speaking...' : 'Ready'}
               </p>
            </div>

            {/* AI MESSAGE (Transcript) */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 min-h-[60px] flex items-center justify-center italic">
              "{aiMessage}"
            </div>

            <p className="text-gray-400 text-xs">Session ID: {sessionId}</p>
          </div>
        )}

        {/* ------------------------- CONTROL BUTTONS ------------------------- */}
        <div className="space-y-3">
          
          {/* START BUTTON: Shown when status is 'ready' */}
          {status === 'ready' && (
            <button 
              onClick={handleStartSession}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
              Start New Interview
            </button>
          )}

          {/* END BUTTON: Shown when session is 'running' */}
          {status === 'running' && (
            <button 
              onClick={handleEndSession}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
              End Interview
            </button>
          )}

          {/* RECONNECT BUTTON: Shown when disconnected or error */}
          {(status === 'disconnected' || status === 'error' || status === 'ending') && (
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Reconnect / Try Again
            </button>
          )}
          
        </div>

        {/* ------------------------- INFO TEXT ------------------------- */}
        <p className="mt-8 text-xs text-gray-400">
          {status === 'running' 
            ? 'Speaking naturally... I am listening.' 
            : 'Click start to begin. Microphone access required.'}
        </p>

      </div>
    </div>
  );
};


// =============================================================================
// EXPORT
// =============================================================================

export default InterviewPage;
