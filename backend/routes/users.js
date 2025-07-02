import express from 'express';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all users for distributor
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { role, status } = req.query;
    let query = `
      SELECT u.*, d.business_name as distributor_name
      FROM users u
      JOIN distributors d ON u.distributor_id = d.distributor_id
      WHERE u.distributor_id = $1 AND u.deleted_at IS NULL
    `;
    const params = [req.user.distributor_id];
    let paramCount = 1;

    if (role) {
      paramCount++;
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (status) {
      paramCount++;
      query += ` AND u.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY u.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    const { rows } = await pool.query(
      `SELECT u.*, d.business_name as distributor_name
       FROM users u
       JOIN distributors d ON u.distributor_id = d.distributor_id
       WHERE u.user_id = $1 AND u.distributor_id = $2 AND u.deleted_at IS NULL`,
      [userId, req.user.distributor_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create new user
router.post('/', authenticateUser, requireRole(['super_admin', 'distributor_admin']), async (req, res) => {
  try {
    const {
      email,
      first_name,
      last_name,
      phone,
      role,
      distributor_id
    } = req.body;

    // Check if user already exists
    const { rows: existingUser } = await pool.query(
      'SELECT user_id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const firebase_uid = uuidv4();
    const user_id = uuidv4();

    const { rows } = await pool.query(
      `INSERT INTO users (
        user_id, distributor_id, firebase_uid, email, first_name, last_name, phone, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [user_id, distributor_id || req.user.distributor_id, firebase_uid, email, first_name, last_name, phone, role]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:userId', authenticateUser, requireRole(['super_admin', 'distributor_admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      first_name,
      last_name,
      phone,
      role,
      status
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6 AND distributor_id = $7 AND deleted_at IS NULL
       RETURNING *`,
      [first_name, last_name, phone, role, status, userId, req.user.distributor_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/:userId', authenticateUser, requireRole(['super_admin', 'distributor_admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow users to delete themselves
    if (userId === req.user.user_id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { rows } = await pool.query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND distributor_id = $2 AND deleted_at IS NULL RETURNING *',
      [userId, req.user.distributor_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get current user profile
router.get('/profile/me', authenticateUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*, d.business_name as distributor_name
       FROM users u
       JOIN distributors d ON u.distributor_id = d.distributor_id
       WHERE u.user_id = $1 AND u.deleted_at IS NULL`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update current user profile
router.put('/profile/me', authenticateUser, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [first_name, last_name, phone, req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get users by role
router.get('/role/:role', authenticateUser, async (req, res) => {
  try {
    const { role } = req.params;

    const { rows } = await pool.query(
      `SELECT u.*, d.business_name as distributor_name
       FROM users u
       JOIN distributors d ON u.distributor_id = d.distributor_id
       WHERE u.distributor_id = $1 AND u.role = $2 AND u.status = 'active' AND u.deleted_at IS NULL
       ORDER BY u.first_name, u.last_name`,
      [req.user.distributor_id, role]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ error: 'Failed to get users by role' });
  }
});

// Change user status
router.patch('/:userId/status', authenticateUser, requireRole(['super_admin', 'distributor_admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { rows } = await pool.query(
      `UPDATE users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND distributor_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [status, userId, req.user.distributor_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Change user status error:', error);
    res.status(500).json({ error: 'Failed to change user status' });
  }
});

export default router; 