import React, { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

interface Customer {
  customer_id: string;
  customer_code: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: string;
  stop_supply: boolean;
  stop_supply_reason?: string;
  created_at: string;
  preferred_driver?: string; // Placeholder for now
}

interface ModificationRequest {
  request_id: string;
  customer_id: string;
  requested_by: string;
  field: string;
  old_value: string;
  new_value: string;
  status: string;
  created_at: string;
}

const initialForm = {
  customer_code: '',
  business_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Nigeria',
  credit_limit: '',
  credit_period_days: '',
  payment_terms: '',
  discount: '',
};

export const CustomersPage: React.FC = () => {
  const { distributor_id, isSuperAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverSuccess, setDriverSuccess] = useState(false);
  const [stopSupply, setStopSupply] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [savingStop, setSavingStop] = useState(false);
  const [stopSuccess, setStopSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'customers' | 'modification'>('customers');
  const [modRequests, setModRequests] = useState<ModificationRequest[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [modError, setModError] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (isSuperAdmin) {
        res = await api.customers.getAll();
      } else if (distributor_id) {
        res = await api.customers.getAll(distributor_id);
      } else {
        setLoading(false);
        return;
      }
      setCustomers(res.data);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchModificationRequests = async () => {
    setModLoading(true);
    setModError('');
    try {
      const res = await api.customers.getModificationRequests();
      setModRequests(res.data);
    } catch (err: any) {
      setModError('Failed to load modification requests');
    } finally {
      setModLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin && !distributor_id) return;
    fetchCustomers();
  }, [distributor_id, isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'modification') fetchModificationRequests();
  }, [activeTab]);

  const filtered = customers.filter(c =>
    c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_code?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    // Basic validation
    if (!form.customer_code || !form.contact_person || !form.phone || !form.address_line1 || !form.city || !form.state) {
      setFormError('Please fill all required fields.');
      setSubmitting(false);
      return;
    }
    try {
      await api.customers.create({
        ...form,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : 0,
        credit_period_days: form.credit_period_days ? Number(form.credit_period_days) : 30,
        discount: form.discount ? Number(form.discount) : 0,
      });
      setShowAdd(false);
      setForm({ ...initialForm });
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add customer');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditId(customer.customer_id);
    setEditForm({
      customer_code: customer.customer_code || '',
      business_name: customer.business_name || '',
      contact_person: customer.contact_person || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: (customer as any).address_line1 || '',
      address_line2: (customer as any).address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: (customer as any).postal_code || '',
      country: (customer as any).country || 'Nigeria',
      credit_limit: (customer as any).credit_limit?.toString() || '',
      credit_period_days: (customer as any).credit_period_days?.toString() || '',
      payment_terms: (customer as any).payment_terms || '',
      discount: (customer as any).discount?.toString() || '',
    });
    setEditError('');
    setShowEdit(true);
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditSubmitting(true);
    if (!editForm.customer_code || !editForm.contact_person || !editForm.phone || !editForm.address_line1 || !editForm.city || !editForm.state) {
      setEditError('Please fill all required fields.');
      setEditSubmitting(false);
      return;
    }
    try {
      // Exclude customer_code and any extra fields from update payload
      const { customer_code, ...updatePayload } = editForm;
      // Remove any extra fields that are not in the backend's fields array
      const allowedFields = [
        'business_name', 'contact_person', 'email', 'phone',
        'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
        'credit_limit', 'credit_period_days', 'payment_terms', 'discount'
      ];
      const cleanPayload: any = {};
      allowedFields.forEach(field => {
        if ((updatePayload as any)[field] !== undefined) cleanPayload[field] = (updatePayload as any)[field];
      });
      await api.customers.update(editId!, {
        ...cleanPayload,
        credit_limit: editForm.credit_limit ? Number(editForm.credit_limit) : 0,
        credit_period_days: editForm.credit_period_days ? Number(editForm.credit_period_days) : 30,
        discount: editForm.discount ? Number(editForm.discount) : 0,
      });
      setShowEdit(false);
      setEditId(null);
      setEditForm({ ...initialForm });
      fetchCustomers();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update customer');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openDetailsModal = (customer: Customer) => {
    setDetailsCustomer(customer);
    setShowDetails(true);
    setSelectedDriver(customer.preferred_driver || '');
    setDriverSuccess(false);
    setStopSupply(customer.stop_supply);
    setStopReason(customer.stop_supply_reason || '');
    setStopSuccess(false);
    api.customers.getDrivers().then(res => setDrivers(res.data));
  };

  const handleSavePreferredDriver = async () => {
    if (!detailsCustomer) return;
    setSavingDriver(true);
    setDriverSuccess(false);
    try {
      await api.customers.setPreferredDriver(detailsCustomer.customer_id, selectedDriver);
      setDriverSuccess(true);
    } finally {
      setSavingDriver(false);
    }
  };

  const handleSaveStopSupply = async () => {
    if (!detailsCustomer) return;
    setSavingStop(true);
    setStopSuccess(false);
    try {
      await api.customers.setStopSupply(detailsCustomer.customer_id, stopSupply, stopSupply ? stopReason : undefined);
      setStopSuccess(true);
    } finally {
      setSavingStop(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!detailsCustomer) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.customers.delete(detailsCustomer.customer_id);
      setShowDeleteConfirm(false);
      setShowDetails(false);
      fetchCustomers();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 font-semibold rounded-t ${activeTab === 'customers' ? 'bg-white dark:bg-gray-900 border-x border-t border-b-0 border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}
          onClick={() => setActiveTab('customers')}
        >
          Customers
        </button>
        <button
          className={`px-4 py-2 font-semibold rounded-t ${activeTab === 'modification' ? 'bg-white dark:bg-gray-900 border-x border-t border-b-0 border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}
          onClick={() => setActiveTab('modification')}
        >
          Modification Requests
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'customers' && (
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage customer information and relationships</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              className="px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:border-gray-600"
              placeholder="Search by name, code, or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
              onClick={() => setShowAdd(true)}
            >
              + Add Customer
            </button>
          </div>
        </div>
      )}
      {activeTab === 'customers' && (
        <div className="card p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading customers...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No customers found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Business Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">City</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Preferred Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.customer_code}</td>
                    <td className="px-4 py-2 font-semibold">{c.business_name}</td>
                    <td className="px-4 py-2">{c.contact_person}</td>
                    <td className="px-4 py-2">{c.phone}</td>
                    <td className="px-4 py-2">{c.city}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'suspended' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-700'}`}>{c.status}</span>
                      {c.stop_supply && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Supply Stopped</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.preferred_driver || <span className="italic text-gray-400">Not set</span>}</td>
                    <td className="px-4 py-2">
                      <button className="text-blue-600 hover:underline text-sm mr-2" onClick={() => openDetailsModal(c)}>View</button>
                      <button className="text-green-600 hover:underline text-sm mr-2" onClick={() => openEditModal(c)}>Edit</button>
                      <button className="text-red-500 hover:underline text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => { setShowAdd(false); setForm({ ...initialForm }); setFormError(''); }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Add Customer</h2>
            <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Customer Code *" value={form.customer_code} onChange={e => setForm({ ...form, customer_code: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Business Name" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Contact Person *" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Phone *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Address Line 1 *" value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Address Line 2" value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="City *" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} required />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="State *" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} required />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Postal Code" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Credit Limit" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} type="number" min="0" />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Credit Period (days)" value={form.credit_period_days} onChange={e => setForm({ ...form, credit_period_days: e.target.value })} type="number" min="0" />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Payment Terms" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Discount (₹)" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} type="number" min="0" />
              {formError && <div className="col-span-2 text-red-500 text-sm text-center">{formError}</div>}
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold" onClick={() => { setShowAdd(false); setForm({ ...initialForm }); setFormError(''); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white font-semibold" disabled={submitting}>{submitting ? 'Adding...' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => { setShowEdit(false); setEditForm({ ...initialForm }); setEditError(''); setEditId(null); }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Customer</h2>
            <form onSubmit={handleEditCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Customer Code *" value={editForm.customer_code} disabled />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Business Name" value={editForm.business_name} onChange={e => setEditForm({ ...editForm, business_name: e.target.value })} />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Contact Person *" value={editForm.contact_person} onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} type="email" />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Phone *" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Address Line 1 *" value={editForm.address_line1} onChange={e => setEditForm({ ...editForm, address_line1: e.target.value })} required />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Address Line 2" value={editForm.address_line2} onChange={e => setEditForm({ ...editForm, address_line2: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="City *" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} required />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="State *" value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} required />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Postal Code" value={editForm.postal_code} onChange={e => setEditForm({ ...editForm, postal_code: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Country" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Credit Limit" value={editForm.credit_limit} onChange={e => setEditForm({ ...editForm, credit_limit: e.target.value })} type="number" min="0" />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Credit Period (days)" value={editForm.credit_period_days} onChange={e => setEditForm({ ...editForm, credit_period_days: e.target.value })} type="number" min="0" />
              <input className="col-span-2 px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Payment Terms" value={editForm.payment_terms} onChange={e => setEditForm({ ...editForm, payment_terms: e.target.value })} />
              <input className="px-4 py-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Discount (₹)" value={editForm.discount} onChange={e => setEditForm({ ...editForm, discount: e.target.value })} type="number" min="0" />
              {editError && <div className="col-span-2 text-red-500 text-sm text-center">{editError}</div>}
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold" onClick={() => { setShowEdit(false); setEditForm({ ...initialForm }); setEditError(''); setEditId(null); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white font-semibold" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetails && detailsCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setShowDetails(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div><strong>Code:</strong> {detailsCustomer.customer_code}</div>
              <div><strong>Business Name:</strong> {detailsCustomer.business_name}</div>
              <div><strong>Contact:</strong> {detailsCustomer.contact_person}</div>
              <div><strong>Phone:</strong> {detailsCustomer.phone}</div>
              <div><strong>Email:</strong> {detailsCustomer.email}</div>
              <div><strong>Address:</strong> {(detailsCustomer as any).address_line1} {(detailsCustomer as any).address_line2}</div>
              <div><strong>City:</strong> {detailsCustomer.city}</div>
              <div><strong>State:</strong> {detailsCustomer.state}</div>
              <div><strong>Status:</strong> {detailsCustomer.status}</div>
              <div><strong>Credit Limit:</strong> {(detailsCustomer as any).credit_limit}</div>
              <div><strong>Credit Period:</strong> {(detailsCustomer as any).credit_period_days} days</div>
              <div><strong>Payment Terms:</strong> {(detailsCustomer as any).payment_terms}</div>
            </div>
            <div className="mb-6">
              <label className="block font-semibold mb-1">Stop Supply</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={stopSupply} onChange={e => setStopSupply(e.target.checked)} id="stop-supply-toggle" />
                <label htmlFor="stop-supply-toggle" className="text-gray-700">{stopSupply ? 'Supply Stopped' : 'Supplying'}</label>
              </div>
              {stopSupply && (
                <input
                  className="mt-2 w-full border rounded px-3 py-2"
                  placeholder="Reason for stopping supply"
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                />
              )}
              <button className="mt-2 bg-red-600 text-white px-4 py-2 rounded" onClick={handleSaveStopSupply} disabled={savingStop || (stopSupply && !stopReason)}>
                {savingStop ? 'Saving...' : stopSupply ? 'Stop Supply' : 'Resume Supply'}
              </button>
              {stopSuccess && <span className="ml-4 text-green-600 font-semibold">Saved!</span>}
            </div>
            <div className="mb-6">
              <label className="block font-semibold mb-1">Preferred Driver</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedDriver}
                onChange={e => setSelectedDriver(e.target.value)}
              >
                <option value="">Select driver...</option>
                {drivers.map((d: any) => (
                  <option key={d.user_id} value={d.user_id}>{d.first_name} {d.last_name} ({d.email})</option>
                ))}
              </select>
              <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSavePreferredDriver} disabled={savingDriver || !selectedDriver}>
                {savingDriver ? 'Saving...' : 'Save Preferred Driver'}
              </button>
              {driverSuccess && <span className="ml-4 text-green-600 font-semibold">Saved!</span>}
            </div>
            <div className="mt-6 flex gap-2">
              <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={() => openEditModal(detailsCustomer)}>Edit</button>
              <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Delete Customer</h3>
            <p className="mb-4 text-gray-700">Are you sure you want to delete this customer? This action cannot be undone.</p>
            {deleteError && <div className="text-red-500 text-sm mb-2">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white font-semibold" onClick={handleDeleteCustomer} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'modification' && (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Customer Modification Requests</h2>
          {modLoading ? (
            <div className="p-8 text-center text-gray-500">Loading requests...</div>
          ) : modError ? (
            <div className="p-8 text-center text-red-500">{modError}</div>
          ) : modRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No modification requests found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Request ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Old Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">New Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Requested At</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {modRequests.map((req) => (
                  <tr key={req.request_id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">{req.request_id}</td>
                    <td className="px-4 py-2 text-xs">{req.customer_id}</td>
                    <td className="px-4 py-2 text-xs">{req.field}</td>
                    <td className="px-4 py-2 text-xs">{req.old_value}</td>
                    <td className="px-4 py-2 text-xs">{req.new_value}</td>
                    <td className="px-4 py-2 text-xs">{req.status}</td>
                    <td className="px-4 py-2 text-xs">{new Date(req.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}; 