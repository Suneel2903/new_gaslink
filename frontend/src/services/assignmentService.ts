import axios from './apiClient';

const assignmentService = {
  assignDriverToVehicle: async (data: any) => {
    const res = await axios.post('/orders/assignments', data);
    return res.data;
  },
  listAssignments: async (params: any) => {
    const res = await axios.get('/orders/assignments', { params });
    return res.data;
  },
  reconcileAssignment: async (id: string) => {
    const res = await axios.patch(`/orders/assignments/${id}/reconcile`);
    return res.data;
  },
};

export default assignmentService; 