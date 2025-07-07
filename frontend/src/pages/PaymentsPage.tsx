import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

// Simple text icons (like other pages)
const Icons = {
  Plus: '➕',
  Eye: '👁️',
  Download: '📥',
  Filter: '🔍',
  Search: '🔎',
};

interface Payment {
  payment_id: string;
  customer_name: string;
  phone: string;
  distributor_name: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  allocation_mode: 'auto' | 'manual';
  received_by_name: string;
  received_at: string;
  notes?: string;
  created_at: string;
  allocations?: PaymentAllocation[];
}

interface PaymentAllocation {
  allocation_id: string;
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  allocated_amount: number;
  invoice_status: string;
}

interface Customer {
  customer_id: string;
  customer_name: string;
  business_name: string;
  phone: string;
}



const PaymentsPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterMode, setFilterMode] = useState('all');

  // Add payment form state
  const [addPaymentForm, setAddPaymentForm] = useState({
    customer_id: '',
    amount: '',
    payment_method: 'cash',
    payment_reference: '',
    allocation_mode: 'auto' as 'auto' | 'manual',
    notes: '',
    allocations: [] as Array<{ invoice_id: string; allocated_amount: number }>
  });

  // Manual allocation state
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);

  const DEFAULT_DISTRIBUTOR_ID = '11111111-1111-1111-1111-111111111111';

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return; // Wait for distributor_id
    fetchPayments();
    fetchCustomers();
  }, [distributor_id, isSuperAdmin]);

  const fetchPayments = async () => {
    try {
      let response;
      if (isSuperAdmin) {
        response = await apiClient.get('/payments');
      } else {
        response = await apiClient.get('/payments', { params: { distributorId: distributor_id } });
      }
      setPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      let response;
      if (isSuperAdmin) {
        response = await apiClient.get('/customers');
      } else {
        response = await apiClient.get('/customers', { params: { distributorId: distributor_id } });
      }
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchOutstandingInvoices = async (customerId: string) => {
    try {
      const response = await apiClient.get(`/payments/outstanding/${customerId}`);
      setOutstandingInvoices(response.data);
    } catch (error) {
      console.error('Error fetching outstanding invoices:', error);
    }
  };

  const handleAddPayment = async () => {
    try {
      const payload = {
        ...addPaymentForm,
        distributor_id: DEFAULT_DISTRIBUTOR_ID,
        amount: parseFloat(addPaymentForm.amount),
        allocations: addPaymentForm.allocation_mode === 'manual' ? addPaymentForm.allocations : []
      };
      await apiClient.post('/payments', payload);
      setShowAddModal(false);
      resetAddPaymentForm();
      fetchPayments();
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };

  const handleViewDetails = async (paymentId: string) => {
    try {
      const response = await apiClient.get(`/payments/${paymentId}`);
      setSelectedPayment(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  };

  const resetAddPaymentForm = () => {
    setAddPaymentForm({
      customer_id: '',
      amount: '',
      payment_method: 'cash',
      payment_reference: '',
      allocation_mode: 'auto',
      notes: '',
      allocations: []
    });
  };

  const handleCustomerChange = (customerId: string) => {
    setAddPaymentForm(prev => ({ ...prev, customer_id: customerId }));
    if (customerId && addPaymentForm.allocation_mode === 'manual') {
      fetchOutstandingInvoices(customerId);
    }
  };

  const handleAllocationModeChange = (mode: 'auto' | 'manual') => {
    setAddPaymentForm(prev => ({ ...prev, allocation_mode: mode }));
    if (mode === 'manual' && addPaymentForm.customer_id) {
      fetchOutstandingInvoices(addPaymentForm.customer_id);
    }
  };

  const addAllocation = (invoiceId: string, amount: number) => {
    setAddPaymentForm(prev => ({
      ...prev,
      allocations: [...prev.allocations, { invoice_id: invoiceId, allocated_amount: amount }]
    }));
  };

  const removeAllocation = (index: number) => {
    setAddPaymentForm(prev => ({
      ...prev,
      allocations: prev.allocations.filter((_, i) => i !== index)
    }));
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.payment_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.phone.includes(searchTerm);
    
    const matchesMethod = filterMethod === 'all' || payment.payment_method === filterMethod;
    const matchesMode = filterMode === 'all' || payment.allocation_mode === filterMode;
    
    return matchesSearch && matchesMethod && matchesMode;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Manage customer payments and allocations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <span>{Icons.Plus}</span>
          Add Payment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">{Icons.Search}</span>
            <input
              type="text"
              placeholder="Search by customer, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
          </select>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Modes</option>
            <option value="auto">Auto Allocation</option>
            <option value="manual">Manual Allocation</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.payment_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {payment.customer_name}
                      </div>
                      <div className="text-sm text-gray-500">{payment.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </div>
                    {payment.payment_reference && (
                      <div className="text-sm text-gray-500">
                        Ref: {payment.payment_reference}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {payment.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.allocation_mode === 'auto' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.allocation_mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.received_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(payment.received_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(payment.payment_id)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                    >
                      <span>{Icons.Eye}</span>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Payment</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddPaymentForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={addPaymentForm.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers
                    .filter(c => c.business_name?.trim())
                    .map((customer) => (
                      <option key={customer.customer_id} value={customer.customer_id}>
                        {customer.business_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addPaymentForm.amount}
                  onChange={(e) => setAddPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={addPaymentForm.payment_method}
                  onChange={(e) => setAddPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference
                </label>
                <input
                  type="text"
                  value={addPaymentForm.payment_reference}
                  onChange={(e) => setAddPaymentForm(prev => ({ ...prev, payment_reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Transaction ID, Cheque number, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allocation Mode *
                </label>
                <select
                  value={addPaymentForm.allocation_mode}
                  onChange={(e) => handleAllocationModeChange(e.target.value as 'auto' | 'manual')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="auto">Auto Allocation (Oldest Invoices First)</option>
                  <option value="manual">Manual Allocation</option>
                </select>
              </div>
            </div>

            {addPaymentForm.allocation_mode === 'manual' && outstandingInvoices.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manual Allocations
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {outstandingInvoices.map((invoice) => (
                    <div key={invoice.invoice_id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                      <div>
                        <div className="font-medium">Invoice #{invoice.invoice_number}</div>
                        <div className="text-sm text-gray-500">
                          Outstanding: {formatCurrency(invoice.outstanding_amount)}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        onChange={(e) => {
                          const amount = parseFloat(e.target.value) || 0;
                          if (amount > 0) {
                            addAllocation(invoice.invoice_id, amount);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {addPaymentForm.allocations.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Allocations
                </label>
                <div className="border border-gray-300 rounded-lg p-4">
                  {addPaymentForm.allocations.map((allocation, index) => {
                    const invoice = outstandingInvoices.find(inv => inv.invoice_id === allocation.invoice_id);
                    return (
                      <div key={index} className="flex items-center justify-between py-2">
                        <span>Invoice #{invoice?.invoice_number}: {formatCurrency(allocation.allocated_amount)}</span>
                        <button
                          onClick={() => removeAllocation(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={addPaymentForm.notes}
                onChange={(e) => setAddPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddPaymentForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Payment Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Payment Information</h3>
                <div className="space-y-2">
                  <div><strong>Customer:</strong> {selectedPayment.customer_name}</div>
                  <div><strong>Phone:</strong> {selectedPayment.phone}</div>
                  <div><strong>Distributor:</strong> {selectedPayment.distributor_name}</div>
                  <div><strong>Amount:</strong> {formatCurrency(selectedPayment.amount)}</div>
                  <div><strong>Method:</strong> {selectedPayment.payment_method}</div>
                  {selectedPayment.payment_reference && (
                    <div><strong>Reference:</strong> {selectedPayment.payment_reference}</div>
                  )}
                  <div><strong>Mode:</strong> {selectedPayment.allocation_mode}</div>
                  <div><strong>Received By:</strong> {selectedPayment.received_by_name}</div>
                  <div><strong>Date:</strong> {formatDate(selectedPayment.received_at)}</div>
                  {selectedPayment.notes && (
                    <div><strong>Notes:</strong> {selectedPayment.notes}</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Allocations</h3>
                {selectedPayment.allocations && selectedPayment.allocations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPayment.allocations.map((allocation) => (
                      <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-3">
                        <div><strong>Invoice:</strong> #{allocation.invoice_number}</div>
                        <div><strong>Total Amount:</strong> {formatCurrency(allocation.total_amount)}</div>
                        <div><strong>Allocated:</strong> {formatCurrency(allocation.allocated_amount)}</div>
                        <div><strong>Status:</strong> {allocation.invoice_status}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No allocations found</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage; 