import axios from './apiClient';

const vehicleService = {
  listVehicles: async () => {
    const res = await axios.get('/vehicles');
    return res.data;
  },
  createVehicle: async (data: any) => {
    const res = await axios.post('/vehicles', data);
    return res.data;
  },
  updateVehicle: async (id: string, data: any) => {
    const res = await axios.patch(`/vehicles/${id}`, data);
    return res.data;
  },
  deactivateVehicle: async (id: string, status: string) => {
    const res = await axios.patch(`/vehicles/${id}`, { status });
    return res.data;
  },
};

export default vehicleService; 