const { Pool } = require('pg');
const { getEffectiveUserId } = require('../utils/authUtils');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// List all users (optionally filter by distributor for distributor_admin)
const getAllUsers = async (req, res) => {
  try {
    let query = 'SELECT user_id, distributor_id, firebase_uid, email, first_name, last_name, phone, role, status, last_login, created_at, updated_at FROM users WHERE deleted_at IS NULL';
    let params = [];
    if (req.user.role === 'distributor_admin') {
      query += ' AND distributor_id = $1';
      params.push(req.user.distributor_id);
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
};

// Get a single user by ID
const getUser = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req.user);
    let query = 'SELECT user_id, distributor_id, firebase_uid, email, first_name, last_name, phone, role, status, last_login, created_at, updated_at FROM users WHERE user_id = $1 AND deleted_at IS NULL';
    let params = [userId];
    // Restrict distributor_admin to their own distributor
    if (req.user.role === 'distributor_admin') {
      query += ' AND distributor_id = $2';
      params.push(req.user.distributor_id);
    }
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const { distributor_id, firebase_uid, email, first_name, last_name, phone, role, status } = req.body;
    const result = await pool.query(
      `INSERT INTO users (distributor_id, firebase_uid, email, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING user_id, distributor_id, firebase_uid, email, first_name, last_name, phone, role, status, created_at, updated_at`,
      [distributor_id, firebase_uid, email, first_name, last_name, phone, role, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req.user);
    const fields = ['distributor_id', 'firebase_uid', 'email', 'first_name', 'last_name', 'phone', 'role', 'status'];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${idx} AND deleted_at IS NULL RETURNING *`;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
};

// Delete (soft delete) a user
const deleteUser = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req.user);
    const { rows } = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL RETURNING *',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
};

// Set a user's role (and optionally status)
const setUserRole = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req.user);
    const { role, status } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });
    const { rows } = await pool.query(
      'UPDATE users SET role = $1, status = COALESCE($2, status), updated_at = NOW() WHERE user_id = $3 AND deleted_at IS NULL RETURNING *',
      [role, status, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User role updated', user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role', details: err.message });
  }
};

// Get current user's profile
const getMyProfile = async (req, res) => {
  try {
    let result;
    if (req.user.user_id) {
      result = await pool.query(
        'SELECT email, role, distributor_id FROM users WHERE user_id = $1 AND deleted_at IS NULL',
        [req.user.user_id]
      );
    } else if (req.user.firebase_uid || req.user.uid) {
      result = await pool.query(
        'SELECT email, role, distributor_id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL',
        [req.user.firebase_uid || req.user.uid]
      );
    } else {
      return res.status(401).json({ error: 'User authentication required' });
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
};

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setUserRole,
  getMyProfile
}; 