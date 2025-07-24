const { Pool } = require('pg');
const pool = require('../db.js');

// Get distributor settings
const getDistributorSettings = async (req, res) => {
  const { distributor_id } = req.params;
  
  if (!distributor_id) {
    return res.status(400).json({ error: 'Distributor ID is required' });
  }

  try {
    const client = await pool.connect();
    
    const query = `
      SELECT setting_key, setting_value 
      FROM distributor_settings 
      WHERE distributor_id = $1::uuid
      ORDER BY setting_key
    `;
    
    const result = await client.query(query, [distributor_id]);
    client.release();

    // Convert to object format for easier frontend consumption
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Error fetching distributor settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch distributor settings',
      details: error.message 
    });
  }
};

// Update distributor settings
const updateDistributorSettings = async (req, res) => {
  const { distributor_id } = req.params;
  const settings = req.body;
  
  if (!distributor_id) {
    return res.status(400).json({ error: 'Distributor ID is required' });
  }

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  try {
    const client = await pool.connect();
    
    // Begin transaction
    await client.query('BEGIN');

    try {
      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const upsertQuery = `
          INSERT INTO distributor_settings (distributor_id, setting_key, setting_value, updated_at)
          VALUES ($1::uuid, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (distributor_id, setting_key) 
          DO UPDATE SET 
            setting_value = EXCLUDED.setting_value,
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await client.query(upsertQuery, [distributor_id, key, value.toString()]);
      }

      // Commit transaction
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Settings updated successfully'
      });

    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating distributor settings:', error);
    res.status(500).json({ 
      error: 'Failed to update distributor settings',
      details: error.message 
    });
  }
};

// Get default due date settings (for reference)
const getDefaultDueDateSettings = async (req, res) => {
  try {
    const defaultSettings = {
      due_date_credit_notes: 2,
      due_date_invoice_disputes: 2,
      due_date_customer_modifications: 2,
      due_date_inventory_adjustments: 2,
      due_date_accountability_logs: 2,
      due_date_stock_replenishment: 0, // Immediate
      due_date_unallocated_payments: 2
    };

    res.json({
      success: true,
      data: defaultSettings
    });

  } catch (error) {
    console.error('Error fetching default settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch default settings',
      details: error.message 
    });
  }
};

// Get all cylinder thresholds for a distributor
const getCylinderThresholds = async (req, res) => {
  const distributor_id = req.user?.distributor_id || req.query.distributor_id || req.body.distributor_id;
  if (!distributor_id) {
    return res.status(400).json({ error: 'Distributor ID is required' });
  }
  try {
    const client = await pool.connect();
    // Get all cylinder types and their thresholds (if set)
    const result = await client.query(`
      SELECT ct.cylinder_type_id, ct.name, COALESCE(sct.threshold_quantity, 50) as threshold
      FROM cylinder_types ct
      LEFT JOIN settings_cylinder_thresholds sct
        ON ct.cylinder_type_id = sct.cylinder_type_id AND sct.distributor_id = $1
      WHERE ct.is_active = TRUE AND ct.deleted_at IS NULL
      ORDER BY ct.name
    `, [distributor_id]);
    client.release();
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching cylinder thresholds:', error);
    res.status(500).json({ error: 'Failed to fetch cylinder thresholds', details: error.message });
  }
};

// Update cylinder thresholds for a distributor
const updateCylinderThresholds = async (req, res) => {
  const distributor_id = req.user?.distributor_id || req.body.distributor_id;
  const { thresholds } = req.body; // [{cylinder_type_id, threshold}]
  if (!distributor_id || !Array.isArray(thresholds)) {
    return res.status(400).json({ error: 'Distributor ID and thresholds array are required' });
  }
  try {
    const client = await pool.connect();
    await client.query('BEGIN');
    for (const { cylinder_type_id, threshold } of thresholds) {
      await client.query(`
        INSERT INTO settings_cylinder_thresholds (distributor_id, cylinder_type_id, threshold_quantity, alert_enabled, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW())
        ON CONFLICT (distributor_id, cylinder_type_id) DO UPDATE SET threshold_quantity = $3, updated_at = NOW()
      `, [distributor_id, cylinder_type_id, threshold]);
    }
    await client.query('COMMIT');
    client.release();
    res.json({ success: true, message: 'Thresholds updated successfully' });
  } catch (error) {
    console.error('Error updating cylinder thresholds:', error);
    res.status(500).json({ error: 'Failed to update cylinder thresholds', details: error.message });
  }
};

module.exports = {
  getDistributorSettings,
  updateDistributorSettings,
  getDefaultDueDateSettings,
  getCylinderThresholds,
  updateCylinderThresholds,
}; 