const pool = require('../db.js');
const {
  insertContacts,
  insertDiscounts,
  fetchContacts,
  fetchDiscounts
} = require('../services/customerService.js');

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
    const customer = result.rows[0];
    // Fetch contacts and discounts
    customer.contacts = await fetchContacts(customer_id);
    customer.cylinder_discounts = (await fetchDiscounts(customer_id)).map(d => ({
      ...d,
      per_kg_discount: Number(d.per_kg_discount),
      capacity_kg: d.capacity_kg !== undefined ? Number(d.capacity_kg) : undefined,
    }));
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer', details: err.message });
  }
};

// Add a new customer
const addCustomer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { role } = req.user;
    let { distributor_id } = req.user;
    if (role === 'super_admin') {
      distributor_id = req.body.distributor_id;
      if (!distributor_id) {
        return res.status(400).json({ error: 'Super admin must provide distributor_id in request body.' });
      }
    }
    if (!distributor_id) {
      return res.status(400).json({ error: 'Missing distributor_id in request.' });
    }
    // Extract new fields
    const {
      business_name, contact_person, email, phone,
      address_line1, address_line2, city, state, postal_code, country,
      credit_period, payment_terms,
      billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode, billing_state_code,
      gstin, trade_name, state_code, preferred_driver_id,
      enable_grace_cylinder_recovery, grace_period_cylinder_recovery_days,
      contacts, cylinder_discounts
    } = req.body;
    // Validate at least one contact (primary)
    if (!Array.isArray(contacts) || contacts.length === 0 || !contacts.some(c => c.is_primary)) {
      return res.status(400).json({ error: 'At least one primary contact is required.' });
    }
    // Generate customer code if not provided
    let customer_code = req.body.customer_code;
    if (!customer_code) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM customers WHERE distributor_id = $1 AND deleted_at IS NULL`,
        [distributor_id]
      );
      const nextNumber = (countResult.rows[0].count || 0) + 1;
      customer_code = `CUST${String(nextNumber).padStart(3, '0')}`;
    }
    // Set contact_person, email, and phone from primary contact if present
    let resolvedContactPerson = '';
    let resolvedEmail = '';
    let resolvedPhone = '';
    if (Array.isArray(contacts) && contacts.length > 0) {
      const primary = contacts.find(c => c.is_primary) || contacts[0];
      resolvedContactPerson = primary.name || '';
      resolvedEmail = primary.email || '';
      resolvedPhone = primary.phone || '';
    }
    console.log('[DEBUG] Resolved contact_person, email, phone:', resolvedContactPerson, resolvedEmail, resolvedPhone);
    // Insert customer
    const result = await client.query(
      `INSERT INTO customers (
        distributor_id, customer_code, business_name, contact_person, email, phone,
        address_line1, address_line2, city, state, postal_code, country,
        credit_limit, credit_period_days, payment_terms,
        billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode, billing_state_code,
        gstin, trade_name, state_code, preferred_driver_id,
        enable_grace_cylinder_recovery, grace_period_cylinder_recovery_days
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27
      ) RETURNING *`,
      [
        distributor_id, customer_code, business_name || '', resolvedContactPerson, resolvedEmail, resolvedPhone,
        address_line1 || '', address_line2 || '', city || '', state || '', postal_code || '', country || 'India',
        0, credit_period || 30, payment_terms || 'credit',
        billing_address_line1 || '', billing_address_line2 || '', billing_city || '', billing_state || '', billing_pincode || '', billing_state_code || '',
        gstin || '', trade_name || '', state_code || '', preferred_driver_id || null,
        enable_grace_cylinder_recovery || false, grace_period_cylinder_recovery_days || null
      ]
    );
    const customer = result.rows[0];
    // Insert contacts and discounts
    await insertContacts(customer.customer_id, contacts, client);
    if (Array.isArray(cylinder_discounts)) {
      await insertDiscounts(customer.customer_id, cylinder_discounts, client);
    }
    await client.query('COMMIT');
    // Fetch with contacts/discounts
    customer.contacts = await fetchContacts(customer.customer_id, client);
    customer.cylinder_discounts = (await fetchDiscounts(customer.customer_id, client)).map(d => ({
      ...d,
      per_kg_discount: Number(d.per_kg_discount),
      capacity_kg: d.capacity_kg !== undefined ? Number(d.capacity_kg) : undefined,
    }));
    res.status(201).json(customer);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Customer code already exists for this distributor' });
    }
    res.status(500).json({ error: 'Failed to add customer', details: err.message });
  } finally {
    client.release();
  }
};

// Update customer details
const updateCustomer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { distributor_id } = req.user;
    const { customer_id } = req.params;
    // Extract new fields
    const fields = [
      'business_name', 'contact_person', 'email', 'phone',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
      'credit_limit', 'credit_period_days', 'payment_terms',
      'billing_address_line1', 'billing_address_line2', 'billing_city', 'billing_state', 'billing_pincode', 'billing_state_code',
      'gstin', 'trade_name', 'state_code', 'preferred_driver_id',
      'enable_grace_cylinder_recovery', 'grace_period_cylinder_recovery_days'
    ];
    const values = fields.map(field => req.body[field]);
    values.unshift(customer_id);
    values.unshift(distributor_id);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 3}`).join(', ');
    const result = await client.query(
      `UPDATE customers SET ${setClause}, updated_at = NOW()
       WHERE distributor_id = $1 AND customer_id = $2 AND deleted_at IS NULL RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }
    // Update contacts and discounts if provided
    if (Array.isArray(req.body.contacts)) {
      await insertContacts(customer_id, req.body.contacts, client);
    }
    if (Array.isArray(req.body.cylinder_discounts)) {
      await insertDiscounts(customer_id, req.body.cylinder_discounts, client);
    }
    await client.query('COMMIT');
    // Fetch with contacts/discounts
    const customer = result.rows[0];
    customer.contacts = await fetchContacts(customer_id, client);
    customer.cylinder_discounts = await fetchDiscounts(customer_id, client);
    res.json(customer);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update customer', details: err.message });
  } finally {
    client.release();
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
    // For each customer, fetch and attach contacts and discounts
    const customers = await Promise.all(result.rows.map(async (customer) => {
      customer.contacts = await fetchContacts(customer.customer_id);
      customer.cylinder_discounts = (await fetchDiscounts(customer.customer_id)).map(d => ({
        ...d,
        per_kg_discount: Number(d.per_kg_discount),
        capacity_kg: d.capacity_kg !== undefined ? Number(d.capacity_kg) : undefined,
      }));
      return customer;
    }));
    console.log('[DEBUG] getAllCustomers returned:', customers);
    res.json(customers);
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