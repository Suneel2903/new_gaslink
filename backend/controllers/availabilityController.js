const pool = require('../db');

// Mark driver or vehicle unavailable for a date
exports.markUnavailable = async (req, res) => {
  try {
    const { entity_type, entity_id, date, reason } = req.body;
    const result = await pool.query(
      `INSERT INTO availability (entity_type, entity_id, date, status, reason)
       VALUES ($1, $2, $3, 'unavailable', $4) RETURNING *`,
      [entity_type, entity_id, date, reason]
    );
    res.json({ success: true, availability: result.rows[0] });
  } catch (err) {
    console.error('markUnavailable error:', err);
    res.status(500).json({ error: 'Failed to mark unavailable' });
  }
};

// List unavailable drivers/vehicles for a date/entity_type
exports.listUnavailableEntities = async (req, res) => {
  try {
    const { entity_type, date } = req.query;
    const result = await pool.query(
      `SELECT * FROM availability WHERE entity_type = $1 AND date = $2 AND status = 'unavailable' ORDER BY created_at DESC`,
      [entity_type, date]
    );
    res.json({ unavailable: result.rows });
  } catch (err) {
    console.error('listUnavailableEntities error:', err);
    res.status(500).json({ error: 'Failed to fetch unavailable entities' });
  }
};

// Mark driver or vehicle available for a date
exports.markAvailable = async (req, res) => {
  try {
    const { entity_type, entity_id, date } = req.body;
    // Remove any unavailable record for this entity/date
    await pool.query(
      `DELETE FROM availability WHERE entity_type = $1 AND entity_id = $2 AND date = $3 AND status = 'unavailable'`,
      [entity_type, entity_id, date]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('markAvailable error:', err);
    res.status(500).json({ error: 'Failed to mark available' });
  }
};

// Get availability status for all entities of a type for a date
exports.getAvailabilityStatus = async (req, res) => {
  try {
    const { entity_type, date } = req.query;
    // Get all unavailable entities for the date
    const unavailableResult = await pool.query(
      `SELECT entity_id FROM availability WHERE entity_type = $1 AND date = $2 AND status = 'unavailable'`,
      [entity_type, date]
    );
    const unavailableIds = unavailableResult.rows.map(row => row.entity_id);
    res.json({ unavailable: unavailableIds });
  } catch (err) {
    console.error('getAvailabilityStatus error:', err);
    res.status(500).json({ error: 'Failed to fetch availability status' });
  }
}; 