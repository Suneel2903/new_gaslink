const axios = require('axios');

async function testResponseStructure() {
  try {
    console.log('🔍 Testing dashboard API response structure...');
    
    // Test the actual API endpoint
    const response = await axios.get('http://localhost:5000/api/dashboard/stats/11111111-1111-1111-1111-111111111111', {
      headers: {
        'Authorization': 'Bearer test-token' // This will fail auth but we can see the response structure
      }
    });
    
    console.log('✅ Response received:');
    console.log('Status:', response.status);
    console.log('Response structure:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Expected auth error, but let\'s check response structure:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testResponseStructure(); 