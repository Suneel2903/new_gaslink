import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import type { InventorySummary, VehicleCancelledStock } from '../types';
import EmptyState from '../components/EmptyState';
import Mermaid from 'react-mermaid2';
import { FiMaximize2, FiX } from 'react-icons/fi';

interface UnaccountedModalState {
  open: boolean;
  cylinderType: string;
  count: number;
  reason: string;
  responsibleParty: string;
  responsibleRole: string;
  entries: Array<{ id: string; count: number; reason: string; responsible_party: string; responsible_role: string; created_at: string }>;
}

export const InventoryPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<InventorySummary[]>([]);
  const [cancelledStock, setCancelledStock] = useState<VehicleCancelledStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unaccountedModal, setUnaccountedModal] = useState<UnaccountedModalState>({ open: false, cylinderType: '', count: 0, reason: '', responsibleParty: '', responsibleRole: '', entries: [] });
  const [cancelledStockModal, setCancelledStockModal] = useState<{ open: boolean; cylinderType: string; stock: VehicleCancelledStock[] }>({ open: false, cylinderType: '', stock: [] });
  const [showDiagramModal, setShowDiagramModal] = useState(false);

  // Update changeDateBy to allow any date (no clamping)
  const changeDateBy = (days: number) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    });
  };

  // Helper to get cancelled stock count for a cylinder type
  const getCancelledStockCount = (cylinderType: string) => {
    return cancelledStock
      .filter(stock => stock.cylinder_type === cylinderType)
      .reduce((sum, stock) => sum + stock.cancelled_quantity, 0);
  };

  // Helper to get cancelled stock details for a cylinder type
  const getCancelledStockDetails = (cylinderType: string) => {
    return cancelledStock.filter(stock => stock.cylinder_type === cylinderType);
  };

  // Open cancelled stock modal
  const openCancelledStockModal = (cylinderType: string) => {
    const stockDetails = getCancelledStockDetails(cylinderType);
    setCancelledStockModal({ open: true, cylinderType, stock: stockDetails });
  };

  // Close cancelled stock modal
  const closeCancelledStockModal = () => {
    setCancelledStockModal({ open: false, cylinderType: '', stock: [] });
  };

  // Move cancelled stock to inventory
  const moveCancelledStockToInventory = async (vehicleId: string, cylinderTypeId: string, quantity: number) => {
    try {
      await api.vehicle.moveCancelledStockToInventory({
        vehicle_id: vehicleId,
        cylinder_type_id: cylinderTypeId,
        quantity: quantity
      });
      
      // Refresh the data
      await fetchInventory();
      
      // Close modal and show success
      closeCancelledStockModal();
      setSuccess(`Successfully moved ${quantity} cylinders to depot inventory`);
    } catch (err: any) {
      console.error('Error moving stock to inventory:', err);
      setError(`Failed to move stock: ${err.response?.data?.error || err.message}`);
    }
  };

  // Add a helper to check if selected date is in the future
  const isFutureDate = (selectedStr: string, todayStr: string) => selectedStr > todayStr;

  // Patch: Remove blocking message for today, always show table for today (even if empty)
  const fetchInventory = async () => {
    const selectedStr = date; // already in YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const debug = (globalThis as any).__debuglog || console.log;
    debug(`INVENTORY DEBUG: Selected date string: ${selectedStr}, Today string: ${todayStr}`);
    debug(`INVENTORY DEBUG: Comparison result: selectedStr > todayStr = ${selectedStr > todayStr}`);
    if (isFutureDate(selectedStr, todayStr)) {
      setSummary([]);
      setCancelledStock([]);
      setError(null); // No error
      setSuccess(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      debug('INVENTORY DEBUG: Making API call for inventory summary and cancelled stock.');
      const [inventoryResponse, cancelledStockResponse] = await Promise.all([
        api.inventory.getSummaryByDate(date, distributor_id || undefined),
        api.vehicle.getCancelledStockInVehicles(distributor_id || '')
      ]);
      setSummary(inventoryResponse.data.data || []);
      setCancelledStock(cancelledStockResponse.data.data || []);
    } catch (error) {
      debug('INVENTORY DEBUG: Error fetching inventory:', error);
      setError('Error fetching inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [date, distributor_id, isSuperAdmin]);

  // Modal handlers
  const openUnaccountedModal = async (cylinderType: string) => {
    setLoading(true);
    try {
      const res = await api.inventory.getUnaccountedLog(date, distributor_id || '', cylinderType);
      setUnaccountedModal({
        open: true,
        cylinderType,
        count: 0,
        reason: '',
        responsibleParty: '',
        responsibleRole: '',
        entries: res.data.data || []
      });
    } catch {
      setUnaccountedModal({ open: true, cylinderType, count: 0, reason: '', responsibleParty: '', responsibleRole: '', entries: [] });
    } finally {
      setLoading(false);
    }
  };
  const closeUnaccountedModal = () => setUnaccountedModal({ open: false, cylinderType: '', count: 0, reason: '', responsibleParty: '', responsibleRole: '', entries: [] });

  const handleUnaccountedSubmit = async () => {
    try {
      setLoading(true);
      await api.inventory.logUnaccounted({
        date,
        distributor_id: distributor_id || '',
        cylinder_type_id: unaccountedModal.cylinderType,
        count: unaccountedModal.count,
        reason: unaccountedModal.reason,
        responsible_party: unaccountedModal.responsibleParty,
        responsible_role: unaccountedModal.responsibleRole,
      });
      setSuccess('Inventory unaccounted logged successfully');
      // Refetch entries for modal
      const res = await api.inventory.getUnaccountedLog(date, distributor_id || '', unaccountedModal.cylinderType);
      setUnaccountedModal((prev) => ({ ...prev, count: 0, reason: '', responsibleParty: '', responsibleRole: '', entries: res.data.data || [] }));
      fetchInventory();
    } catch (err) {
      setError('Failed to log inventory unaccounted');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }
  if (error) {
    return <div className="p-6 max-w-7xl mx-auto"><div className="card"><div className="p-8 text-center text-red-500">Something went wrong loading inventory: {error}</div></div></div>;
  }
  const selectedStr = date;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div className="py-6 w-full max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory Summary</h1>
          <p className="text-gray-600 dark:text-gray-400">Track and manage daily inventory by cylinder type</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"
            onClick={() => changeDateBy(-1)}
            aria-label="Previous day"
          >
            &#8592;
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"
            onClick={() => changeDateBy(1)}
            aria-label="Next day"
          >
            &#8594;
          </button>
        </div>
      </div>
      {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      

      
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1200px]">
          {isFutureDate(selectedStr, todayStr) ? (
            <div className="p-6 max-w-7xl mx-auto">
              <div className="card">
                <div className="p-8 text-center text-gray-500">
                  Inventory data for future dates is not available yet.
                </div>
              </div>
            </div>
          ) : summary.length === 0 ? (
            <div className="p-6 max-w-7xl mx-auto"><div className="card"><EmptyState message="No inventory data found for this date." /></div></div>
          ) : (
            <table className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-2 py-3 font-bold">Cylinder Type</th>
                  <th className="px-2 py-3 font-bold">Opening Fulls</th>
                  <th className="px-2 py-3 font-bold">Opening Empties</th>
                  <th className="px-2 py-3 font-bold">AC4 Qty</th>
                  <th className="px-2 py-3 font-bold">ERV Qty</th>
                  <th className="px-2 py-3 font-bold">Soft Blocked</th>
                  <th className="px-2 py-3 font-bold">Cancelled Stock</th>
                  <th className="px-2 py-3 font-bold">Delivered Fulls Qty</th>
                  <th className="px-2 py-3 font-bold">Collected Empties Qty</th>
                  <th className="px-2 py-3 font-bold">Customer Unaccounted</th>
                  <th className="px-2 py-3 font-bold">Inventory Unaccounted</th>
                  <th className="px-2 py-3 font-bold">Closing Fulls</th>
                  <th className="px-2 py-3 font-bold">Closing Empties</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, idx) => (
                  <tr
                    key={row.cylinder_type}
                    className={
                      (idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-gray-700') +
                      ' hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors duration-150'
                    }
                    style={{ fontSize: '0.98rem' }}
                  >
                    <td className="px-2 py-3 font-semibold whitespace-nowrap">{row.cylinder_type}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.opening_fulls}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.opening_empties}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.ac4_qty}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.erv_qty}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.soft_blocked_qty}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      {(() => {
                        const cancelledCount = getCancelledStockCount(row.cylinder_type);
                        return cancelledCount > 0 ? (
                          <button 
                            className="text-red-700 font-bold underline hover:text-red-900"
                            onClick={() => openCancelledStockModal(row.cylinder_type)}
                          >
                            {cancelledCount}
                          </button>
                        ) : (
                          cancelledCount
                        );
                      })()}
                    </td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.delivered_qty}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.collected_empties_qty}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      {row.customer_unaccounted > 0 ? (
                        <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-800 font-bold">{row.customer_unaccounted}</span>
                      ) : (
                        row.customer_unaccounted
                      )}
                    </td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      <button className="text-blue-700 font-bold underline" onClick={() => openUnaccountedModal(row.cylinder_type)}>
                        {row.inventory_unaccounted > 0 ? (
                          <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 font-bold">{row.inventory_unaccounted}</span>
                        ) : (
                          row.inventory_unaccounted
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      {row.closing_fulls < 0 ? (
                        <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 font-bold">{row.closing_fulls}</span>
                      ) : (
                        row.closing_fulls
                      )}
                    </td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">{row.closing_empties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Inventory Flow Card: Two Halves, Explanation Left, Diagram Right */}
      <div className="flex justify-center mt-6 mb-2">
        <div className="w-full max-w-6xl bg-white rounded-xl shadow-lg border border-gray-200 flex flex-row items-stretch overflow-hidden" style={{ minHeight: 340 }}>
          {/* Left: Daily Flow Written Explanation */}
          <div className="flex-1 flex flex-col justify-center items-start p-6 bg-gray-50 dark:bg-gray-900" style={{ minWidth: 260 }}>
            <div className="text-lg font-bold mb-3 text-gray-900">Inventory Daily Flow</div>
            <ul className="list-none pl-0 text-base text-gray-800 dark:text-gray-100 space-y-2">
              <li><span style={{color:'#16a34a', fontWeight:'bold', fontSize:'1.2em'}}>➕</span> <b>AC4 Qty</b>: Received from corporation (added to stock).</li>
              <li><span style={{color:'#16a34a', fontWeight:'bold', fontSize:'1.2em'}}>➕</span> <b>Collected Empties Qty</b>: Empties collected from customers (added to stock).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>ERV Qty</b>: Sent back to corporation (removed from stock).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>Delivered Fulls Qty</b>: Delivered to customers (removed from stock).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>Soft Blocked</b>: Reserved for pending/processing orders (temporarily unavailable).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>Cancelled Stock</b>: In vehicles from cancelled deliveries (temporarily unavailable).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>Customer Unaccounted</b>: With customers, not yet returned (missing from depot).</li>
              <li><span style={{color:'#dc2626', fontWeight:'bold', fontSize:'1.2em'}}>➖</span> <b>Inventory Unaccounted</b>: Missing/unaccounted in depot (lost/damaged).</li>
              <li><b>Opening Fulls / Empties</b>: Start of day (from yesterday's closing).</li>
              <li><b>Closing Fulls / Empties</b>: End of day (becomes tomorrow's opening).</li>
            </ul>
          </div>
          {/* Right: Diagram Section */}
          <div className="flex-1 relative flex items-center justify-center p-4 bg-white" style={{ minWidth: 320, minHeight: 320 }}>
            <div className="w-full max-w-xl flex justify-center items-center" style={{ minHeight: 260 }}>
              <Mermaid chart={`
                flowchart TD
                  A["Yesterday's Closing\n(Fulls/Empties)" ] -->|"Carry Forward"| B["Today's Opening\n(Fulls/Empties)"]
                  B --> C["<span style='color:#16a34a;font-weight:bold'>+ AC4 Qty</span>\n(Received from Corp)"]
                  B --> D["<span style='color:#dc2626;font-weight:bold'>- ERV Qty</span>\n(Sent to Corp)"]
                  B --> E["<span style='color:#dc2626;font-weight:bold'>- Delivered Fulls</span>\n(To Customers)"]
                  B --> F["<span style='color:#16a34a;font-weight:bold'>+ Collected Empties</span>\n(From Customers)"]
                  B --> G["<span style='color:#dc2626;font-weight:bold'>- Soft Blocked</span>\n(Reserved for Orders)"]
                  B --> H["<span style='color:#dc2626;font-weight:bold'>- Cancelled Stock</span>\n(In Vehicles)"]
                  B --> I["<span style='color:#dc2626;font-weight:bold'>- Customer Unaccounted</span>\n(With Customers)"]
                  B --> J["<span style='color:#dc2626;font-weight:bold'>- Inventory Unaccounted</span>\n(Lost/Damaged)"]
                  C & D & E & F & G & H & I & J --> K["Today's Closing\n(Fulls/Empties)"]
                  K -->|"Carry Forward"| L["Tomorrow's Opening"]
                  %% Style additions and subtractions
                  classDef add fill:#bbf7d0,stroke:#16a34a,color:#166534;
                  classDef sub fill:#fee2e2,stroke:#dc2626,color:#991b1b;
                  class C,F add;
                  class D,E,G,H,I,J sub;
              `} />
            </div>
            {/* Expand Icon Overlay */}
            <button
              className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1 shadow border border-gray-300"
              style={{ zIndex: 2 }}
              onClick={() => setShowDiagramModal(true)}
              aria-label="Expand Diagram"
            >
              <FiMaximize2 size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* Modal for Enlarged Diagram */}
      {showDiagramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setShowDiagramModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full relative" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 rounded-full p-1 border border-gray-300"
              onClick={() => setShowDiagramModal(false)}
              aria-label="Close Diagram"
              style={{ zIndex: 2 }}
            >
              <FiX size={22} />
            </button>
            <div className="mb-2 text-center text-lg font-bold text-gray-900">Inventory Daily Flow</div>
            <div className="overflow-x-auto flex justify-center" style={{ fontSize: '1.15rem', color: '#111' }}>
              <Mermaid chart={`
                flowchart TD
                  A["Yesterday's Closing\n(Fulls/Empties)"] -->|"Carry Forward"| B["Today's Opening\n(Fulls/Empties)"]
                  B --> C["<span style='color:#16a34a;font-weight:bold'>+ AC4 Qty</span>\n(Received from Corp)"]
                  B --> D["<span style='color:#dc2626;font-weight:bold'>- ERV Qty</span>\n(Sent to Corp)"]
                  B --> E["<span style='color:#dc2626;font-weight:bold'>- Delivered Fulls</span>\n(To Customers)"]
                  B --> F["<span style='color:#16a34a;font-weight:bold'>+ Collected Empties</span>\n(From Customers)"]
                  B --> G["<span style='color:#dc2626;font-weight:bold'>- Soft Blocked</span>\n(Reserved for Orders)"]
                  B --> H["<span style='color:#dc2626;font-weight:bold'>- Cancelled Stock</span>\n(In Vehicles)"]
                  B --> I["<span style='color:#dc2626;font-weight:bold'>- Customer Unaccounted</span>\n(With Customers)"]
                  B --> J["<span style='color:#dc2626;font-weight:bold'>- Inventory Unaccounted</span>\n(Lost/Damaged)"]
                  C & D & E & F & G & H & I & J --> K["Today's Closing\n(Fulls/Empties)"]
                  K -->|"Carry Forward"| L["Tomorrow's Opening"]
                  %% Style additions and subtractions
                  classDef add fill:#bbf7d0,stroke:#16a34a,color:#166534;
                  classDef sub fill:#fee2e2,stroke:#dc2626,color:#991b1b;
                  class C,F add;
                  class D,E,G,H,I,J sub;
              `} />
            </div>
            <div className="text-xs text-center text-gray-600 mt-2">Click outside the diagram to close</div>
          </div>
        </div>
      )}
      {/* Modal for Inventory Unaccounted */}
      {unaccountedModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Inventory Unaccounted Entries</h2>
            <div className="mb-4">
              <div className="font-semibold mb-2">Existing Entries:</div>
              {unaccountedModal.entries.length === 0 ? (
                <div className="text-gray-500 text-sm mb-2">No entries yet.</div>
              ) : (
                <ul className="mb-2 max-h-40 overflow-y-auto">
                  {unaccountedModal.entries.map((entry) => (
                    <li key={entry.id} className="flex flex-col border-b py-2">
                      <div><span className="font-medium">Count:</span> {entry.count}</div>
                      <div><span className="font-medium">Reason:</span> {entry.reason}</div>
                      <div><span className="font-medium">Responsible:</span> {entry.responsible_party} ({entry.responsible_role})</div>
                      <div className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="font-semibold mt-2">Total: {unaccountedModal.entries.reduce((sum, e) => sum + e.count, 0)}</div>
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Count</label>
              <input type="number" className="input-field w-full" value={unaccountedModal.count} onChange={e => setUnaccountedModal({ ...unaccountedModal, count: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Reason</label>
              <input type="text" className="input-field w-full" value={unaccountedModal.reason} onChange={e => setUnaccountedModal({ ...unaccountedModal, reason: e.target.value })} />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Responsible Party</label>
              <input type="text" className="input-field w-full" value={unaccountedModal.responsibleParty} onChange={e => setUnaccountedModal({ ...unaccountedModal, responsibleParty: e.target.value })} />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Role</label>
              <select className="input-field w-full" value={unaccountedModal.responsibleRole} onChange={e => setUnaccountedModal({ ...unaccountedModal, responsibleRole: e.target.value })}>
                <option value="">Select</option>
                <option value="driver">Driver</option>
                <option value="inventory">Inventory</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={closeUnaccountedModal}>Close</button>
              <button className="btn-primary" onClick={handleUnaccountedSubmit}>Add Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Cancelled Stock */}
      {cancelledStockModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Cancelled Stock - {cancelledStockModal.cylinderType}</h2>
              <button 
                onClick={closeCancelledStockModal}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            {cancelledStockModal.stock.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No cancelled stock found for this cylinder type.</p>
              </div>
            ) : (
              <div>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Review:</strong> Check if all soft blocked cylinders are delivered. 
                    Any gaps should be clearly observed here before moving cancelled stock to depot inventory.
                  </p>
                </div>
                
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left">Vehicle</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Driver</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Quantity</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledStockModal.stock.map((stock, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">🚚</span>
                            {stock.vehicle_number}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {stock.driver_name || 'Not assigned'}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {stock.cancelled_quantity}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <button
                            onClick={() => moveCancelledStockToInventory(stock.vehicle_id, stock.cylinder_type_id, stock.cancelled_quantity)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            <span className="mr-1">📥</span>
                            Move to Depot
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="mt-4 text-sm text-gray-600">
                  <p>💡 <strong>Note:</strong> Moving cylinders to depot inventory will make them available for new orders.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 