/*
================================================================================
SOCKET SERVER ENTRY POINT (Backend)
================================================================================
ROLE: The Hotel Lobby 🏠

WHY:  
  - This file sets up the "Real-Time Department" of our backend.
  - It's the first place Socket.io connections arrive.
  - It applies security (socketAuth) and routes connections to handlers.

HOW:
  - We export a function `initializeSocket(httpServer)`.
  - This function is called from `index.js` after the HTTP server starts.
  - We create the Socket.io server, apply middleware, and register handlers.

FLOW:
  1. `index.js` starts the HTTP server.
  2. `index.js` calls `initializeSocket(server)`.
  3. We create the Socket.io instance attached to that server.
  4. When a user connects:
     a. The socketAuth middleware checks their token.
     b. If valid, we register event handlers for that socket.
  5. The socket is now ready to receive events like 'session:start'.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  Server - The Socket.io Server class.
  
  ROLE: Creates the WebSocket server.
  WHY:  We need this to accept real-time connections.
  HOW:  We create a new Server and attach it to our HTTP server.
*/
const { Server } = require('socket.io');

/*
  socketAuth - Our authentication middleware.
  
  ROLE: Verifies Firebase tokens for incoming connections.
  WHY:  We don't want random people connecting.
*/
const socketAuth = require('./middleware/socketAuth');

/*
  sessionHandler - Event handlers for interview sessions.
  
  ROLE: Defines what happens on 'session:start', 'session:end', etc.
*/
const sessionHandler = require('./handlers/session.handler');


// =============================================================================
// MODULE STATE
// =============================================================================

/*
  io - Holds the Socket.io server instance.
  
  WHY:  We need to store this so other parts of the app can use it.
        For example, to broadcast a message to all connected users.
  
  NOTE: This is a module-level variable (shared across all requires).
*/
let io = null;


// =============================================================================
// INITIALIZE FUNCTION
// =============================================================================

/*
  initializeSocket(httpServer)
  
  ROLE: Sets up the entire Socket.io infrastructure.
  
  PARAMS:
    - httpServer: The Node.js HTTP server instance (from `http.createServer(app)`).
  
  RETURNS: The Socket.io server instance (`io`).
  
  WHY:
    - Socket.io needs to "attach" to an HTTP server.
    - This allows it to upgrade HTTP connections to WebSockets.
  
  HOW:
    1. Create a new Server with configuration.
    2. Apply middleware (socketAuth).
    3. Register the 'connection' event handler.
*/
function initializeSocket(httpServer) {
  console.log('🔌 SocketServer: Initializing...');

  // ---------------------------------------------------------------------------
  // STEP 1: Create the Socket.io Server
  // ---------------------------------------------------------------------------
  /*
    new Server(httpServer, options)
    
    - httpServer: The HTTP server to attach to.
    - options: Configuration object.
  */
  io = new Server(httpServer, {
    // -------------------------------------------------------------------------
    // CORS Configuration
    // -------------------------------------------------------------------------
    /*
      CORS (Cross-Origin Resource Sharing)
      
      WHY: 
        - Our frontend (http://localhost:5173) and backend (http://localhost:3000)
          are different "origins".
        - By default, browsers block cross-origin requests for security.
        - We explicitly allow it here.
      
      NOTE: In production, replace '*' with your actual frontend URL for security.
    */
    cors: {
      origin: '*', // Allow all origins (for development convenience).
      methods: ['GET', 'POST']
    }
  });

  // ---------------------------------------------------------------------------
  // STEP 2: Apply Authentication Middleware
  // ---------------------------------------------------------------------------
  /*
    io.use(middleware)
    
    ROLE: Run a function on EVERY incoming connection.
    
    HOW:
      - socketAuth receives (socket, next).
      - If the user is authenticated, it calls next().
      - If not, it calls next(Error) to reject the connection.
    
    Every socket that passes this step will have `socket.user` populated.
  */
  io.use(socketAuth);

  // ---------------------------------------------------------------------------
  // STEP 3: Handle Connections
  // ---------------------------------------------------------------------------
  /*
    io.on('connection', callback)
    
    ROLE: Fires whenever a new socket successfully connects (after middleware).
    
    PARAMS:
      - socket: The new socket connection.
    
    At this point, the user is authenticated (socketAuth passed).
    We can now register event handlers specific to this socket.
  */
  io.on('connection', (socket) => {
    // The user is authenticated. socket.user contains their info.
    
    // Register the session event handlers (start, heartbeat, end, disconnect).
    sessionHandler(io, socket);
    
    // You can add more handlers here in the future.
    // For example: chatHandler(io, socket), adminHandler(io, socket), etc.
  });

  console.log('✅ SocketServer: Ready for connections.');
  return io;
}


// =============================================================================
// GETTER FUNCTION
// =============================================================================

/*
  getIO()
  
  ROLE: Returns the Socket.io instance.
  
  WHY:
    - Other parts of the app might need to broadcast messages.
    - For example: `getIO().emit('notification', { message: 'Hello everyone!' })`.
  
  THROWS: Error if called before initializeSocket().
*/
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized! Call initializeSocket() first.');
  }
  return io;
}


// =============================================================================
// EXPORTS
// =============================================================================

/*
  We export two functions:
  
  1. initializeSocket: Called once at startup to set up everything.
  2. getIO:            Called anytime you need access to the io instance.
*/
module.exports = {
  initializeSocket,
  getIO
};
