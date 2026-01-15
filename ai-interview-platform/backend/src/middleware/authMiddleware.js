/*
================================================================================
FIREBASE AUTH MIDDLEWARE
================================================================================
ROLE: Verify Firebase ID tokens on protected API routes.
WHY:  The backend must NEVER trust the frontend blindly.
      This middleware ensures every request to protected routes has a valid token.
HOW:  
      1. Extract token from Authorization header
      2. Verify with Firebase Admin SDK
      3. Attach user info to request object
      4. Continue to route handler (or reject if invalid)
================================================================================

MENTAL MODEL:
  Frontend: "I am user X, here's my ID token"
  This Middleware: "Let me verify that with Firebase..."
  Firebase: "Yes, that's really user X"
  Middleware: "OK, you may proceed. Route handler, here's the user info."
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  Import the auth instance from our Firebase config
  
  ROLE: We use auth.verifyIdToken() to check if tokens are valid
*/
const { auth } = require('../config/firebase.config');


// =============================================================================
// THE MIDDLEWARE FUNCTION
// =============================================================================

/*
  verifyFirebaseToken - Express middleware for authentication
  
  ROLE: Sits between the request and your route handler
  WHY:  Ensures only authenticated users can access protected routes
  HOW:  Checks the Authorization header, verifies token, attaches user to req
  
  USAGE:
    // Protect a single route:
    app.get('/api/me', verifyFirebaseToken, (req, res) => {
      res.json(req.user); // req.user is available because middleware set it
    });
    
    // Protect all routes under a path:
    app.use('/api/protected', verifyFirebaseToken);
    
  PARAMETERS (standard Express middleware signature):
    - req: The incoming request object
    - res: The response object (used to send errors)
    - next: Function to call the next middleware or route handler
*/
async function verifyFirebaseToken(req, res, next) {
  
  console.log('🔐 AuthMiddleware: Checking authorization...');
  
  // ===========================================================================
  // STEP 1: Extract the token from headers
  // ===========================================================================
  
  /*
    Authorization Header Format
    
    The standard format is: "Bearer <token>"
    
    EXAMPLE:
      Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR...
      
    We need to:
    1. Get the header value
    2. Check it starts with "Bearer "
    3. Extract just the token part
  */
  const authHeader = req.headers.authorization;
  
  // Check if header exists and has the right format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ AuthMiddleware: No valid Authorization header found');
    
    /*
      Return 401 Unauthorized
      
      WHY 401?
        - 401 = "You need to authenticate"
        - 403 = "You're authenticated but not allowed" (different meaning)
      
      We also set WWW-Authenticate header (best practice for 401 responses)
    */
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>'
    });
  }
  
  /*
    Extract the token
    
    "Bearer eyJhbGc..." → "eyJhbGc..."
    
    split(' ')[1] takes everything after the space
  */
  const idToken = authHeader.split(' ')[1];
  
  
  // ===========================================================================
  // STEP 2: Verify the token with Firebase
  // ===========================================================================
  
  try {
    
    /*
      auth.verifyIdToken(token)
      
      ROLE: Ask Firebase "Is this token valid and who does it belong to?"
      
      WHAT IT CHECKS:
        - Signature (was it really signed by Firebase?)
        - Expiration (is it still valid?)
        - Issuer (does it come from our project?)
        - Audience (was it meant for our project?)
      
      RETURNS (if valid):
        A "decoded token" object containing:
        - uid: The user's unique ID (MOST IMPORTANT)
        - email: User's email
        - email_verified: Boolean
        - name: Display name (if available)
        - picture: Profile photo URL (if available)
        - firebase: { sign_in_provider: 'google.com', ... }
        - iat: Issued at timestamp
        - exp: Expiration timestamp
        - aud: Audience (project ID)
        - iss: Issuer
        
      THROWS (if invalid):
        An error with codes like:
        - 'auth/id-token-expired'
        - 'auth/argument-error'
        - 'auth/id-token-revoked'
    */
    const decodedToken = await auth.verifyIdToken(idToken);
    
    console.log('✅ AuthMiddleware: Token verified for UID:', decodedToken.uid);
    
    
    // =========================================================================
    // STEP 3: Attach user info to the request object
    // =========================================================================
    
    /*
      req.user - Standard convention for authenticated user data
      
      ROLE: Makes user info available to all downstream handlers
      WHY:  Route handlers need to know WHO is making the request
      HOW:  We just add a property to the req object
      
      WHAT WE INCLUDE:
        - uid: The primary identifier (use this as database keys!)
        - email: For display or notifications
        - emailVerified: For extra security checks
        - name: Display purposes
        - picture: Avatar
    */
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null
    };
    
    
    // =========================================================================
    // STEP 4: Continue to the next middleware or route handler
    // =========================================================================
    
    /*
      next()
      
      ROLE: Pass control to the next function in the chain
      WHY:  If we don't call next(), the request hangs forever
      HOW:  Just call next() with no arguments for success
            Call next(error) to pass an error to error handlers
    */
    next();
    
  } catch (error) {
    
    // =========================================================================
    // HANDLE VERIFICATION ERRORS
    // =========================================================================
    
    console.error('❌ AuthMiddleware: Token verification failed:', error.code || error.message);
    
    /*
      Different error responses based on error type
      
      WHY: Helps the client understand what went wrong
    */
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Your session has expired. Please log in again.'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'TokenRevoked',
        message: 'Your session was revoked. Please log in again.'
      });
    }
    
    // Generic error for other cases
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'The provided authentication token is invalid.'
    });
  }
}


// =============================================================================
// EXPORT
// =============================================================================

/*
  Export the middleware function
  
  USAGE:
    const { verifyFirebaseToken } = require('./middleware/authMiddleware');
    app.get('/protected', verifyFirebaseToken, handler);
*/
module.exports = {
  verifyFirebaseToken
};
