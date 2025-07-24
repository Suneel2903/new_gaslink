import React, { useState } from 'react';
import assignmentService from '../services/assignmentService';

interface AssignmentModalProps {
  date: string;
  drivers: any[];
  vehicles: any[];
  distributorId: string;
  createdBy: string;
  onClose: () => void;
  onAssigned: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ date, drivers, vehicles, distributorId, createdBy, onClose, onAssigned }) => {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAssign = async () => {
    setLoading(true);
    setError('');
    try {
      await assignmentService.assignDriverToVehicle({
        date,
        driver_id: selectedDriver,
        vehicle_id: selectedVehicle,
        distributor_id: distributorId,
        reason: '',
        created_by: createdBy,
      });
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <h2>Assign Driver to Vehicle</h2>
      <div>
        <label>Driver:</label>
        <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
          <option value="">Select Driver</option>
          {drivers.map((d: any) => (
            <option key={d.driver_id} value={d.driver_id}>{d.driver_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Vehicle:</label>
        <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}>
          <option value="">Select Vehicle</option>
          {vehicles.map((v: any) => (
            <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
          ))}
        </select>
      </div>
      <button onClick={handleAssign} disabled={loading || !selectedDriver || !selectedVehicle}>
        {loading ? 'Assigning...' : 'Assign'}
      </button>
      {error && <div className="text-red-500">{error}</div>}
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default AssignmentModal; 