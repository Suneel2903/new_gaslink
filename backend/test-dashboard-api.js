const axios = require('axios');

async function testDashboardAPI() {
  try {
    console.log('🧪 Testing Dashboard API endpoint...');
    
    const distributorId = '11111111-1111-1111-1111-111111111111';
    const url = `http://localhost:5000/api/dashboard/stats/${distributorId}`;
    
    console.log('📡 Making request to:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': 'Bearer test-token', // This will be handled by middleware
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Dashboard Stats:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Validate response structure
    const data = response.data;
    const requiredFields = ['orders_today', 'cylinders_in_stock', 'overdue_invoices', 'revenue_this_week', 'cylinder_health'];
    
    for (const field of requiredFields) {
      if (data.hasOwnProperty(field)) {
        console.log(`✅ ${field}:`, data[field]);
      } else {
        console.log(`❌ Missing field: ${field}`);
      }
    }
    
    // Check for auto-triggered requests
    const lowStockAlerts = data.cylinder_health.filter(h => h.request_sent);
    if (lowStockAlerts.length > 0) {
      console.log('🚨 Low stock alerts triggered:');
      lowStockAlerts.forEach(alert => {
        console.log(`   - ${alert.cylinder_type}: ${alert.in_stock}/${alert.threshold} (triggered at: ${alert.triggered_at})`);
      });
    } else {
      console.log('✅ No low stock alerts triggered');
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testDashboardAPI(); 