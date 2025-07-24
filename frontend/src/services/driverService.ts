import axios from './apiClient';

const driverService = {
  listDrivers: async () => {
    const res = await axios.get('/drivers');
    return res.data;
  },
  createDriver: async (data: any) => {
    const res = await axios.post('/drivers', data);
    return res.data;
  },
  updateDriver: async (id: string, data: any) => {
    const res = await axios.patch(`/drivers/${id}`, data);
    return res.data;
  },
  deactivateDriver: async (id: string, status: string) => {
    const res = await axios.patch(`/drivers/${id}`, { status });
    return res.data;
  },
};

export default driverService; 