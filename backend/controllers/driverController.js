const pool = require('../db');

// Create a new driver
exports.createDriver = async (req, res) => {
  try {
    const { driver_name, phone, license_number, employment_type, preferred_vehicle_id, status, joining_date } = req.body;
    const distributor_id = req.user?.distributor_id || req.body.distributor_id;
    if (!distributor_id) {
      return res.status(400).json({ error: 'Missing distributor_id' });
    }
    const result = await pool.query(
      `INSERT INTO drivers (driver_name, phone, license_number, employment_type, preferred_vehicle_id, status, joining_date, distributor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [driver_name, phone, license_number, employment_type, preferred_vehicle_id, status || 'Active', joining_date, distributor_id]
    );
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    console.error('createDriver error:', err);
    res.status(500).json({ error: 'Failed to create driver' });
  }
};

// List all drivers
exports.listDrivers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers ORDER BY created_at DESC');
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('listDrivers error:', err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

// Update driver details
exports.updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driver_name, phone, license_number, employment_type, preferred_vehicle_id, status, joining_date } = req.body;
    const result = await pool.query(
      `UPDATE drivers SET driver_name = $1, phone = $2, license_number = $3, employment_type = $4, preferred_vehicle_id = $5, status = $6, joining_date = $7, updated_at = NOW() WHERE driver_id = $8 RETURNING *`,
      [driver_name, phone, license_number, employment_type, preferred_vehicle_id, status, joining_date, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    console.error('updateDriver error:', err);
    res.status(500).json({ error: 'Failed to update driver' });
  }
};

// Deactivate/reactivate driver (soft delete)
exports.deactivateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Active' or 'Inactive'
    const result = await pool.query(
      `UPDATE drivers SET status = $1, updated_at = NOW() WHERE driver_id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    console.error('deactivateDriver error:', err);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
}; 