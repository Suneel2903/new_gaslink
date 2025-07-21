const pool = require('../db.js');

const getAllDistributors = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM distributors ORDER BY business_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch distributors', details: err.message });
  }
};

const createDistributor = async (req, res) => {
  try {
    const { business_name, email, phone, address_line1, address_line2, city, state, postal_code, country } = req.body;
    if (!business_name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await pool.query(
      `INSERT INTO distributors (business_name, email, phone, address_line1, address_line2, city, state, postal_code, country, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [business_name, email, phone, address_line1, address_line2, city, state, postal_code, country || 'Nigeria']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create distributor', details: err.message });
  }
};

const updateDistributor = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['business_name', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'];
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
    values.push(id);
    const query = `UPDATE distributors SET ${updates.join(', ')}, updated_at = NOW() WHERE distributor_id = $${idx} RETURNING *`;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Distributor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update distributor', details: err.message });
  }
};

const deleteDistributor = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'UPDATE distributors SET deleted_at = NOW() WHERE distributor_id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Distributor not found' });
    res.json({ message: 'Distributor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete distributor', details: err.message });
  }
};

const getDistributorDetails = async (req, res) => {
  try {
    const { role } = req.user;
    let { distributor_id } = req.user;
    if (role === 'super_admin') {
      distributor_id = req.query.distributor_id;
      if (!distributor_id) {
        return res.status(400).json({ error: 'Super admin must select a distributor first.' });
      }
    }
    if (!distributor_id) {
      return res.status(400).json({ error: 'Missing distributor_id in request.' });
    }
    // Example SQL query:
    // const result = await pool.query('SELECT * FROM distributors WHERE distributor_id = $1', [distributor_id]);
    // ...rest of your logic...
  } catch (err) {
    // ...
  }
};

module.exports = {
  getAllDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor,
  getDistributorDetails
}; 