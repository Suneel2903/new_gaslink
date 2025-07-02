import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';

interface CustomerInventoryData {
  customer_id: string;
  customer_name: string;
  cylinder_type_id: string;
  cylinder_name: string;
  with_customer_qty: number;
  pending_returns: number;
  missing_qty: number;
  unaccounted: number;
  last_updated?: string;
}

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerData: CustomerInventoryData | null;
  onOverride: (data: any) => void;
}

interface InventoryHistoryEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: any;
  user_id?: string;
  created_at: string;
}

const OverrideModal: React.FC<OverrideModalProps> = ({ isOpen, onClose, customerData, onOverride }) => {
  const [formData, setFormData] = useState({
    with_customer_qty: 0,
    pending_returns: 0,
    missing_qty: 0,
    reason: ''
  });

  useEffect(() => {
    if (customerData) {
      setFormData({
        with_customer_qty: customerData.with_customer_qty,
        pending_returns: customerData.pending_returns,
        missing_qty: customerData.missing_qty,
        reason: ''
      });
    }
  }, [customerData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData || !formData.reason.trim()) return;
    
    onOverride({
      customer_id: customerData.customer_id,
      cylinder_type_id: customerData.cylinder_type_id,
      ...formData
    });
    onClose();
  };

  if (!isOpen || !customerData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Override Balance</h2>
        <p className="text-sm text-gray-600 mb-4">
          {customerData.customer_name} - {customerData.cylinder_name}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              With Customer Qty
            </label>
            <input
              type="number"
              min="0"
              value={formData.with_customer_qty}
              onChange={(e) => setFormData(prev => ({ ...prev, with_customer_qty: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pending Returns
            </label>
            <input
              type="number"
              min="0"
              value={formData.pending_returns}
              onChange={(e) => setFormData(prev => ({ ...prev, pending_returns: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Missing Qty
            </label>
            <input
              type="number"
              min="0"
              value={formData.missing_qty}
              onChange={(e) => setFormData(prev => ({ ...prev, missing_qty: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Override *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter reason for override..."
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CustomerInventoryPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerInventoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInventoryData | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: CustomerInventoryData | null }>({ open: false, customer: null });
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadCustomerInventory();
  }, []);

  const loadCustomerInventory = async () => {
    setLoading(true);
    try {
      const response = await api.inventory.getUnaccountedSummary(new Date().toISOString().split('T')[0]);
      setCustomers(response.data);
      console.log('Fetched customers:', response.data);
    } catch (error) {
      console.error('Failed to load customer inventory:', error);
      setMessage({ type: 'error', text: 'Failed to load customer inventory' });
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (data: any) => {
    try {
      await api.inventory.adminOverrideBalance(data);
      setMessage({ type: 'success', text: 'Balance overridden successfully' });
      loadCustomerInventory(); // Reload data
    } catch (error) {
      console.error('Failed to override balance:', error);
      setMessage({ type: 'error', text: 'Failed to override balance' });
    }
  };

  const openHistory = async (customer: CustomerInventoryData) => {
    setHistoryModal({ open: true, customer });
    setHistoryLoading(true);
    try {
      const res = await api.inventory.getHistory(customer.customer_id, customer.cylinder_type_id);
      setHistory(res.data);
    } catch (e) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.cylinder_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  console.log('Filtered customers:', filteredCustomers);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Inventory</h1>
        <p className="text-gray-600">View and manage customer inventory balances</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search customers or cylinder types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full rounded-lg overflow-hidden shadow">
          <thead>
            <tr className="border-b border-gray-200 bg-blue-50">
              <th className="text-left py-2 px-4 font-medium text-blue-900">Customer</th>
              <th className="text-left py-2 px-4 font-medium text-blue-900">Cylinder Type</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">With Customer</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">Pending Returns</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">Missing</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">Unaccounted</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">Last Updated</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((item, idx) => (
              <tr key={item.customer_id + '-' + item.cylinder_type_id} className={
                `border-b border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-100`
              }>
                <td className="py-3 px-4 font-medium text-gray-900">{item.customer_name}</td>
                <td className="py-3 px-4 font-medium text-gray-900">{item.cylinder_name}</td>
                <td className={`py-3 px-4 text-center font-semibold ${item.with_customer_qty < 0 ? 'text-red-600' : 'text-green-700'}`}>{item.with_customer_qty}</td>
                <td className={`py-3 px-4 text-center font-semibold ${item.pending_returns > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>{item.pending_returns}</td>
                <td className={`py-3 px-4 text-center font-semibold ${item.missing_qty > 0 ? 'text-red-700' : 'text-gray-700'}`}>{item.missing_qty}</td>
                <td className={`py-3 px-4 text-center font-semibold ${item.unaccounted > 0 ? 'text-red-600' : item.unaccounted < 0 ? 'text-blue-700' : 'text-gray-700'}`}>{item.unaccounted}</td>
                <td className="py-3 px-4 text-center text-gray-500">{item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => {
                      setSelectedCustomer(item);
                      setShowOverrideModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
                  >
                    Override
                  </button>
                  <button
                    onClick={() => openHistory(item)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded ml-2"
                  >
                    History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        customerData={selectedCustomer}
        onOverride={handleOverride}
      />

      {/* History Modal */}
      {historyModal.open && historyModal.customer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Inventory History</h2>
            <p className="mb-2 text-gray-600">{historyModal.customer.customer_name} - {historyModal.customer.cylinder_name}</p>
            {historyLoading ? (
              <div>Loading...</div>
            ) : history.length === 0 ? (
              <div>No history found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-2 text-left">Date</th>
                    <th className="py-2 px-2 text-left">Action</th>
                    <th className="py-2 px-2 text-left">Details</th>
                    <th className="py-2 px-2 text-left">User/Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="py-1 px-2">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="py-1 px-2">{h.action}</td>
                      <td className="py-1 px-2 whitespace-pre-wrap">{JSON.stringify(h.details, null, 2)}</td>
                      <td className="py-1 px-2">{h.user_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setHistoryModal({ open: false, customer: null })} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerInventoryPage; 