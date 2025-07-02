import pool from '../db.js';

export const listCylinderTypes = async (req, res) => {
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

export const updateCylinderPrice = async (req, res) => {
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