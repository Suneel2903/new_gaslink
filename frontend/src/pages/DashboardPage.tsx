import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/apiClient';
import { PendingActionsModal } from '../components/PendingActionsModal';
import type { DashboardStats, ApiError, PendingActionsResponse, PendingAction } from '../types';

export const DashboardPage: React.FC = () => {
  const { role, distributor_id } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [inventoryModal, setInventoryModal] = useState(false);
  const [financeModal, setFinanceModal] = useState(false);
  const [inventoryActions, setInventoryActions] = useState<PendingAction[]>([]);
  const [financeActions, setFinanceActions] = useState<PendingAction[]>([]);

  useEffect(() => {
    if (!distributor_id) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch dashboard stats
        const statsResponse = await api.dashboard.getStats(distributor_id);
        setStats(statsResponse.data.data);
        
        // Fetch all pending actions data for consistent dashboard display
        if (role === 'distributor_admin' || role === 'super_admin') {
          const [distributorResponse, inventoryResponse, financeResponse] = await Promise.all([
            api.dashboard.getPendingActions(distributor_id, 'distributor'),
            api.dashboard.getPendingActions(distributor_id, 'inventory'),
            api.dashboard.getPendingActions(distributor_id, 'finance')
          ]);
          
          // Combine all data for dashboard display
          const combinedData = {
            ...distributorResponse.data.data,
            inventory_actions: inventoryResponse.data.data,
            finance_actions: financeResponse.data.data
          };
          
          setPendingActions(combinedData);
        }
      } catch (err) {
        const apiError = err as ApiError;
        console.error('Error fetching dashboard data:', apiError);
        setError(apiError.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [distributor_id, role]);

  const formatCurrency = (amount: number) => {
    return `₹${Number(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  };

  // Modal handlers
  const handleInventoryModal = () => {
    if (!pendingActions?.inventory_actions) return;
    
    const inventoryData = pendingActions.inventory_actions;
    const allActions = [
      ...(inventoryData.accountability_logs || []),
      ...(inventoryData.unreconciled_orders || []),
      ...(inventoryData.stock_replenishment_requests || []),
      ...(inventoryData.manual_inventory_adjustments || [])
    ];
    setInventoryActions(allActions);
    setInventoryModal(true);
  };

  const handleFinanceModal = () => {
    if (!pendingActions?.finance_actions) return;
    
    const financeData = pendingActions.finance_actions;
    const allActions = [
      ...(financeData.unallocated_payments || []),
      ...(financeData.gst_sync_failures || [])
    ];
    setFinanceActions(allActions);
    setFinanceModal(true);
  };

  // Early return check after all hooks are declared
  if (role !== 'super_admin' && !distributor_id) {
    return <div className="p-4 text-red-500">No distributor selected</div>;
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-500">No dashboard data available</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome to your dashboard</p>
      </div>

      {/* Stats Cards - 4 Horizontal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <span className="text-2xl">📋</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Orders Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.orders_today}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <span className="text-2xl">📦</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.values(stats.cylinders_in_stock).reduce((sum, qty) => sum + qty, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdue_invoices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <span className="text-2xl">📈</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue (This Week)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.revenue_this_week)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Actions Summary Cards - Between 4 cards and 4 boxes */}
      {(role === 'distributor_admin' || role === 'super_admin') && pendingActions && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Actions Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Your Actions Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Your Actions</h4>
                <button 
                  onClick={() => window.location.href = '/app/pending-actions'}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {(() => {
                  // Get distributor-specific actions only
                  const distributorActions = [
                    { key: 'invoice_disputes', count: pendingActions.invoice_disputes?.length || 0 },
                    { key: 'credit_notes', count: pendingActions.credit_notes?.length || 0 },
                    { key: 'customer_modification_requests', count: pendingActions.customer_modification_requests?.length || 0 }
                  ].filter(action => action.count > 0);

                  return distributorActions.slice(0, 3).map(({ key, count }) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {count}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Inventory Team Card */}
            <div 
              className="card p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={handleInventoryModal}
            >
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-2xl">📦</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Inventory Team</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click to view details</p>
                </div>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {(() => {
                    const inventoryData = pendingActions.inventory_actions || {};
                    const inventoryCount = (
                      (inventoryData.accountability_logs?.length || 0) +
                      (inventoryData.unreconciled_orders?.length || 0) +
                      (inventoryData.stock_replenishment_requests?.length || 0) +
                      (inventoryData.manual_inventory_adjustments?.length || 0)
                    );
                    return inventoryCount;
                  })()}
                </span>
                <p className="text-sm text-gray-500 mt-1">Pending items</p>
              </div>
            </div>

            {/* Finance Team Card */}
            <div 
              className="card p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={handleFinanceModal}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">₹</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Finance Team</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click to view details</p>
                </div>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {(() => {
                    const financeData = pendingActions.finance_actions || {};
                    const financeCount = (
                      (financeData.unallocated_payments?.length || 0) +
                      (financeData.gst_sync_failures?.length || 0)
                    );
                    return financeCount;
                  })()}
                </span>
                <p className="text-sm text-gray-500 mt-1">Pending items</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cylinder Health - 4 Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cylinder Stock Levels</h3>
          <div className="space-y-4">
            {Object.entries(stats.cylinders_in_stock).map(([type, quantity]) => (
              <div key={type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">In Stock</p>
                </div>
                <span className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  {quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Low Stock Alerts</h3>
          <div className="space-y-4">
            {stats.cylinder_health.filter(health => health.request_sent).map((health, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{health.cylinder_type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {health.in_stock} / {health.threshold} (Stock/Threshold)
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full">
                    Low Stock
                  </span>
                  {health.triggered_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(health.triggered_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {stats.cylinder_health.filter(health => health.request_sent).length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No low stock alerts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities - 4 Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Orders</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Order #{1000 + i}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Activity #{i}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Description of activity</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>



      {/* For finance roles - show their actions */}
      {role === 'finance' && (
        <div className="mt-8">
          <div className="card p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Pending Actions</h3>
            <button 
              onClick={() => window.location.href = '/app/pending-actions'}
              className="text-blue-600 hover:text-blue-800 font-medium text-lg"
            >
              View Your Pending Actions →
            </button>
          </div>
        </div>
      )}

      {/* Pending Actions Modals */}
      <PendingActionsModal
        isOpen={inventoryModal}
        onClose={() => setInventoryModal(false)}
        title="Inventory Team Pending Actions"
        actions={inventoryActions}
        teamType="inventory"
      />
      
      <PendingActionsModal
        isOpen={financeModal}
        onClose={() => setFinanceModal(false)}
        title="Finance Team Pending Actions"
        actions={financeActions}
        teamType="finance"
      />
    </div>
  );
}; 