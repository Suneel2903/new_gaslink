const pool = require('../db.js');

const getLatestPrices = async (req, res) => {
  try {
    // Get the latest month/year in the table
    const { rows: latestRows } = await pool.query(
      `SELECT month, year FROM cylinder_prices ORDER BY year DESC, month DESC LIMIT 1`
    );
    if (!latestRows.length) return res.json([]);
    const { month, year } = latestRows[0];
    // Get all prices for that month/year
    const { rows } = await pool.query(
      `SELECT cylinder_type_id, unit_price FROM cylinder_prices WHERE month = $1 AND year = $2`,
      [month, year]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch latest prices', err);
    res.status(500).json({ error: 'Failed to fetch latest prices' });
  }
};

const upsertPrices = async (req, res) => {
  try {
    console.log('Received price upsert:', req.body); // Debug log
    const { month, year, prices } = req.body;
    if (!month || !year || !Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { cylinder_type_id, unit_price } of prices) {
        await client.query(
          `INSERT INTO cylinder_prices (price_id, cylinder_type_id, unit_price, month, year, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (cylinder_type_id, month, year)
           DO UPDATE SET unit_price = EXCLUDED.unit_price, updated_at = NOW()` ,
          [cylinder_type_id, unit_price, month, year]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to upsert prices', err);
    res.status(500).json({ error: 'Failed to upsert prices' });
  }
};

const getPricesByMonthYear = async (req, res) => {
  try {
    const { month, year } = req.query;
    let distributor_id = req.user?.distributor_id;
    if (req.user?.role === 'super_admin') {
      distributor_id = req.query.distributor_id;
      if (Array.isArray(distributor_id)) {
        distributor_id = distributor_id[0];
      }
    }
    console.log("Received distributor_id:", distributor_id, "month:", month, "year:", year);
    if (!month || !year || !distributor_id) return res.status(400).json({ error: 'Month, year, and distributor_id are required' });
    const { rows } = await pool.query(
      `SELECT cp.cylinder_type_id, ct.name as cylinder_type_name, ct.capacity_kg, ct.description, cp.unit_price
       FROM cylinder_prices cp
       JOIN cylinder_types ct ON cp.cylinder_type_id = ct.cylinder_type_id
       WHERE cp.distributor_id = $1 AND cp.month = $2 AND cp.year = $3`,
      [distributor_id, month, year]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Failed to fetch prices by month/year', err);
    res.status(500).json({ error: 'Failed to fetch prices by month/year' });
  }
};

// Get all cylinder prices (latest month/year)
const getAllCylinderPrices = async (req, res) => {
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
    // Get the latest month/year in the table
    const { rows: latestRows } = await pool.query(
      `SELECT month, year FROM cylinder_prices ORDER BY year DESC, month DESC LIMIT 1`
    );
    if (!latestRows.length) return res.json([]);
    const { month, year } = latestRows[0];
    // Get all prices for that month/year
    const { rows } = await pool.query(
      `SELECT price_id, cylinder_type_id, unit_price, month, year, created_at, updated_at FROM cylinder_prices WHERE month = $1 AND year = $2`,
      [month, year]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch latest prices', err);
    res.status(500).json({ error: 'Failed to fetch latest prices' });
  }
};

// Create a new cylinder price entry
const createCylinderPrice = async (req, res) => {
  try {
    const { cylinder_type_id, unit_price, month, year } = req.body;
    if (!cylinder_type_id || !unit_price || !month || !year) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await pool.query(
      `INSERT INTO cylinder_prices (price_id, cylinder_type_id, unit_price, month, year, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [cylinder_type_id, unit_price, month, year]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create cylinder price', err);
    res.status(500).json({ error: 'Failed to create cylinder price' });
  }
};

// Update a cylinder price entry
const updateCylinderPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_price } = req.body;
    if (!unit_price) return res.status(400).json({ error: 'unit_price is required' });
    const result = await pool.query(
      `UPDATE cylinder_prices SET unit_price = $1, updated_at = NOW() WHERE price_id = $2 RETURNING *`,
      [unit_price, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cylinder price not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update cylinder price', err);
    res.status(500).json({ error: 'Failed to update cylinder price' });
  }
};

// Delete (soft delete) a cylinder price entry
const deleteCylinderPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM cylinder_prices WHERE price_id = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cylinder price not found' });
    res.json({ message: 'Cylinder price deleted', price: result.rows[0] });
  } catch (err) {
    console.error('Failed to delete cylinder price', err);
    res.status(500).json({ error: 'Failed to delete cylinder price' });
  }
};

module.exports = {
  getLatestPrices,
  upsertPrices,
  getPricesByMonthYear,
  getAllCylinderPrices,
  createCylinderPrice,
  updateCylinderPrice,
  deleteCylinderPrice
}; 