const { getDashboardStats } = require('./controllers/dashboardController.js');

// Mock request and response objects
const mockReq = {
  params: { distributor_id: '11111111-1111-1111-1111-111111111111' },
  user: { 
    user_id: '11111111-1111-1111-1111-111111111111', // Mock user ID
    role: 'distributor_admin',
    distributor_id: '11111111-1111-1111-1111-111111111111'
  }
};

const mockRes = {
  json: (data) => {
    console.log('✅ Dashboard API Response:');
    console.log(JSON.stringify(data, null, 2));
  },
  status: (code) => {
    console.log(`📊 Response Status: ${code}`);
    return mockRes;
  }
};

async function testDashboardDirect() {
  try {
    console.log('🔍 Testing Dashboard Controller directly...');
    console.log('📋 Distributor ID:', mockReq.params.distributor_id);
    
    await getDashboardStats(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testDashboardDirect(); 