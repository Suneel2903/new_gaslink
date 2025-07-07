import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// Create axios instance with base configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Temporarily comment out redirect to login on 401 for debugging
    // if (error.response?.status === 401) {
    //   localStorage.removeItem('authToken');
    //   window.location.href = '/login';
    // }
    return Promise.reject(error);
  }
);

// API endpoints
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) => 
      apiClient.post('/auth/login', { email, password }),
    register: (userData: any) => 
      apiClient.post('/auth/register', userData),
    verifyToken: () => 
      apiClient.get('/auth/verify'),
  },

  // Users endpoints
  users: {
    getAll: (distributorId?: string) => 
      apiClient.get('/users', { params: { distributorId } }),
    getById: (id: string) => 
      apiClient.get(`/users/${id}`),
    create: (userData: any) => 
      apiClient.post('/users', userData),
    update: (id: string, userData: any) => 
      apiClient.put(`/users/${id}`, userData),
    delete: (id: string) => 
      apiClient.delete(`/users/${id}`),
    getProfile: () => 
      apiClient.get('/users/profile/me'),
    updateProfile: (userData: any) => 
      apiClient.put('/users/profile/me', userData),
  },

  // Orders endpoints
  orders: {
    getAll: (distributorId?: string, status?: string) => 
      apiClient.get('/orders', { params: { distributorId, status } }),
    getById: (id: string) => 
      apiClient.get(`/orders/${id}`),
    create: (orderData: any) => 
      apiClient.post('/orders', orderData),
    update: (id: string, orderData: any) => 
      apiClient.put(`/orders/${id}`, orderData),
    delete: (id: string) => 
      apiClient.delete(`/orders/${id}`),
    changeStatus: (id: string, status: string, payload?: any) => 
      apiClient.patch(`/orders/${id}/status`, { status, ...(payload || {}) }),
    cancel: (id: string) => 
      apiClient.patch(`/orders/${id}/cancel`),
  },

  // Inventory endpoints
  inventory: {
    getAll: (distributorId?: string) => 
      apiClient.get('/inventory', { params: { distributorId } }),
    getById: (id: string) => 
      apiClient.get(`/inventory/${id}`),
    create: (inventoryData: any) => 
      apiClient.post('/inventory', inventoryData),
    update: (id: string, inventoryData: any) => 
      apiClient.put(`/inventory/${id}`, inventoryData),
    delete: (id: string) => 
      apiClient.delete(`/inventory/${id}`),
    updateStock: (id: string, quantity: number) => 
      apiClient.patch(`/inventory/${id}/stock`, { quantity }),
    getSummaryByDate: (date: string) => apiClient.get(`/inventory/summary/${date}`),
    upsertSummaryByDate: (date: string, updates: any) => apiClient.post(`/inventory/summary/${date}`, { updates }),
    approveAdjustment: (adjustment_ids: string[], admin_id: string) => apiClient.patch('/inventory/approve-adjustment', { adjustment_ids, admin_id }),
    updateFromDelivery: (payload: any) => apiClient.post('/inventory/update-from-delivery', payload),
    getReplenishments: (status?: string) => apiClient.get('/inventory/replenishments', { params: status ? { status } : {} }),
    updateReplenishment: (id: string, data: any) => apiClient.patch(`/inventory/replenishments/${id}`, data),
    getPendingAdjustments: (status?: string) => apiClient.get('/inventory/adjustments', { params: status ? { status } : {} }),
    confirmReturn: (returns: any[]) => apiClient.post('/inventory/confirm-return', { returns }),
    getCustomerSummary: (customerId: string) => apiClient.get(`/inventory/customer-summary/${customerId}`),
    getUnaccountedSummary: (date: string) => apiClient.get('/inventory/unaccounted-summary', { params: { date } }),
    lockSummary: (date: string) => apiClient.patch(`/inventory/lock-summary/${date}`),
    unlockSummary: (date: string) => apiClient.patch(`/inventory/unlock-summary/${date}`),
    adminOverrideBalance: (data: {
      customer_id: string;
      cylinder_type_id: string;
      with_customer_qty: number;
      pending_returns: number;
      missing_qty: number;
      reason: string;
    }) => apiClient.patch('/inventory/admin-override-balance', data),
  },

  // Dashboard endpoints
  dashboard: {
    getStats: (distributorId?: string) => 
      apiClient.get('/dashboard/stats', { params: { distributorId } }),
    getRecentOrders: (distributorId?: string) => 
      apiClient.get('/dashboard/recent-orders', { params: { distributorId } }),
    getPendingActions: (distributorId?: string) => 
      apiClient.get('/dashboard/pending-actions', { params: { distributorId } }),
  },

  // Customers endpoints
  customers: {
    getAll: () => apiClient.get('/customers'),
    getById: (id: string) => apiClient.get(`/customers/${id}`),
    create: (customerData: any) => apiClient.post('/customers', customerData),
    update: (id: string, customerData: any) => apiClient.put(`/customers/${id}`, customerData),
    delete: (id: string) => apiClient.delete(`/customers/${id}`),
    setStopSupply: (id: string, stop_supply: boolean, reason?: string) =>
      apiClient.patch(`/customers/${id}/stop-supply`, { stop_supply, stop_supply_reason: reason }),
    setPreferredDriver: (id: string, driver_id: string) =>
      apiClient.patch(`/customers/${id}/preferred-driver`, { driver_id }),
    getDrivers: () => apiClient.get('/users', { params: { role: 'driver' } }),
    getModificationRequests: () => apiClient.get('/customers/modification/requests'),
  },

  cylinderTypes: {
    getAll: () => apiClient.get('/cylinder-types'),
    updatePrice: (id: string, data: any) => apiClient.patch(`/cylinder-types/${id}/price`, data),
  },

  cylinderPrices: {
    getLatest: () => apiClient.get('/cylinder-prices/latest'),
    insert: (data: any) => apiClient.post('/cylinder-prices', data),
    getByMonthYear: (month: number, year: number) => apiClient.get(`/cylinder-prices/by-month?month=${month}&year=${year}`),
  },
};

export default apiClient; 