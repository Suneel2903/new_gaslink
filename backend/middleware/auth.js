import admin from 'firebase-admin';
import pool from '../db.js';

// Initialize Firebase Admin (commented out for now - will be configured later)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
// });

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // For development, accept a dev token and set a valid user object
    if (token === 'dev-token') {
      req.user = {
        user_id: '11111111-1111-1111-1111-111111111111',
        distributor_id: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        email: 'admin@dist1.com',
        firebase_uid: 'dev-token',
        status: 'active'
      };
      return next();
    }

    // Try to find user by token in database
    const { rows } = await pool.query(
      'SELECT user_id, email, distributor_id, role FROM users WHERE firebase_uid = $1 AND status = $2',
      [token, 'active']
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles) => {
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

export default authenticateUser; 