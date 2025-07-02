import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection(config, name) {
  const pool = new Pool(config);
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ ${name}: Connected successfully - ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function findWorkingConfig() {
  console.log('🔍 Testing different PostgreSQL connection configurations...\n');

  const configs = [
    {
      name: 'Default with empty password',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: undefined
      }
    },
    {
      name: 'Default with null password',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: null
      }
    },
    {
      name: 'Default with empty string password',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: ''
      }
    },
    {
      name: 'Common password: postgres',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres'
      }
    },
    {
      name: 'Common password: admin',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'admin'
      }
    },
    {
      name: 'Common password: password',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'password'
      }
    }
  ];

  for (const { name, config } of configs) {
    const success = await testConnection(config, name);
    if (success) {
      console.log(`\n🎉 Found working configuration: ${name}`);
      console.log('Use this in your .env file:');
      console.log(`DB_HOST=${config.host}`);
      console.log(`DB_PORT=${config.port}`);
      console.log(`DB_USER=${config.user}`);
      console.log(`DB_PASSWORD=${config.password || ''}`);
      return config;
    }
  }

  console.log('\n❌ No working configuration found.');
  console.log('💡 You may need to:');
  console.log('   1. Reset your PostgreSQL password');
  console.log('   2. Check if PostgreSQL is configured for trust authentication');
  console.log('   3. Use a different PostgreSQL user');
  
  return null;
}

findWorkingConfig(); 