import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import type { ApiError, CylinderType } from '../types';

const CylinderPriceAdminPage: React.FC = () => {
  const { role, loading, isSuperAdmin, distributor_id } = useAuth();
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
  const [prices, setPrices] = useState<{ [id: string]: string }>({});
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [cylinderPrices, setCylinderPrices] = useState<CylinderType[]>([]);
  const [loadingCylinderPrices, setLoadingCylinderPrices] = useState<boolean>(true);

  useEffect(() => {
    api.cylinderTypes.getAll().then(res => {
      setCylinderTypes(res.data.data);
      const priceMap: { [id: string]: string } = {};
      res.data.data.forEach((ct: CylinderType) => {
        priceMap[ct.cylinder_type_id] = ct.unit_price.toString();
      });
      setPrices(priceMap);
    }).catch((error: unknown) => {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to load cylinder types');
    });
  }, []);

  useEffect(() => {
    if (isSuperAdmin && !distributor_id) {
      setLoadingCylinderPrices(false);
      return;
    }
    fetchCylinderPrices();
  }, [distributor_id, isSuperAdmin]);

  const handleEdit = (id: string) => {
    setEditing({ ...editing, [id]: true });
    setMessage('');
    setError('');
  };

  const handleCancel = (id: string) => {
    setEditing({ ...editing, [id]: false });
    setMessage('');
    setError('');
  };

  const handlePriceChange = (id: string, value: string) => {
    setPrices({ ...prices, [id]: value });
  };

  const handleSave = async (id: string) => {
    setMessage('');
    setError('');
    const priceValue = prices[id];
    if (!priceValue) {
      setError('Please enter a valid price.');
      return;
    }
    const newPrice = parseFloat(priceValue);
    if (isNaN(newPrice) || newPrice <= 0) {
      setError('Please enter a valid price.');
      return;
    }
    try {
      await api.cylinderTypes.updatePrice(id, { unit_price: newPrice });
      setCylinderTypes(cts => cts.map(ct => ct.cylinder_type_id === id ? { ...ct, unit_price: newPrice } : ct));
      setEditing({ ...editing, [id]: false });
      setMessage('Price updated successfully.');
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to update price.');
    }
  };

  const fetchCylinderPrices = async () => {
    try {
      const res = await api.cylinderTypes.getAll();
      setCylinderPrices(res.data.data);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Failed to load cylinder prices');
    } finally {
      setLoadingCylinderPrices(false);
    }
  };

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

  if (!cylinderPrices) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Something went wrong loading cylinder prices</div>
      </div>
    );
  }

  if (cylinderPrices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No cylinder prices found.</div>
      </div>
    );
  }

  if (role !== 'admin' && role !== 'finance') {
    return <div className="text-red-600 p-8 text-center">You do not have permission to access this page.</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Cylinder Price Management</h1>
      <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Capacity (kg)</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Price</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {cylinderTypes.map(ct => (
            <tr key={ct.cylinder_type_id} className="border-t">
              <td className="px-4 py-2">{ct.name}</td>
              <td className="px-4 py-2">{ct.capacity}</td>
              <td className="px-4 py-2">-</td>
              <td className="px-4 py-2">
                {editing[ct.cylinder_type_id] ? (
                  <input
                    type="number"
                    min={0}
                    className="input-field w-24"
                    value={prices[ct.cylinder_type_id]}
                    onChange={e => handlePriceChange(ct.cylinder_type_id, e.target.value)}
                  />
                ) : (
                  `₹${ct.unit_price}`
                )}
              </td>
              <td className="px-4 py-2">
                {editing[ct.cylinder_type_id] ? (
                  <>
                    <button className="btn-primary mr-2" onClick={() => handleSave(ct.cylinder_type_id)}>Save</button>
                    <button className="btn-secondary" onClick={() => handleCancel(ct.cylinder_type_id)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn-secondary" onClick={() => handleEdit(ct.cylinder_type_id)}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {message && <div className="text-green-600 mt-4">{message}</div>}
      {error && <div className="text-red-600 mt-4">{error}</div>}
    </div>
  );
};

export default CylinderPriceAdminPage; 