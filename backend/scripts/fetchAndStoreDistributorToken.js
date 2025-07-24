// backend/scripts/fetchAndStoreDistributorToken.js
const db = require('../db');
const axios = require('axios');

async function fetchAndStoreToken(distributor_id) {
  // 1. Fetch distributor credentials
  const { rows } = await db.query(
    'SELECT username, password FROM distributor_tokens WHERE distributor_id = $1',
    [distributor_id]
  );
  if (!rows.length) {
    console.error('No distributor found for distributor_id:', distributor_id);
    process.exit(1);
  }
  const { username, password } = rows[0];
  if (!username || !password) {
    console.error('Username or password missing for distributor:', distributor_id);
    process.exit(1);
  }

  // 2. Fetch token from Masters India
  try {
    const response = await axios.post('https://sandb-api.mastersindia.co/api/v1/token-auth/', {
      username,
      password
    });
    let token = response.data.token;
    // Remove any prefix before storing
    token = token.replace(/^Bearer\s+/i, '').replace(/^JWT\s+/i, '');
    const expiry = new Date(Date.now() + 14 * 60 * 1000); // 14 min expiry

    // 3. Store token in DB
    await db.query(
      'UPDATE distributor_tokens SET jwt_token = $1, token_expiry = $2, last_refreshed = NOW() WHERE distributor_id = $3',
      [token, expiry, distributor_id]
    );
    console.log('✅ Token fetched and stored for distributor:', distributor_id);
    console.log('Token (first 20 chars):', token.slice(0, 20));
    console.log('Expires at:', expiry.toISOString());
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to fetch/store token:', err.response?.data || err.message);
    process.exit(1);
  }
}

// Usage: node fetchAndStoreDistributorToken.js <distributor_id>
const distributor_id = process.argv[2];
if (!distributor_id) {
  console.error('Usage: node fetchAndStoreDistributorToken.js <distributor_id>');
  process.exit(1);
}
fetchAndStoreToken(distributor_id); 