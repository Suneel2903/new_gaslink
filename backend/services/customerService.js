const pool = require('../db.js');

// Insert contacts for a customer (removes old, inserts new)
async function insertContacts(customer_id, contacts, client = pool) {
  if (!Array.isArray(contacts) || contacts.length === 0) return;
  await client.query('DELETE FROM customer_contacts WHERE customer_id = $1', [customer_id]);
  for (const c of contacts) {
    await client.query(
      `INSERT INTO customer_contacts (customer_id, name, phone, email, is_primary) VALUES ($1, $2, $3, $4, $5)`,
      [customer_id, c.name, c.phone, c.email, !!c.is_primary]
    );
  }
}

// Insert discounts for a customer (removes old, inserts new)
async function insertDiscounts(customer_id, discounts, client = pool) {
  console.log('[DEBUG] insertDiscounts called with:', discounts);
  if (!Array.isArray(discounts) || discounts.length === 0) return;
  await client.query('DELETE FROM customer_cylinder_discounts WHERE customer_id = $1', [customer_id]);
  for (const d of discounts) {
    console.log('[DEBUG] Inserting discount:', d);
    await client.query(
      `INSERT INTO customer_cylinder_discounts (customer_id, cylinder_type_id, per_kg_discount, effective_from) VALUES ($1, $2, $3, $4)`,
      [customer_id, d.cylinder_type_id, d.per_kg_discount, d.effective_from || new Date()]
    );
  }
}

// Fetch contacts for a customer
async function fetchContacts(customer_id, client = pool) {
  const result = await client.query('SELECT * FROM customer_contacts WHERE customer_id = $1 ORDER BY is_primary DESC, created_at ASC', [customer_id]);
  return result.rows;
}

// Fetch discounts for a customer (with cylinder type info)
async function fetchDiscounts(customer_id, client = pool) {
  const result = await client.query(`
    SELECT d.*, ct.name as cylinder_type_name, ct.capacity_kg
    FROM customer_cylinder_discounts d
    JOIN cylinder_types ct ON d.cylinder_type_id = ct.cylinder_type_id
    WHERE d.customer_id = $1
    ORDER BY ct.name
  `, [customer_id]);
  return result.rows;
}

module.exports = {
  insertContacts,
  insertDiscounts,
  fetchContacts,
  fetchDiscounts
}; 