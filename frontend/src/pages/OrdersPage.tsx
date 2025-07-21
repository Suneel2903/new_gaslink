import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../services/apiClient';
import invoiceService from '../services/invoiceService';
import { useAuth } from '../contexts/AuthContext';
import { orderSchema, type OrderFormData } from '../schemas/orderSchema';
import { editOrderSchema, type EditOrderFormData } from '../schemas/editOrderSchema';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import useEscKey from '../hooks/useEscKey';
import 'react-toastify/dist/ReactToastify.css';
import type { 
  ApiError, 
  Order, 
  Customer, 
  CylinderType, 
  OrderStatusChangeRequest,
} from '../types';
import EmptyState from '../components/EmptyState';
import { useDebug } from '../contexts/DebugContext';

interface DeliveryInputs {
  [cylinder_type_id: string]: {
    delivered: number;
    empties: number;
  };
}

interface SimpleCustomer {
  customer_id: string;
  business_name: string;
}

interface SearchFilters {
  customer: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const initialOrderForm: OrderFormData = {
  customer_id: '',
  delivery_date: '',
  items: [{ cylinder_type_id: '', quantity: 1 }],
};

export const OrdersPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const debug = useDebug();
  
  console.log('Current distributor_id in OrdersPage:', distributor_id, 'isSuperAdmin:', isSuperAdmin);

  // Restore form setup and hooks
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: initialOrderForm,
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    control: controlEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: initialOrderForm,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const { fields: editFields, append: appendEdit, remove: removeEdit } = useFieldArray({
    control: controlEdit,
    name: 'items',
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modal, setModal] = useState<'view' | 'edit' | 'new' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<SimpleCustomer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [cylinderTypesLoading, setCylinderTypesLoading] = useState(true);
  const [cylinderTypesError, setCylinderTypesError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [deliveryInputs, setDeliveryInputs] = useState<DeliveryInputs>({});
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  
  // Invoice generation state
  const [invoiceChecks, setInvoiceChecks] = useState<Record<string, { 
    invoice_id: string; 
    status: string; 
    can_generate?: boolean;
    existing_invoice?: boolean;
    message?: string;
  } | null>>({});

  // New search panel state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    customer: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    customer: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // UI state for enhancements - removed old customerFilter as it's now part of searchFilters

  const fetchOrdersAndInvoices = async () => {
    console.log('fetchOrdersAndInvoices CALLED');
    setLoading(true);
    try {
      console.log('Fetching orders from API... distributor_id:', distributor_id);
      let response = await api.orders.getAll(distributor_id || undefined);
      console.log('Orders API response:', response);
      setOrders(response.data?.data || response.data || []);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching orders or checking invoices:', apiError);
    } finally {
      setLoading(false);
      console.log('Set loading to false in OrdersPage');
    }
  };

  useEffect(() => {
    if (isSuperAdmin && !distributor_id) {
      setLoading(false);
      return;
    }
    fetchOrdersAndInvoices();
  }, [distributor_id, isSuperAdmin]);

  useEffect(() => {
    debug.log(`Fetching customers for distributor_id: ${distributor_id}, isSuperAdmin: ${isSuperAdmin}`);
    setCylinderTypesLoading(true);
    setCylinderTypesError('');
    api.customers.getAll(distributor_id || undefined).then(res => {
      // Accepts both array and { data: array } formats
      const raw = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      const customersWithId = raw.map((c: Customer) => ({
        customer_id: c.customer_id || c.business_name || '',
        business_name: c.business_name || '',
      }));
      debug.log(`Fetched customers: ${JSON.stringify(customersWithId)}`);
      setCustomers(customersWithId);
    }).catch((error) => {
      debug.log(`❌ Error fetching customers: ${error?.message || error}`);
      setCustomers([]);
    });
    // Fetch cylinder types from backend
    api.cylinderTypes.getAll(distributor_id || undefined).then(res => {
      // Accepts both array and { data: array } formats
      const raw = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      // Map to ensure name/capacity fields are present
      const mapped = raw.map((ct: any) => ({
        ...ct,
        name: ct.name,
        capacity: ct.capacity_kg,
      }));
      setCylinderTypes(mapped);
      setCylinderTypesLoading(false);
    }).catch((error) => {
      console.error('❌ Error fetching cylinder types:', error);
      setCylinderTypes([]);
      setCylinderTypesError('Failed to load cylinder types');
      setCylinderTypesLoading(false);
    });
  }, [distributor_id, isSuperAdmin]);

  const openDeliveryModal = (order: Order) => {
    const initialInputs: DeliveryInputs = {};
    (order.items ?? []).forEach(item => {
      initialInputs[item.cylinder_type_id] = {
        delivered: item.delivered_quantity !== null && item.delivered_quantity !== undefined ? item.delivered_quantity : item.quantity,
        empties: item.empties_collected || 0,
      };
    });
    setDeliveryInputs(initialInputs);
    setDeliveryModalOrder(order);
    setShowDeliveryModal(true);
  };

  const handleDeliveryInputChange = (cylinder_type_id: string, field: 'delivered' | 'empties', value: number) => {
    setDeliveryInputs((prev: DeliveryInputs) => ({
      ...prev,
      [cylinder_type_id]: {
        delivered: field === 'delivered' ? value : (prev[cylinder_type_id]?.delivered || 0),
        empties: field === 'empties' ? value : (prev[cylinder_type_id]?.empties || 0),
      },
    }));
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryModalOrder) return;
    setUpdatingId(deliveryModalOrder.order_id);
    // Validate inputs
    let valid = true;
    (deliveryModalOrder.items ?? []).forEach(item => {
      const inp = deliveryInputs[item.cylinder_type_id];
      if (!inp) {
        valid = false;
        return;
      }
      // Only allow integers, no floats, no leading zeros
      if (
        !Number.isInteger(Number(inp.delivered)) ||
        !Number.isInteger(Number(inp.empties)) ||
        inp.delivered < 0 ||
        inp.empties < 0
      ) valid = false;
    });
    if (!valid) {
      alert('Please enter valid delivered and empties values.');
      setUpdatingId(null);
      return;
    }
    // Build payload for deliveries array
    const deliveries = (deliveryModalOrder.items ?? []).map(item => ({
      order_id: deliveryModalOrder.order_id,
      order_item_id: item.order_item_id,
      customer_id: deliveryModalOrder.customer_id,
      cylinder_type_id: item.cylinder_type_id,
      delivered_qty: Number(deliveryInputs[item.cylinder_type_id]?.delivered ?? 0),
      empties_collected: Number(deliveryInputs[item.cylinder_type_id]?.empties ?? 0)
    }));
    try {
      await api.orders.changeStatus(
        deliveryModalOrder.order_id,
        'delivered',
        {
          status: 'delivered',
          delivered_quantities: deliveries.reduce<Record<string, number>>((acc, d) => { acc[d.cylinder_type_id] = d.delivered_qty; return acc; }, {}),
          empties_collected: deliveries.reduce<Record<string, number>>((acc, d) => { acc[d.cylinder_type_id] = d.empties_collected; return acc; }, {})
        }
      );
      // Inventory integration: push delivered/empties to summary with new API format
      await api.inventory.updateFromDelivery({
        distributor_id,
        date: deliveryModalOrder.delivery_date.split('T')[0],
        deliveries
      } as any);
      setShowDeliveryModal(false);
      setDeliveryModalOrder(null);
      fetchOrdersAndInvoices();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      alert(apiError.message || 'Failed to confirm delivery');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelOrder = async (order_id: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setUpdatingId(order_id);
    try {
      await api.orders.changeStatus(order_id, 'cancelled', { status: 'cancelled' } as OrderStatusChangeRequest);
      fetchOrdersAndInvoices();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      alert(apiError.message || 'Failed to cancel order');
    } finally {
      setUpdatingId(null);
    }
  };

  const closeModal = () => {
    setModal(null);
    setSelectedOrder(null);
    reset(initialOrderForm);
    resetEdit(initialOrderForm);
    setFormError('');
    setFormSuccess('');
  };

  const onSubmit = async (data: OrderFormData) => {
    if (formLoading) return; // Prevent double submit
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);
    
    try {
      if (modal === 'new') {
        await api.orders.create({
          distributor_id: distributor_id || '',
          customer_id: data.customer_id,
          delivery_date: data.delivery_date,
          items: data.items,
        });
        setFormSuccess('Order placed successfully!');
      } else if (modal === 'edit' && selectedOrder) {
        await api.orders.update(selectedOrder.order_id, {
          delivery_date: data.delivery_date,
          items: data.items,
        });
        setFormSuccess('Order updated successfully!');
      }
      await fetchOrdersAndInvoices();
      closeModal(); // Close modal immediately on success
    } catch (err) {
      setFormError('Failed to save order');
    } finally {
      setFormLoading(false);
    }
  };

  const onSubmitEdit = async (data: EditOrderFormData) => {
    if (formLoading) return; // Prevent double submit
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);
    
    try {
      if (selectedOrder) {
        await api.orders.update(selectedOrder.order_id, {
          delivery_date: data.delivery_date,
          items: data.items
        });
        setFormSuccess('Order updated successfully!');
        await fetchOrdersAndInvoices();
        closeModal(); // Close modal immediately on success
      }
    } catch (err) {
      setFormError('Failed to update order');
    } finally {
      setFormLoading(false);
    }
  };

  useEffect(() => {
    if (modal === 'edit' && selectedOrder) {
      resetEdit({
        customer_id: selectedOrder.customer_id,
        delivery_date: selectedOrder.delivery_date?.split('T')[0] || '',
        items: selectedOrder.items ?? [{ cylinder_type_id: '', quantity: 1 }],
      });
    } else if (modal === 'new') {
      reset(initialOrderForm);
    }
  }, [modal, selectedOrder, reset, resetEdit]);

  useEffect(() => {
    const handleOpenNewOrderModal = () => {
      setModal('new');
      setSelectedOrder(null);
    };
    window.addEventListener('open-new-order-modal', handleOpenNewOrderModal);
    return () => {
      window.removeEventListener('open-new-order-modal', handleOpenNewOrderModal);
    };
  }, []);

  useEffect(() => {
    if (modal === 'new') {
      debug.log(`Add Order modal opened. distributor_id: ${distributor_id}, isSuperAdmin: ${isSuperAdmin}`);
      debug.log(`Customers array: ${JSON.stringify(customers)}`);
    }
  }, [modal, distributor_id, customers, isSuperAdmin]);

  const getOrderStatus = (order: Order) => {
    if (order.status === 'delivered' && order.items && order.items.some(i => typeof i.delivered_quantity === 'number' && i.delivered_quantity !== i.quantity)) {
      return 'modified delivered';
    }
    if (order.status === 'modified delivered') return 'modified delivered';
    return order.status;
  };

  const isDeliveredStatus = (status: string) => status === 'delivered' || status === 'modified delivered';
  const isUndeliveredStatus = (status: string) => status === 'pending' || status === 'processing';

  // TODO: Implement invoice viewing functionality

  // New search panel handlers
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setAppliedFilters({ ...searchFilters });
    }
  };

  const handleFilterChange = (field: keyof SearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchSubmit = () => {
    setAppliedFilters({ ...searchFilters });
  };

  const clearFilters = () => {
    const clearedFilters = {
      customer: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    };
    setSearchFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
  };

  const hasActiveFilters = () => {
    return appliedFilters.customer || 
           appliedFilters.status !== 'all' || 
           appliedFilters.dateFrom || 
           appliedFilters.dateTo || 
           appliedFilters.searchTerm;
  };

  // ESC key handler to close modals
  useEscKey({
    onEsc: () => {
      if (modal) {
        closeModal();
      }
      if (showDeliveryModal) {
        setShowDeliveryModal(false);
      }
      if (drawerOrder) {
        setDrawerOrder(null);
      }
    },
    isActive: Boolean(modal || showDeliveryModal || drawerOrder)
  });

  if (cylinderTypesLoading) return <div className="p-8 text-center text-gray-500">Loading cylinder types...</div>;

  console.log("orders before filter:", orders);
  // Filtered orders with new search panel
  const filteredOrders = (orders ?? []).filter(order => {
    const matchesSearch = !appliedFilters.searchTerm || 
      order.order_number?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase());
    
    const matchesStatus = appliedFilters.status === 'all' || getOrderStatus(order) === appliedFilters.status;
    
    const matchesCustomer = !appliedFilters.customer || order.customer_id === appliedFilters.customer;
    
    const matchesDateFrom = !appliedFilters.dateFrom || 
      (order.delivery_date && new Date(order.delivery_date) >= new Date(appliedFilters.dateFrom));
    
    const matchesDateTo = !appliedFilters.dateTo || 
      (order.delivery_date && new Date(order.delivery_date) <= new Date(appliedFilters.dateTo));
    
    return matchesSearch && matchesStatus && matchesCustomer && matchesDateFrom && matchesDateTo;
  });
  console.log("orders before map:", filteredOrders);

  // Defensive UI checks
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card">
          <div className="p-8 text-center text-gray-500">Loading orders...</div>
        </div>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">Something went wrong loading orders</div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card">
          <EmptyState message="No orders found." />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none mx-auto">
      <div className="mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer orders and track delivery status</p>
        </div>
        <div className="flex flex-row flex-wrap gap-4 justify-end items-center w-full sm:w-auto">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
            onClick={() => setModal('new')}
          >
            + Add Order
          </button>
        </div>
      </div>

      {/* New Search Panel */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search & Filters</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showSearchPanel ? 'Hide' : 'Show'} Advanced
            </button>
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Basic Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer
            </label>
            <select
              value={searchFilters.customer}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={searchFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered</option>
              <option value="modified delivered">Modified Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Orders
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by order # or customer name..."
                value={searchFilters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearchSubmit}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Search Panel */}
        {showSearchPanel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery Date From
              </label>
              <input
                type="date"
                value={searchFilters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery Date To
              </label>
              <input
                type="date"
                value={searchFilters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Search Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSearchSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            Search Orders
          </button>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              {appliedFilters.customer && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Customer: {customers.find(c => c.customer_id === appliedFilters.customer)?.business_name}
                  <button
                    onClick={() => handleFilterChange('customer', '')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {appliedFilters.status !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Status: {appliedFilters.status}
                  <button
                    onClick={() => handleFilterChange('status', 'all')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {appliedFilters.searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Search: {appliedFilters.searchTerm}
                  <button
                    onClick={() => handleFilterChange('searchTerm', '')}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  Date: {appliedFilters.dateFrom || 'Any'} - {appliedFilters.dateTo || 'Any'}
                  <button
                    onClick={() => {
                      handleFilterChange('dateFrom', '');
                      handleFilterChange('dateTo', '');
                    }}
                    className="ml-1 text-yellow-600 hover:text-yellow-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters() ? 'No orders match your search criteria.' : 'No orders found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Initial Order Qty</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {(filteredOrders ?? []).map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">{order.order_number}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{order.customer_name}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        isDeliveredStatus(getOrderStatus(order)) ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        order.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        order.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {getOrderStatus(order)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{order.total_amount !== undefined ? `₹${Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                      {Array.isArray(order.items) && order.items.length > 0
                        ? <div className="flex flex-col gap-1 items-center">
                            {order.items.map(i => {
                              const ct = cylinderTypes.find(ct => ct.cylinder_type_id === i.cylinder_type_id);
                              return <div key={i.cylinder_type_id}>{ct ? `${ct.name} × ${i.quantity}` : `Unknown × ${i.quantity}`}</div>;
                            })}
                          </div>
                        : cylinderTypesLoading ? 'Loading...' : '-'}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-center font-medium">
                      <div className="flex flex-row flex-nowrap gap-2 items-center justify-center min-w-[260px]">
                        <button
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold hover:bg-blue-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => { setDrawerOrder(order); }}
                        >
                          View
                        </button>
                        {isUndeliveredStatus(getOrderStatus(order)) && (
                          <button
                            className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-200 h-8 flex items-center justify-center min-w-[70px]"
                            onClick={() => openDeliveryModal(order)}
                          >
                            Mark Delivery
                          </button>
                        )}
                        {!isDeliveredStatus(getOrderStatus(order)) && (
                          <>
                            <button
                              className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-xs font-semibold hover:bg-yellow-200 h-8 flex items-center justify-center min-w-[70px]"
                              onClick={() => {
                                setSelectedOrder(order);
                                setModal('edit');
                              }}
                              disabled={order.status === 'cancelled'}
                            >
                              Edit
                            </button>
                            <button
                              className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-200 h-8 flex items-center justify-center min-w-[70px]"
                              onClick={() => handleCancelOrder(order.order_id)}
                              disabled={order.status === 'cancelled'}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={closeModal}
              aria-label="Close"
            >
              &times;
            </button>
            {modal === 'new' && (
              <>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Order</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <FormSelect
                    label="Customer"
                    options={[
                      { value: '', label: 'Select customer...' },
                      ...customers.map(c => ({ value: c.customer_id, label: c.business_name }))
                    ]}
                    error={errors.customer_id}
                    {...register('customer_id')}
                  />
                  <FormInput
                    label="Delivery Date"
                    type="date"
                    error={errors.delivery_date}
                    {...register('delivery_date')}
                  />
                  <div>
                    <label className="block font-medium mb-1">Cylinder Types & Quantities</label>
                    {fields.length === 0 && (
                      <div className="text-gray-400 italic">Add at least one cylinder type</div>
                    )}
                    {fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 mb-2 items-center flex-wrap">
                        <FormSelect
                          label=""
                          options={[
                            { value: '', label: cylinderTypesLoading ? 'Loading types...' : cylinderTypesError ? 'Failed to load types' : 'Select type...' },
                            ...cylinderTypes.map(ct => ({ value: ct.cylinder_type_id, label: `${ct.name} (${ct.capacity}kg)` }))
                          ]}
                          error={errors.items?.[idx]?.cylinder_type_id}
                          disabled={cylinderTypesLoading || cylinderTypes.length === 0}
                          {...register(`items.${idx}.cylinder_type_id`)}
                        />
                        <FormInput
                          label=""
                          type="number"
                          min={1}
                          className="w-24"
                          error={errors.items?.[idx]?.quantity}
                          {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                        />
                        {fields.length > 1 && (
                          <button type="button" className="text-red-500 font-bold text-lg" onClick={() => remove(idx)}>&times;</button>
                        )}
                        {errors.items?.[idx]?.cylinder_type_id && (
                          <p className="w-full text-sm text-red-600 dark:text-red-400">{errors.items[idx]?.cylinder_type_id?.message}</p>
                        )}
                        {errors.items?.[idx]?.quantity && (
                          <p className="w-full text-sm text-red-600 dark:text-red-400">{errors.items[idx]?.quantity?.message}</p>
                        )}
                      </div>
                    ))}
                    {errors.items && (
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.items.message}</p>
                    )}
                    <button type="button" className="btn-secondary mt-2" onClick={() => append({ cylinder_type_id: '', quantity: 1 })}>+ Add Cylinder Type</button>
                  </div>
                  {formError && <div className="text-red-500 text-center mb-2">{formError}</div>}
                  {formSuccess && <div className="text-green-600 text-center mb-2">{formSuccess}</div>}
                  <div className="flex justify-end gap-2 mt-4">
                    <button type="button" className="btn-secondary" onClick={closeModal} disabled={formLoading}>Cancel</button>
                    <button type="submit" className="btn-primary flex items-center" disabled={formLoading || cylinderTypesLoading || cylinderTypes.length === 0}>
                      {formLoading && <span className="loader mr-2"></span>}
                      {formLoading ? 'Saving...' : 'Save Order'}
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === 'edit' && selectedOrder && (
              <>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Order</h2>
                <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">Customer</label>
                    <div className="input-field bg-gray-100 text-gray-600">
                      {selectedOrder.customer_name}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Customer cannot be changed for existing orders</p>
                  </div>
                  <FormInput
                    label="Delivery Date"
                    type="date"
                    error={editErrors.delivery_date}
                    {...registerEdit('delivery_date')}
                  />
                  <div>
                    <label className="block font-medium mb-1">Cylinder Types & Quantities</label>
                    {editFields.length === 0 && (
                      <div className="text-gray-400 italic">Add at least one cylinder type</div>
                    )}
                    {editFields.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 mb-2 items-center flex-wrap">
                        <FormSelect
                          label=""
                          options={[
                            { value: '', label: cylinderTypesLoading ? 'Loading types...' : cylinderTypesError ? 'Failed to load types' : 'Select type...' },
                            ...cylinderTypes.map(ct => ({ value: ct.cylinder_type_id, label: `${ct.name} (${ct.capacity}kg)` }))
                          ]}
                          error={editErrors.items?.[idx]?.cylinder_type_id}
                          disabled={cylinderTypesLoading || cylinderTypes.length === 0}
                          {...registerEdit(`items.${idx}.cylinder_type_id`)}
                        />
                        <FormInput
                          label=""
                          type="number"
                          min={1}
                          className="w-24"
                          error={editErrors.items?.[idx]?.quantity}
                          {...registerEdit(`items.${idx}.quantity`, { valueAsNumber: true })}
                        />
                        {editFields.length > 1 && (
                          <button type="button" className="text-red-500 font-bold text-lg" onClick={() => removeEdit(idx)}>&times;</button>
                        )}
                      </div>
                    ))}
                    {editErrors.items && (
                      <p className="text-sm text-red-600 dark:text-red-400">{editErrors.items.message}</p>
                    )}
                    <button type="button" className="btn-secondary mt-2" onClick={() => appendEdit({ cylinder_type_id: '', quantity: 1 })}>+ Add Cylinder Type</button>
                  </div>
                  {formError && <div className="text-red-500 text-center mb-2">{formError}</div>}
                  {formSuccess && <div className="text-green-600 text-center mb-2">{formSuccess}</div>}
                  <div className="flex justify-end gap-2 mt-4">
                    <button type="button" className="btn-secondary" onClick={closeModal} disabled={formLoading}>Cancel</button>
                    <button type="submit" className="btn-primary flex items-center" disabled={formLoading || cylinderTypesLoading || cylinderTypes.length === 0}>
                      {formLoading && <span className="loader mr-2"></span>}
                      {formLoading ? 'Saving...' : 'Update Order'}
                    </button>
                  </div>
                </form>
              </>
            )}
            {modal === 'view' && selectedOrder && (
              <>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Order Details</h2>
                <div className="mb-2"><strong>Order #:</strong> {selectedOrder.order_number}</div>
                <div className="mb-2"><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                <div className="mb-2"><strong>Status:</strong> {selectedOrder.status}</div>
                <div className="mb-2"><strong>Amount:</strong> ₹{Number(selectedOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="mb-2"><strong>Delivery Date:</strong> {selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : '-'}</div>
                <div className="mb-2"><strong>Created At:</strong> {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '-'}</div>
                <div className="mb-2"><strong>Items:</strong>
                  <ul className="list-disc ml-6">
                    {selectedOrder.items && selectedOrder.items.map((item, idx) => {
                      const ct = cylinderTypes.find(ct => ct.cylinder_type_id === item.cylinder_type_id);
                      return (
                        <li key={idx}>
                          {ct ? [ct.name ? ct.name : '', ct.capacity ? `(${ct.capacity}kg)` : ''].filter(Boolean).join(' ') : item.cylinder_type_id} × {item.quantity}
                          {typeof item.delivered_quantity === 'number' && (
                            <span className="ml-2 text-xs text-blue-600">Delivered: {item.delivered_quantity}</span>
                          )}
                          {typeof item.empties_collected === 'number' && (
                            <span className="ml-2 text-xs text-gray-600">Empties Collected: {item.empties_collected}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <button
                  className={`bg-red-100 text-red-700 px-4 py-2 rounded font-semibold mt-4 ${selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-200'}`}
                  disabled={selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled'}
                  title={selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled' ? 'Cannot cancel delivered or cancelled orders' : 'Cancel this order'}
                  onClick={() => handleCancelOrder(selectedOrder.order_id)}
                >
                  Cancel Order
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showDeliveryModal && deliveryModalOrder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeliveryModal(false);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setShowDeliveryModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Confirm Delivery</h2>
            <div className="mb-4">
              <strong>Order #:</strong> {deliveryModalOrder.order_number}<br />
              <strong>Customer:</strong> {deliveryModalOrder.customer_name}
            </div>
            <table className="min-w-full text-sm mb-4">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Cylinder Type</th>
                  <th className="px-2 py-1 text-left">Ordered</th>
                  <th className="px-2 py-1 text-left">Delivered</th>
                  <th className="px-2 py-1 text-left">Empties Collected</th>
                </tr>
              </thead>
              <tbody>
                {(deliveryModalOrder.items ?? []).map(item => {
                  const ct = cylinderTypes.find(ct => ct.cylinder_type_id === item.cylinder_type_id);
                  return (
                    <tr key={item.cylinder_type_id}>
                      <td className="px-2 py-1">{ct ? [ct.name ? ct.name : '', ct.capacity ? `(${ct.capacity}kg)` : ''].filter(Boolean).join(' ') : item.cylinder_type_id}</td>
                      <td className="px-2 py-1">{item.quantity}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          max={item.quantity}
                          value={deliveryInputs[item.cylinder_type_id]?.delivered ?? item.quantity}
                          onChange={e => handleDeliveryInputChange(item.cylinder_type_id, 'delivered', Number(e.target.value))}
                          className="input-field w-20"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={deliveryInputs[item.cylinder_type_id]?.empties ?? 0}
                          onChange={e => handleDeliveryInputChange(item.cylinder_type_id, 'empties', Number(e.target.value))}
                          className="input-field w-20"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShowDeliveryModal(false)} disabled={updatingId === deliveryModalOrder.order_id}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmDelivery} disabled={updatingId === deliveryModalOrder.order_id}>
                {updatingId === deliveryModalOrder.order_id ? 'Saving...' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black bg-opacity-30" onClick={() => setDrawerOrder(null)}>
          <div className="bg-white shadow-lg w-full max-w-md h-full overflow-y-auto p-6 relative animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setDrawerOrder(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Order Details</h2>
            <div className="mb-2"><strong>Order #:</strong> {drawerOrder.order_number}</div>
            <div className="mb-2"><strong>Customer:</strong> {drawerOrder.customer_name}</div>
            <div className="mb-2"><strong>Status:</strong> {getOrderStatus(drawerOrder)}</div>
            <div className="mb-2"><strong>Delivery Date:</strong> {drawerOrder.delivery_date ? new Date(drawerOrder.delivery_date).toLocaleDateString() : '-'}</div>
            <div className="mb-2"><strong>Created At:</strong> {drawerOrder.created_at ? new Date(drawerOrder.created_at).toLocaleString() : '-'}</div>
            <div className="mb-2"><strong>Items:</strong>
              <ul className="list-disc ml-6">
                {drawerOrder.items && drawerOrder.items.map((item, idx) => {
                  const ct = cylinderTypes.find(ct => ct.cylinder_type_id === item.cylinder_type_id);
                  const isModified = typeof item.delivered_quantity === 'number' && item.delivered_quantity !== item.quantity;
                  return (
                    <li key={idx}>
                      {ct ? [ct.name ? ct.name : '', ct.capacity ? `(${ct.capacity}kg)` : ''].filter(Boolean).join(' ') : item.cylinder_type_id} × {item.quantity}
                      {isModified && (
                        <span className="ml-2 text-xs text-blue-600">Delivered: {item.delivered_quantity}</span>
                      )}
                      {typeof item.empties_collected === 'number' && (
                        <span className="ml-2 text-xs text-gray-600">Empties Collected: {item.empties_collected}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mb-2"><strong>Total Amount:</strong> {drawerOrder.total_amount !== undefined ? `₹${Number(drawerOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}</div>
            {!isDeliveredStatus(getOrderStatus(drawerOrder)) && (
              <div className="flex gap-2 mt-4">
                <button
                  className="bg-red-100 text-red-700 px-3 py-1 rounded font-semibold"
                  disabled={drawerOrder.status === 'delivered' || drawerOrder.status === 'cancelled'}
                  onClick={() => { setDrawerOrder(null); handleCancelOrder(drawerOrder.order_id); }}
                >
                  Cancel
                </button>
                <button
                  className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold hover:bg-green-200"
                  onClick={() => { setDrawerOrder(null); openDeliveryModal(drawerOrder); }}
                >
                  Mark Delivery
                </button>
                <button
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                  onClick={() => { setDrawerOrder(null); setModal('edit'); setSelectedOrder(drawerOrder); }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 