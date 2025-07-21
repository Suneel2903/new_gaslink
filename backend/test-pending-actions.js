const axios = require('axios');

async function testPendingActions() {
  try {
    console.log('🧪 Testing Pending Actions API endpoints...');
    
    const distributorId = '11111111-1111-1111-1111-111111111111';
    const baseUrl = 'http://localhost:5000/api/dashboard';
    
    // Test 1: Distributor pending actions
    console.log('\n📋 Test 1: Distributor pending actions');
    try {
      const distributorResponse = await axios.get(`${baseUrl}/pending-actions/${distributorId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Distributor response status:', distributorResponse.status);
      console.log('📊 Response structure:', Object.keys(distributorResponse.data.data));
      
      const data = distributorResponse.data.data;
      if (data.summary) {
        console.log('📈 Summary counts:');
        console.log('   - Inventory team:', data.summary.inventory_team_count || 0);
        console.log('   - Finance team:', data.summary.finance_team_count || 0);
      }
      
      // Check for actual pending actions
      const actionCounts = {};
      Object.entries(data).forEach(([key, actions]) => {
        if (key !== 'summary' && Array.isArray(actions)) {
          actionCounts[key] = actions.length;
        }
      });
      
      console.log('📝 Action counts:', actionCounts);
      
    } catch (error) {
      console.error('❌ Distributor test failed:', error.response?.data || error.message);
    }
    
    // Test 2: Inventory team pending actions
    console.log('\n📦 Test 2: Inventory team pending actions');
    try {
      const inventoryResponse = await axios.get(`${baseUrl}/pending-actions/${distributorId}?role=inventory`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Inventory response status:', inventoryResponse.status);
      console.log('📊 Response structure:', Object.keys(inventoryResponse.data.data));
      
      const inventoryData = inventoryResponse.data.data;
      const inventoryCounts = {};
      Object.entries(inventoryData).forEach(([key, actions]) => {
        if (Array.isArray(actions)) {
          inventoryCounts[key] = actions.length;
        }
      });
      
      console.log('📝 Inventory action counts:', inventoryCounts);
      
    } catch (error) {
      console.error('❌ Inventory test failed:', error.response?.data || error.message);
    }
    
    // Test 3: Finance team pending actions
    console.log('\n💰 Test 3: Finance team pending actions');
    try {
      const financeResponse = await axios.get(`${baseUrl}/pending-actions/${distributorId}?role=finance`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Finance response status:', financeResponse.status);
      console.log('📊 Response structure:', Object.keys(financeResponse.data.data));
      
      const financeData = financeResponse.data.data;
      const financeCounts = {};
      Object.entries(financeData).forEach(([key, actions]) => {
        if (Array.isArray(actions)) {
          financeCounts[key] = actions.length;
        }
      });
      
      console.log('📝 Finance action counts:', financeCounts);
      
    } catch (error) {
      console.error('❌ Finance test failed:', error.response?.data || error.message);
    }
    
    console.log('\n✅ Pending Actions API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPendingActions(); 