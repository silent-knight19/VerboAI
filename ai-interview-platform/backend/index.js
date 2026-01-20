/*
================================================================================
BACKEND SERVER ENTRY POINT (index.js)
================================================================================
ROLE: This file creates and starts our Express web server.
WHY:  We need a backend to handle things the frontend can't do:
      - Store data securely
      - Process audio/video
      - Communicate with AI services (OpenAI, Deepgram, etc.)
HOW:  Express is a Node.js framework that makes it easy to create web servers.
================================================================================

WHAT IS A WEB SERVER?
A web server is a program that:
1. Listens for requests from clients (like web browsers)
2. Processes those requests (read database, call APIs, etc.)
3. Sends back responses (JSON data, HTML pages, etc.)

Our frontend sends requests to this backend, and the backend responds with data.
================================================================================
*/

// =============================================================================
// IMPORTS using require() - CommonJS Style
// =============================================================================

/*
  require() vs import
  
  ROLE: Load external modules (libraries)
  WHY:  Node.js historically uses require() (CommonJS)
        Frontend uses import (ES Modules)
  HOW:  require('package-name') returns the module's exports
  
  NOTE: You CAN use import in Node.js with "type": "module" in package.json
        But require() is more common in backend JavaScript
*/

/*
  express - The web framework
  
  ROLE: Makes it easy to create web servers and APIs
  WHY:  Without Express, we'd have to write a lot more code
        Express handles HTTP parsing, routing, middleware, etc.
  HOW:  We create an "app" and define routes on it
*/
const express = require('express');
const http = require('http'); // [NEW] Needed for Socket.io
const { initializeSocket } = require('./src/socket/socket.server'); // [NEW] Our Socket Module

/*
  cors - Cross-Origin Resource Sharing middleware
  
  ROLE: Allows requests from different domains
  WHY:  By default, browsers block requests from different origins
        Our frontend (localhost:5173) and backend (localhost:3000) are different origins
        Without CORS, the browser would block frontend requests to backend
  HOW:  We use it as middleware: app.use(cors())
  
  WHAT IS "ORIGIN"?
  Origin = protocol + domain + port
  - http://localhost:5173 (frontend)
  - http://localhost:3000 (backend)
  These are DIFFERENT origins, so CORS is needed
*/
const cors = require('cors');

/*
  dotenv - Environment variable loader
  
  ROLE: Loads variables from .env file into process.env
  WHY:  We don't want to hardcode secrets (API keys, passwords)
        .env files keep secrets out of source code
  HOW:  After dotenv.config(), we can access process.env.VARIABLE_NAME
  
  EXAMPLE .env file:
    PORT=3000
    DATABASE_URL=mongodb://...
    API_KEY=secret123
*/
const dotenv = require('dotenv');

/*
  verifyFirebaseToken - Our authentication middleware
  
  ROLE: Verifies Firebase ID tokens on protected routes
  WHY:  Prevents unauthorized access to sensitive endpoints
  HOW:  Place it before any route handler that needs protection
*/
const { verifyFirebaseToken } = require('./src/middleware/authMiddleware');

/*
  UserService - Firestore operations for users
  
  ROLE: Create, read, and update user documents in Firestore
  WHY:  Keeps database logic separate from route handlers
*/
const UserService = require('./src/services/user.service');


// =============================================================================
// CONFIGURATION
// =============================================================================

/*
  dotenv.config()
  
  ROLE: Read the .env file and load variables
  WHY:  Without this, process.env wouldn't have our custom variables
  HOW:  Looks for .env in the current directory
        Parses it and adds each line to process.env
  
  MUST BE CALLED EARLY - before you try to access any env variables
*/
dotenv.config();


// =============================================================================
// CREATE THE EXPRESS APP
// =============================================================================

/*
  express()
  
  ROLE: Creates an Express application instance
  WHY:  This is the main object we'll use to define routes, middleware, etc.
  HOW:  Returns an "app" object with methods like .get(), .post(), .use(), etc.
*/
const app = express();
const server = http.createServer(app); // [NEW] Wrap Express in HTTP Server

/*
  process.env.PORT || 3000
  
  ROLE: Determine which port to listen on
  WHY:  
    - In production, hosts like Heroku set the PORT environment variable
    - In development, we use a default (3000)
  HOW:  
    - || is the "OR" operator
    - If process.env.PORT is undefined, use 3000
    - This is called a "fallback" or "default value" pattern
*/
const PORT = process.env.PORT || 3000;


// =============================================================================
// MIDDLEWARE
// =============================================================================

/*
  WHAT IS MIDDLEWARE?
  
  Middleware are functions that run on EVERY request, before your route handlers.
  They can:
  - Modify the request (req) or response (res) objects
  - End the request-response cycle
  - Call the next middleware in the stack
  
  They run in the order you define them (top to bottom)
*/

/*
  app.use(cors())
  
  ROLE: Allow cross-origin requests
  WHY:  Without this, browsers would block requests from our frontend
  HOW:  
    - cors() returns a middleware function
    - app.use() tells Express to use it for all routes
    - It adds headers like "Access-Control-Allow-Origin" to responses
*/
app.use(cors());

/*
  app.use(express.json())
  
  ROLE: Parse JSON request bodies
  WHY:  When frontend sends JSON data (like { name: "John" }), we need to parse it
        Without this, req.body would be undefined
  HOW:  
    - Checks if Content-Type is application/json
    - Parses the JSON string into a JavaScript object
    - Puts it in req.body
  
  EXAMPLE:
    Frontend sends: POST /users with body {"name": "John"}
    With this middleware: req.body = { name: "John" }
    Without this middleware: req.body = undefined
*/
app.use(express.json());


// =============================================================================
// ROUTES
// =============================================================================

/*
  WHAT ARE ROUTES?
  
  Routes define what happens when someone visits a URL.
  
  SYNTAX: app.METHOD(PATH, HANDLER)
  - METHOD: HTTP method (get, post, put, delete, etc.)
  - PATH: URL path ('/users', '/api/interviews', etc.)
  - HANDLER: Function that handles the request
  
  The handler receives:
  - req (request): Information about the incoming request
  - res (response): Object to send the response
*/

/*
  Home route - GET /
  
  ROLE: Simple check to see if server is running
  WHY:  Useful for quick testing and health checks
  HOW:  When someone visits the root URL, send a message
  
  req.query, req.params, req.body are ways to get data from requests:
  - req.query: URL query params like ?name=John
  - req.params: URL params like /users/:id
  - req.body: POST/PUT body data (parsed JSON)
*/
app.get('/', function (req, res) {
  
  /*
    res.send()
    
    ROLE: Send a response to the client
    WHY:  Every request needs a response, or it will hang
    HOW:  Accepts strings, objects, arrays, Buffers
          Automatically sets Content-Type header
  */
  res.send('AI Interview Platform Backend is Running!');
});

/*
  Health check route - GET /health
  
  ROLE: Detailed status for monitoring systems
  WHY:  DevOps tools (Kubernetes, load balancers) check this endpoint
        to know if the server is healthy
  HOW:  Return a JSON object with status info
*/
app.get('/health', function (req, res) {
  
  /*
    res.json()
    
    ROLE: Send a JSON response
    WHY:  APIs typically communicate in JSON format
    HOW:  
      - Takes a JavaScript object
      - Converts it to JSON string
      - Sets Content-Type to application/json
      - Sends the response
  */
  res.json({
    status: 'ok',
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});


/*
  Protected route - GET /api/me
  
  ROLE: The "Who Am I" endpoint — syncs user with Firestore
  WHY:  This is the SINGLE point where users are created/updated in Firestore.
        - First login: Creates a new user document
        - Returning user: Updates lastLoginAt
  HOW:  
    1. verifyFirebaseToken runs first (the middleware)
    2. If token is valid, req.user is populated with { uid, email, ... }
    3. We call UserService.getOrCreateUser() to sync with Firestore
    4. We return the full Firestore profile to the frontend
  
  SECURITY: Only accessible with a valid Firebase ID token!
*/
app.get('/api/me', verifyFirebaseToken, async function (req, res) {
  
  console.log('📧 /api/me: Processing request for UID:', req.user.uid);
  
  try {
    /*
      Prepare user data from the verified token
      
      req.user was set by verifyFirebaseToken middleware.
      We pass this to UserService to create/update the Firestore document.
    */
    const tokenUser = {
      uid: req.user.uid,
      email: req.user.email,
      displayName: req.user.name || null,
      photoURL: req.user.picture || null,
      authProvider: 'google' // For now, we only support Google
    };
    
    /*
      getOrCreateUser - The core sync logic
      
      Returns:
      - user: The Firestore user document
      - isNewUser: true if this was their first login
    */
    const { user, isNewUser } = await UserService.getOrCreateUser(tokenUser);
    
    if (isNewUser) {
      console.log('🎉 /api/me: New user created in Firestore!');
    } else {
      console.log('👋 /api/me: Returning user, updated lastLoginAt');
    }
    
    /*
      Return the full Firestore profile
      
      The frontend will store this in auth.store as `profile`.
      This is richer than just the token data because it includes
      our app-specific fields like role, onboardingCompleted, etc.
    */
    res.json({
      success: true,
      user: user,
      isNewUser: isNewUser
    });
    
  } catch (error) {
    console.error('❌ /api/me: Error syncing user:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to sync user profile',
      message: error.message
    });
  }
});
// Correct Import (CommonJS)
// We don't import individual functions here because we attached them to UserService object
// const UserService = require('./src/services/user.service'); // Already imported at line 96

/*
  session routes - POST /api/session/...
  
  ROLE: Manage the interview session lifecycle (Start, Beat, End)
*/

// 1. START SESSION
app.post('/api/session/start', verifyFirebaseToken, async function (req, res) {
  try {
    const sessionId = await UserService.startInterviewSession(req.user.uid);
    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. HEARTBEAT (The Pulse)
app.post('/api/session/heartbeat', verifyFirebaseToken, async function (req, res) {
  try {
    await UserService.updateHeartbeat(req.user.uid);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. END SESSION
app.post('/api/session/end', verifyFirebaseToken, async function (req, res) {
  try {
    // Note: We don't need duration from client anymore (Security Fix)
    await UserService.endInterviewSession(req.user.uid);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


// =============================================================================
// START THE SERVER
// =============================================================================

/*
  app.listen(PORT, callback)
  
  ROLE: Start the server and begin listening for requests
  WHY:  Without this, the server wouldn't actually run
  HOW:  
    - Binds to the specified port
    - Starts accepting connections
    - Calls the callback when ready
  
  WHAT IS A PORT?
  - Think of it like an apartment number in a building
  - The building is your computer (IP address)
  - The port is the specific "door" to your application
  - Only one application can use a port at a time
*/
// START THE SERVER (Modified for Socket.io)
// We listen on 'server', not 'app'
server.listen(PORT, function () {
  
  // This callback runs when the server starts successfully
  console.log('=================================');
  console.log('AI Interview Platform Backend');
  console.log('=================================');
  console.log('Server is running on port ' + PORT);
  
  // Initialize Socket.io (After server is created)
  initializeSocket(server);
  
  console.log('Visit: http://localhost:' + PORT);
  console.log('=================================');
  
});

/*
  WHAT HAPPENS NOW?
  
  1. Server is listening on port 3000 (or whatever PORT is set to)
  2. When a request comes in (like GET /):
     a. Express receives the HTTP request
     b. Middleware runs in order (cors, json parser)
     c. Express finds matching route handler
     d. Route handler runs and sends response
  3. Client receives the response
  4. Repeat for each request
  
  The server keeps running until you stop it (Ctrl+C)
*/
