import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import driverService from '../services/driverService';
import availabilityService from '../services/availabilityService';
import vehicleService from '../services/vehicleService';
import DriverForm from '../components/DriverForm';
import { FaPlus } from 'react-icons/fa';

const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    const res = await driverService.listDrivers();
    setDrivers(res?.drivers || []);
    setLoading(false);
  };

  const fetchVehicles = async () => {
    try {
      const res = await vehicleService.listVehicles();
      setVehicles(res.vehicles || []);
    } catch (err) {
      setVehicles([]);
    }
  };

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
  }, []);

  const handleAdd = () => {
    setEditDriver(null);
    setShowForm(true);
  };

  const handleEdit = (driver: any) => {
    setEditDriver(driver);
    setShowForm(true);
  };

  const handleDeactivate = async (driver: any) => {
    // Send all required fields, not just status
    await driverService.updateDriver(driver.driver_id, {
      driver_name: driver.driver_name,
      phone: driver.phone,
      license_number: driver.license_number,
      employment_type: driver.employment_type,
      preferred_vehicle_id: driver.preferred_vehicle_id,
      status: driver.status === 'Active' ? 'Inactive' : 'Active',
      joining_date: driver.joining_date,
      distributor_id: driver.distributor_id,
    });
    fetchDrivers();
  };

  const handleLogAvailability = async (driver: any, available: boolean) => {
    if (available) {
      await availabilityService.markAvailable({
        entity_type: 'driver',
        entity_id: driver.driver_id,
        date,
      });
    } else {
      await availabilityService.markUnavailable({
        entity_type: 'driver',
        entity_id: driver.driver_id,
        date,
        reason: 'Marked unavailable from UI',
      });
    }
    // Optionally refetch availability status here
  };

  const filteredDrivers = drivers.filter((d: any) =>
    d.driver_name?.toLowerCase().includes(filter.toLowerCase()) ||
    d.phone?.includes(filter)
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
          placeholder="Search drivers..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shadow transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400" onClick={handleAdd}>
          <FaPlus /> Add Driver
        </button>
      </div>
      <div className="card p-6 mb-6 w-full">
        <table className="min-w-full w-full bg-white border rounded-xl shadow overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-center">Name</th>
              <th className="px-2 py-2 text-center">Phone</th>
              <th className="px-2 py-2 text-center">License</th>
              <th className="px-2 py-2 text-center">Employment</th>
              <th className="px-2 py-2 text-center">Preferred Vehicle</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-center">Actions</th>
              <th className="px-2 py-2 text-center">Available Today</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center">Loading...</td></tr>
            ) : filteredDrivers.length === 0 ? (
              <tr><td colSpan={8} className="text-center">No drivers found.</td></tr>
            ) : filteredDrivers.map((driver: any, idx: number) => {
              const vehicle = vehicles.find((v: any) => v.vehicle_id === driver.preferred_vehicle_id);
              return (
                <tr key={driver.driver_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-2 text-center">{driver.driver_name}</td>
                  <td className="px-2 py-2 text-center">{driver.phone}</td>
                  <td className="px-2 py-2 text-center">{driver.license_number}</td>
                  <td className="px-2 py-2 text-center">{driver.employment_type}</td>
                  <td className="px-2 py-2 text-center">{vehicle ? vehicle.vehicle_number : '-'}</td>
                  <td className="px-2 py-2 text-center">{driver.status}</td>
                  <td className="px-2 py-2 text-center flex gap-2 justify-center">
                    <button className="btn btn-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded px-3 py-1" onClick={() => handleEdit(driver)}>Edit</button>
                    <button className={`btn btn-sm ${driver.status === 'Active' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded px-3 py-1`} onClick={() => handleDeactivate(driver)}>
                      {driver.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button className="btn btn-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 mr-1" onClick={() => handleLogAvailability(driver, true)}>Available</button>
                    <button className="btn btn-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1" onClick={() => handleLogAvailability(driver, false)}>Unavailable</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && (
        <DriverForm
          driver={editDriver}
          onClose={() => { setShowForm(false); fetchDrivers(); }}
        />
      )}
    </div>
  );
};

export default DriversPage; 