import axios from './apiClient';

const availabilityService = {
  markUnavailable: async (data: any) => {
    // POST to /vehicles/availability/mark-unavailable or /drivers/availability/mark-unavailable based on entity_type
    const url = data.entity_type === 'vehicle'
      ? '/vehicles/availability/mark-unavailable'
      : '/drivers/availability/mark-unavailable';
    const res = await axios.post(url, data);
    return res.data;
  },
  markAvailable: async (data: any) => {
    const url = data.entity_type === 'vehicle'
      ? '/vehicles/availability/mark-available'
      : '/drivers/availability/mark-available';
    const res = await axios.post(url, data);
    return res.data;
  },
  getStatus: async (params: any) => {
    const url = params.entity_type === 'vehicle'
      ? '/vehicles/availability/status'
      : '/drivers/availability/status';
    const res = await axios.get(url, { params });
    return res.data;
  },
  listUnavailable: async (params: any) => {
    // (optional legacy)
    const res = await axios.get('/availability', { params });
    return res.data;
  },
};

export default availabilityService; 