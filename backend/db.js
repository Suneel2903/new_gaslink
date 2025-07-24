const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: 'postgres',
  password: 'admin123',
  database: process.env.DB_NAME || 'gaslink_db', // Use .env or default to gaslink_db
});

// Enhanced query logging
const originalQuery = pool.query;
pool.query = async (...args) => {
  const [text, params] = args;
  console.log('[DB QUERY]', text, params ? JSON.stringify(params) : '');
  try {
    const result = await originalQuery.apply(pool, args);
    return result;
  } catch (err) {
    console.error('[DB ERROR]', err.message, '\nQuery:', text, '\nParams:', params);
    throw err;
  }
};

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool; 