const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use __dirname directly in CommonJS
// Database connection for setup (without database name)
const setupPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: 'admin123',
  database: 'postgres', // Connect to default postgres database first
});

// Database connection for the actual application
const appPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: 'admin123',
  database: process.env.DB_NAME || 'gaslink_db',
});

async function setupDatabase() {
  try {
    console.log('🚀 Setting up GasLink database...\n');

    // Step 1: Create database if it doesn't exist
    console.log('📋 Step 1: Creating database...');
    try {
      await setupPool.query(`CREATE DATABASE ${process.env.DB_NAME || 'gaslink_db'}`);
      console.log('✅ Database created successfully');
    } catch (error) {
      if (error.code === '42P04') {
        console.log('ℹ️  Database already exists');
      } else {
        throw error;
      }
    }

    // Step 2: Read and execute schema
    console.log('\n📋 Step 2: Creating schema...');
    const schemaPath = path.join(__dirname, 'sql', 'init_db.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await appPool.query(statement);
      } catch (error) {
        if (error.code === '42710') {
          // Object already exists, skip
          console.log('ℹ️  Schema object already exists, skipping...');
        } else {
          console.error('❌ Error executing statement:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    console.log('✅ Schema created successfully');

    // Step 3: Insert sample data
    console.log('\n📋 Step 3: Inserting sample data...');
    await insertSampleData();
    console.log('✅ Sample data inserted successfully');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('📊 You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\n💡 Make sure you have:');
    console.error('   1. PostgreSQL installed and running');
    console.error('   2. Created a .env file with database credentials');
    console.error('   3. PostgreSQL user has CREATE DATABASE permissions');
  } finally {
    await setupPool.end();
    await appPool.end();
  }
}

async function insertSampleData() {
  // Insert sample distributor
  const distributorResult = await appPool.query(`
    INSERT INTO distributors (
      business_name, legal_name, registration_number, contact_person, 
      email, phone, address_line1, city, state, postal_code
    ) VALUES (
      'GasLink Demo Distributor', 'GasLink Demo Distributor Ltd', 'REG123456',
      'John Manager', 'demo@gaslink.com', '+2348012345678',
      '123 Demo Street', 'Lagos', 'Lagos', '100001'
    ) RETURNING distributor_id
  `);

  const distributorId = distributorResult.rows[0].distributor_id;

  // Insert sample user
  await appPool.query(`
    INSERT INTO users (
      distributor_id, firebase_uid, email, first_name, last_name, 
      phone, role, status
    ) VALUES (
      $1, 'demo-user-123', 'admin@gaslink.com', 'Admin', 'User',
      '+2348012345678', 'distributor_admin', 'active'
    )
  `, [distributorId]);

  // Insert sample cylinder types
  await appPool.query(`
    INSERT INTO cylinder_types (name, capacity_kg, description) VALUES
    ('12.5kg Cylinder', 12.5, 'Standard 12.5kg LPG cylinder'),
    ('25kg Cylinder', 25.0, 'Large 25kg LPG cylinder'),
    ('50kg Cylinder', 50.0, 'Industrial 50kg LPG cylinder')
  `);

  // Insert sample customers
  await appPool.query(`
    INSERT INTO customers (
      distributor_id, customer_code, business_name, contact_person,
      email, phone, address_line1, city, state, credit_limit
    ) VALUES
    ($1, 'CUST001', 'ABC Restaurant', 'Jane Doe', 'jane@abc.com', '+2348012345679', '456 Restaurant Ave', 'Lagos', 'Lagos', 50000.00),
    ($1, 'CUST002', 'XYZ Hotel', 'Bob Smith', 'bob@xyz.com', '+2348012345680', '789 Hotel Street', 'Abuja', 'FCT', 100000.00)
  `, [distributorId]);

  // Insert sample inventory
  const cylinderTypes = await appPool.query('SELECT cylinder_type_id FROM cylinder_types');
  for (const type of cylinderTypes.rows) {
    await appPool.query(`
      INSERT INTO inventory (
        distributor_id, cylinder_type_id, total_quantity, full_quantity, empty_quantity
      ) VALUES ($1, $2, 100, 80, 20)
    `, [distributorId, type.cylinder_type_id]);
  }
}

setupDatabase(); 