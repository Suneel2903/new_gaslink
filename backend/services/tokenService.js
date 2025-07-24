/**
 * SANDBOX TESTING MODE ENABLED
 * Using dummy credentials and GSTINs for testing on sandbox.einvoice1 portal
 * TODO: DISABLE BEFORE MOVING TO PRODUCTION
 */

const SANDBOX_MODE = true;

const db = require('../db');
const axios = require('axios');

/**
 * Get a valid JWT token for the given distributor.
 * If missing or expired, fetches a new one from Masters India and updates the DB.
 * Always stores the raw JWT (no prefix) in DB, and returns 'JWT <token>' for API calls.
 */
async function getToken(distributor_id) {
  // 1. Fetch distributor credentials and token
  const { rows } = await db.query(
    'SELECT gstin, jwt_token, token_expiry, username, password FROM distributor_tokens WHERE distributor_id = $1',
    [distributor_id]
  );
  if (!rows.length) throw new Error('No token config for distributor');
  const { jwt_token, token_expiry, username, password } = rows[0];

  // 2. If token is valid, return it (always with 'JWT ' prefix)
  if (jwt_token && token_expiry && new Date(token_expiry) > new Date()) {
    let rawToken = jwt_token.replace(/^Bearer\s+/i, '').replace(/^JWT\s+/i, '');
    console.log('[TokenService] Using valid token from DB for distributor:', distributor_id);
    return 'JWT ' + rawToken;
  }

  // 3. Fetch new token from Masters India
  try {
    const tokenUrl = SANDBOX_MODE
      ? "https://sandb-api.mastersindia.co/api/v1/token-auth/"
      : "https://production-api.mastersindia.co/api/v1/token-auth/";
    const credentials = SANDBOX_MODE
      ? { username: "mvsuneelkumar2903@gmail.com", password: "Mvsuneel@123" }
      : { username, password };
    const response = await axios.post(tokenUrl, credentials);
    let newToken = response.data.token;
    newToken = newToken.replace(/^Bearer\s+/i, '').replace(/^JWT\s+/i, '');
    const expiry = new Date(Date.now() + 14 * 60 * 1000); // 14 min expiry

    // 4. Save only the raw JWT in DB
    const updateRes = await db.query(
      'UPDATE distributor_tokens SET jwt_token = $1, token_expiry = $2, last_refreshed = NOW() WHERE distributor_id = $3',
      [newToken, expiry, distributor_id]
    );
    if (updateRes.rowCount === 0) {
      throw new Error('[TokenService] Failed to update token in DB for distributor: ' + distributor_id);
    }
    console.log('[TokenService] New token fetched and stored for distributor:', distributor_id);
    return 'JWT ' + newToken;
  } catch (err) {
    console.error('[TokenService] Error fetching/storing token:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { getToken }; 