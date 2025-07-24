const pool = require('../db');

// Assign driver to vehicle for a date
exports.assignDriverToVehicle = async (req, res) => {
  try {
    const { date, driver_id, vehicle_id, distributor_id, reason, created_by } = req.body;
    // Only one active assignment per driver per day
    await pool.query(
      `UPDATE driver_vehicle_assignments SET assignment_status = 'Cancelled' WHERE date = $1 AND driver_id = $2 AND assignment_status = 'Confirmed'`,
      [date, driver_id]
    );
    const result = await pool.query(
      `INSERT INTO driver_vehicle_assignments (date, driver_id, vehicle_id, distributor_id, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [date, driver_id, vehicle_id, distributor_id, reason, created_by]
    );
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    console.error('assignDriverToVehicle error:', err);
    res.status(500).json({ error: 'Failed to assign driver to vehicle' });
  }
};

// List assignments for a date
exports.listAssignmentsForDate = async (req, res) => {
  try {
    const { date, distributor_id } = req.query;
    const result = await pool.query(
      `SELECT * FROM driver_vehicle_assignments WHERE date = $1 AND distributor_id = $2 ORDER BY created_at DESC`,
      [date, distributor_id]
    );
    res.json({ assignments: result.rows });
  } catch (err) {
    console.error('listAssignmentsForDate error:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

// Update/override/cancel assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignment_status, reason } = req.body;
    const result = await pool.query(
      `UPDATE driver_vehicle_assignments SET assignment_status = $1, reason = $2, updated_at = NOW() WHERE assignment_id = $3 RETURNING *`,
      [assignment_status, reason, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    console.error('updateAssignment error:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
}; 