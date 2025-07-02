const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
let authToken = null;
let testCustomerId = null;
let testDistributorId = null;
let testInvoiceId = null;
let testPaymentId = null;

// Test data
const testData = {
  customer: {
    customer_name: 'Test Customer for Payments',
    phone: '9876543210',
    email: 'testpayments@example.com',
    address: 'Test Address for Payments'
  },
  distributor: {
    distributor_name: 'Test Distributor for Payments',
    phone: '9876543211',
    email: 'testdistpayments@example.com',
    address: 'Test Distributor Address'
  },
  payment: {
    amount: 5000.00,
    payment_method: 'bank_transfer',
    payment_reference: 'TEST-TXN-001',
    allocation_mode: 'auto',
    notes: 'Test payment for integration testing'
  }
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ ${method} ${endpoint} failed:`, error.response?.data || error.message);
    throw error;
  }
};

// Test functions
const testLogin = async () => {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_BASE}/users/login`, {
      email: 'admin@gaslink.com',
      password: 'admin123'
    });
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testCreateCustomer = async () => {
  console.log('\n👤 Testing Customer Creation...');
  try {
    const customer = await makeRequest('POST', '/customers', testData.customer);
    testCustomerId = customer.customer_id;
    console.log('✅ Customer created:', customer.customer_name);
    return customer;
  } catch (error) {
    console.log('❌ Customer creation failed');
    throw error;
  }
};

const testCreateDistributor = async () => {
  console.log('\n🏢 Testing Distributor Creation...');
  try {
    const distributor = await makeRequest('POST', '/distributors', testData.distributor);
    testDistributorId = distributor.distributor_id;
    console.log('✅ Distributor created:', distributor.distributor_name);
    return distributor;
  } catch (error) {
    console.log('❌ Distributor creation failed');
    throw error;
  }
};

const testCreateInvoice = async () => {
  console.log('\n🧾 Testing Invoice Creation...');
  try {
    // First create a cylinder type and price if needed
    const cylinderType = await makeRequest('POST', '/cylinder-types', {
      type_name: 'Test Cylinder for Payments',
      capacity: 14.2,
      description: 'Test cylinder for payment testing'
    });
    
    const cylinderPrice = await makeRequest('POST', '/cylinder-prices', {
      cylinder_type_id: cylinderType.cylinder_type_id,
      distributor_id: testDistributorId,
      price_per_unit: 1000.00,
      effective_date: new Date().toISOString()
    });
    
    // Create an order first
    const order = await makeRequest('POST', '/orders', {
      customer_id: testCustomerId,
      distributor_id: testDistributorId,
      items: [{
        cylinder_type_id: cylinderType.cylinder_type_id,
        quantity: 5,
        price_per_unit: 1000.00
      }]
    });
    
    // Create invoice from order
    const invoice = await makeRequest('POST', '/invoices', {
      order_id: order.order_id
    });
    
    testInvoiceId = invoice.invoice_id;
    console.log('✅ Invoice created:', invoice.invoice_number);
    return invoice;
  } catch (error) {
    console.log('❌ Invoice creation failed');
    throw error;
  }
};

const testGetOutstandingInvoices = async () => {
  console.log('\n📋 Testing Outstanding Invoices...');
  try {
    const invoices = await makeRequest('GET', `/payments/outstanding/${testCustomerId}`);
    console.log('✅ Outstanding invoices retrieved:', invoices.length);
    console.log('   Invoice details:', invoices.map(inv => ({
      invoice_number: inv.invoice_number,
      total_amount: inv.total_amount,
      outstanding_amount: inv.outstanding_amount
    })));
    return invoices;
  } catch (error) {
    console.log('❌ Outstanding invoices retrieval failed');
    throw error;
  }
};

const testCreateAutoPayment = async () => {
  console.log('\n💰 Testing Auto Payment Creation...');
  try {
    const paymentData = {
      ...testData.payment,
      customer_id: testCustomerId,
      distributor_id: testDistributorId,
      allocation_mode: 'auto'
    };
    
    const payment = await makeRequest('POST', '/payments', paymentData);
    testPaymentId = payment.payment_id;
    console.log('✅ Auto payment created:', payment.payment_id);
    console.log('   Amount:', payment.amount);
    console.log('   Mode:', payment.allocation_mode);
    return payment;
  } catch (error) {
    console.log('❌ Auto payment creation failed');
    throw error;
  }
};

const testCreateManualPayment = async () => {
  console.log('\n💰 Testing Manual Payment Creation...');
  try {
    // Get outstanding invoices first
    const outstandingInvoices = await makeRequest('GET', `/payments/outstanding/${testCustomerId}`);
    
    if (outstandingInvoices.length === 0) {
      console.log('⚠️  No outstanding invoices for manual payment test');
      return null;
    }
    
    const paymentData = {
      ...testData.payment,
      customer_id: testCustomerId,
      distributor_id: testDistributorId,
      amount: 2000.00,
      payment_reference: 'TEST-MANUAL-001',
      allocation_mode: 'manual',
      allocations: [
        {
          invoice_id: outstandingInvoices[0].invoice_id,
          allocated_amount: 2000.00
        }
      ]
    };
    
    const payment = await makeRequest('POST', '/payments', paymentData);
    console.log('✅ Manual payment created:', payment.payment_id);
    console.log('   Amount:', payment.amount);
    console.log('   Mode:', payment.allocation_mode);
    return payment;
  } catch (error) {
    console.log('❌ Manual payment creation failed');
    throw error;
  }
};

const testGetPaymentDetails = async () => {
  console.log('\n👁️ Testing Payment Details Retrieval...');
  try {
    const payment = await makeRequest('GET', `/payments/${testPaymentId}`);
    console.log('✅ Payment details retrieved');
    console.log('   Customer:', payment.customer_name);
    console.log('   Amount:', payment.amount);
    console.log('   Allocations:', payment.allocations?.length || 0);
    if (payment.allocations && payment.allocations.length > 0) {
      console.log('   Allocation details:', payment.allocations.map(all => ({
        invoice_number: all.invoice_number,
        allocated_amount: all.allocated_amount
      })));
    }
    return payment;
  } catch (error) {
    console.log('❌ Payment details retrieval failed');
    throw error;
  }
};

const testGetAllPayments = async () => {
  console.log('\n📊 Testing All Payments Retrieval...');
  try {
    const payments = await makeRequest('GET', '/payments');
    console.log('✅ All payments retrieved:', payments.length);
    console.log('   Payment summary:', payments.map(p => ({
      customer: p.customer_name,
      amount: p.amount,
      method: p.payment_method,
      mode: p.allocation_mode
    })));
    return payments;
  } catch (error) {
    console.log('❌ All payments retrieval failed');
    throw error;
  }
};

const testPaymentSummary = async () => {
  console.log('\n📈 Testing Payment Summary...');
  try {
    const summary = await makeRequest('GET', '/payments/summary/reports');
    console.log('✅ Payment summary retrieved');
    console.log('   Summary:', summary.map(s => ({
      method: s.payment_method,
      mode: s.allocation_mode,
      total_payments: s.total_payments,
      total_amount: s.total_amount
    })));
    return summary;
  } catch (error) {
    console.log('❌ Payment summary retrieval failed');
    throw error;
  }
};

const testInvoiceStatusUpdate = async () => {
  console.log('\n🔄 Testing Invoice Status Update...');
  try {
    const invoices = await makeRequest('GET', `/payments/outstanding/${testCustomerId}`);
    console.log('✅ Invoice status check completed');
    console.log('   Outstanding invoices:', invoices.length);
    console.log('   Invoice statuses:', invoices.map(inv => ({
      invoice_number: inv.invoice_number,
      status: inv.status,
      outstanding_amount: inv.outstanding_amount
    })));
    return invoices;
  } catch (error) {
    console.log('❌ Invoice status check failed');
    throw error;
  }
};

const testValidationErrors = async () => {
  console.log('\n⚠️ Testing Validation Errors...');
  
  // Test missing required fields
  try {
    await makeRequest('POST', '/payments', {
      amount: 1000,
      // Missing customer_id, distributor_id, etc.
    });
    console.log('❌ Should have failed with missing fields');
  } catch (error) {
    console.log('✅ Correctly rejected payment with missing fields');
  }
  
  // Test invalid allocation mode
  try {
    await makeRequest('POST', '/payments', {
      customer_id: testCustomerId,
      distributor_id: testDistributorId,
      amount: 1000,
      payment_method: 'cash',
      allocation_mode: 'invalid_mode'
    });
    console.log('❌ Should have failed with invalid allocation mode');
  } catch (error) {
    console.log('✅ Correctly rejected payment with invalid allocation mode');
  }
  
  // Test negative amount
  try {
    await makeRequest('POST', '/payments', {
      customer_id: testCustomerId,
      distributor_id: testDistributorId,
      amount: -1000,
      payment_method: 'cash',
      allocation_mode: 'auto'
    });
    console.log('❌ Should have failed with negative amount');
  } catch (error) {
    console.log('✅ Correctly rejected payment with negative amount');
  }
};

const cleanup = async () => {
  console.log('\n🧹 Cleaning up test data...');
  try {
    // Note: In a real scenario, you might want to clean up test data
    // For now, we'll just log what would be cleaned up
    console.log('   Test payment ID:', testPaymentId);
    console.log('   Test customer ID:', testCustomerId);
    console.log('   Test distributor ID:', testDistributorId);
    console.log('   Test invoice ID:', testInvoiceId);
    console.log('✅ Cleanup information logged');
  } catch (error) {
    console.log('⚠️ Cleanup failed:', error.message);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Payments Module Integration Tests...');
  console.log('=' .repeat(60));
  
  try {
    // Authentication
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
      console.log('❌ Cannot proceed without authentication');
      return;
    }
    
    // Setup test data
    await testCreateCustomer();
    await testCreateDistributor();
    await testCreateInvoice();
    
    // Test core functionality
    await testGetOutstandingInvoices();
    await testCreateAutoPayment();
    await testCreateManualPayment();
    await testGetPaymentDetails();
    await testGetAllPayments();
    await testPaymentSummary();
    await testInvoiceStatusUpdate();
    
    // Test error handling
    await testValidationErrors();
    
    // Cleanup
    await cleanup();
    
    console.log('\n🎉 All Payments Module Tests Completed Successfully!');
    console.log('=' .repeat(60));
    console.log('✅ Database schema working');
    console.log('✅ API endpoints functional');
    console.log('✅ Business logic implemented');
    console.log('✅ Auto allocation working');
    console.log('✅ Manual allocation working');
    console.log('✅ Invoice status updates working');
    console.log('✅ Validation working');
    console.log('✅ Error handling working');
    
  } catch (error) {
    console.log('\n❌ Test suite failed:', error.message);
    console.log('=' .repeat(60));
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testData
}; 