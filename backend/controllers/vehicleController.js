const pool = require('../db');

// List all vehicles
const listVehicles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json({ vehicles: result.rows });
  } catch (err) {
    console.error('listVehicles error:', err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

// Create a new vehicle
const createVehicle = async (req, res) => {
  try {
    const { vehicle_number, cylinder_capacity, ownership_type, status } = req.body;
    // Prefer distributor_id from auth, else from body
    const distributor_id = req.user?.distributor_id || req.body.distributor_id;
    if (!distributor_id) {
      return res.status(400).json({ error: 'Missing distributor_id' });
    }
    const result = await pool.query(
      `INSERT INTO vehicles (vehicle_number, cylinder_capacity, ownership_type, status, distributor_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vehicle_number, cylinder_capacity, ownership_type, status || 'Available', distributor_id]
    );
    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('createVehicle error:', err);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

// Update vehicle details
const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_number, cylinder_capacity, ownership_type, status } = req.body;
    const result = await pool.query(
      `UPDATE vehicles SET vehicle_number = $1, cylinder_capacity = $2, ownership_type = $3, status = $4, updated_at = NOW() WHERE vehicle_id = $5 RETURNING *`,
      [vehicle_number, cylinder_capacity, ownership_type, status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('updateVehicle error:', err);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

// Deactivate/reactivate vehicle (soft delete)
const deactivateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Available' or 'Inactive'
    const result = await pool.query(
      `UPDATE vehicles SET status = $1, updated_at = NOW() WHERE vehicle_id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('deactivateVehicle error:', err);
    res.status(500).json({ error: 'Failed to update vehicle status' });
  }
};

// Get cancelled stock in vehicles for a distributor
const getCancelledStockInVehicles = async (req, res) => {
  try {
    const { distributor_id } = req.params;
    console.log('🔍 Fetching cancelled stock for distributor:', distributor_id);
    
    const query = `
      SELECT 
        v.vehicle_number,
        d.driver_name,
        ct.name as cylinder_type,
        vi.cancelled_order_quantity as cancelled_quantity,
        vi.vehicle_id,
        vi.cylinder_type_id
      FROM vehicle_inventory vi
      JOIN vehicles v ON vi.vehicle_id = v.vehicle_id
      LEFT JOIN drivers d ON v.vehicle_id = d.vehicle_id
      JOIN cylinder_types ct ON vi.cylinder_type_id = ct.cylinder_type_id
      WHERE vi.distributor_id = $1::uuid 
        AND vi.cancelled_order_quantity > 0
      ORDER BY v.vehicle_number, ct.name
    `;

    const result = await pool.query(query, [distributor_id]);
    console.log('✅ Cancelled stock:', result.rows);
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cancelled stock',
      details: error.message 
    });
  }
};

// Move cancelled stock from vehicle to depot inventory
const moveCancelledStockToInventory = async (req, res) => {
  try {
    const { vehicle_id, cylinder_type_id, quantity } = req.body;
    const { distributor_id } = req.user;
    
    console.log('🔄 Moving stock:', { vehicle_id, cylinder_type_id, quantity });
    
    // Simple implementation for now
    const updateQuery = `
      UPDATE vehicle_inventory 
      SET cancelled_order_quantity = cancelled_order_quantity - $1,
          updated_at = NOW()
      WHERE vehicle_id = $2::uuid 
        AND cylinder_type_id = $3::uuid 
        AND distributor_id = $4::uuid
    `;
    
    await pool.query(updateQuery, [quantity, vehicle_id, cylinder_type_id, distributor_id]);

    // Mark cancelled stock as moved to inventory
    await pool.query(
      `UPDATE vehicle_cancelled_stock_log
       SET moved_to_inventory = true, moved_at = NOW()
       WHERE vehicle_id = $1 AND cylinder_type_id = $2 AND moved_to_inventory = false`,
      [vehicle_id, cylinder_type_id]
    );
    
    res.json({ 
      success: true, 
      message: `Moved ${quantity} cylinders to depot inventory`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to move stock',
      details: error.message 
    });
  }
};

// Get vehicle inventory summary
const getVehicleInventorySummary = async (req, res) => {
  try {
    const { distributor_id } = req.params;
    console.log('🔍 Fetching vehicle summary for distributor:', distributor_id);
    
    const query = `
      SELECT 
        v.vehicle_number,
        d.driver_name,
        ct.name as cylinder_type,
        vi.available_quantity,
        vi.soft_blocked_quantity,
        vi.cancelled_order_quantity
      FROM vehicle_inventory vi
      JOIN vehicles v ON vi.vehicle_id = v.vehicle_id
      LEFT JOIN drivers d ON v.vehicle_id = d.vehicle_id
      JOIN cylinder_types ct ON vi.cylinder_type_id = ct.cylinder_type_id
      WHERE vi.distributor_id = $1::uuid
      ORDER BY v.vehicle_number, ct.name
    `;

    const result = await pool.query(query, [distributor_id]);
    console.log('✅ Vehicle summary:', result.rows);
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch vehicle summary',
      details: error.message 
    });
  }
};

module.exports = {
  listVehicles,
  createVehicle,
  updateVehicle,
  deactivateVehicle,
  getCancelledStockInVehicles,
  moveCancelledStockToInventory,
  getVehicleInventorySummary
}; 