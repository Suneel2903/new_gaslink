const admin = require('firebase-admin');
const serviceAccount = require('./firebase/serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function testFirebaseAuth() {
  try {
    console.log('🔍 Testing Firebase Admin SDK initialization...');
    
    // Test if we can list users (this requires proper initialization)
    const result = await admin.auth().listUsers(1);
    console.log('✅ Firebase Admin SDK is working!');
    console.log(`📊 Found ${result.users.length} users`);
    
    if (result.users.length > 0) {
      const user = result.users[0];
      console.log(`👤 Sample user: ${user.email} (UID: ${user.uid})`);
      
      // Test creating a custom token
      const customToken = await admin.auth().createCustomToken(user.uid);
      console.log('✅ Custom token creation works!');
      console.log(`🔑 Custom token: ${customToken.substring(0, 20)}...`);
      
      // Test verifying the custom token
      const decodedToken = await admin.auth().verifyIdToken(customToken);
      console.log('✅ Token verification works!');
      console.log(`🔍 Decoded UID: ${decodedToken.uid}`);
    }
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testFirebaseAuth(); 