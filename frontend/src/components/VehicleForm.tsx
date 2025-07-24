import React, { useState } from 'react';
import vehicleService from '../services/vehicleService';

interface VehicleFormProps {
  vehicle?: any;
  onClose: () => void;
}

const ownershipTypes = ['owned', 'rented'];
const statusTypes = ['Available', 'In Repair', 'Inactive'];

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onClose }) => {
  const [form, setForm] = useState<any>({
    vehicle_number: vehicle?.vehicle_number || '',
    cylinder_capacity: vehicle?.cylinder_capacity || vehicle?.capacity_kg || '',
    ownership_type: vehicle?.ownership_type || vehicle?.vehicle_type || '',
    status: vehicle?.status || 'Available',
    distributor_id: vehicle?.distributor_id || '11111111-1111-1111-1111-111111111111', // TODO: Replace with actual distributor_id from context/auth
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (vehicle) {
      await vehicleService.updateVehicle(vehicle.vehicle_id, form);
    } else {
      await vehicleService.createVehicle(form);
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <form className="bg-white p-6 rounded shadow w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold mb-4">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
        <div className="mb-2">
          <label className="block text-sm">Vehicle Number</label>
          <input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div className="mb-2">
          <label className="block text-sm">Cylinder Capacity</label>
          <input name="cylinder_capacity" value={form.cylinder_capacity} onChange={handleChange} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div className="mb-2">
          <label className="block text-sm">Ownership Type</label>
          <select name="ownership_type" value={form.ownership_type} onChange={handleChange} className="border rounded px-2 py-1 w-full">
            <option value="">Select</option>
            {ownershipTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm">Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="border rounded px-2 py-1 w-full">
            {statusTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
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

export default VehicleForm; 