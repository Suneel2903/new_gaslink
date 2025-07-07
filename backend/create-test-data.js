const db = require('./db.js');

console.log('🚀 Creating test data for Payments module...');

const createTestData = async () => {
  try {
    // Create test customer with correct column names
    const customerQuery = `
      INSERT INTO customers (distributor_id, customer_code, business_name, contact_person, email, phone, address_line1, city, state)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (customer_code, distributor_id) DO NOTHING
      RETURNING customer_id
    `;
    
    const customerResult = await db.query(customerQuery, [
      '11111111-1111-1111-1111-111111111111', // distributor_id (using a default UUID)
      'TEST001',
      'Test Customer for Payments',
      'Test Contact',
      'testpayments@example.com',
      '9876543210',
      'Test Address for Payments',
      'Test City',
      'Test State'
    ]);
    
    if (customerResult.rows.length > 0) {
      console.log('✅ Test customer created:', customerResult.rows[0].customer_id);
    } else {
      console.log('ℹ️  Test customer already exists');
    }
    
    // Create test distributor with correct column names
    const distributorQuery = `
      INSERT INTO distributors (business_name, legal_name, registration_number, contact_person, email, phone, address_line1, city, state, postal_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING distributor_id
    `;
    
    const distributorResult = await db.query(distributorQuery, [
      'Test Distributor for Payments',
      'Test Distributor for Payments Ltd',
      'REG123457',
      'Test Contact',
      'testdistpayments@example.com',
      '9876543211',
      'Test Distributor Address',
      'Test City',
      'Test State',
      '100001'
    ]);
    
    if (distributorResult.rows.length > 0) {
      console.log('✅ Test distributor created:', distributorResult.rows[0].distributor_id);
    } else {
      console.log('ℹ️  Test distributor already exists');
    }
    
    // Create test cylinder type
    const cylinderTypeQuery = `
      INSERT INTO cylinder_types (name, capacity_kg, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING
      RETURNING cylinder_type_id
    `;
    
    const cylinderTypeResult = await db.query(cylinderTypeQuery, [
      'Test Cylinder for Payments',
      14.2,
      'Test cylinder for payment testing'
    ]);
    
    if (cylinderTypeResult.rows.length > 0) {
      console.log('✅ Test cylinder type created:', cylinderTypeResult.rows[0].cylinder_type_id);
    } else {
      console.log('ℹ️  Test cylinder type already exists');
    }
    
    console.log('🎉 Test data creation completed!');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    process.exit(0);
  }
};

createTestData(); 