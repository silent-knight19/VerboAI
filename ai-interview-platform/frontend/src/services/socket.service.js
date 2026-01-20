/*
================================================================================
SOCKET SERVICE (Frontend)
================================================================================
ROLE: The Telephone Operator ☎️

WHY:  
  - We need ONE central place to manage our real-time connection.
  - If each component managed its own socket, we'd have chaos (multiple connections, memory leaks).
  - A "Singleton" pattern ensures only ONE socket exists for the entire app.

HOW:
  - This file creates a class `SocketService`.
  - We export a single instance of this class (new SocketService()).
  - Any component that imports this file gets the SAME instance.

FLOW:
  1. User logs in.
  2. InterviewPage calls `SocketService.connect(token)`.
  3. This opens a WebSocket to the backend.
  4. User clicks "Start" -> `SocketService.startSession()` is called.
  5. Every 15 seconds, `SocketService.sendHeartbeat()` is called.
  6. User clicks "End" -> `SocketService.endSession()` is called.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  io - The main function from socket.io-client library.
  
  ROLE: Creates a client-side socket connection.
  WHY:  This is the standard way to connect to a Socket.io server.
*/
import { io } from 'socket.io-client';


// =============================================================================
// CONSTANTS
// =============================================================================

/*
  BACKEND_URL - Where our backend server lives.
  
  WHY:  The socket needs to know where to connect.
        In production, this would come from environment variables.
*/
const BACKEND_URL = 'http://localhost:3000';


// =============================================================================
// THE SERVICE CLASS
// =============================================================================

class SocketService {

  /*
    constructor()
    
    ROLE: Initialize the service with an empty socket.
    WHY:  We start with null; the socket is created when connect() is called.
  */
  constructor() {
    this.socket = null;
  }


  // ===========================================================================
  // 1. CONNECT
  // ===========================================================================
  /*
    connect(token)
    
    ROLE: Establish the WebSocket connection to the backend.
    WHY:  Before we can send/receive messages, we need an open line.
    
    PARAMS:
      - token: The Firebase ID token (proves who we are).
    
    HOW:
      1. Create the socket with io(url, options).
      2. Pass the token in the `auth` option (backend will verify this).
      3. Set up default listeners for connect, error, and disconnect.
  */
  connect(token) {
    // Guard: If already connected, don't create another socket.
    if (this.socket) {
      console.log('⚠️ SocketService: Already connected, skipping.');
      return;
    }

    console.log('🔌 SocketService: Connecting to backend...');
    
    // Create the socket connection
    this.socket = io(BACKEND_URL, {
      // -----------------------------------------------------------------------
      // auth: How we send the token to the backend.
      // The backend's socketAuth middleware will look for this.
      // -----------------------------------------------------------------------
      auth: {
        token: token
      },
      
      // -----------------------------------------------------------------------
      // transports: ['websocket'] forces pure WebSocket.
      // Without this, Socket.io might start with "long-polling" (slower).
      // -----------------------------------------------------------------------
      transports: ['websocket'],
      
      // -----------------------------------------------------------------------
      // reconnectionAttempts: How many times to retry if connection drops.
      // -----------------------------------------------------------------------
      reconnectionAttempts: 5
    });

    // -------------------------------------------------------------------------
    // DEFAULT EVENT LISTENERS
    // -------------------------------------------------------------------------

    // 'connect' fires when the connection is successfully established.
    this.socket.on('connect', () => {
      console.log('✅ SocketService: Connected! Socket ID:', this.socket.id);
    });

    // 'connect_error' fires if the connection fails (e.g., bad token).
    this.socket.on('connect_error', (err) => {
      console.error('❌ SocketService: Connection Error:', err.message);
    });

    // 'disconnect' fires when the connection is lost.
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ SocketService: Disconnected. Reason:', reason);
    });
  }


  // ===========================================================================
  // 2. START SESSION
  // ===========================================================================
  /*
    startSession()
    
    ROLE: Tell the backend we want to start an interview session.
    WHY:  This triggers the backend's session:start logic (budget check, lock, etc.)
    
    RETURNS: A Promise that resolves with the sessionId, or rejects with an error.
    
    HOW:
      1. We use `socket.emit('event', callback)` to send a message.
      2. The callback is called with the server's response.
      3. We wrap this in a Promise for easier async/await usage.
  */
  startSession() {
    return new Promise((resolve, reject) => {
      // Guard: Can't start if not connected.
      if (!this.socket) {
        return reject(new Error('Not connected to server.'));
      }

      // Send the 'session:start' event to the backend.
      // The second argument is a callback that receives the server's response.
      this.socket.emit('session:start', (response) => {
        if (response.success) {
          console.log('🚀 SocketService: Session Started! ID:', response.sessionId);
          resolve(response.sessionId);
        } else {
          console.error('❌ SocketService: Start Failed:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  }


  // ===========================================================================
  // 3. HEARTBEAT
  // ===========================================================================
  /*
    sendHeartbeat()
    
    ROLE: Send a "pulse" to the backend to say "I'm still here".
    WHY:  Prevents the backend from thinking we're a "zombie" session.
          If the backend doesn't hear from us for 2 minutes, it can kill our session.
    
    HOW:
      - Just emit the 'session:heartbeat' event.
      - No response needed (fire and forget).
  */
  sendHeartbeat() {
    if (!this.socket) return;
    
    // Fire and forget - no callback needed.
    this.socket.emit('session:heartbeat');
  }


  // ===========================================================================
  // 4. END SESSION
  // ===========================================================================
  /*
    endSession()
    
    ROLE: Tell the backend we're done with the interview.
    WHY:  This triggers the cleanup logic (unlock session, deduct time, etc.)
    
    RETURNS: A Promise that resolves on success, or rejects on error.
  */
  endSession() {
    return new Promise((resolve, reject) => {
      // Guard: If already disconnected, just resolve.
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.emit('session:end', (response) => {
        // Always disconnect after ending, regardless of result.
        this.disconnect();
        
        if (response && response.success) {
          console.log('🏁 SocketService: Session Ended Cleanly.');
          resolve();
        } else {
          reject(new Error(response?.error || 'Unknown error ending session.'));
        }
      });
    });
  }


  // ===========================================================================
  // 5. DISCONNECT
  // ===========================================================================
  /*
    disconnect()
    
    ROLE: Close the socket connection.
    WHY:  Clean up resources when we're done or leaving the page.
  */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 SocketService: Disconnected.');
    }
  }


  // ===========================================================================
  // HELPER: ON (Listen to events)
  // ===========================================================================
  /*
    on(event, callback)
    
    ROLE: A wrapper to listen for custom events from the server.
    WHY:  In the future, the server might send events like 'ai:response'.
  */
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }


  // ===========================================================================
  // HELPER: OFF (Remove listeners)
  // ===========================================================================
  /*
    off(event)
    
    ROLE: Stop listening to a specific event.
    WHY:  Prevents memory leaks when components unmount.
  */
  off(event) {
    if (!this.socket) return;
    this.socket.off(event);
  }
}


// =============================================================================
// EXPORT (Singleton Pattern)
// =============================================================================

/*
  new SocketService()
  
  ROLE: Create a SINGLE instance of the service.
  WHY:  Every file that imports this gets the SAME object.
        This ensures only one WebSocket connection for the whole app.
*/
export default new SocketService();
