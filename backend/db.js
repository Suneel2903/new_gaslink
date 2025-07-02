import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || 'marri',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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

export default pool; 