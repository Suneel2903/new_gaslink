import React, { useState, useEffect, useRef } from 'react';
import invoiceService from '../services/invoiceService';
import type { Invoice, DisputeRequest, CreditNoteRequest } from '../services/invoiceService';
import { useAuth } from '../contexts/AuthContext';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-orange-100 text-orange-800'
};

const statusLabels = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  pending_approval: 'Pending Approval'
};

const InvoicesPage: React.FC = () => {
  useAuth();
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

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [disputeModal, setDisputeModal] = useState(false);
  const [creditNoteModal, setCreditNoteModal] = useState(false);
  const [disputeData, setDisputeData] = useState<DisputeRequest>({ reason: '', dispute_type: 'amount', disputed_amount: 0, disputed_quantities: {}, description: '' });
  const [creditNoteData, setCreditNoteData] = useState<CreditNoteRequest>({ amount: 0, reason: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [pagination.page, filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await invoiceService.getAllInvoices({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      setInvoices(response.invoices);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to fetch invoices');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!selectedInvoice || !disputeData.reason.trim() || !disputeData.dispute_type) return;
    try {
      setActionLoading(true);
      await invoiceService.raiseDispute(selectedInvoice.invoice_id, disputeData);
      setDisputeModal(false);
      setDisputeData({ reason: '', dispute_type: 'amount', disputed_amount: 0, disputed_quantities: {}, description: '' });
      setSuccess('Dispute raised successfully');
      setTimeout(() => setSuccess(''), 3000);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to raise dispute');
      setTimeout(() => setError(''), 3000);
      console.error('Error raising dispute:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreditNote = async () => {
    if (!selectedInvoice || !creditNoteData.reason.trim() || isNaN(Number(creditNoteData.amount)) || Number(creditNoteData.amount) <= 0) {
      setError('Amount must be a positive number and reason is required');
      return;
    }

    try {
      setActionLoading(true);
      await invoiceService.issueCreditNote(selectedInvoice.invoice_id, creditNoteData);
      setCreditNoteModal(false);
      setCreditNoteData({ amount: 0, reason: '' });
      setSuccess('Credit note issued successfully');
      setTimeout(() => setSuccess(''), 3000);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to issue credit note');
      setTimeout(() => setError(''), 3000);
      console.error('Error issuing credit note:', err);
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to cancel invoice');
      setTimeout(() => setError(''), 3000);
      console.error('Error cancelling invoice:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG');
  };

  const getOutstandingAmount = (invoice: Invoice) => {
    const credits = invoice.total_credits || 0;
    return invoice.total_amount - credits;
  };

  const fetchInvoiceDetails = async (invoice_id: string) => {
    try {
      const response = await invoiceService.getInvoice(invoice_id);
      setSelectedInvoice(response.invoice);
    } catch (err) {
      setError('Failed to fetch invoice details');
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

  // Helper to open Dispute modal with full invoice details
  const openDisputeModal = async (invoice_id: string) => {
    try {
      const response = await invoiceService.getInvoice(invoice_id);
      setSelectedInvoice(response.invoice);
      setDisputeModal(true);
    } catch (err) {
      setError('Failed to fetch invoice details');
    }
  };

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
    } catch (err) {
      setError('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <div className="flex gap-2">
          <button 
            className="btn-primary flex items-center"
            onClick={() => invoiceService.updateStatuses()}
          >
            Update Statuses
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

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="flex items-center gap-2">
            🔍 Filters
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Status</label>
              <select 
                className="input-field"
                value={filters.status} 
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Invoice number, customer..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-end">
              <button 
                className="btn-secondary w-full"
                onClick={() => setFilters({ status: '', customer_id: '', search: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="card-header">
          <h3>All Invoices ({pagination.total})</h3>
        </div>
        <div className="card-body">
          <div className="flex gap-2 mb-2">
            <button
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
              disabled={!isSingleSelected}
              onClick={() => isSingleSelected && selectedInvoiceObj && openDisputeModal(selectedInvoiceObj.invoice_id)}
            >
              Dispute
            </button>
            <button
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
              disabled={!isSingleSelected}
              onClick={() => isSingleSelected && selectedInvoiceObj && openCreditNoteModal(selectedInvoiceObj.invoice_id)}
            >
              Credit Note
            </button>
            <button
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
              disabled={!isSingleSelected}
              onClick={() => isSingleSelected && selectedInvoiceObj && handleCancelInvoice(selectedInvoiceObj)}
            >
              Cancel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th><input type="checkbox" ref={selectAllRef} checked={selectedRows.length === invoices.length && invoices.length > 0} onChange={handleSelectAll} /></th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Issue Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.invoice_id} className="hover:bg-gray-50">
                    <td><input type="checkbox" checked={selectedRows.includes(invoice.invoice_id)} onChange={() => handleRowSelect(invoice.invoice_id)} /></td>
                    <td className="px-4 py-2 font-medium">{invoice.invoice_number}</td>
                    <td className="px-4 py-2">{invoice.business_name || 'N/A'}</td>
                    <td className="px-4 py-2">{formatDate(invoice.issue_date)}</td>
                    <td className="px-4 py-2">{formatDate(invoice.due_date)}</td>
                    <td className="px-4 py-2">{formatCurrency(invoice.total_amount)}</td>
                    <td className="px-4 py-2">{formatCurrency(getOutstandingAmount(invoice))}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 items-center">
                        <button
                          className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => fetchInvoiceDetails(invoice.invoice_id)}
                        >
                          View
                        </button>
                        <button
                          className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => handleDownload(invoice.invoice_id, invoice.invoice_number)}
                          disabled={downloadingId === invoice.invoice_id}
                        >
                          {downloadingId === invoice.invoice_id ? 'Downloading...' : 'Download'}
                        </button>
                        <div className="relative group">
                          <button className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center">
                            More
                          </button>
                          <div className="absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg z-10 hidden group-hover:block">
                            <button
                              className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                              onClick={() => openDisputeModal(invoice.invoice_id)}
                            >
                              Dispute
                            </button>
                            <button
                              className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                              onClick={() => openCreditNoteModal(invoice.invoice_id)}
                            >
                              Credit Note
                            </button>
                            <button
                              className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                              onClick={() => handleCancelInvoice(invoice)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
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
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[selectedInvoice.status]}`}>
                    {statusLabels[selectedInvoice.status]}
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
              </div>
              
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
                    {selectedInvoice.items?.map((item) => (
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

              {(!selectedInvoice.items || selectedInvoice.items.length === 0) && (
                <div className="text-center text-gray-500 py-4">No items found for this invoice.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Raise Dispute</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Dispute Type</label>
                <select
                  className="input-field"
                  value={disputeData.dispute_type}
                  onChange={e => setDisputeData(d => ({ ...d, dispute_type: e.target.value as 'amount' | 'quantity' }))}
                >
                  <option value="amount">Amount</option>
                  <option value="quantity">Quantity</option>
                </select>
              </div>
              {disputeData.dispute_type === 'amount' && (
                <div>
                  <label className="block font-medium mb-1">Disputed Amount</label>
                  <input
                    type="number"
                    className="input-field"
                    value={disputeData.disputed_amount || ''}
                    onChange={e => setDisputeData(d => ({ ...d, disputed_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="Enter disputed amount"
                  />
                </div>
              )}
              {disputeData.dispute_type === 'quantity' && selectedInvoice && (
                <div>
                  <label className="block font-medium mb-1">Disputed Quantities</label>
                  {selectedInvoice.items?.map(item => (
                    <div key={item.cylinder_type_id} className="flex items-center gap-2 mb-2">
                      <span className="w-32">{item.cylinder_type_name}</span>
                      <input
                        type="number"
                        className="input-field w-24"
                        value={disputeData.disputed_quantities?.[item.cylinder_type_id] || ''}
                        onChange={e => setDisputeData(d => ({
                          ...d,
                          disputed_quantities: {
                            ...d.disputed_quantities,
                            [item.cylinder_type_id]: parseInt(e.target.value, 10) || 0
                          }
                        }))}
                        placeholder="Qty"
                        min={0}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="block font-medium mb-1">Reason for Dispute</label>
                <textarea
                  className="input-field"
                  value={disputeData.reason}
                  onChange={e => setDisputeData(d => ({ ...d, reason: e.target.value }))}
                  placeholder="Please provide a detailed reason for the dispute..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Description (optional)</label>
                <textarea
                  className="input-field"
                  value={disputeData.description}
                  onChange={e => setDisputeData(d => ({ ...d, description: e.target.value }))}
                  placeholder="Additional details (optional)"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setDisputeModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleDispute}
                  disabled={actionLoading || !disputeData.reason.trim()}
                >
                  {actionLoading ? 'Raising...' : 'Raise Dispute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {creditNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Issue Credit Note</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Amount</label>
                <input
                  type="number"
                  className="input-field"
                  value={creditNoteData.amount}
                  onChange={(e) => setCreditNoteData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="Enter credit amount"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Reason</label>
                <textarea
                  className="input-field"
                  value={creditNoteData.reason}
                  onChange={(e) => setCreditNoteData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a reason for the credit note..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  className="btn-secondary" 
                  onClick={() => setCreditNoteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleCreditNote} 
                  disabled={actionLoading || !creditNoteData.reason.trim() || creditNoteData.amount <= 0}
                >
                  {actionLoading ? 'Issuing...' : 'Issue Credit Note'}
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