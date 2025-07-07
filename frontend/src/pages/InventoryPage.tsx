import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export const InventoryPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<{ [cylinder_type_id: string]: any }>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ [cylinder_type_id: string]: boolean }>({});
  const [isLocked, setIsLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // TODO: Get from auth context

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    fetchInventory();
  }, [date, distributor_id, isSuperAdmin]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      // Always fetch by date
      const response = await api.inventory.getSummaryByDate(date);
      setSummary(response.data);
      setEditRows({});
      setIsLocked(response.data.some((row: any) => row.status === 'locked'));
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setError('Error fetching inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleLockSummary = async () => {
    setLockLoading(true);
    setError(null);
    try {
      await api.inventory.lockSummary(date);
      setIsLocked(true);
      setSuccess('Summary locked successfully');
    } catch (err: any) {
      setError('Failed to lock summary');
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlockSummary = async () => {
    setLockLoading(true);
    setError(null);
    try {
      await api.inventory.unlockSummary(date);
      setIsLocked(false);
      setSuccess('Summary unlocked successfully');
    } catch (err: any) {
      setError('Failed to unlock summary');
    } finally {
      setLockLoading(false);
    }
  };

  const handleEditChange = (cylinder_type_id: string, field: string, value: any) => {
    if (isLocked && !isAdmin) return; // Prevent editing if locked and not admin
    setEditRows((prev) => ({
      ...prev,
      [cylinder_type_id]: {
        ...prev[cylinder_type_id],
        [field]: value,
      },
    }));
  };

  const handleLostChange = (cylinder_type_id: string, value: number) => {
    if (isLocked && !isAdmin) return; // Prevent editing if locked and not admin
    setEditRows((prev) => ({
      ...prev,
      [cylinder_type_id]: {
        ...prev[cylinder_type_id],
        lost: value,
      },
    }));
    setPendingLost((prev) => ({ ...prev, [cylinder_type_id]: true }));
  };

  const handleSubmit = async () => {
    if (isLocked && !isAdmin) {
      setError('Cannot submit changes when summary is locked');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updates = Object.entries(editRows).map(([cylinder_type_id, fields]) => ({
        cylinder_type_id,
        ...fields,
      }));
      await api.inventory.upsertSummaryByDate(date, updates);
      setSuccess('Submitted for approval!');
      fetchInventory();
    } catch (err: any) {
      setError('Failed to submit updates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLost = async (cylinder_type_id: string) => {
    if (isLocked && !isAdmin) {
      setError('Cannot submit changes when summary is locked');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const lost = editRows[cylinder_type_id]?.lost;
      await api.inventory.upsertSummaryByDate(date, [{ cylinder_type_id, lost }]);
      setSuccess('Submitted for approval!');
      setPendingLost((prev) => ({ ...prev, [cylinder_type_id]: false }));
      fetchInventory();
    } catch (err: any) {
      setError('Failed to submit lost value');
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine lost approval status for a row
  const getLostStatus = (row: any) => {
    if (row.lost_pending) return 'pending';
    if (row.lost_approved) return 'approved';
    return '';
  };

  // Helper to calculate closing fields
  const calcClosingFulls = (row: any) => row.opening_fulls + row.replenished_qty_from_corp - row.delivered_qty - (editRows[row.cylinder_type_id]?.lost ?? row.lost ?? 0);
  const calcClosingEmpties = (row: any) => row.opening_empties + row.collected_empties_qty + row.empties_sent_to_corp;
  const calcUnaccountedFor = (row: any) => row.opening_fulls + row.replenished_qty_from_corp - row.delivered_qty - calcClosingFulls(row);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Summary</h1>
          <p className="text-gray-600 dark:text-gray-400">Track and manage daily inventory by cylinder type</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-field"
          />
          <div className="flex items-center gap-2">
            {isLocked ? (
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-sm font-medium">🔒 Locked</span>
                {isAdmin && (
                  <button
                    onClick={handleUnlockSummary}
                    disabled={lockLoading}
                    className="btn-secondary text-sm px-3 py-1"
                  >
                    {lockLoading ? 'Unlocking...' : 'Unlock'}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleLockSummary}
                disabled={lockLoading}
                className="btn-primary text-sm px-3 py-1"
              >
                {lockLoading ? 'Locking...' : 'Lock'}
              </button>
            )}
          </div>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {isLocked && !isAdmin && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded-lg">
          This summary is locked. Only admins can make changes.
        </div>
      )}

      <div className="card p-6 overflow-x-auto bg-white rounded-lg shadow-md">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : (
          <table className="min-w-full text-sm border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-purple-100">
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Cylinder Type</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Opening Fulls</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Opening Empties</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Replenished Qty from Corp</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Empties Sent to Corp</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Soft Blocked</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Delivered Qty</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Collected Empties</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Pending Returns</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Missing</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Lost</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Closing Fulls</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Closing Empties</th>
                <th className="px-2 py-2 border text-center text-purple-900 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, idx) => (
                <tr key={row.cylinder_type_id} className={idx % 2 === 0 ? 'bg-teal-50 hover:bg-teal-100' : 'bg-white hover:bg-teal-50'}>
                  <td className="px-2 py-2 border text-center font-semibold text-purple-800">{row.cylinder_name || row.cylinder_type_id}</td>
                  <td className="px-2 py-2 border text-center text-teal-700 font-semibold">{row.opening_fulls}</td>
                  <td className="px-2 py-2 border text-center text-teal-700 font-semibold">{row.opening_empties}</td>
                  <td className="px-2 py-2 border text-center text-teal-700 font-semibold">{row.replenished_qty_from_corp}</td>
                  <td className="px-2 py-2 border text-center text-teal-700 font-semibold">{row.empties_sent_to_corp}</td>
                  <td className="px-2 py-2 border text-center text-purple-700 font-semibold">{row.soft_blocked_qty}</td>
                  <td className="px-2 py-2 border text-center text-teal-800 font-semibold">{row.delivered_qty}</td>
                  <td className="px-2 py-2 border text-center text-teal-800 font-semibold">{row.collected_empties_qty}</td>
                  <td className={`px-2 py-2 border text-center font-semibold ${row.pending_returns > 0 ? 'text-orange-600' : 'text-gray-700'}`}>{row.pending_returns}</td>
                  <td className={`px-2 py-2 border text-center font-semibold ${row.missing_qty > 0 ? 'text-red-600' : 'text-gray-700'}`}>{row.missing_qty}</td>
                  <td className="px-2 py-2 border text-center">
                    <input
                      type="number"
                      className={`input-field w-20 text-center ${isLocked && !isAdmin ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      value={editRows[row.cylinder_type_id]?.lost ?? row.lost ?? 0}
                      onChange={e => handleLostChange(row.cylinder_type_id, Number(e.target.value))}
                      disabled={isLocked && !isAdmin}
                    />
                  </td>
                  <td className="px-2 py-2 border text-center text-teal-900 font-bold">{row.closing_fulls}</td>
                  <td className="px-2 py-2 border text-center text-teal-900 font-bold">{calcClosingEmpties(row)}</td>
                  <td className="px-2 py-2 border text-center">
                    {editRows[row.cylinder_type_id]?.lost !== undefined && !row.lost_pending && !isLocked ? (
                      <button className="bg-purple-500 text-white text-xs px-2 py-1 rounded hover:bg-purple-600 transition-colors" onClick={() => handleSubmitLost(row.cylinder_type_id)} disabled={loading}>Submit for Approval</button>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getLostStatus(row) === 'pending' ? 'bg-orange-100 text-orange-700' : getLostStatus(row) === 'approved' ? 'bg-teal-100 text-teal-700' : ''}`}>{getLostStatus(row)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex gap-4 mt-6">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={Object.keys(editRows).length === 0 || loading || (isLocked && !isAdmin)}
          >
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}; 