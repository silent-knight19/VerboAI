/*
================================================================================
SOCKET AUTH MIDDLEWARE (Backend)
================================================================================
ROLE: The Bouncer 🛡️

WHY:  
  - We cannot let just anyone connect to our real-time server.
  - WebSockets bypass normal HTTP middleware, so we need a separate check.
  - This middleware verifies the user's Firebase token before allowing connection.

HOW:
  - Socket.io has a "handshake" phase when a client first connects.
  - The client sends their token in `socket.handshake.auth.token`.
  - We verify this token using Firebase Admin SDK.
  - If valid: Attach user info to `socket.user` and call `next()`.
  - If invalid: Call `next(Error)` to reject the connection immediately.

FLOW:
  1. Client connects: io({ auth: { token: '...' } })
  2. This middleware runs.
  3. We extract the token from handshake.
  4. We verify with Firebase Admin.
  5. If valid -> socket.user = { uid, email, name }; next()
  6. If invalid -> next(new Error('Authentication error'))
  7. The connection is either accepted or rejected.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  firebase-admin - Firebase Admin SDK.
  
  ROLE: Allows server-side Firebase operations.
  WHY:  We need `admin.auth().verifyIdToken()` to validate the user's token.
  
  NOTE: This must be initialized in firebase.config.js before this file runs.
*/
const admin = require('firebase-admin');


// =============================================================================
// THE MIDDLEWARE FUNCTION
// =============================================================================

/*
  socketAuth(socket, next)
  
  ROLE: Verify the Firebase ID token for an incoming socket connection.
  
  PARAMS:
    - socket: The socket connection being established.
    - next:   Function to call when done.
              - next()         = Allow connection.
              - next(Error)    = Reject connection.
  
  WHAT WE CHECK:
    1. Is there a token in the handshake?
    2. Is the token valid (not expired, not forged)?
  
  WHAT WE DO ON SUCCESS:
    - Attach user info to `socket.user` so handlers can use it.
    - Call next() to proceed.
  
  WHAT WE DO ON FAILURE:
    - Call next(Error) to reject the connection.
    - The client receives a 'connect_error' event.
*/
async function socketAuth(socket, next) {
  console.log('🔒 SocketAuth: Checking credentials for new connection...');

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Extract the token from the handshake
    // -------------------------------------------------------------------------
    /*
      socket.handshake.auth
      
      WHAT: An object containing the 'auth' data sent by the client.
      
      The client sends this when connecting:
        io('http://localhost:3000', {
          auth: {
            token: 'the-firebase-id-token'
          }
        })
      
      So socket.handshake.auth.token contains the token.
    */
    const token = socket.handshake.auth.token;

    // Guard: If no token was provided, reject immediately.
    if (!token) {
      console.log('❌ SocketAuth: No token provided. Rejecting connection.');
      return next(new Error('Authentication error: Token required'));
    }

    // -------------------------------------------------------------------------
    // STEP 2: Verify the token with Firebase Admin
    // -------------------------------------------------------------------------
    /*
      admin.auth().verifyIdToken(token)
      
      WHAT: Validates the token and decodes it.
      
      RETURNS: A decoded token object with user info:
        {
          uid: 'user-firebase-uid',
          email: 'user@example.com',
          name: 'John Doe',
          ... other claims
        }
      
      THROWS: Error if token is invalid, expired, or forged.
    */
    const decodedToken = await admin.auth().verifyIdToken(token);

    // -------------------------------------------------------------------------
    // STEP 3: Attach user info to the socket
    // -------------------------------------------------------------------------
    /*
      socket.user = { ... }
      
      WHY:  
        - We attach the verified user info so that event handlers can use it.
        - For example, in session.handler.js, we do: const uid = socket.user.uid;
      
      WHAT WE STORE:
        - uid:   The unique Firebase user ID (most important).
        - email: The user's email address.
        - name:  The user's display name.
    */
    socket.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };

    console.log(`✅ SocketAuth: Welcome, ${socket.user.email} (${socket.user.uid})`);
    
    // -------------------------------------------------------------------------
    // STEP 4: Call next() to allow the connection
    // -------------------------------------------------------------------------
    /*
      next()
      
      WHAT: Tells Socket.io to proceed with the connection.
      
      After this, the socket is fully connected and the 'connection' event fires.
    */
    next();

  } catch (error) {
    // -------------------------------------------------------------------------
    // ERROR HANDLING: Token is invalid
    // -------------------------------------------------------------------------
    /*
      Possible reasons for failure:
        - Token is expired (Firebase tokens expire after 1 hour).
        - Token is malformed (someone tried to send a fake token).
        - Token was revoked (user signed out on another device).
      
      We reject the connection with a generic error message.
      (We don't reveal specifics for security reasons.)
    */
    console.error('❌ SocketAuth: Token verification failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
}


// =============================================================================
// EXPORT
// =============================================================================

/*
  Export the middleware function.
  
  USAGE (in socket.server.js):
    const socketAuth = require('./middleware/socketAuth');
    io.use(socketAuth);
*/
module.exports = socketAuth;
