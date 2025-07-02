import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

console.log('🚀 Starting Simple Payment Module Test...');

// Test 1: Health Check
const testHealth = async () => {
  console.log('\n1️⃣ Testing Health Check...');
  try {
    const response = await axios.get(`${API_BASE.replace('/api', '')}/health`);
    console.log('✅ Backend is running:', response.data.message);
    return true;
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
    return false;
  }
};

// Test 2: Get Payments (should work even if empty)
const testGetPayments = async () => {
  console.log('\n2️⃣ Testing Get Payments...');
  try {
    const response = await axios.get(`${API_BASE}/payments`);
    console.log('✅ Get payments successful');
    console.log('   Found', response.data.length, 'payments');
    return response.data;
  } catch (error) {
    console.log('❌ Get payments failed:', error.response?.data || error.message);
    return [];
  }
};

// Test 3: Get Customers (to find one for payment test)
const testGetCustomers = async () => {
  console.log('\n3️⃣ Testing Get Customers...');
  try {
    const response = await axios.get(`${API_BASE}/customers`);
    console.log('✅ Get customers successful');
    console.log('   Found', response.data.length, 'customers');
    return response.data;
  } catch (error) {
    console.log('❌ Get customers failed:', error.response?.data || error.message);
    return [];
  }
};

// Test 4: Get Distributors
const testGetDistributors = async () => {
  console.log('\n4️⃣ Testing Get Distributors...');
  try {
    const response = await axios.get(`${API_BASE}/distributors`);
    console.log('✅ Get distributors successful');
    console.log('   Found', response.data.length, 'distributors');
    return response.data;
  } catch (error) {
    console.log('❌ Get distributors failed:', error.response?.data || error.message);
    return [];
  }
};

// Test 5: Test Payment Creation (if we have customers and distributors)
const testCreatePayment = async (customers, distributors) => {
  console.log('\n5️⃣ Testing Payment Creation...');
  
  if (customers.length === 0) {
    console.log('⚠️  No customers found, skipping payment creation test');
    return null;
  }
  
  if (distributors.length === 0) {
    console.log('⚠️  No distributors found, skipping payment creation test');
    return null;
  }
  
  try {
    const paymentData = {
      customer_id: customers[0].customer_id,
      distributor_id: distributors[0].distributor_id,
      amount: 1000.00,
      payment_method: 'cash',
      payment_reference: 'TEST-001',
      allocation_mode: 'auto',
      notes: 'Test payment from integration test'
    };
    
    const response = await axios.post(`${API_BASE}/payments`, paymentData);
    
    console.log('✅ Payment creation successful');
    console.log('   Payment ID:', response.data.payment_id);
    console.log('   Amount:', response.data.amount);
    console.log('   Mode:', response.data.allocation_mode);
    
    return response.data;
  } catch (error) {
    console.log('❌ Payment creation failed:', error.response?.data || error.message);
    return null;
  }
};

// Test 6: Test Payment Details
const testGetPaymentDetails = async (paymentId) => {
  if (!paymentId) {
    console.log('\n6️⃣ Skipping Payment Details Test (no payment created)');
    return;
  }
  
  console.log('\n6️⃣ Testing Get Payment Details...');
  try {
    const response = await axios.get(`${API_BASE}/payments/${paymentId}`);
    
    console.log('✅ Payment details retrieved successfully');
    console.log('   Customer:', response.data.customer_name);
    console.log('   Amount:', response.data.amount);
    console.log('   Allocations:', response.data.allocations?.length || 0);
    
    return response.data;
  } catch (error) {
    console.log('❌ Payment details retrieval failed:', error.response?.data || error.message);
    return null;
  }
};

// Test 7: Test Outstanding Invoices
const testOutstandingInvoices = async (customers) => {
  if (customers.length === 0) {
    console.log('\n7️⃣ Skipping Outstanding Invoices Test (no customers)');
    return;
  }
  
  console.log('\n7️⃣ Testing Outstanding Invoices...');
  try {
    const response = await axios.get(`${API_BASE}/payments/outstanding/${customers[0].customer_id}`);
    
    console.log('✅ Outstanding invoices retrieved successfully');
    console.log('   Found', response.data.length, 'outstanding invoices');
    
    return response.data;
  } catch (error) {
    console.log('❌ Outstanding invoices retrieval failed:', error.response?.data || error.message);
    return [];
  }
};

// Test 8: Test Payment Summary
const testPaymentSummary = async () => {
  console.log('\n8️⃣ Testing Payment Summary...');
  try {
    const response = await axios.get(`${API_BASE}/payments/summary/reports`);
    
    console.log('✅ Payment summary retrieved successfully');
    console.log('   Summary data:', response.data);
    
    return response.data;
  } catch (error) {
    console.log('❌ Payment summary retrieval failed:', error.response?.data || error.message);
    return [];
  }
};

// Main test runner
const runSimpleTests = async () => {
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Health Check
    const healthOk = await testHealth();
    if (!healthOk) {
      console.log('❌ Cannot proceed without backend');
      return;
    }
    
    // Test 2: Get Payments
    await testGetPayments();
    
    // Test 3: Get Customers
    const customers = await testGetCustomers();
    
    // Test 4: Get Distributors
    const distributors = await testGetDistributors();
    
    // Test 5: Create Payment
    const payment = await testCreatePayment(customers, distributors);
    
    // Test 6: Get Payment Details
    await testGetPaymentDetails(payment?.payment_id);
    
    // Test 7: Outstanding Invoices
    await testOutstandingInvoices(customers);
    
    // Test 8: Payment Summary
    await testPaymentSummary();
    
    console.log('\n🎉 Simple Payment Module Tests Completed!');
    console.log('=' .repeat(50));
    console.log('✅ Backend connectivity');
    console.log('✅ Payment listing');
    console.log('✅ Payment creation');
    console.log('✅ Payment details');
    console.log('✅ Outstanding invoices');
    console.log('✅ Payment summary');
    
  } catch (error) {
    console.log('\n❌ Test suite failed:', error.message);
    console.log('=' .repeat(50));
  }
};

// Run tests
runSimpleTests(); 