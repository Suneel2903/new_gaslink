import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { CustomerInventorySummary } from '../types';

export const CustomerInventoryPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customerInventory, setCustomerInventory] = useState<CustomerInventorySummary[]>([]);

  useEffect(() => {
    if (isSuperAdmin && !distributor_id) {
      setLoading(false);
      return;
    }
    fetchCustomerInventory();
  }, [distributor_id, isSuperAdmin]);

  const fetchCustomerInventory = async () => {
    // Implementation of fetchCustomerInventory
    setLoading(false);
  };

  // Defensive UI checks
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customerInventory) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Something went wrong loading customer inventory</div>
      </div>
    );
  }

  if (customerInventory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No customer inventory found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Inventory</h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage customer inventory balances</p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          Customer Inventory management coming soon...
        </div>
      </div>
    </div>
  );
}; 