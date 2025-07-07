require('dotenv').config();
const admin = require('firebase-admin');
const { Pool } = require('pg');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const userRoles = [
  { email: 'platform@admin.com', role: 'super_admin' },
  { email: 'admin@dist1.com', role: 'distributor_admin', distributorEmail: 'vikasini@example.com' },
  { email: 'finance@dist1.com', role: 'finance', distributorEmail: 'vikasini@example.com' },
  { email: 'inventory@dist1.com', role: 'inventory', distributorEmail: 'vikasini@example.com' },
  { email: 'driver@dist1.com', role: 'driver', distributorEmail: 'vikasini@example.com' },
  { email: 'customer1@dist1.com', role: 'customer', distributorEmail: 'vikasini@example.com' }
];

(async () => {
  for (const { email, role, distributorEmail } of userRoles) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      let customClaims = { role };
      if (distributorEmail) {
        const result = await pool.query(
          'SELECT distributor_id FROM distributors WHERE email = $1 LIMIT 1',
          [distributorEmail]
        );
        if (result.rows.length === 0) {
          console.warn(`⚠️ No distributor found for email: ${distributorEmail}`);
          continue;
        }
        const distributor_id = result.rows[0].distributor_id;
        customClaims.distributor_id = distributor_id;
      }
      await admin.auth().setCustomUserClaims(user.uid, customClaims);
      console.log(`✅ Claims set for ${email}:`, customClaims);
    } catch (error) {
      console.error(`❌ Failed for ${email}: ${error.message}`);
    }
  }
  await pool.end();
})(); 