import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import type { ApiError } from '../../types';
import { useDebug } from '../../contexts/DebugContext';

interface CustomerInventoryData {
  customer_id: string;
  customer_name: string;
  cylinder_type_id: string;
  cylinder_name: string;
  full_cylinders: number;
  empty_cylinders: number;
  missing_qty: number;
  last_updated: string;
}

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerData: CustomerInventoryData | null;
  onOverride: (data: OverrideBalanceRequest) => void;
}

interface OverrideBalanceRequest {
  customer_id: string;
  cylinder_type_id: string;
  with_customer_qty: number;
  pending_returns: number;
  missing_qty: number;
  reason: string;
  status?: string; // Add status for role-aware override
}

interface OverrideBalanceRequestWithStatus extends OverrideBalanceRequest {
  status: string;
}

interface InventoryHistoryEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown>;
  user_id?: string;
  created_at: string;
}

interface DeliveryHistoryEntry {
  order_id: string;
  delivery_date: string | null;
  delivered_qty: number;
  empties_returned: number;
  net_change: number;
  grace_expiry: string | null;
  status: string;
}

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerInventoryData | null;
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
        with_customer_qty: customerData.full_cylinders,
        pending_returns: customerData.empty_cylinders,
        missing_qty: 0,
        reason: ''
      });
    }
  }, [customerData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData || !formData.reason.trim()) return;
    onOverride({
      customer_id: customerData.customer_id,
      cylinder_type_id: customerData.cylinder_type_id, // Fix: use correct cylinder_type_id
      ...formData
    });
    onClose();
  };

  if (!isOpen || !customerData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Override Balance</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {customerData.customer_id}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              With Customer Qty
            </label>
            <input
              type="number"
              min="0"
              value={formData.with_customer_qty}
              onChange={(e) => setFormData(prev => ({ ...prev, with_customer_qty: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pending Returns
            </label>
            <input
              type="number"
              min="0"
              value={formData.pending_returns}
              onChange={(e) => setFormData(prev => ({ ...prev, pending_returns: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Missing Qty
            </label>
            <input
              type="number"
              min="0"
              value={formData.missing_qty}
              onChange={(e) => setFormData(prev => ({ ...prev, missing_qty: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Override *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={3}
              placeholder="Enter reason for override..."
              required
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
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

const DrilldownModal: React.FC<DrilldownModalProps> = ({ isOpen, onClose, customer }) => {
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const debug = useDebug();

  useEffect(() => {
    if (isOpen && customer) {
      setLoading(true);
      fetch(`/inventory/customer-delivery-history/${customer.customer_id}/${customer.cylinder_type_id}`)
        .then(res => res.json())
        .then(data => {
          debug?.log && debug.log(`📦 Drilldown fetched: ${JSON.stringify(data)}`);
          setHistory(data.data || []);
        })
        .catch(e => {
          debug?.log && debug.log(`❌ Drilldown fetch error: ${e.message}`);
          setHistory([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Delivery Details: {customer.customer_name} ({customer.cylinder_name})</h2>
        {loading ? (
          <div>Loading...</div>
        ) : history.length === 0 ? (
          <div>No delivery history found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-2 text-left">Delivery Date</th>
                <th className="py-2 px-2 text-center">Delivered</th>
                <th className="py-2 px-2 text-center">Returned</th>
                <th className="py-2 px-2 text-center">Net Change</th>
                <th className="py-2 px-2 text-center">Grace Expiry</th>
                <th className="py-2 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.order_id + i}>
                  <td className="py-1 px-2">{h.delivery_date ? new Date(h.delivery_date).toLocaleDateString() : '-'}</td>
                  <td className="py-1 px-2 text-center">{h.delivered_qty}</td>
                  <td className="py-1 px-2 text-center">{h.empties_returned}</td>
                  <td className="py-1 px-2 text-center">{h.net_change}</td>
                  <td className="py-1 px-2 text-center">{h.grace_expiry ? new Date(h.grace_expiry).toLocaleDateString() : '-'}</td>
                  <td className={`py-1 px-2 text-center font-semibold ${h.status === 'missing' ? 'text-red-600' : h.status === 'pending' ? 'text-yellow-700' : 'text-green-700'}`}>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Close</button>
        </div>
      </div>
    </div>
  );
};

const CustomerInventoryPage: React.FC = () => {
  const { distributor_id, isSuperAdmin, role } = useAuth();
  const debug = useDebug();
  const [customers, setCustomers] = useState<CustomerInventoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInventoryData | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: CustomerInventoryData | null }>({ open: false, customer: null });
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [drilldownModal, setDrilldownModal] = useState<{ open: boolean; customer: CustomerInventoryData | null }>({ open: false, customer: null });
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [cylinderDetails, setCylinderDetails] = useState<Record<string, DeliveryHistoryEntry[]>>({});
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (distributor_id || isSuperAdmin) {
      loadCustomerInventory();
    }
  }, [distributor_id, isSuperAdmin]);

  const loadCustomerInventory = async () => {
    setLoading(true);
    try {
      // Using unaccounted summary which returns customer inventory data
      const date = new Date().toISOString().split('T')[0] || '';
      const response = await api.inventory.getUnaccountedSummary(date, distributor_id || undefined);
      debug?.log && debug.log(`📊 Fetched customer summary: ${JSON.stringify(response.data)}`);
      console.log('Raw response:', response);
      console.log('Response data:', response.data);
      console.log('Using distributor_id:', distributor_id);
      
      // The backend returns the data directly as an array
      const rawData = Array.isArray(response.data) ? response.data : [];
      console.log('Raw data:', rawData);
      
      if (rawData.length === 0) {
        console.log('No data returned from backend');
        setCustomers([]);
        return;
      }
      
      // Transform the data to match the expected interface
      const transformedData = rawData.map((item: any) => ({
        customer_id: item.customer_id,
        customer_name: item.customer_name,
        cylinder_type_id: item.cylinder_type_id,
        cylinder_name: item.cylinder_name,
        full_cylinders: item.with_customer_qty || 0,
        empty_cylinders: item.pending_returns || 0,
        missing_qty: item.missing_qty || 0,
        last_updated: item.last_updated || new Date().toISOString()
      }));
      
      console.log('Transformed data:', transformedData);
      setCustomers(transformedData);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      debug?.log && debug.log(`❌ Error loading customer inventory: ${apiError.message}`);
      setMessage({ type: 'error', text: apiError.message || 'Failed to load customer inventory' });
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (data: OverrideBalanceRequest) => {
    try {
      // Set status based on role
      const status = role === 'distributor_admin' ? 'approved' : 'pending';
      const payload: OverrideBalanceRequestWithStatus = { ...data, status };
      debug?.log && debug.log(`🛠️ Override request submitted: ${JSON.stringify(payload)}`);
      await api.inventory.adminOverrideBalance(payload);
      debug?.log && debug.log('✅ Override approved by distributor');
      setMessage({ type: 'success', text: 'Balance overridden successfully' });
      loadCustomerInventory(); // Reload data
    } catch (error: unknown) {
      const apiError = error as ApiError;
      debug?.log && debug.log(`❌ Error overriding balance: ${apiError.message}`);
      setMessage({ type: 'error', text: apiError.message || 'Failed to override balance' });
    }
  };

  const openHistory = async (customer: CustomerInventoryData) => {
    setHistoryModal({ open: true, customer });
    setHistoryLoading(true);
    try {
      // TODO: Implement getHistory API method
      // const res = await api.inventory.getHistory(customer.customer_id, customer.cylinder_type_id);
      // setHistory(res.data.data);
      setHistory([]);
    } catch (e) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExpandCustomer = async (customer: any) => {
    if (expandedCustomerId === customer.customer_id) {
      setExpandedCustomerId(null);
      return;
    }
    setExpandedCustomerId(customer.customer_id);
    setDetailsLoading(customer.customer_id);
    // Fetch per-cylinder delivery details for each cylinder type
    const details: Record<string, DeliveryHistoryEntry[]> = {};
    for (const cyl of customer.cylinders) {
      try {
        const res = await fetch(`/inventory/customer-delivery-history/${customer.customer_id}/${cyl.cylinder_type_id}`);
        const data = await res.json();
        details[cyl.cylinder_name] = data.data || [];
      } catch {
        details[cyl.cylinder_name] = [];
      }
    }
    setCylinderDetails(details);
    setDetailsLoading(null);
  };

  console.log("customers before filter:", customers);
  // Group and summarize customers by customer_id
  const groupedCustomers = customers.reduce((acc, curr) => {
    if (!acc[curr.customer_id]) {
      acc[curr.customer_id] = {
        customer_id: curr.customer_id,
        customer_name: curr.customer_name,
        total_with_customer: 0,
        total_pending: 0,
        total_missing: 0,
        cylinders: []
      };
    }
    acc[curr.customer_id].total_with_customer += curr.full_cylinders || 0;
    acc[curr.customer_id].total_pending += curr.empty_cylinders || 0;
    acc[curr.customer_id].total_missing += curr.missing_qty || 0;
    acc[curr.customer_id].cylinders.push(curr);
    return acc;
  }, {} as Record<string, any>);
  const customerSummaryRows = Object.values(groupedCustomers);
  console.log("filteredCustomers before map:", customerSummaryRows);

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Customer Inventory</h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage customer inventory balances</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>



      <div className="overflow-x-auto">
        <table className="w-full rounded-lg overflow-hidden shadow bg-white dark:bg-gray-800">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900">
              <th className="text-left py-2 px-4 font-medium text-blue-900 dark:text-blue-100">Customer</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900 dark:text-blue-100">With Customer (Total)</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900 dark:text-blue-100">Pending Returns (Total)</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900 dark:text-blue-100">Missing (Total)</th>
              <th className="text-center py-2 px-4 font-medium text-blue-900 dark:text-blue-100">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customerSummaryRows.filter(customer =>
              customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((customer, idx) => [
              <tr key={customer.customer_id} className={`border-b border-gray-100 dark:border-gray-700 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/50 ${idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}>
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white cursor-pointer" onClick={() => handleExpandCustomer(customer)}>
                  {customer.customer_name}
                </td>
                <td className="py-3 px-4 text-center font-semibold text-gray-900 dark:text-white">{customer.total_with_customer}</td>
                <td className="py-3 px-4 text-center font-semibold text-gray-900 dark:text-white">{customer.total_pending}</td>
                <td className="py-3 px-4 text-center font-semibold text-gray-900 dark:text-white">{customer.total_missing}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => alert('Download PDF placeholder')}
                    className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium transition-colors bg-blue-50 dark:bg-blue-900/50 px-3 py-1 rounded"
                  >
                    History Download
                  </button>
                </td>
              </tr>,
              expandedCustomerId === customer.customer_id && (
                <tr key={customer.customer_id + '-details'}>
                  <td colSpan={5} className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-300 dark:border-blue-600 p-0">
                    <div className="p-4">
                      {detailsLoading === customer.customer_id ? (
                        <div className="text-gray-600 dark:text-gray-400">Loading details...</div>
                      ) : (
                        Object.entries(cylinderDetails).length === 0 ? (
                          <div className="text-gray-600 dark:text-gray-400">No cylinder details found.</div>
                        ) : (
                          <table className="w-full text-sm mb-2">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                              <tr>
                                <th className="py-2 px-2 text-left text-gray-900 dark:text-white">Cylinder Type</th>
                                <th className="py-2 px-2 text-left text-gray-900 dark:text-white">Date</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Fulls Delivered</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Empties Collected</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Net</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Status</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Grace Expires</th>
                                <th className="py-2 px-2 text-center text-gray-900 dark:text-white">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(cylinderDetails).flatMap(([cylinderName, deliveries], i) => (
                                deliveries.length === 0 ? [
                                  <tr key={cylinderName + '-empty'} className={`${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-600'}`}>
                                    <td className="py-1 px-2 font-semibold text-gray-900 dark:text-white">{cylinderName}</td>
                                    <td colSpan={7} className="text-center text-gray-600 dark:text-gray-400">No deliveries found.</td>
                                  </tr>
                                ] : deliveries.map((d, j) => (
                                  <tr key={d.order_id + j} className={`${j % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-600'}`}>
                                    <td className="py-1 px-2 font-semibold text-gray-900 dark:text-white">{cylinderName}</td>
                                    <td className="py-1 px-2 text-gray-900 dark:text-white">{d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : '-'}</td>
                                    <td className="py-1 px-2 text-center text-gray-900 dark:text-white">{d.delivered_qty}</td>
                                    <td className="py-1 px-2 text-center text-gray-900 dark:text-white">{d.empties_returned}</td>
                                    <td className="py-1 px-2 text-center text-gray-900 dark:text-white">{d.net_change}</td>
                                    <td className={`py-1 px-2 text-center font-semibold ${d.status === 'missing' ? 'text-red-600 dark:text-red-400' : d.status === 'pending' ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>{d.status}</td>
                                    <td className="py-1 px-2 text-center text-gray-900 dark:text-white">{d.grace_expiry ? new Date(d.grace_expiry).toLocaleDateString() : '-'}</td>
                                    <td className="py-1 px-2 text-center">
                                      <button
                                        onClick={() => { setShowOverrideModal(true); setSelectedCustomer({ ...customer.cylinders.find((c: any) => c.cylinder_name === cylinderName), customer_id: customer.customer_id }); }}
                                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-800 dark:hover:text-blue-200 text-xs font-medium transition-colors bg-blue-50 dark:bg-blue-900/50 px-2 py-1 rounded"
                                      >
                                        Override
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ))}
                            </tbody>
                          </table>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            ])}
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
            <p className="mb-2 text-gray-600">{historyModal.customer.customer_id}</p>
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

      <DrilldownModal
        isOpen={drilldownModal.open}
        onClose={() => setDrilldownModal({ open: false, customer: null })}
        customer={drilldownModal.customer}
      />
    </div>
  );
};

export default CustomerInventoryPage; 