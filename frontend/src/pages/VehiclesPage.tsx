import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import vehicleService from '../services/vehicleService';
import availabilityService from '../services/availabilityService';
import assignmentService from '../services/assignmentService';
import VehicleForm from '../components/VehicleForm';

const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [availability, setAvailability] = useState<{ [vehicleId: string]: boolean }>({});

  const fetchVehicles = async () => {
    setLoading(true);
    const res = await vehicleService.listVehicles();
    setVehicles(res?.vehicles || []);
    setLoading(false);
  };

  const fetchAssignments = async () => {
    const res = await assignmentService.listAssignments({ date });
    setAssignments(res?.assignments || []);
  };

  useEffect(() => {
    fetchVehicles();
    fetchAssignments();
  }, [date]);

  const handleAdd = () => {
    setEditVehicle(null);
    setShowForm(true);
  };

  const handleEdit = (vehicle: any) => {
    setEditVehicle(vehicle);
    setShowForm(true);
  };

  const handleDeactivate = async (vehicle: any) => {
    // Send all required fields, not just status
    await vehicleService.updateVehicle(vehicle.vehicle_id, {
      vehicle_number: vehicle.vehicle_number,
      cylinder_capacity: vehicle.cylinder_capacity,
      ownership_type: vehicle.ownership_type,
      status: vehicle.status === 'Available' ? 'Inactive' : 'Available',
      distributor_id: vehicle.distributor_id,
    });
    fetchVehicles();
  };

  const handleLogAvailability = async (vehicle: any, available: boolean) => {
    if (available) {
      await availabilityService.markAvailable({
        entity_type: 'vehicle',
        entity_id: vehicle.vehicle_id,
        date,
      });
    } else {
      await availabilityService.markUnavailable({
        entity_type: 'vehicle',
        entity_id: vehicle.vehicle_id,
        date,
        reason: 'Marked unavailable from UI',
      });
    }
    // Optionally refetch availability status here
  };

  const filteredVehicles = vehicles.filter((v: any) =>
    v.vehicle_number?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center mb-4 gap-4 w-full">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <input
          type="text"
          placeholder="Search vehicles..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shadow" onClick={handleAdd}>Add Vehicle</button>
      </div>
      <div className="card p-6 mb-6 w-full">
        <table className="min-w-full w-full bg-white border rounded-xl shadow overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-center">Vehicle Number</th>
              <th className="px-2 py-2 text-center">Capacity</th>
              <th className="px-2 py-2 text-center">Ownership</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-center">Actions</th>
              <th className="px-2 py-2 text-center">Driver</th>
              <th className="px-2 py-2 text-center">Available Today</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center">Loading...</td></tr>
            ) : filteredVehicles.length === 0 ? (
              <tr><td colSpan={7} className="text-center">No vehicles found.</td></tr>
            ) : filteredVehicles.map((vehicle: any, idx: number) => {
              const isAvailable = availability[vehicle.vehicle_id] ?? (vehicle.status === 'Available');
              // Find assigned driver (if any)
              const assignedDriver = assignments.find(a => a.vehicle_id === vehicle.vehicle_id && !a.is_reconciled)?.driver_id || '';
              return (
                <tr key={vehicle.vehicle_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-2 text-center">{vehicle.vehicle_number}</td>
                  <td className="px-2 py-2 text-center">{vehicle.cylinder_capacity || vehicle.capacity_kg}</td>
                  <td className="px-2 py-2 text-center">{vehicle.ownership_type || vehicle.vehicle_type}</td>
                  <td className="px-2 py-2 text-center">{vehicle.status}</td>
                  <td className="px-2 py-2 text-center flex gap-2 justify-center">
                    <button className="btn btn-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded px-3 py-1" onClick={() => handleEdit(vehicle)}>Edit</button>
                    <button className="btn btn-sm bg-gray-400 hover:bg-gray-500 text-white rounded px-3 py-1" onClick={() => handleDeactivate(vehicle)}>
                      Deactivate
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">{assignedDriver ? assignedDriver : '-'}</td>
                  <td className="px-2 py-2 text-center flex gap-2 justify-center">
                    {isAvailable && (
                      <button
                        className="btn btn-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1"
                        onClick={() => {
                          setAvailability(prev => ({ ...prev, [vehicle.vehicle_id]: true }));
                          handleLogAvailability(vehicle, true);
                        }}
                        disabled={isAvailable}
                      >
                        Yes
                      </button>
                    )}
                    {!isAvailable && (
                      <button
                        className="btn btn-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
                        onClick={() => {
                          setAvailability(prev => ({ ...prev, [vehicle.vehicle_id]: false }));
                          handleLogAvailability(vehicle, false);
                        }}
                        disabled={!isAvailable}
                      >
                        No
                      </button>
                    )}
                    <button
                      className={`btn btn-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 ml-2 ${isAvailable ? '' : 'opacity-50 cursor-not-allowed'}`}
                      onClick={() => {/* open assignment modal logic here */}}
                      disabled={!isAvailable}
                    >
                      Assign Driver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && (
        <VehicleForm
          vehicle={editVehicle}
          onClose={() => { setShowForm(false); fetchVehicles(); }}
        />
      )}
    </div>
  );
};

export default VehiclesPage; 