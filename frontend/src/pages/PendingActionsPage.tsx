import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/apiClient';

export const PendingActionsPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    fetchPendingActions();
  }, [distributor_id, isSuperAdmin]);

  const fetchPendingActions = async () => {
    try {
      let response;
      if (isSuperAdmin) {
        response = await api.dashboard.getPendingActions();
      } else {
        response = await api.dashboard.getPendingActions(distributor_id);
      }
      setPendingActions(response.data);
    } catch (error) {
      console.error('Error fetching pending actions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Actions</h1>
        <p className="text-gray-600 dark:text-gray-400">Review and manage pending tasks</p>
      </div>
      <div className="card p-6">
        <p className="text-gray-600 dark:text-gray-400">Pending actions management coming soon...</p>
      </div>
    </div>
  );
}; 