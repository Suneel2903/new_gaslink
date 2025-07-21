const admin = require('firebase-admin');
const pool = require('../db.js');

// Initialize Firebase Admin (commented out for now - will be configured later)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
// });

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("Decoded Firebase UID:", decodedToken.uid);
    
    // Fetch user details from database including distributor_id
    const userResult = await pool.query(
      `SELECT user_id, firebase_uid, email, first_name, last_name, role, distributor_id, status 
       FROM users WHERE firebase_uid = $1 AND status = 'active'`,
      [decodedToken.uid]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "User not found in database" });
    }
    
    const user = userResult.rows[0];
    req.user = {
      ...decodedToken,
      ...user
    };
    
    console.log("User authenticated:", { 
      user_id: user.user_id, 
      distributor_id: user.distributor_id, 
      role: user.role 
    });
    
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid token" });
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
  verifyFirebaseToken,
  requireRole,
  default: verifyFirebaseToken
}; 