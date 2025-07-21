const pool = require('../db.js');

// List all customers for a distributor
const listCustomers = async (req, res) => {
  try {
    const { role } = req.user;
    let { distributor_id } = req.user;
    
    // For super_admin, allow distributor_id from query
    if (role === 'super_admin') {
      distributor_id = req.query.distributor_id;
      if (!distributor_id) {
        return res.status(400).json({ error: 'Super admin must select a distributor first.' });
      }
    }
    
    // Only check for missing distributor_id
    if (!distributor_id) {
      return res.status(400).json({ error: 'Invalid distributor_id in request.' });
    }
    const result = await pool.query(
      `SELECT * FROM customers WHERE distributor_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [distributor_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
};

// Get a single customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM customers WHERE customer_id = $1 AND distributor_id = $2 AND deleted_at IS NULL`,
      [customer_id, distributor_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer', details: err.message });
  }
};

// Add a new customer
const addCustomer = async (req, res) => {
  try {
    console.log('🔍 Customer creation request body:', req.body);
    console.log('🔍 User info:', req.user);
    console.log('🔍 Headers:', req.headers);
    
    const { role } = req.user;
    let { distributor_id } = req.user;
    
    // For super_admin, allow distributor_id from request body
    if (role === 'super_admin') {
      distributor_id = req.body.distributor_id;
      if (!distributor_id) {
        return res.status(400).json({ error: 'Super admin must provide distributor_id in request body.' });
      }
    }
    
    if (!distributor_id) {
      console.log('❌ Missing distributor_id in user:', req.user);
      return res.status(400).json({ error: 'Missing distributor_id in request.' });
    }
    
    const {
      business_name, contact_person, email, phone,
      address_line1, address_line2, city, state, postal_code, country,
      credit_period, payment_terms
    } = req.body;
    
    console.log('🔍 Extracted fields:', {
      contact_person, phone, address_line1, city, state,
      hasBusinessName: !!business_name,
      hasEmail: !!email,
      hasAddressLine2: !!address_line2,
      hasPostalCode: !!postal_code,
      hasCountry: !!country,
      credit_period,
      payment_terms
    });
    
    // Validate required fields
    if (!contact_person || !phone || !address_line1 || !city || !state) {
      const missingFields = [];
      if (!contact_person) missingFields.push('contact_person');
      if (!phone) missingFields.push('phone');
      if (!address_line1) missingFields.push('address_line1');
      if (!city) missingFields.push('city');
      if (!state) missingFields.push('state');
      
      console.log('❌ Missing required fields:', missingFields);
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields 
      });
    }

    // Generate customer code if not provided
    let customer_code = req.body.customer_code;
    if (!customer_code) {
      // Get the next customer number for this distributor
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM customers WHERE distributor_id = $1 AND deleted_at IS NULL`,
        [distributor_id]
      );
      const nextNumber = (countResult.rows[0].count || 0) + 1;
      customer_code = `CUST${String(nextNumber).padStart(3, '0')}`;
    }

    const result = await pool.query(
      `INSERT INTO customers (
        distributor_id, customer_code, business_name, contact_person, email, phone,
        address_line1, address_line2, city, state, postal_code, country,
        credit_limit, credit_period_days, payment_terms
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15
      ) RETURNING *`,
      [
        distributor_id, customer_code, business_name || '', contact_person, email || '', phone,
        address_line1, address_line2 || '', city, state, postal_code || '', country || 'Nigeria',
        0, credit_period || 30, payment_terms || 'credit'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Customer code already exists for this distributor' });
    }
    console.error('Customer creation error:', err);
    res.status(500).json({ error: 'Failed to add customer', details: err.message });
  }
};

// Update customer details
const updateCustomer = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    const fields = [
      'business_name', 'contact_person', 'email', 'phone',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
      'credit_limit', 'credit_period_days', 'payment_terms', 'discount'
    ];
    // Always update all fields in the same order
    const values = fields.map(field => req.body[field]);
    values.unshift(customer_id);
    values.unshift(distributor_id);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 3}`).join(', ');
    console.log('FIELDS:', fields);
    console.log('VALUES:', values);
    console.log('SET CLAUSE:', setClause);
    console.log('SQL:', `UPDATE customers SET ${setClause}, updated_at = NOW() WHERE distributor_id = $1 AND customer_id = $2 AND deleted_at IS NULL RETURNING *`);
    const result = await pool.query(
      `UPDATE customers SET ${setClause}, updated_at = NOW()
       WHERE distributor_id = $1 AND customer_id = $2 AND deleted_at IS NULL RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer', details: err.message });
  }
};

// Soft delete (deactivate) customer
const deactivateCustomer = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    const result = await pool.query(
      `UPDATE customers SET deleted_at = NOW(), status = 'inactive' WHERE distributor_id = $1 AND customer_id = $2 AND deleted_at IS NULL RETURNING *`,
      [distributor_id, customer_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deactivated', customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate customer', details: err.message });
  }
};

// Stop or resume supply to a customer
const setStopSupply = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    const { stop_supply, stop_supply_reason } = req.body;
    const result = await pool.query(
      `UPDATE customers SET stop_supply = $1, stop_supply_reason = $2, updated_at = NOW()
       WHERE distributor_id = $3 AND customer_id = $4 AND deleted_at IS NULL RETURNING *`,
      [!!stop_supply, stop_supply_reason || null, distributor_id, customer_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stop supply status', details: err.message });
  }
};

// List customer modification requests
const listModificationRequests = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const result = await pool.query(
      `SELECT * FROM customer_modification_requests WHERE distributor_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [distributor_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch modification requests', details: err.message });
  }
};

// Create a customer modification request
const createModificationRequest = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id, request_type, requested_changes, reason } = req.body;
    if (!customer_id || !request_type || !requested_changes || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Get current data
    const current = await pool.query(
      `SELECT * FROM customers WHERE customer_id = $1 AND distributor_id = $2 AND deleted_at IS NULL`,
      [customer_id, distributor_id]
    );
    if (current.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    const result = await pool.query(
      `INSERT INTO customer_modification_requests (
        distributor_id, customer_id, requested_by, request_type, current_data, requested_changes, reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING *`,
      [distributor_id, customer_id, distributor_id, request_type, current.rows[0], requested_changes, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create modification request', details: err.message });
  }
};

// Assign or update preferred driver for a customer
const setPreferredDriver = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    const { driver_id } = req.body;
    if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });
    // Check if customer exists
    const cust = await pool.query(
      `SELECT * FROM customers WHERE customer_id = $1 AND distributor_id = $2 AND deleted_at IS NULL`,
      [customer_id, distributor_id]
    );
    if (cust.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });
    // Upsert preferred driver assignment
    const result = await pool.query(
      `INSERT INTO preferred_driver_assignments (customer_id, driver_id, assigned_by, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (customer_id) DO UPDATE SET driver_id = $2, assigned_by = $3, updated_at = NOW(), deleted_at = NULL
       RETURNING *`,
      [customer_id, driver_id, distributor_id]
    );
    res.json({ message: 'Preferred driver assigned', assignment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign preferred driver', details: err.message });
  }
};

// Aliases for expected route names
const getAllCustomers = async (req, res) => {
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
    const result = await pool.query(
      `SELECT * FROM customers WHERE distributor_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [distributor_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
};
const getCustomer = getCustomerById;
const createCustomer = addCustomer;
const deleteCustomer = deactivateCustomer;

// Stubs for missing features
const getCustomerBalance = async (req, res) => {
  res.json({ balance: 0, message: 'Balance feature not yet implemented.' });
};
const getCustomerInvoices = async (req, res) => {
  res.json({ invoices: [], message: 'Invoices feature not yet implemented.' });
};
const getCustomerOrders = async (req, res) => {
  res.json({ orders: [], message: 'Orders feature not yet implemented.' });
};
const getCustomerInventory = async (req, res) => {
  res.json({ inventory: [], message: 'Inventory feature not yet implemented.' });
};

module.exports = {
  getAllCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBalance,
  getCustomerInvoices,
  getCustomerOrders,
  getCustomerInventory
}; 