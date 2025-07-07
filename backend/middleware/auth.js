const admin = require('firebase-admin');
const pool = require('../db.js');

// Initialize Firebase Admin (commented out for now - will be configured later)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
// });

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split('Bearer ')[1];

    // Dev token shortcut
    if (token === 'dev-token') {
      req.user = {
        uid: 'dev-token',
        email: 'admin@dist1.com',
        role: 'super_admin',
        distributor_id: null
      };
      return next();
    }

    // Try to verify Firebase token
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      // Fallback: try DB lookup by firebase_uid
      const { rows } = await pool.query(
        'SELECT firebase_uid as uid, email, role, distributor_id FROM users WHERE firebase_uid = $1 AND status = $2',
        [token, 'active']
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.user = rows[0];
      if (req.user.role === 'super_admin') req.user.distributor_id = null;
      if (!req.user.role || (!req.user.distributor_id && req.user.role !== 'super_admin')) {
        console.warn('User missing role or distributor_id', req.user);
      }
      return next();
    }

    // Attach user info from Firebase claims
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role,
      distributor_id: decoded.distributor_id || null
    };
    if (req.user.role === 'super_admin') req.user.distributor_id = null;
    if (!req.user.role || (!req.user.distributor_id && req.user.role !== 'super_admin')) {
      console.warn('User missing role or distributor_id', req.user);
    }
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

module.exports = {
  authenticateUser,
  requireRole,
  default: authenticateUser
}; 