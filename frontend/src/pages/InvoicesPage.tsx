import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import invoiceService from '../services/invoiceService';
import { creditNoteSchema, type CreditNoteFormData } from '../schemas/creditNoteSchema';
import FormInput from '../components/FormInput';
import FormError from '../components/FormError';
import useEscKey from '../hooks/useEscKey';
import type { Invoice, DisputeRequest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import type { ApiError } from '../types';
import EmptyState from '../components/EmptyState';
import FormSelect from '../components/FormSelect';
import { paymentService } from '../services/paymentService';
import type { Customer, OutstandingInvoice, CreatePaymentRequest } from '../types';
import { api } from '../services/apiClient';
import axios from '../services/apiClient';

interface UploadResult {
  success?: boolean;
  error?: string;
  items_inserted?: number;
}

interface SearchFilters {
  status: string;
  customer: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  credit_note_issued: 'bg-purple-100 text-purple-800',
};

const statusLabels = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  pending_approval: 'Pending Approval',
  credit_note_issued: 'Credit Note Issued',
};

const allowedStatusKeys: readonly string[] = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'pending_approval',
];

const InvoicesPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  console.log('Current distributor_id in InvoicesPage:', distributor_id);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    customer_id: '',
    search: ''
  });

  // New search panel state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    status: 'all',
    customer: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    status: 'all',
    customer: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [creditNoteModal, setCreditNoteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Customer filter and payment modal state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAllocations, setPaymentAllocations] = useState<{ [invoice_id: string]: number }>({});
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>('auto');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [orderStatusLog, setOrderStatusLog] = useState<any[]>([]);

  const {
    register: registerCreditNote,
    handleSubmit: handleSubmitCreditNote,
    formState: { errors: creditNoteErrors },
    reset: resetCreditNote,
  } = useForm<CreditNoteFormData>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      amount: 0,
      reason: '',
    },
  });

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    fetchInvoices();
  }, [distributor_id, isSuperAdmin, pagination.page]);

  // ESC key handler to close modals
  useEscKey({
    onEsc: () => {
      if (creditNoteModal) {
        setCreditNoteModal(false);
        resetCreditNote();
      }
      if (showPaymentModal) {
        setShowPaymentModal(false);
      }
    },
    isActive: Boolean(creditNoteModal || showPaymentModal)
  });

  // New search panel handlers
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setAppliedFilters({ ...searchFilters });
    }
  };

  const handleFilterChange = (field: keyof SearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchSubmit = () => {
    setAppliedFilters({ ...searchFilters });
  };

  const clearFilters = () => {
    const clearedFilters = {
      status: 'all',
      customer: '',
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    };
    setSearchFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
  };

  const hasActiveFilters = () => {
    return appliedFilters.status !== 'all' || 
           appliedFilters.customer || 
           appliedFilters.dateFrom || 
           appliedFilters.dateTo || 
           appliedFilters.searchTerm;
  };

  // Fetch customers for filter dropdown
  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    api.customers.getAll(distributor_id || undefined)
      .then(res => {
        const list = res.data?.data || res.data;
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]));
  }, [distributor_id, isSuperAdmin]);

  const fetchInvoices = async () => {
    try {
      let response;
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      if (distributor_id) {
        params.distributor_id = distributor_id;
      }
      
      if (isSuperAdmin) {
        response = await invoiceService.getAllInvoices(params);
      } else {
        response = await invoiceService.getAllInvoices(params);
      }
      // Deduplicate invoices by invoice_number
      const uniqueInvoices = Object.values(
        (response.invoices ?? []).reduce((acc, inv) => {
          acc[inv.invoice_number] = inv;
          return acc;
        }, {} as Record<string, Invoice>)
      );
      setInvoices(uniqueInvoices);
      setPagination(response.pagination);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to fetch invoices');
      console.error('Error fetching invoices:', apiError);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitCreditNote = async (data: CreditNoteFormData) => {
    if (!selectedInvoice) return;
    
    try {
      setActionLoading(true);
      await invoiceService.issueCreditNote(selectedInvoice.invoice_id, {
        amount: data.amount,
        reason: data.reason,
      });
      setCreditNoteModal(false);
      resetCreditNote();
      setSuccess('Credit note issued successfully');
      setTimeout(() => setSuccess(''), 3000);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to issue credit note');
      setTimeout(() => setError(''), 3000);
      console.error('Error issuing credit note:', apiError);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvoice = async (invoice: Invoice) => {
    if (!confirm('Are you sure you want to cancel this invoice? This will create inventory adjustment requests.')) {
      return;
    }

    try {
      setActionLoading(true);
      await invoiceService.cancelInvoice(invoice.invoice_id);
      setSuccess('Invoice cancelled successfully');
      setTimeout(() => setSuccess(''), 3000);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to cancel invoice');
      setTimeout(() => setError(''), 3000);
      console.error('Error cancelling invoice:', apiError);
    } finally {
      setActionLoading(false);
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

  // Filtered invoices with new search panel
  const filteredInvoices = (invoices ?? []).filter(invoice => {
    const matchesSearch = !appliedFilters.searchTerm || 
      invoice.invoice_number?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      invoice.business_name?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      invoice.contact_person?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase());
    
    const matchesStatus = appliedFilters.status === 'all' || invoice.status === appliedFilters.status;
    const matchesCustomer = !appliedFilters.customer || invoice.customer_id === appliedFilters.customer;
    
    const matchesDateFrom = !appliedFilters.dateFrom || 
      (invoice.issue_date && new Date(invoice.issue_date) >= new Date(appliedFilters.dateFrom));
    
    const matchesDateTo = !appliedFilters.dateTo || 
      (invoice.issue_date && new Date(invoice.issue_date) <= new Date(appliedFilters.dateTo));
    
    return matchesSearch && matchesStatus && matchesCustomer && matchesDateFrom && matchesDateTo;
  });

  const getOutstandingAmount = (invoice: Invoice) => {
    const credits = invoice.total_credits || 0;
    return invoice.total_amount - credits;
  };

  const fetchInvoiceDetails = async (invoice_id: string) => {
    try {
      const response = await invoiceService.getInvoice(invoice_id);
      setSelectedInvoice(response.invoice);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to fetch invoice details');
      setSelectedInvoice(null);
    }
  };

  const handleRowSelect = (invoice_id: string) => {
    setSelectedRows(prev => prev.includes(invoice_id) ? prev.filter(id => id !== invoice_id) : [invoice_id]);
  };

  const handleSelectAll = () => {
    if (selectedRows.length === invoices.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(invoices.map(inv => inv.invoice_id));
    }
  };

  const isSingleSelected = selectedRows.length === 1;
  const selectedInvoiceObj = invoices.find(inv => inv.invoice_id === selectedRows[0]);

  // Helper to open Credit Note modal with full invoice details
  const openCreditNoteModal = async (invoice_id: string) => {
    try {
      const response = await invoiceService.getInvoice(invoice_id);
      setSelectedInvoice(response.invoice);
      setCreditNoteModal(true);
    } catch (err) {
      setError('Failed to fetch invoice details');
    }
  };

  const handleDownload = async (invoice_id: string, invoice_number: string) => {
    setDownloadingId(invoice_id);
    try {
      const blob = await invoiceService.downloadInvoice(invoice_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // --- OCR Invoice Upload ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const result = await invoiceService.uploadInvoicePDF(uploadFile);
      setUploadResult(result);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setUploadResult({ error: apiError.message || 'Upload failed' });
    }
    setUploadLoading(false);
  };

  // Payment modal helpers
  const handleOpenPaymentModal = () => {
    setShowPaymentModal(true);
    setPaymentAllocations({});
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentReference('');
    setAllocationMode('auto');
    setPaymentNotes('');
    setPaymentError(null);
  };
  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAllocations({});
    setPaymentAmount(0);
    setPaymentError(null);
  };
  const handlePaymentAllocationChange = (invoice_id: string, value: number) => {
    setPaymentAllocations(prev => ({ ...prev, [invoice_id]: value }));
  };
  const handleSubmitPayment = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      if (!filters.customer_id) {
        setPaymentError('Please select a customer to record payment.');
        setPaymentLoading(false);
        return;
      }
      if (paymentAmount <= 0) {
        setPaymentError('Payment amount must be greater than zero.');
        setPaymentLoading(false);
        return;
      }
      let allocations: { invoice_id: string; allocated_amount: number }[] = [];
      if (allocationMode === 'manual') {
        const totalAllocated = Object.values(paymentAllocations).reduce((a, b) => a + b, 0);
        if (totalAllocated !== paymentAmount) {
          setPaymentError('Allocated amount must match payment amount.');
          setPaymentLoading(false);
          return;
        }
        allocations = Object.entries(paymentAllocations)
          .filter(([id, amt]) => amt > 0)
          .map(([invoice_id, allocated_amount]) => ({ invoice_id, allocated_amount }));
        if (allocations.length === 0) {
          setPaymentError('Please allocate payment to at least one invoice.');
          setPaymentLoading(false);
          return;
        }
      }
      const payload: CreatePaymentRequest = {
        customer_id: filters.customer_id,
        distributor_id: distributor_id || '',
        amount: paymentAmount,
        payment_method: paymentMethod,
        allocation_mode: allocationMode,
        allocations: allocationMode === 'manual' ? allocations : [],
      };
      if (typeof paymentReference === 'string' && paymentReference.trim() !== '') {
        (payload as any).payment_reference = paymentReference;
      }
      if (typeof paymentNotes === 'string' && paymentNotes.trim() !== '') {
        (payload as any).notes = paymentNotes;
      }
      await paymentService.createPayment(payload);
      setShowPaymentModal(false);
      setPaymentAllocations({});
      setPaymentAmount(0);
      setPaymentError(null);
      setSuccess('Payment recorded successfully');
      fetchInvoices();
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleGenerateEinvoice = async () => {
    if (!isSingleSelected || !selectedInvoiceObj) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await invoiceService.generateEinvoice(selectedInvoiceObj.invoice_id);
      setSuccess('GST E-Invoice generated successfully!');
      fetchInvoices();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate GST E-Invoice');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInvoice) {
      axios.get(`/order-status-log?order_id=${selectedInvoice.order_id}`).then(res => {
        setOrderStatusLog(res.data?.log || []);
      }).catch(() => setOrderStatusLog([]));
    }
  }, [selectedInvoice]);

  // Defensive UI checks
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  if (loading) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-gray-500">Loading invoices...</div>
        </div>
      </div>
    );
  }

  if (!invoices) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">Something went wrong loading invoices</div>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <EmptyState message="No invoices found." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <div className="flex gap-2">
          <button 
            className="btn-primary flex items-center"
            onClick={() => invoiceService.updateStatuses()}
          >
            Update Statuses
          </button>
          <button
            className="btn-primary flex items-center"
            onClick={handleOpenPaymentModal}
            disabled={!filters.customer_id}
            title={!filters.customer_id ? 'Select a customer to record payment' : 'Record Payment'}
          >
            Record Payment
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          ✅ {success}
        </div>
      )}

      {/* New Search Panel */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search & Filters</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showSearchPanel ? 'Hide' : 'Show'} Advanced
            </button>
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Basic Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={searchFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer
            </label>
            <select
              value={searchFilters.customer}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Invoices
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by invoice number, customer..."
                value={searchFilters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearchSubmit}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Search Panel */}
        {showSearchPanel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Issue Date From
              </label>
              <input
                type="date"
                value={searchFilters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Issue Date To
              </label>
              <input
                type="date"
                value={searchFilters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Search Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSearchSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            Search Invoices
          </button>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              {appliedFilters.status !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Status: {statusLabels[appliedFilters.status as keyof typeof statusLabels] || appliedFilters.status}
                  <button
                    onClick={() => handleFilterChange('status', 'all')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {appliedFilters.customer && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Customer: {customers.find(c => c.customer_id === appliedFilters.customer)?.business_name}
                  <button
                    onClick={() => handleFilterChange('customer', '')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {appliedFilters.searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Search: {appliedFilters.searchTerm}
                  <button
                    onClick={() => handleFilterChange('searchTerm', '')}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  Date: {appliedFilters.dateFrom || 'Any'} - {appliedFilters.dateTo || 'Any'}
                  <button
                    onClick={() => {
                      handleFilterChange('dateFrom', '');
                      handleFilterChange('dateTo', '');
                    }}
                    className="ml-1 text-yellow-600 hover:text-yellow-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="card-header">
          <h3>All Invoices ({pagination.total})</h3>
        </div>
        <div className="card-body">
          <div className="flex gap-3 mb-4">
            {/* Remove View Invoice button here */}
            <button
              className="inline-flex items-center px-4 py-2 border border-green-600 text-green-600 rounded-full font-semibold transition hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !isSingleSelected ||
                !selectedInvoiceObj ||
                selectedInvoiceObj.einvoice_status === 'SUCCESS' ||
                actionLoading
              }
              onClick={handleGenerateEinvoice}
            >
              {actionLoading ? 'Generating...' : 'Generate E-Invoice'}
            </button>
            <button
              className="inline-flex items-center px-4 py-2 border border-red-600 text-red-600 rounded-full font-semibold transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !isSingleSelected ||
                !selectedInvoiceObj ||
                selectedInvoiceObj.einvoice_status === 'SUCCESS'
              }
              onClick={() => isSingleSelected && selectedInvoiceObj && handleCancelInvoice(selectedInvoiceObj)}
            >
              Cancel Invoice
            </button>
            <button
              className="inline-flex items-center px-4 py-2 border border-yellow-600 text-yellow-600 rounded-full font-semibold transition hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !isSingleSelected ||
                !selectedInvoiceObj ||
                selectedInvoiceObj.einvoice_status !== 'SUCCESS'
              }
              onClick={() => isSingleSelected && selectedInvoiceObj && openCreditNoteModal(selectedInvoiceObj.invoice_id)}
            >
              Issue Credit Note
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-center"><input type="checkbox" ref={selectAllRef} checked={selectedRows.length === filteredInvoices.length && filteredInvoices.length > 0} onChange={handleSelectAll} /></th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issue Date</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">GST Status</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRN</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      {hasActiveFilters() ? 'No invoices match your search criteria.' : 'No invoices found.'}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2 text-center"><input type="checkbox" checked={selectedRows.includes(invoice.invoice_id)} onChange={() => handleRowSelect(invoice.invoice_id)} /></td>
                      <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</td>
                      <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{invoice.business_name || 'N/A'}</td>
                      <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{formatDate(invoice.issue_date)}</td>
                      <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[(invoice.einvoice_status ?? 'draft') as string]}`}>
                          {invoice.einvoice_status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{invoice.irn || '-'}</td>
                      <td className="px-4 py-2 text-center text-xs text-red-600">
                        {invoice.credit_note_rejection_reason || invoice.cancel_rejection_reason || ''}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          className="inline-flex items-center justify-center px-3 py-1 rounded-full hover:bg-blue-100 text-blue-700 border border-blue-600 text-xs font-semibold"
                          title="View Invoice"
                          onClick={async () => {
                            await fetchInvoiceDetails(invoice.invoice_id);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-4 flex justify-center">
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.pages}
                </span>
                
                <button
                  className="btn-secondary"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Invoice Details</h2>
              <button
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
                onClick={() => setSelectedInvoice(null)}
              >
                &times;
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Invoice Number</label>
                  <p className="font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[(selectedInvoice.einvoice_status ?? 'draft') as string]}`}>
                    {selectedInvoice.einvoice_status || 'N/A'}
                  </span>
                </div>
                <div>
                  <label className="block font-medium mb-1">Customer</label>
                  <p>{selectedInvoice.business_name}</p>
                </div>
                <div>
                  <label className="block font-medium mb-1">Total Amount</label>
                  <p className="font-medium">{formatCurrency(selectedInvoice.total_amount)}</p>
                </div>
                {selectedInvoice.einvoice_status !== 'SUCCESS' ? (
                  <div className="col-span-2 text-gray-500 italic py-2">
                    GST e-Invoice details: Yet to be published
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block font-medium mb-1">IRN</label>
                      <p>{selectedInvoice.irn || '-'}</p>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Ack No</label>
                      <p>{selectedInvoice.ack_no || '-'}</p>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Ack Date</label>
                      <p>{selectedInvoice.ack_date ? formatDate(selectedInvoice.ack_date) : '-'}</p>
                    </div>
                    {selectedInvoice.signed_qr_code && (
                      <div>
                        <label className="block font-medium mb-1">Signed QR Code</label>
                        <img src={`data:image/png;base64,${selectedInvoice.signed_qr_code}`} alt="QR Code" className="w-32 h-32" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block font-medium mb-1">GST Invoice JSON</label>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(selectedInvoice.gst_invoice_json, null, 2)}</pre>
                    </div>
                  </>
                )}
              </div>
              {/* Tax breakdown and items */}
              <div>
                <label className="block font-medium mb-1">Items</label>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Cylinder Type</th>
                      <th className="px-4 py-2 text-left">Quantity</th>
                      <th className="px-4 py-2 text-left">Unit Price</th>
                      <th className="px-4 py-2 text-left">Total</th>
                      <th className="px-4 py-2 text-left">Discount per Unit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedInvoice?.items ?? []).map((item) => (
                      <tr key={item.invoice_item_id}>
                        <td className="px-4 py-2">{item.cylinder_type_name}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-2">{formatCurrency(item.total_price)}</td>
                        <td className="px-4 py-2">{formatCurrency(item.discount_per_unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Order Status Log */}
              {orderStatusLog.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Order Status History</h3>
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1">Previous Status</th>
                        <th className="px-2 py-1">New Status</th>
                        <th className="px-2 py-1">Changed By</th>
                        <th className="px-2 py-1">Changed At</th>
                        <th className="px-2 py-1">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderStatusLog.map((log: any) => (
                        <tr key={log.log_id}>
                          <td className="px-2 py-1">{log.previous_status}</td>
                          <td className="px-2 py-1">{log.new_status}</td>
                          <td className="px-2 py-1">{log.changed_by}</td>
                          <td className="px-2 py-1">{new Date(log.changed_at).toLocaleString()}</td>
                          <td className="px-2 py-1">{log.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {creditNoteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCreditNoteModal(false);
              resetCreditNote();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Issue Credit Note</h2>
            <form onSubmit={handleSubmitCreditNote(onSubmitCreditNote)} className="space-y-4">
              <FormInput
                label="Amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter credit amount"
                error={creditNoteErrors.amount}
                {...registerCreditNote('amount', { valueAsNumber: true })}
              />
              <div>
                <label className="block font-medium mb-1">Reason</label>
                <textarea
                  className={`input-field ${creditNoteErrors.reason ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Please provide a reason for the credit note..."
                  rows={4}
                  {...registerCreditNote('reason')}
                />
                {creditNoteErrors.reason && <FormError error={creditNoteErrors.reason} />}
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  className="btn-secondary" 
                  onClick={() => {
                    setCreditNoteModal(false);
                    resetCreditNote();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Issuing...' : 'Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClosePaymentModal();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={handleClosePaymentModal}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Record Payment</h2>
            <div className="space-y-4">
              <FormInput
                label="Amount (₹) *"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={e => setPaymentAmount(Number(e.target.value))}
              />
              <FormSelect
                label="Payment Method"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'upi', label: 'UPI' },
                ]}
              />
              <FormInput
                label="Payment Reference"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
              />
              <FormSelect
                label="Allocation Mode"
                value={allocationMode}
                onChange={e => setAllocationMode(e.target.value as 'auto' | 'manual')}
                options={[
                  { value: 'auto', label: 'Auto Allocation' },
                  { value: 'manual', label: 'Manual Allocation' },
                ]}
              />
              {allocationMode === 'manual' && (
                <div>
                  <label className="block font-medium mb-1">Allocate to Invoices</label>
                  <div className="space-y-2">
                    {invoices.filter(inv => inv.customer_id === filters.customer_id && getOutstandingAmount(inv) > 0).map(inv => (
                      <div key={inv.invoice_id} className="flex items-center gap-2">
                        <span className="w-32">{inv.invoice_number}</span>
                        <span className="w-24 text-right">{formatCurrency(getOutstandingAmount(inv))}</span>
                        <input
                          type="number"
                          min={0}
                          max={getOutstandingAmount(inv)}
                          className="input-field w-24"
                          value={paymentAllocations[inv.invoice_id] || ''}
                          onChange={e => handlePaymentAllocationChange(inv.invoice_id, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <FormInput
                label="Notes"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
              />
              {paymentError && <div className="text-red-600 text-sm">{paymentError}</div>}
              <div className="flex justify-end gap-2 mt-4">
                <button className="btn-secondary" onClick={handleClosePaymentModal} disabled={paymentLoading}>Cancel</button>
                <button className="btn-primary" onClick={handleSubmitPayment} disabled={paymentLoading}>
                  {paymentLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage; 