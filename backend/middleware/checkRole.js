// backend/middleware/checkRole.js
module.exports.checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      console.warn('checkRole: Missing user role', req.user);
      return res.status(403).json({ error: 'Forbidden: No user role' });
    }
    if (!allowedRoles.includes(userRole)) {
      console.warn(`checkRole: Role ${userRole} not in allowed roles`, allowedRoles);
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
    next();
  };
}; 