import React, { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';

const InventoryApprovalsPage: React.FC = () => {
  const [pendingAdjustments, setPendingAdjustments] = useState<any[]>([]);
  const [pendingReplenishments, setPendingReplenishments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const admin_id = 'admin-uuid'; // Replace with real admin user id

  useEffect(() => {
    fetchApprovals();
    // eslint-disable-next-line
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const adjRes = await api.inventory.getPendingAdjustments('pending');
      setPendingAdjustments(adjRes.data.data);
      const repRes = await api.inventory.getReplenishments('pending');
      setPendingReplenishments(repRes.data.data);
    } catch (err: any) {
      setError('Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAdjustment = async (id: string) => {
    setLoading(true);
    setSuccess(null);
    try {
      await api.inventory.approveAdjustment([id], admin_id);
      setSuccess('Adjustment approved!');
      fetchApprovals();
    } catch {
      setError('Failed to approve adjustment');
    } finally {
      setLoading(false);
    }
  };

  const handleReplenishmentAction = async (id: string, status: string) => {
    setLoading(true);
    setSuccess(null);
    try {
      await api.inventory.updateReplenishment(id, { status, approved_by: admin_id });
      setSuccess('Replenishment updated!');
      fetchApprovals();
    } catch {
      setError('Failed to update replenishment');
    } finally {
      setLoading(false);
    }
  };

  console.log("pendingAdjustments before filter:", pendingAdjustments);
  const lostAdjustments = (pendingAdjustments ?? []).filter(adj => adj.field === 'lost');
  console.log("pendingAdjustments before map:", pendingAdjustments);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Inventory Approvals</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">{success}</div>}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Pending Inventory Adjustments</h2>
        <table className="min-w-full text-sm border rounded-lg overflow-hidden mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 border text-center">Date</th>
              <th className="px-2 py-2 border text-center">Cylinder Type</th>
              <th className="px-2 py-2 border text-center">Field</th>
              <th className="px-2 py-2 border text-center">Requested Value</th>
              <th className="px-2 py-2 border text-center">Previous Value</th>
              <th className="px-2 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingAdjustments.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-gray-500">No pending adjustments</td></tr>
            ) : pendingAdjustments.map((adj, idx) => (
              <tr key={adj.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-2 py-2 border text-center">{adj.date}</td>
                <td className="px-2 py-2 border text-center">{adj.cylinder_name || adj.cylinder_type_id}</td>
                <td className="px-2 py-2 border text-center">{adj.field}</td>
                <td className="px-2 py-2 border text-center">{adj.requested_value}</td>
                <td className="px-2 py-2 border text-center">{adj.previous_value}</td>
                <td className="px-2 py-2 border text-center">
                  <button className="btn-primary text-xs px-2 py-1 mr-2" onClick={() => handleApproveAdjustment(adj.id)} disabled={loading}>Approve</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Pending Lost Approvals</h2>
        <table className="min-w-full text-sm border rounded-lg overflow-hidden mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 border text-center">Date</th>
              <th className="px-2 py-2 border text-center">Cylinder Type</th>
              <th className="px-2 py-2 border text-center">Lost Value</th>
              <th className="px-2 py-2 border text-center">Previous Value</th>
              <th className="px-2 py-2 border text-center">Status</th>
              <th className="px-2 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lostAdjustments.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-gray-500">No pending lost approvals</td></tr>
            ) : lostAdjustments.map((adj, idx) => (
              <tr key={adj.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-2 py-2 border text-center">{adj.date}</td>
                <td className="px-2 py-2 border text-center">{adj.cylinder_name || adj.cylinder_type_id}</td>
                <td className="px-2 py-2 border text-center">{adj.requested_value}</td>
                <td className="px-2 py-2 border text-center">{adj.previous_value}</td>
                <td className="px-2 py-2 border text-center">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${adj.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {adj.status}
                  </span>
                </td>
                <td className="px-2 py-2 border text-center">
                  {adj.status === 'pending' && (
                    <button className="btn-primary text-xs px-2 py-1 mr-2" onClick={() => handleApproveAdjustment(adj.id)} disabled={loading}>Approve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Pending Replenishment Requests</h2>
        <table className="min-w-full text-sm border rounded-lg overflow-hidden mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 border text-center">Date</th>
              <th className="px-2 py-2 border text-center">Cylinder Type</th>
              <th className="px-2 py-2 border text-center">Quantity</th>
              <th className="px-2 py-2 border text-center">Status</th>
              <th className="px-2 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingReplenishments.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4 text-gray-500">No pending replenishments</td></tr>
            ) : pendingReplenishments.map((rep, idx) => (
              <tr key={rep.request_id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-2 py-2 border text-center">{rep.date}</td>
                <td className="px-2 py-2 border text-center">{rep.cylinder_name || rep.cylinder_type_id}</td>
                <td className="px-2 py-2 border text-center">{rep.quantity}</td>
                <td className="px-2 py-2 border text-center">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${rep.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {rep.status}
                  </span>
                </td>
                <td className="px-2 py-2 border text-center">
                  <button className="btn-primary text-xs px-2 py-1 mr-2" onClick={() => handleReplenishmentAction(rep.request_id, 'in-transit')} disabled={loading}>Approve</button>
                  <button className="btn-secondary text-xs px-2 py-1" onClick={() => handleReplenishmentAction(rep.request_id, 'rejected')} disabled={loading}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryApprovalsPage; 