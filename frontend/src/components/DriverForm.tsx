import React, { useState, useEffect } from 'react';
import driverService from '../services/driverService';
import vehicleService from '../services/vehicleService';

interface DriverFormProps {
  driver?: any;
  onClose: () => void;
}

const employmentTypes = ['payroll', 'contract'];

const DriverForm: React.FC<DriverFormProps> = ({ driver, onClose }) => {
  const [form, setForm] = useState<any>({
    driver_name: driver?.driver_name || '',
    phone: driver?.phone || '',
    license_number: driver?.license_number || '',
    employment_type: driver?.employment_type || '',
    preferred_vehicle_id: driver?.preferred_vehicle_id || '',
    status: driver?.status || 'Active',
    joining_date: driver?.joining_date || '',
    distributor_id: driver?.distributor_id || '11111111-1111-1111-1111-111111111111', // TODO: Replace with actual distributor_id from context/auth
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch vehicles for the dropdown
    const fetchVehicles = async () => {
      try {
        const res = await vehicleService.listVehicles();
        setVehicles(res.vehicles || []);
      } catch (err) {
        setVehicles([]);
      }
    };
    fetchVehicles();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (driver) {
      await driverService.updateDriver(driver.driver_id, form);
    } else {
      await driverService.createDriver(form);
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <form className="bg-white p-6 rounded shadow w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold mb-4">{driver ? 'Edit Driver' : 'Add Driver'}</h2>
        <div className="mb-2">
          <label className="block text-sm">Driver Name</label>
          <input name="driver_name" value={form.driver_name} onChange={handleChange} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div className="mb-2">
          <label className="block text-sm">Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div className="mb-2">
          <label className="block text-sm">License Number</label>
          <input name="license_number" value={form.license_number} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
        </div>
        <div className="mb-2">
          <label className="block text-sm">Employment Type</label>
          <select name="employment_type" value={form.employment_type} onChange={handleChange} className="border rounded px-2 py-1 w-full">
            <option value="">Select</option>
            {employmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="mb-2">
          <label className="block text-sm">Preferred Vehicle</label>
          <select name="preferred_vehicle_id" value={form.preferred_vehicle_id} onChange={handleChange} className="border rounded px-2 py-1 w-full">
            <option value="">Select</option>
            {vehicles.map((v: any) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
            ))}
          </select>
        </div>
        <div className="mb-2">
          <label className="block text-sm">Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="border rounded px-2 py-1 w-full">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm">Joining Date</label>
          <input type="date" name="joining_date" value={form.joining_date} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
        </div>
        {/* Hidden distributor_id field for now */}
        <input type="hidden" name="distributor_id" value={form.distributor_id} />
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};

export default DriverForm; 