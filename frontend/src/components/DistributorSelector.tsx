import React, { useState, useEffect } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export const DistributorSelector: React.FC = () => {
  const { distributor_id, setSelectedDistributorId, isSuperAdmin, loading, role } = useAuth();
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loadingDistributors, setLoadingDistributors] = useState(true);

  useEffect(() => {
    console.log('DistributorSelector useEffect:', { loading, isSuperAdmin, role });
    if (loading) return; // Wait until auth is loaded
    if (!isSuperAdmin) return;
    console.log('About to call api.distributors.getAll()');
    api.distributors.getAll()
      .then(res => {
        const list = res.data?.data || res.data;
        console.log('Distributors API response:', res.data);
        console.log('Parsed distributor list:', list);
        setDistributors(Array.isArray(list) ? list : []);
        setLoadingDistributors(false);
      })
      .catch(() => {
        setLoadingDistributors(false);
      });
  }, [isSuperAdmin, loading, role]);

  if (!isSuperAdmin) return null;

  return (
    <select
      value={distributor_id || ''}
      onChange={(e) => setSelectedDistributorId(e.target.value || null)}
      className="px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-800"
      disabled={loadingDistributors}
    >
      <option value="">Select Distributor</option>
      {distributors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}; 