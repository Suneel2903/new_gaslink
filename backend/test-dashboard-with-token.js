const admin = require('firebase-admin');
const serviceAccount = require('./firebase/serviceAccountKey.json');
const axios = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function testDashboardWithToken() {
  try {
    console.log('🔍 Testing Dashboard API with Firebase token...');
    
    // Get a user from Firebase
    const result = await admin.auth().listUsers(1);
    if (result.users.length === 0) {
      console.error('❌ No users found in Firebase');
      return;
    }
    
    const user = result.users[0];
    console.log(`👤 Using user: ${user.email} (UID: ${user.uid})`);
    
    // Create a custom token for this user
    const customToken = await admin.auth().createCustomToken(user.uid);
    console.log('✅ Custom token created');
    
    // Test the dashboard API
    const response = await axios.get('http://localhost:5000/api/dashboard/stats/11111111-1111-1111-1111-111111111111', {
      headers: {
        'Authorization': `Bearer ${customToken}`
      }
    });
    
    console.log('✅ Dashboard API call successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Dashboard API test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    process.exit(0);
  }
}

testDashboardWithToken(); 