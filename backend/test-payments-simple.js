import db from './db.js';

console.log('🚀 Testing Payments Module - Direct Database Access...');
console.log('==================================================');

const testPaymentsModule = async () => {
  try {
    // Test 1: Check if payment_transactions table exists
    console.log('\n1️⃣ Testing Payment Tables...');
    try {
      const tableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('payment_transactions', 'payment_allocations')
      `);
      console.log('✅ Payment tables found:', tableCheck.rows.map(row => row.table_name));
    } catch (error) {
      console.log('❌ Error checking tables:', error.message);
    }

    // Test 2: Check customers
    console.log('\n2️⃣ Testing Customers...');
    try {
      const customers = await db.query(`
        SELECT customer_id, business_name, phone 
        FROM customers 
        WHERE deleted_at IS NULL 
        LIMIT 5
      `);
      console.log('✅ Customers found:', customers.rows.length);
      customers.rows.forEach(customer => {
        console.log(`   - ${customer.business_name} (${customer.phone})`);
      });
    } catch (error) {
      console.log('❌ Error fetching customers:', error.message);
    }

    // Test 3: Check distributors
    console.log('\n3️⃣ Testing Distributors...');
    try {
      const distributors = await db.query(`
        SELECT distributor_id, business_name, phone 
        FROM distributors 
        LIMIT 5
      `);
      console.log('✅ Distributors found:', distributors.rows.length);
      distributors.rows.forEach(dist => {
        console.log(`   - ${dist.business_name} (${dist.phone})`);
      });
    } catch (error) {
      console.log('❌ Error fetching distributors:', error.message);
    }

    // Test 4: Check existing payments
    console.log('\n4️⃣ Testing Existing Payments...');
    try {
      const payments = await db.query(`
        SELECT payment_id, amount, payment_method, created_at 
        FROM payment_transactions 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.log('✅ Payments found:', payments.rows.length);
      payments.rows.forEach(payment => {
        console.log(`   - ₹${payment.amount} via ${payment.payment_method} (${payment.created_at})`);
      });
    } catch (error) {
      console.log('❌ Error fetching payments:', error.message);
    }

    // Test 5: Create a test payment
    console.log('\n5️⃣ Testing Payment Creation...');
    try {
      // Get first customer and distributor
      const customer = await db.query('SELECT customer_id FROM customers WHERE deleted_at IS NULL LIMIT 1');
      const distributor = await db.query('SELECT distributor_id FROM distributors LIMIT 1');
      
      if (customer.rows.length > 0 && distributor.rows.length > 0) {
        const testPayment = await db.query(`
          INSERT INTO payment_transactions (
            customer_id, distributor_id, amount, payment_method, 
            payment_reference, allocation_mode, received_by, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING payment_id, amount, payment_method
        `, [
          customer.rows[0].customer_id,
          distributor.rows[0].distributor_id,
          5000.00,
          'cash',
          'TEST-REF-001',
          'auto',
          null, // received_by (UUID) - null for testing
          'Test payment for module testing'
        ]);
        
        console.log('✅ Test payment created:', testPayment.rows[0]);
        
        // Clean up - delete the test payment
        await db.query('DELETE FROM payment_transactions WHERE payment_id = $1', [testPayment.rows[0].payment_id]);
        console.log('✅ Test payment cleaned up');
      } else {
        console.log('❌ No customers or distributors found for testing');
      }
    } catch (error) {
      console.log('❌ Error creating test payment:', error.message);
    }

    // Test 6: Payment summary
    console.log('\n6️⃣ Testing Payment Summary...');
    try {
      const summary = await db.query(`
        SELECT 
          COUNT(*) as total_payments,
          COALESCE(SUM(amount), 0) as total_amount,
          payment_method,
          allocation_mode
        FROM payment_transactions 
        GROUP BY payment_method, allocation_mode
        ORDER BY total_amount DESC
      `);
      console.log('✅ Payment summary:', summary.rows);
    } catch (error) {
      console.log('❌ Error fetching payment summary:', error.message);
    }

    console.log('\n🎉 Payments Module Database Tests Completed!');
    console.log('==================================================');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
};

testPaymentsModule(); 