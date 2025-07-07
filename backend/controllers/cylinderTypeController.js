const pool = require('../db.js');

const listCylinderTypes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cylinder_type_id, name, capacity_kg, description, price FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL ORDER BY capacity_kg ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List cylinder types error:', err);
    res.status(500).json({ error: 'Failed to fetch cylinder types' });
  }
};

const updateCylinderPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    if (!price || isNaN(price)) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    const result = await pool.query(
      'UPDATE cylinder_types SET price = $1, updated_at = NOW() WHERE cylinder_type_id = $2 RETURNING *',
      [price, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cylinder type not found' });
    }
    res.json({ cylinder_type: result.rows[0] });
  } catch (err) {
    console.error('Update cylinder price error:', err);
    res.status(500).json({ error: 'Failed to update cylinder price' });
  }
};

// Get all cylinder types
const getAllCylinderTypes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cylinder_type_id, name, capacity_kg, description, price, is_active, created_at, updated_at FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL ORDER BY capacity_kg ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List cylinder types error:', err);
    res.status(500).json({ error: 'Failed to fetch cylinder types' });
  }
};

// Create a new cylinder type
const createCylinderType = async (req, res) => {
  try {
    const { name, capacity_kg, description, price } = req.body;
    if (!name || !capacity_kg || isNaN(capacity_kg)) {
      return res.status(400).json({ error: 'Name and valid capacity_kg are required' });
    }
    const result = await pool.query(
      `INSERT INTO cylinder_types (name, capacity_kg, description, price, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW()) RETURNING *`,
      [name, capacity_kg, description || '', price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create cylinder type error:', err);
    res.status(500).json({ error: 'Failed to create cylinder type' });
  }
};

// Update a cylinder type
const updateCylinderType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity_kg, description, price, is_active } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (capacity_kg !== undefined) { fields.push(`capacity_kg = $${idx++}`); values.push(capacity_kg); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(price); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await pool.query(
      `UPDATE cylinder_types SET ${fields.join(', ')}, updated_at = NOW() WHERE cylinder_type_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cylinder type not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update cylinder type error:', err);
    res.status(500).json({ error: 'Failed to update cylinder type' });
  }
};

// Delete (soft delete) a cylinder type
const deleteCylinderType = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE cylinder_types SET deleted_at = NOW(), is_active = FALSE WHERE cylinder_type_id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cylinder type not found' });
    res.json({ message: 'Cylinder type deleted', cylinder_type: result.rows[0] });
  } catch (err) {
    console.error('Delete cylinder type error:', err);
    res.status(500).json({ error: 'Failed to delete cylinder type' });
  }
};

module.exports = {
  listCylinderTypes,
  updateCylinderPrice,
  getAllCylinderTypes,
  createCylinderType,
  updateCylinderType,
  deleteCylinderType
}; 