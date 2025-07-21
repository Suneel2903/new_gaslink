import React, { useState, useEffect } from 'react';
import { api } from '../services/apiClient';
import type { VehicleCancelledStock } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface VehicleInventoryManagerProps {
  distributorId: string;
}

export const VehicleInventoryManager: React.FC<VehicleInventoryManagerProps> = ({ distributorId }) => {
  const [cancelledStock, setCancelledStock] = useState<VehicleCancelledStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingStock, setMovingStock] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCancelledStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.vehicle.getCancelledStockInVehicles(distributorId);
      setCancelledStock(response.data.data);
    } catch (err) {
      console.error('Error fetching cancelled stock:', err);
      setError('Failed to fetch cancelled stock in vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCancelledStock();
  }, [distributorId]);

  const handleMoveToInventory = async (vehicleId: string, cylinderTypeId: string, quantity: number) => {
    const stockKey = `${vehicleId}-${cylinderTypeId}`;
    
    try {
      setMovingStock(stockKey);
      await api.vehicle.moveCancelledStockToInventory({
        vehicle_id: vehicleId,
        cylinder_type_id: cylinderTypeId,
        quantity: quantity
      });
      
      // Refresh the data
      await fetchCancelledStock();
      
      // Show success message
      alert(`Successfully moved ${quantity} cylinders to depot inventory`);
    } catch (err: any) {
      console.error('Error moving stock to inventory:', err);
      alert(`Failed to move stock: ${err.response?.data?.error || err.message}`);
    } finally {
      setMovingStock(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading cancelled stock...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (cancelledStock.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-600 text-lg font-medium">
            No cancelled stock in vehicles
          </p>
          <p className="text-gray-500 text-sm mt-2">
            All vehicles are clear of cancelled order cylinders
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cancelled Stock in Vehicles
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Move cancelled order cylinders from vehicles to depot inventory
          </p>
        </div>
        <button
          onClick={fetchCancelledStock}
          className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Driver
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cylinder Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cancelled Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {cancelledStock.map((stock, index) => (
              <tr key={`${stock.vehicle_id}-${stock.cylinder_type_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">🚚</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {stock.vehicle_number}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 dark:text-white">
                    {stock.driver_name || 'Not assigned'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">📦</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {stock.cylinder_type}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {stock.cancelled_quantity}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleMoveToInventory(stock.vehicle_id, stock.cylinder_type_id, stock.cancelled_quantity)}
                    disabled={movingStock === `${stock.vehicle_id}-${stock.cylinder_type_id}`}
                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white ${
                      movingStock === `${stock.vehicle_id}-${stock.cylinder_type_id}`
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    }`}
                  >
                    {movingStock === `${stock.vehicle_id}-${stock.cylinder_type_id}` ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        Moving...
                      </>
                    ) : (
                      <>
                        <span className="mr-1">📥</span>
                        Move to Depot
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>💡 <strong>Note:</strong> Moving cylinders to depot inventory will make them available for new orders.</p>
      </div>
    </div>
  );
}; 