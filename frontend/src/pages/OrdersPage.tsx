import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import invoiceService from '../services/invoiceService';
import { useAuth } from '../contexts/AuthContext';
import { fetchInvoiceByOrderId } from '../services/invoiceService';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Order {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_id: string;
  status: string;
  total_amount: number;
  delivery_date: string;
  created_at: string;
  items?: OrderItem[];
  total_quantity?: number;
}

interface OrderItem {
  cylinder_type_id: string;
  name?: string;
  quantity: number;
  delivered_quantity?: number;
  empties_collected?: number;
  order_item_id?: string;
}

interface Customer {
  customer_id: string;
  business_name: string;
}

interface CylinderType {
  cylinder_type_id: string;
  name: string;
  capacity_kg: number;
  description: string;
}

const initialOrderForm = {
  customer_id: '',
  delivery_date: '',
  items: [{ cylinder_type_id: '', quantity: 1 }],
};

export const OrdersPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modal, setModal] = useState<'view' | 'edit' | 'new' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [cylinderTypesLoading, setCylinderTypesLoading] = useState(true);
  const [cylinderTypesError, setCylinderTypesError] = useState('');
  const [orderForm, setOrderForm] = useState<any>({ ...initialOrderForm });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [deliveryInputs, setDeliveryInputs] = useState<any>({});
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  
  // Invoice generation state
  const [invoiceChecks, setInvoiceChecks] = useState<Record<string, { invoice_id: string; status: string } | null>>({});

  const fetchOrdersAndInvoices = async () => {
    setLoading(true);
    try {
      let response;
      if (isSuperAdmin) {
        response = await api.orders.getAll();
      } else {
        response = await api.orders.getAll(distributor_id);
      }
      setOrders(response.data);
      // After orders are fetched, batch check invoices for delivered orders
      const deliveredOrderIds = (response.data || [])
        .filter((order: Order) => isDeliveredStatus(getOrderStatus(order)))
        .map((order: Order) => order.order_id);
      if (deliveredOrderIds.length > 0) {
        const checks = await invoiceService.checkMultipleInvoices(deliveredOrderIds);
        setInvoiceChecks(checks);
      } else {
        setInvoiceChecks({});
      }
    } catch (error) {
      console.error('Error fetching orders or checking invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    fetchOrdersAndInvoices();
  }, [distributor_id, isSuperAdmin]);

  useEffect(() => {
    setCylinderTypesLoading(true);
    setCylinderTypesError('');
    api.customers.getAll().then(res => {
      // Fallback: if customer_id is missing, use business_name as ID
      const customersWithId = (res.data || []).map((c: any) => ({
        customer_id: c.customer_id || c.business_name || '',
        business_name: c.business_name || c.name || '',
      }));
      setCustomers(customersWithId);
    }).catch(() => setCustomers([]));
    // Fetch cylinder types from backend
    api.cylinderTypes.getAll().then(res => {
      setCylinderTypes(res.data || []);
      setCylinderTypesLoading(false);
    }).catch(() => {
      setCylinderTypes([]);
      setCylinderTypesError('Failed to load cylinder types');
      setCylinderTypesLoading(false);
    });
  }, []);

  useEffect(() => {
    console.log("✅ Cylinder Types:", cylinderTypes);
  }, [cylinderTypes]);

  const openDeliveryModal = (order: Order) => {
    const initialInputs: any = {};
    (order.items || []).forEach(item => {
      initialInputs[item.cylinder_type_id] = {
        delivered: item.quantity,
        empties: 0,
      };
    });
    setDeliveryInputs(initialInputs);
    setDeliveryModalOrder(order);
    setShowDeliveryModal(true);
  };

  const handleDeliveryInputChange = (cylinder_type_id: string, field: 'delivered' | 'empties', value: number) => {
    setDeliveryInputs((prev: any) => ({
      ...prev,
      [cylinder_type_id]: {
        ...prev[cylinder_type_id],
        [field]: value,
      },
    }));
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryModalOrder) return;
    setUpdatingId(deliveryModalOrder.order_id);
    // Validate inputs
    let valid = true;
    (deliveryModalOrder.items || []).forEach(item => {
      const inp = deliveryInputs[item.cylinder_type_id];
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
    // Build payload
    const delivered_quantities: any = {};
    const empties_collected: any = {};
    (deliveryModalOrder.items || []).forEach(item => {
      delivered_quantities[item.cylinder_type_id] = parseInt(deliveryInputs[item.cylinder_type_id].delivered, 10);
      empties_collected[item.cylinder_type_id] = parseInt(deliveryInputs[item.cylinder_type_id].empties, 10);
    });
    try {
      await api.orders.changeStatus(
        deliveryModalOrder.order_id,
        'delivered',
        { delivered_quantities, empties_collected }
      );
      // Inventory integration: push delivered/empties to summary with new API format
      // TODO: Replace with real distributor_id from context or auth
      const distributor_id = '11111111-1111-1111-1111-111111111111';
      await api.inventory.updateFromDelivery({
        distributor_id,
        date: deliveryModalOrder.delivery_date?.split('T')[0],
        deliveries: (deliveryModalOrder.items || [])
          .filter(item => !!item.order_item_id)
          .map(item => ({
            order_id: deliveryModalOrder.order_id,
            order_item_id: item.order_item_id, // always a real UUID now
            customer_id: deliveryModalOrder.customer_id,
            cylinder_type_id: item.cylinder_type_id,
            delivered_qty: delivered_quantities[item.cylinder_type_id],
            empties_collected: empties_collected[item.cylinder_type_id],
          }))
      });
      await fetchOrdersAndInvoices();
      setShowDeliveryModal(false);
      setDeliveryModalOrder(null);
    } catch (err) {
      alert('Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelOrder = async (order_id: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setUpdatingId(order_id);
    try {
      await api.orders.changeStatus(order_id, 'cancelled');
      await fetchOrdersAndInvoices();
    } catch (err) {
      alert('Failed to cancel order');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleFormChange = (field: string, value: any) => {
    setOrderForm((prev: any) => ({ ...prev, [field]: value }));
  };
  const handleItemChange = (idx: number, field: string, value: any) => {
    setOrderForm((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any, i: number) => i === idx ? { ...item, [field]: value } : item),
    }));
  };
  const handleAddItem = () => {
    setOrderForm((prev: any) => ({ ...prev, items: [...prev.items, { cylinder_type_id: '', quantity: 1 }] }));
  };
  const handleRemoveItem = (idx: number) => {
    setOrderForm((prev: any) => ({ ...prev, items: prev.items.filter((_: any, i: number) => i !== idx) }));
  };

  const closeModal = () => {
    setModal(null);
    setSelectedOrder(null);
    setOrderForm({ ...initialOrderForm });
    setFormError('');
    setFormSuccess('');
  };

  const handleOrderFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLoading) return; // Prevent double submit
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);
    if (!orderForm.customer_id || !orderForm.delivery_date || !orderForm.items.length || orderForm.items.some((item: any) => !item.cylinder_type_id || !item.quantity)) {
      setFormError('Please fill all required fields.');
      setFormLoading(false);
      return;
    }
    try {
      if (modal === 'new') {
        await api.orders.create({
          customer_id: orderForm.customer_id,
          delivery_date: orderForm.delivery_date,
          items: orderForm.items,
        });
        setFormSuccess('Order placed successfully!');
      } else if (modal === 'edit' && selectedOrder) {
        await api.orders.update(selectedOrder.order_id, {
          customer_id: orderForm.customer_id,
          delivery_date: orderForm.delivery_date,
          items: orderForm.items,
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

  useEffect(() => {
    if (modal === 'edit' && selectedOrder) {
      setOrderForm({
        customer_id: selectedOrder.customer_id,
        delivery_date: selectedOrder.delivery_date ? selectedOrder.delivery_date.split('T')[0] : '',
        items: selectedOrder.items || [{ cylinder_type_id: '', quantity: 1 }],
      });
    } else if (modal === 'new') {
      setOrderForm({ ...initialOrderForm });
    }
  }, [modal, selectedOrder]);

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

  const getOrderStatus = (order: Order) => {
    if (order.status === 'delivered' && order.items && order.items.some(i => typeof i.delivered_quantity === 'number' && i.delivered_quantity !== i.quantity)) {
      return 'modified delivered';
    }
    if (order.status === 'modified delivered') return 'modified delivered';
    return order.status;
  };

  const isDeliveredStatus = (status: string) => status === 'delivered' || status === 'modified delivered';

  // Generate invoice for an order
  const handleGenerateInvoice = async (orderId: string) => {
    try {
      await invoiceService.createFromOrder(orderId);
      alert('Invoice generated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate invoice');
    }
  };

  // Update handleViewInvoice to use new logic and toasts
  const handleViewInvoice = async (order_id: string) => {
    try {
      const invoiceData = await fetchInvoiceByOrderId(order_id);
      // TODO: open modal, viewer, or navigate with invoiceData
      console.log('Fetched invoice:', invoiceData);
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error('❌ Invoice not available for this order');
      } else {
        toast.error('⚠️ Failed to fetch invoice');
        console.error('Fetch invoice error:', err);
      }
    }
  };

  if (cylinderTypesLoading) return <div className="p-8 text-center text-gray-500">Loading cylinder types...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer orders and track delivery status</p>
        </div>
        <div className="flex flex-row flex-wrap gap-4 justify-end items-center w-full sm:w-auto">
        </div>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered</option>
              <option value="modified delivered">Modified Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading orders...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Initial Order Qty</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{order.order_number}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{order.customer_name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        isDeliveredStatus(getOrderStatus(order)) ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        order.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        order.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {getOrderStatus(order)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{order.total_amount !== undefined ? `₹${Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      {Array.isArray(order.items) && order.items.length > 0
                        ? <div className="flex flex-col gap-1">
                            {order.items.map(i => {
                              const ct = cylinderTypes.find(ct => ct.cylinder_type_id === i.cylinder_type_id);
                              return <div key={i.cylinder_type_id}>{ct ? `${ct.capacity_kg}KG × ${i.quantity}` : `Unknown × ${i.quantity}`}</div>;
                            })}
                          </div>
                        : cylinderTypesLoading ? 'Loading...' : '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 font-medium">
                      <div className="flex flex-row flex-nowrap gap-2 items-center min-w-[260px]">
                        {isDeliveredStatus(getOrderStatus(order)) ? (
                          <div className="flex flex-row flex-nowrap gap-2 items-center min-w-[260px]">
                            <button
                              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
                              onClick={() => { setDrawerOrder(order); }}
                            >
                              View
                            </button>
                            
                            {/* Invoice Generation Button */}
                            {(() => {
                              const check = invoiceChecks[order.order_id];
                              
                              if (!check) {
                                return (
                                  <button
                                    className="bg-gray-100 text-gray-500 px-3 py-1 rounded text-xs font-semibold h-8 flex items-center justify-center min-w-[70px] opacity-50 cursor-not-allowed"
                                    disabled
                                    title="Invoice not generated"
                                  >
                                    Invoice
                                  </button>
                                );
                              }
                              
                              if (check.can_generate) {
                                return (
                                  <button
                                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold hover:bg-blue-200 h-8 flex items-center justify-center min-w-[70px]"
                                    onClick={() => handleGenerateInvoice(order.order_id)}
                                  >
                                    Invoice
                                  </button>
                                );
                              }
                              
                              if (check.existing_invoice) {
                                return (
                                  <button
                                    className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-semibold h-8 flex items-center justify-center min-w-[70px]"
                                    title="Invoice already exists"
                                  >
                                    Invoiced
                                  </button>
                                );
                              }
                              
                              return (
                                <button
                                  className="bg-gray-100 text-gray-500 px-3 py-1 rounded text-xs font-semibold h-8 flex items-center justify-center min-w-[70px] opacity-50 cursor-not-allowed"
                                  disabled
                                  title={check.message}
                                >
                                  Invoice
                                </button>
                              );
                            })()}
                          </div>
                        ) : (
                          <>
                            <button
                              className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-semibold hover:bg-gray-200 h-8 flex items-center justify-center min-w-[70px]"
                              onClick={() => { setDrawerOrder(order); }}
                            >
                              Edit
                            </button>
                            <button
                              className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-200 h-8 flex items-center justify-center min-w-[70px]"
                              disabled={updatingId === order.order_id}
                              onClick={() => openDeliveryModal(order)}
                            >
                              {updatingId === order.order_id ? 'Saving...' : 'Delivered'}
                            </button>
                            <button
                              className={`bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-200 h-8 flex items-center justify-center min-w-[70px] ${updatingId === order.order_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={updatingId === order.order_id}
                              title={'Cancel this order'}
                              onClick={() => handleCancelOrder(order.order_id)}
                            >
                              {updatingId === order.order_id ? 'Cancelling...' : 'Cancel'}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={closeModal}
              aria-label="Close"
            >
              &times;
            </button>
            {(modal === 'new' || (modal === 'edit' && selectedOrder)) && (
              <>
                <h2 className="text-xl font-bold mb-4 text-gray-900">{modal === 'new' ? 'Create New Order' : 'Edit Order'}</h2>
                <form onSubmit={handleOrderFormSubmit} className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">Customer</label>
                    <select
                      className="input-field"
                      value={orderForm.customer_id}
                      onChange={e => handleFormChange('customer_id', e.target.value)}
                      required
                    >
                      <option value="">Select customer...</option>
                      {customers.map(c => (
                        <option key={c.customer_id} value={c.customer_id}>{c.business_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Delivery Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={orderForm.delivery_date}
                      onChange={e => handleFormChange('delivery_date', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Cylinder Types & Quantities</label>
                    {orderForm.items.length === 0 && (
                      <div className="text-gray-400 italic">Add at least one cylinder type</div>
                    )}
                    {orderForm.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                        <select
                          className="input-field"
                          value={item.cylinder_type_id}
                          onChange={e => handleItemChange(idx, 'cylinder_type_id', e.target.value)}
                          required
                          disabled={cylinderTypesLoading || cylinderTypes.length === 0}
                        >
                          <option value="">{cylinderTypesLoading ? 'Loading types...' : cylinderTypesError ? 'Failed to load types' : 'Select type...'}</option>
                          {cylinderTypes.map(ct => (
                            <option key={ct.cylinder_type_id} value={ct.cylinder_type_id}>{ct.name} ({ct.capacity_kg}kg)</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          className="input-field w-24"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          required
                        />
                        {orderForm.items.length > 1 && (
                          <button type="button" className="text-red-500 font-bold text-lg" onClick={() => handleRemoveItem(idx)}>&times;</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn-secondary mt-2" onClick={handleAddItem}>+ Add Cylinder Type</button>
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
            {modal === 'view' && selectedOrder && (
              <>
                <h2 className="text-xl font-bold mb-4 text-gray-900">Order Details</h2>
                <div className="mb-2"><strong>Order #:</strong> {selectedOrder.order_number}</div>
                <div className="mb-2"><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                <div className="mb-2"><strong>Status:</strong> {selectedOrder.status}</div>
                <div className="mb-2"><strong>Amount:</strong> ${selectedOrder.total_amount}</div>
                <div className="mb-2"><strong>Delivery Date:</strong> {selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString() : '-'}</div>
                <div className="mb-2"><strong>Created At:</strong> {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '-'}</div>
                <div className="mb-2"><strong>Items:</strong>
                  <ul className="list-disc ml-6">
                    {selectedOrder.items && selectedOrder.items.map((item, idx) => {
                      const ct = cylinderTypes.find(ct => ct.cylinder_type_id === item.cylinder_type_id);
                      return (
                        <li key={idx}>
                          {ct ? `${ct.name} (${ct.capacity_kg}kg)` : item.cylinder_type_id} × {item.quantity}
                          {typeof item.delivered_quantity === 'number' && (
                            <span className="ml-2 text-xs text-blue-600">Delivered: {item.delivered_quantity}</span>
                          )}
                          {typeof item.empties_collected === 'number' && (
                            <span className="ml-2 text-xs text-green-600">Empties Collected: {item.empties_collected}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
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
                {(deliveryModalOrder.items || []).map(item => {
                  const ct = cylinderTypes.find(ct => ct.cylinder_type_id === item.cylinder_type_id);
                  return (
                    <tr key={item.cylinder_type_id}>
                      <td className="px-2 py-1">{ct ? `${ct.name} (${ct.capacity_kg}kg)` : item.cylinder_type_id}</td>
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
                      {ct ? `${ct.capacity_kg}KG` : item.cylinder_type_id} × {item.quantity}
                      {isModified && (
                        <span className="ml-2 text-xs text-blue-600">Delivered: {item.delivered_quantity}</span>
                      )}
                      {typeof item.empties_collected === 'number' && (
                        <span className="ml-2 text-xs text-green-600">Empties Collected: {item.empties_collected}</span>
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
                  Delivered
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