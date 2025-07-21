import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/apiClient';
import EmptyState from '../components/EmptyState';
import type { ApiError, PendingActionsResponse, PendingAction } from '../types';

interface ActionModalData {
  action: PendingAction;
  actionType: 'approve' | 'reject';
  comment: string;
}

type ViewMode = 'distributor' | 'inventory' | 'finance';

export const PendingActionsPage: React.FC = () => {
  const { distributor_id, role, isSuperAdmin } = useAuth();
  const [pendingActions, setPendingActions] = useState<PendingActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<ActionModalData | null>(null);
  const [bulkActionModal, setBulkActionModal] = useState<{ actionType: 'approve' | 'reject'; comment: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('distributor');

  useEffect(() => {
    if (!distributor_id) return;
    fetchPendingActions();
  }, [distributor_id, role, viewMode]);

  const fetchPendingActions = async () => {
    if (!distributor_id) return;
    try {
      setLoading(true);
      setError(null);
      
      // Get role-specific pending actions
      const response = await api.dashboard.getPendingActions(distributor_id, viewMode);
      setPendingActions(response.data.data);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching pending actions:', apiError);
      setError(apiError.message || 'Failed to fetch pending actions');
    } finally {
      setLoading(false);
    }
  };

  // Early return check after all hooks are declared
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  if (loading) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-gray-500">Loading pending actions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  if (!pendingActions) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">Something went wrong loading pending actions</div>
        </div>
      </div>
    );
  }

  // Get actions based on view mode and role
  const getActionsForView = (): PendingAction[] => {
    if (!pendingActions) return [];

    const allActions: PendingAction[] = [];
    
    // Flatten all actions from role-specific data
    Object.entries(pendingActions).forEach(([key, actions]) => {
      if (key !== 'summary' && Array.isArray(actions)) {
        allActions.push(...actions);
      }
    });

    return allActions;
  };

  const allActions = getActionsForView();

  // Don't return early - show the full page structure even when empty

  // Filter actions by type
  const filteredActions = allActions.filter(action => {
    if (filterType === 'all') return true;
    return action.action_type === filterType;
  });

  // Sort actions
  const sortedActions = [...filteredActions].sort((a, b) => {
    if (sortBy === 'created_at') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'credit_note': return '🧾';
      case 'invoice_dispute': return '⚠️';
      case 'customer_modification': return '👤';
      case 'missing_cylinder_log': return '🔍';
      case 'unreconciled_order': return '📋';
      case 'stock_replenishment': return '📦';
      case 'unallocated_payment': return '💰';
      case 'gst_sync_failure': return '📄';
      default: return '📝';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleSelectAction = (actionId: string) => {
    const newSelected = new Set(selectedActions);
    if (newSelected.has(actionId)) {
      newSelected.delete(actionId);
    } else {
      newSelected.add(actionId);
    }
    setSelectedActions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedActions.size === sortedActions.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(sortedActions.map(action => action.action_id)));
    }
  };

  const handleAction = (action: PendingAction, actionType: 'approve' | 'reject') => {
    setActionModal({ action, actionType, comment: '' });
  };

  const handleBulkAction = (actionType: 'approve' | 'reject') => {
    setBulkActionModal({ actionType, comment: '' });
  };

  const submitAction = async (action: PendingAction, actionType: 'approve' | 'reject', comment: string) => {
    try {
      // TODO: Implement API call for action submission
      console.log(`${actionType} action for:`, action, 'with comment:', comment);
      alert(`${actionType} action submitted for ${action.title}`);
      
      // Refresh the data
      await fetchPendingActions();
      setActionModal(null);
    } catch (error) {
      console.error('Error submitting action:', error);
      alert('Failed to submit action');
    }
  };

  const submitBulkAction = async (actionType: 'approve' | 'reject', comment: string) => {
    try {
      const selectedActionIds = Array.from(selectedActions);
      // TODO: Implement API call for bulk action submission
      console.log(`Bulk ${actionType} for actions:`, selectedActionIds, 'with comment:', comment);
      alert(`Bulk ${actionType} submitted for ${selectedActionIds.length} actions`);
      
      // Refresh the data
      await fetchPendingActions();
      setSelectedActions(new Set());
      setBulkActionModal(null);
    } catch (error) {
      console.error('Error submitting bulk action:', error);
      alert('Failed to submit bulk action');
    }
  };

  const isOverdue = (dueDate: string | undefined) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const truncateText = (text: string | undefined, maxLength: number = 50) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getViewModeTitle = (mode: ViewMode) => {
    switch (mode) {
      case 'distributor': return 'Distributor';
      case 'inventory': return 'Inventory';
      case 'finance': return 'Finance';
      default: return 'All';
    }
  };

  const getViewModeDescription = (mode: ViewMode) => {
    switch (mode) {
      case 'distributor': return 'Sensitive workflows requiring distributor approval';
      case 'inventory': return 'Inventory team responsibilities';
      case 'finance': return 'Finance team responsibilities';
      default: return 'All pending actions';
    }
  };

  return (
    <div className="p-6 max-w-none mx-auto">
      {/* Header */}
      <div className="mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center sm:text-left">Pending Actions</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center sm:text-left">Review and manage pending tasks</p>
        </div>
        <div className="flex flex-row flex-wrap gap-4 justify-center sm:justify-end items-center w-full sm:w-auto">
          {selectedActions.size > 1 && (
            <>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
                onClick={() => handleBulkAction('approve')}
              >
                Bulk Approve ({selectedActions.size})
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
                onClick={() => handleBulkAction('reject')}
              >
                Bulk Reject ({selectedActions.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button
            onClick={() => setViewMode('distributor')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'distributor'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Distributor
          </button>
          <button
            onClick={() => setViewMode('inventory')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'inventory'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setViewMode('finance')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'finance'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Finance
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center sm:text-left">
          {getViewModeDescription(viewMode)}
        </p>
      </div>

      {/* Filters */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All {getViewModeTitle(viewMode)} Actions ({allActions.length})</option>
              {viewMode === 'distributor' && (
                <>
                  <option value="invoice_dispute">Invoice Disputes</option>
                  <option value="credit_note">Credit Notes</option>
                  <option value="customer_modification">Customer Modifications</option>
                </>
              )}
              {viewMode === 'inventory' && (
                <>
                  <option value="unreconciled_order">Unreconciled Orders</option>
                  <option value="stock_replenishment">Stock Replenishment</option>
                  <option value="missing_cylinder_log">Missing Cylinder Logs</option>
                </>
              )}
              {viewMode === 'finance' && (
                <>
                  <option value="unallocated_payment">Unallocated Payments</option>
                  <option value="gst_sync_failure">GST Sync Failures</option>
                </>
              )}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="created_at">Sort by Date</option>
              <option value="priority">Sort by Priority</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {allActions.length === 0 
              ? `No ${viewMode} actions available` 
              : `Showing ${filteredActions.length} of ${allActions.length} ${viewMode} actions`
            }
          </div>
        </div>
      </div>

      {/* Actions Table */}
      <div className="card overflow-hidden">
        {allActions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
              No {viewMode} pending actions found
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              All {viewMode} tasks are up to date!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedActions.size === sortedActions.length && sortedActions.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedActions.map((action) => (
                  <tr key={action.action_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedActions.has(action.action_id)}
                        onChange={() => handleSelectAction(action.action_id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-lg mr-2">{getActionIcon(action.action_type)}</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400 max-w-xs">
                      <div className="truncate" title={action.description}>
                        {truncateText(action.description, 60)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                      {formatDate(action.created_at)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-gray-500 dark:text-gray-400 ${isOverdue(action.due_date) ? 'text-red-600 font-semibold' : ''}`}>
                        {formatDate(action.due_date)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400 max-w-32">
                      <div className="truncate" title={action.reference_number}>
                        {truncateText(action.reference_number, 20)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center font-medium">
                      <div className="flex flex-row flex-nowrap gap-2 items-center justify-center min-w-[200px]">
                        <button
                          className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => handleAction(action, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => handleAction(action, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setActionModal(null)}
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {actionModal.actionType === 'approve' ? 'Approve' : 'Reject'} Action
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong>Action:</strong> {actionModal.action.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong>Description:</strong> {actionModal.action.description}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comment (Optional)
              </label>
              <textarea
                value={actionModal.comment}
                onChange={(e) => setActionModal({ ...actionModal, comment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Add a comment..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                onClick={() => setActionModal(null)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 text-white font-medium rounded ${
                  actionModal.actionType === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={() => submitAction(actionModal.action, actionModal.actionType, actionModal.comment)}
              >
                {actionModal.actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      {bulkActionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setBulkActionModal(null)}
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Bulk {bulkActionModal.actionType === 'approve' ? 'Approve' : 'Reject'} Actions
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You are about to {bulkActionModal.actionType} <strong>{selectedActions.size} actions</strong>.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comment (Optional)
              </label>
              <textarea
                value={bulkActionModal.comment}
                onChange={(e) => setBulkActionModal({ ...bulkActionModal, comment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Add a comment for all actions..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                onClick={() => setBulkActionModal(null)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 text-white font-medium rounded ${
                  bulkActionModal.actionType === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={() => submitBulkAction(bulkActionModal.actionType, bulkActionModal.comment)}
              >
                Bulk {bulkActionModal.actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 