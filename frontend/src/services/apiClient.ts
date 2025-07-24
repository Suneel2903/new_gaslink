import axiosInstance from './axiosInstance';
import type {
  ApiResponse,
  User,
  UserProfile,
  CreateUserRequest,
  UpdateUserRequest,
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderStatusChangeRequest,
  InventorySummary,
  InventoryUpdateFromDeliveryRequest,
  ConfirmReturnRequest,
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CylinderType,
  CreateCylinderPriceRequest,
  DashboardStats,
  RecentOrder,
  PendingAction,
  PendingActionsResponse,
  Payment,
  CreatePaymentRequest,
  OutstandingInvoice
} from '../types';

// Use shared axiosInstance for all API calls
const apiClient = axiosInstance;

// API endpoints
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) => 
      apiClient.post<ApiResponse<{ token: string; user: UserProfile }>>('/auth/login', { email, password }),
    register: (userData: CreateUserRequest) => 
      apiClient.post<ApiResponse<User>>('/auth/register', userData),
    verifyToken: () => 
      apiClient.get<ApiResponse<UserProfile>>('/auth/verify'),
  },

  // Users endpoints
  users: {
    getAll: (distributor_id?: string) => 
      apiClient.get<ApiResponse<User[]>>('/users', { params: { distributor_id } }),
    getById: (id: string) => 
      apiClient.get<ApiResponse<User>>(`/users/${id}`),
    create: (userData: CreateUserRequest) => 
      apiClient.post<ApiResponse<User>>('/users', userData),
    update: (id: string, userData: UpdateUserRequest) => 
      apiClient.put<ApiResponse<User>>(`/users/${id}`, userData),
    delete: (id: string) => 
      apiClient.delete<ApiResponse<{ message: string }>>(`/users/${id}`),
    getProfile: () => 
      apiClient.get<ApiResponse<UserProfile>>('/users/profile/me'),
    updateProfile: (userData: UpdateUserRequest) => 
      apiClient.put<ApiResponse<UserProfile>>('/users/profile/me', userData),
  },

  // Orders endpoints
  orders: {
    getAll: (distributor_id?: string, status?: string) => 
      apiClient.get<ApiResponse<Order[]>>('/orders', { params: { distributor_id, status } }),
    getById: (id: string) => 
      apiClient.get<ApiResponse<Order>>(`/orders/${id}`),
    create: (orderData: CreateOrderRequest) => 
      apiClient.post<ApiResponse<Order>>('/orders', orderData),
    update: (id: string, orderData: UpdateOrderRequest) => 
      apiClient.put<ApiResponse<Order>>(`/orders/${id}`, orderData),
    delete: (id: string) => 
      apiClient.delete<ApiResponse<{ message: string }>>(`/orders/${id}`),
    changeStatus: (id: string, status: string, payload?: OrderStatusChangeRequest) => 
      apiClient.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status, ...(payload || {}) }),
    cancel: (id: string) => 
      apiClient.patch<ApiResponse<{ message: string }>>(`/orders/${id}/cancel`),
  },

  // Inventory endpoints
  inventory: {
    getAll: (distributor_id?: string) => 
      apiClient.get<ApiResponse<InventorySummary[]>>('/inventory', { params: { distributor_id } }),
    getById: (id: string) => 
      apiClient.get<ApiResponse<InventorySummary>>(`/inventory/${id}`),
    create: (inventoryData: Partial<InventorySummary>) => 
      apiClient.post<ApiResponse<InventorySummary>>('/inventory', inventoryData),
    update: (id: string, inventoryData: Partial<InventorySummary>) => 
      apiClient.put<ApiResponse<InventorySummary>>(`/inventory/${id}`, inventoryData),
    delete: (id: string) => 
      apiClient.delete<ApiResponse<{ message: string }>>(`/inventory/${id}`),
    updateStock: (id: string, quantity: number) => 
      apiClient.patch<ApiResponse<InventorySummary>>(`/inventory/${id}/stock`, { quantity }),
    getSummaryByDate: (date: string, distributor_id?: string) => apiClient.get<ApiResponse<InventorySummary[]>>(`/inventory/summary/${date}`, { params: distributor_id ? { distributor_id } : {} }),
    upsertSummaryByDate: (date: string, updates: Record<string, unknown>) => apiClient.post<ApiResponse<InventorySummary[]>>(`/inventory/summary/${date}`, { updates }),
    approveAdjustment: (adjustment_ids: string[], admin_id: string) => apiClient.patch<ApiResponse<{ message: string }>>('/inventory/approve-adjustment', { adjustment_ids, admin_id }),
    updateFromDelivery: (payload: InventoryUpdateFromDeliveryRequest) => apiClient.post<ApiResponse<{ message: string }>>('/inventory/update-from-delivery', payload),
    getReplenishments: (status?: string) => apiClient.get<ApiResponse<Array<{ replenishment_id: string; cylinder_type_id: string; quantity: number; status: string; created_at: string }>>>('/inventory/replenishments', { params: status ? { status } : {} }),
    updateReplenishment: (id: string, data: { status: string; approved_by?: string }) => apiClient.patch<ApiResponse<{ message: string }>>(`/inventory/replenishments/${id}`, data),
    getPendingAdjustments: (status?: string) => apiClient.get<ApiResponse<Array<{ adjustment_id: string; cylinder_type_id: string; quantity: number; reason: string; status: string; created_at: string }>>>('/inventory/adjustments', { params: status ? { status } : {} }),
    confirmReturn: (returns: ConfirmReturnRequest['returns']) => apiClient.post<ApiResponse<{ message: string }>>('/inventory/confirm-return', { returns }),
    getCustomerSummary: (customerId: string) => apiClient.get<ApiResponse<Array<{ customer_id: string; cylinder_type_id: string; cylinder_type_name: string; with_customer_qty: number; pending_returns: number; missing_qty: number; last_updated: string }>>>(`/inventory/customer-summary/${customerId}`),
    getUnaccountedSummary: (date: string, distributor_id?: string) => apiClient.get<ApiResponse<Array<{ customer_id: string; customer_name: string; cylinder_type_id: string; cylinder_name: string; with_customer_qty: number; pending_returns: number; missing_qty: number; unaccounted: number; date: string }>>>('/inventory/unaccounted-summary', { params: { date, distributor_id } }),
    lockSummary: (date: string) => apiClient.patch<ApiResponse<{ message: string }>>(`/inventory/lock-summary/${date}`),
    unlockSummary: (date: string) => apiClient.patch<ApiResponse<{ message: string }>>(`/inventory/unlock-summary/${date}`),
    adminOverrideBalance: (data: {
      customer_id: string;
      cylinder_type_id: string;
      with_customer_qty: number;
      pending_returns: number;
      missing_qty: number;
      reason: string;
    }) => apiClient.patch<ApiResponse<{ message: string }>>('/inventory/admin-override-balance', data),
    logUnaccounted: (data: { date: string; distributor_id: string; cylinder_type_id: string; count: number; reason: string; responsible_party: string; responsible_role: string }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/inventory/unaccounted-log', data),
    getUnaccountedLog: (date: string, distributor_id: string, cylinder_type_id: string) =>
      apiClient.get<ApiResponse<Array<{ id: string; count: number; reason: string; responsible_party: string; responsible_role: string; created_at: string }>>>(
        '/inventory/unaccounted-log', { params: { date, distributor_id, cylinder_type_id } }),
  },

  // Dashboard endpoints
  dashboard: {
    getStats: (distributor_id: string) => 
      apiClient.get<ApiResponse<DashboardStats>>(`/dashboard/stats/${distributor_id}`),
    getRecentOrders: (distributor_id?: string) => 
      apiClient.get<ApiResponse<RecentOrder[]>>('/dashboard/recent-orders', { params: { distributor_id } }),
    getPendingActions: (distributor_id: string, role?: string) => 
      apiClient.get<ApiResponse<PendingActionsResponse>>(`/dashboard/pending-actions/${distributor_id}`, { params: { role } }),
  },

  // Customers endpoints
  customers: {
    getAll: (distributor_id?: string) => apiClient.get<ApiResponse<Customer[]>>('/customers', { params: distributor_id ? { distributor_id } : {} }),
    getById: (id: string) => apiClient.get<ApiResponse<Customer>>(`/customers/${id}`),
    create: (customerData: CreateCustomerRequest) => apiClient.post<ApiResponse<Customer>>('/customers', customerData),
    update: (id: string, customerData: UpdateCustomerRequest) => apiClient.put<ApiResponse<Customer>>(`/customers/${id}`, customerData),
    delete: (id: string) => apiClient.delete<ApiResponse<{ message: string }>>(`/customers/${id}`),
    setStopSupply: (id: string, stop_supply: boolean, reason?: string) =>
      apiClient.patch<ApiResponse<{ message: string }>>(`/customers/${id}/stop-supply`, { stop_supply, stop_supply_reason: reason }),
    setPreferredDriver: (id: string, driver_id: string) =>
      apiClient.patch<ApiResponse<{ message: string }>>(`/customers/${id}/preferred-driver`, { driver_id }),
    getDrivers: () => apiClient.get<ApiResponse<User[]>>('/users', { params: { role: 'driver' } }),
    getModificationRequests: () => apiClient.get<ApiResponse<Array<{ request_id: string; customer_id: string; field_name: string; old_value: string; new_value: string; requested_by: string; status: string; created_at: string }>>>('/customers/modification/requests'),
  },

  cylinderTypes: {
    getAll: (distributor_id?: string) => {
      console.log('🚀 cylinderTypes.getAll triggered with:', distributor_id);
      return apiClient.get<ApiResponse<CylinderType[]>>('/cylinder-types', { params: distributor_id ? { distributor_id } : {} });
    },
    updatePrice: (id: string, data: { unit_price: number }) => apiClient.patch<ApiResponse<CylinderType>>(`/cylinder-types/${id}/price`, data),
  },

  cylinderPrices: {
    getLatest: () => apiClient.get<ApiResponse<Array<{ cylinder_type_id: string; unit_price: number; cylinder_type_name: string }>>>('/cylinder-prices/latest'),
    insert: (data: CreateCylinderPriceRequest) => apiClient.post<ApiResponse<{ message: string }>>('/cylinder-prices', data),
    getByMonthYear: (month: number, year: number, distributor_id?: string) =>
      apiClient.get<ApiResponse<Array<{ price_id: string; cylinder_type_id: string; unit_price: number; effective_from: string; cylinder_type_name: string }>>>(
        `/cylinder-prices/by-month?month=${month}&year=${year}${distributor_id ? `&distributor_id=${distributor_id}` : ''}`
      ),
  },

  // Payments endpoints
  payments: {
    getAll: (distributor_id?: string) => 
      apiClient.get<ApiResponse<Payment[]>>('/payments', { params: { distributor_id } }),
    getById: (id: string) => 
      apiClient.get<ApiResponse<Payment>>(`/payments/${id}`),
    create: (paymentData: CreatePaymentRequest) => 
      apiClient.post<ApiResponse<Payment>>('/payments', paymentData),
    update: (id: string, paymentData: Partial<Payment>) => 
      apiClient.put<ApiResponse<Payment>>(`/payments/${id}`, paymentData),
    delete: (id: string) => 
      apiClient.delete<ApiResponse<{ message: string }>>(`/payments/${id}`),
    getOutstandingInvoices: (customerId: string) => 
      apiClient.get<ApiResponse<OutstandingInvoice[]>>(`/payments/outstanding/${customerId}`),
  },

  // Distributors endpoints
  distributors: {
    getAll: () => 
      apiClient.get<ApiResponse<Array<{ id: string; name: string }>>>('/distributors/all'),
    getById: (id: string) => apiClient.get<ApiResponse<any>>(`/distributors/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<any>>('/distributors', data),
    update: (id: string, data: any) => apiClient.put<ApiResponse<any>>(`/distributors/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<any>>(`/distributors/${id}`),
  },

  // Settings endpoints
  settings: {
    getDistributorSettings: (distributorId: string) => 
      apiClient.get<ApiResponse<any>>(`/settings/${distributorId}`),
    updateDistributorSettings: (distributorId: string, settings: any) => 
      apiClient.put<ApiResponse<{ message: string }>>(`/settings/${distributorId}`, settings),
    getDefaultDueDateSettings: () => 
      apiClient.get<ApiResponse<any>>('/settings/defaults/due-dates'),
    getCylinderThresholds: (distributorId: string) =>
      apiClient.get<ApiResponse<any>>('/settings/cylinder-thresholds', { params: { distributor_id: distributorId } }),
    updateCylinderThresholds: (distributorId: string, thresholds: Array<{ cylinder_type_id: string; threshold: number }>) =>
      apiClient.post<ApiResponse<any>>('/settings/cylinder-thresholds', { distributor_id: distributorId, thresholds }),
  },

  // Vehicle endpoints
  vehicle: {
    getCancelledStockInVehicles: (distributorId: string) => 
      apiClient.get<ApiResponse<VehicleCancelledStock[]>>(`/vehicles/cancelled-stock/${distributorId}`),
    moveCancelledStockToInventory: (data: { vehicle_id: string; cylinder_type_id: string; quantity: number }) => 
      apiClient.post<ApiResponse<{ message: string; data: any }>>('/vehicles/cancelled-stock/move', data),
    getVehicleInventorySummary: (distributorId: string) => 
      apiClient.get<ApiResponse<VehicleInventorySummary[]>>(`/vehicles/inventory-summary/${distributorId}`),
  },
};

export default apiClient;