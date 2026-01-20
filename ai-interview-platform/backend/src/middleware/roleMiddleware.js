/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * ROLE: Checks if the logged-in user has permission to view a route.
 * WHY:  Even though we only have 'user' role right now, this prepares
 *       us for future admin features without rewriting code.
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Check if user is logged in (handled by previous middleware)
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    // 2. IMPORTANT: In a real app with 1M users, we would put the role 
    //    inside the Firebase Token (Custom Claims) to avoid a database call here.
    //    For this version, we assume req.user.role exists.
    const userRole = req.user.role || 'user'; // Default to 'user' if missing

    // 3. Check if the user's role is in the allowed list
    if (allowedRoles.includes(userRole)) {
      next(); // Role matches! Proceed.
    } else {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to access this resource' 
      });
    }
  };
};

module.exports = checkRole;