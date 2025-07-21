import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../services/apiClient';  
import { useAuth } from '../contexts/AuthContext';
import { paymentSchema, type PaymentFormData } from '../schemas/paymentSchema';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormError from '../components/FormError';
import useEscKey from '../hooks/useEscKey';
import type { ApiError, Payment, Customer } from '../types';
import { paymentService } from '../services/paymentService';
import type { OutstandingInvoice } from '../types';

// Simple text icons (like other pages)
const Icons = {
  Plus: '➕',
  Eye: '👁️',
  Download: '📥',
  Filter: '🔍',
  Search: '🔎',
};

export const PaymentsPage: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);

  // UI state for enhancements
  const [customerFilter, setCustomerFilter] = useState('');
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [allocationMap, setAllocationMap] = useState<{ [invoice_id: string]: number }>({});
  const [addPaymentError, setAddPaymentError] = useState<string | null>(null);

  // Defensive UI checks
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  // AGGRESSIVE LOGGING
  console.log('PaymentsPage: distributor_id', distributor_id, 'isSuperAdmin', isSuperAdmin);

  // AGGRESSIVE: Always fetch payments and customers on every render (for debugging)
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPayments();
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributor_id, isSuperAdmin]);

  // Fetch outstanding invoices for selected customer in Add Payment modal
  useEffect(() => {
    if (showAddModal && customerFilter) {
      paymentService.getOutstandingInvoices(customerFilter)
        .then((data) => setOutstandingInvoices(data))
        .catch(() => setOutstandingInvoices([]));
    } else {
      setOutstandingInvoices([]);
    }
  }, [showAddModal, customerFilter]);

  // ESC key handler to close modals
  useEscKey({
    onEsc: () => {
      if (showAddModal) {
        setShowAddModal(false);
        reset();
        setAllocationMap({});
      }
      if (showDetailsModal) {
        setShowDetailsModal(false);
        setSelectedPayment(null);
      }
    },
    isActive: Boolean(showAddModal || showDetailsModal)
  });

  const fetchPayments = async () => {
    try {
      console.log('fetchPayments: distributor_id', distributor_id);
      let response = await api.payments.getAll(distributor_id || undefined);
      console.log('fetchPayments: response', response);
      setPayments(response.data.data || response.data || []);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError?.message || 'Unknown error fetching payments');
      console.error('Error fetching payments:', apiError);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      let response = await api.customers.getAll(distributor_id || undefined);
      setCustomers(response.data.data || response.data || []);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching customers:', apiError);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: '',
      amount: 0,
      payment_method: 'cash',
      payment_reference: '',
      allocation_mode: 'auto',
      notes: '',
    },
  });

  // Enhanced Add Payment submit handler
  const enhancedOnSubmit = async (data: PaymentFormData) => {
    setAddPaymentError(null);
    let allocations: { invoice_id: string; allocated_amount: number }[] = [];
    if (data.allocation_mode === 'manual') {
      const totalAllocated = Object.values(allocationMap).reduce((a, b) => a + b, 0);
      if (totalAllocated !== data.amount) {
        setAddPaymentError('Allocated amount must match payment amount.');
        return;
      }
      allocations = Object.entries(allocationMap)
        .filter(([id, amt]) => amt > 0)
        .map(([invoice_id, allocated_amount]) => ({ invoice_id, allocated_amount }));
      if (allocations.length === 0) {
        setAddPaymentError('Please allocate payment to at least one invoice.');
        return;
      }
    }
    try {
      const payload = {
        customer_id: data.customer_id,
        amount: data.amount,
        payment_method: data.payment_method,
        allocation_mode: data.allocation_mode,
        distributor_id: distributor_id || '',
        allocations: allocations, // always an array
        ...(data.payment_reference && { payment_reference: data.payment_reference }),
        ...(data.notes && { notes: data.notes }),
      };
      await api.payments.create(payload);
      setShowAddModal(false);
      reset();
      setAllocationMap({});
      fetchPayments();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setAddPaymentError(apiError?.message || 'Unknown error creating payment');
      console.error('Error creating payment:', apiError);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${Number(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const handleViewDetails = async (paymentId: string) => {
    try {
      const response = await api.payments.getById(paymentId);
      setSelectedPayment(response.data.data);
      setShowDetailsModal(true);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError?.message || 'Unknown error fetching payment details');
      console.error('Error fetching payment details:', apiError);
    }
  };

  // Defensive rendering
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-100 text-red-700 p-4 rounded">Error: {error}</div>
      </div>
    );
  }

  if (!payments) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Something went wrong loading payments</div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No payments found.</div>
      </div>
    );
  }

  // Filtered payments by customer
  const filteredPayments = customerFilter
    ? payments.filter((p) => p.customer_id === customerFilter)
    : payments;

  // Header
  return (
            <div className="p-4">
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
      {/* Customer Filter Dropdown */}
      <div className="mb-4 max-w-xs">
        <FormSelect
          label="Filter by Customer"
          value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value)}
          options={[
            { value: '', label: 'All Customers' },
            ...customers.map((c) => ({ value: c.customer_id, label: c.business_name }))
          ]}
        />
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
                  Allocated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outstanding
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
              {(filteredPayments ?? []).map((payment) => {
                const totalAllocated = payment.allocations?.reduce((a, alloc) => a + alloc.allocated_amount, 0) || 0;
                const outstanding = payment.amount - totalAllocated;
                return (
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
                    <td className="px-6 py-4 whitespace-nowrap text-green-700 font-semibold">
                      {formatCurrency(totalAllocated)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}> 
                      {formatCurrency(outstanding)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Add Payment Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              reset();
              setAllocationMap({});
              setAddPaymentError(null);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Payment</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  reset();
                  setAllocationMap({});
                  setAddPaymentError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit(enhancedOnSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormSelect
                  label="Customer *"
                  options={[
                    { value: '', label: 'Select Customer' },
                    ...customers
                      .filter(c => c.business_name?.trim())
                      .map((customer) => ({
                        value: customer.customer_id,
                        label: customer.business_name || ''
                      }))
                  ]}
                  error={errors.customer_id}
                  value={customerFilter}
                  onChange={e => {
                    setCustomerFilter(e.target.value);
                    setAllocationMap({});
                  }}
                />
                <FormInput
                  label="Amount (₹) *"
                  type="number"
                  step="0.01"
                  min="0"
                  error={errors.amount}
                  {...register('amount', { valueAsNumber: true })}
                />
                <FormSelect
                  label="Payment Method *"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'cheque', label: 'Cheque' },
                    { value: 'upi', label: 'UPI' },
                  ]}
                  error={errors.payment_method}
                  {...register('payment_method')}
                />
                <FormInput
                  label="Payment Reference"
                  type="text"
                  placeholder="Transaction ID, Cheque number, etc."
                  error={errors.payment_reference}
                  {...register('payment_reference')}
                />
                <FormSelect
                  label="Allocation Mode *"
                  options={[
                    { value: 'auto', label: 'Auto Allocation (Oldest Invoices First)' },
                    { value: 'manual', label: 'Manual Allocation' },
                  ]}
                  error={errors.allocation_mode}
                  {...register('allocation_mode')}
                />
              </div>
              {/* Manual Allocation UI */}
              {watch('allocation_mode') === 'manual' && customerFilter && outstandingInvoices.length > 0 && (
                <div>
                  <label className="block font-medium mb-1">Allocate to Invoices</label>
                  <div className="space-y-2">
                    {outstandingInvoices.map(inv => (
                      <div key={inv.invoice_id} className="flex items-center gap-2">
                        <span className="w-32">{inv.invoice_number}</span>
                        <span className="w-24 text-right">{formatCurrency(inv.outstanding_amount)}</span>
                        <input
                          type="number"
                          min={0}
                          max={inv.outstanding_amount}
                          className="input-field w-24"
                          value={allocationMap[inv.invoice_id] || ''}
                          onChange={e => setAllocationMap(prev => ({ ...prev, [inv.invoice_id]: Number(e.target.value) }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.notes ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  rows={3}
                  placeholder="Additional notes..."
                  {...register('notes')}
                />
                {errors.notes && <FormError error={errors.notes} />}
              </div>
              {addPaymentError && <div className="text-red-600 text-sm">{addPaymentError}</div>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    reset();
                    setAllocationMap({});
                    setAddPaymentError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
              setSelectedPayment(null);
            }
          }}
        >
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