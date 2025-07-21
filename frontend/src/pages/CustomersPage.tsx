import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { customerSchema, type CustomerFormData } from '../schemas/customerSchema';
import { editCustomerSchema, type EditCustomerFormData } from '../schemas/editCustomerSchema';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import useEscKey from '../hooks/useEscKey';
import EmptyState from '../components/EmptyState';
import type { ApiError, Customer } from '../types';

interface SearchFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const initialForm: CustomerFormData = {
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
  console.log('Current distributor_id in CustomersPage:', distributor_id, 'isSuperAdmin:', isSuperAdmin);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverSuccess, setDriverSuccess] = useState(false);
  const [stopSupply, setStopSupply] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [savingStop, setSavingStop] = useState(false);
  const [stopSuccess, setStopSuccess] = useState(false);

  // New search panel state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialForm,
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: initialForm,
  });

  // ESC key handler to close modals
  useEscKey({
    onEsc: () => {
      if (showAdd) {
        setShowAdd(false);
        reset(initialForm);
      }
      if (showEdit) {
        setShowEdit(false);
        resetEdit(initialForm);
      }
      if (showDetails) {
        setShowDetails(false);
        setDetailsCustomer(null);
      }
    },
    isActive: Boolean(showAdd || showEdit || showDetails)
  });

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
      status: 'all',
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    };
    setSearchFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
  };

  const hasActiveFilters = () => {
    return appliedFilters.status !== 'all' || 
           appliedFilters.dateFrom || 
           appliedFilters.dateTo || 
           appliedFilters.searchTerm;
  };

  const fetchCustomers = async () => {
    console.log('fetchCustomers CALLED', { isSuperAdmin, distributor_id });
    setLoading(true);
    setError('');
    try {
      let res;
      if (isSuperAdmin) {
        res = await api.customers.getAll(distributor_id || undefined);
      } else if (distributor_id) {
        res = await api.customers.getAll(distributor_id || undefined);
      } else {
        setLoading(false);
        return;
      }
      console.log('Customers API response:', res);
      const list = res.data?.data || res.data;
      setCustomers(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching customers:', apiError);
      setError(apiError.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      console.log('Set loading to false in CustomersPage');
    }
  };

  useEffect(() => {
    if (isSuperAdmin && !distributor_id) {
      setLoading(false);
      return;
    }
    fetchCustomers();
  }, [distributor_id, isSuperAdmin]);

  console.log("customers before filter:", customers);
  // Filtered customers with new search panel
  const filteredCustomers = (customers ?? []).filter(customer => {
    const matchesSearch = !appliedFilters.searchTerm || 
      customer.business_name?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      customer.contact_person?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      customer.customer_code?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase());
    
    const matchesStatus = appliedFilters.status === 'all' || customer.status === appliedFilters.status;
    
    const matchesDateFrom = !appliedFilters.dateFrom || 
      (customer.created_at && new Date(customer.created_at) >= new Date(appliedFilters.dateFrom));
    
    const matchesDateTo = !appliedFilters.dateTo || 
      (customer.created_at && new Date(customer.created_at) <= new Date(appliedFilters.dateTo));
    
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });
  console.log("filtered before map:", filteredCustomers);

  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }
  if (loading) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-gray-500">Loading customers...</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">{error}</div>
        </div>
      </div>
    );
  }
  if (!customers) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <div className="p-8 text-center text-red-500">Something went wrong loading customers</div>
        </div>
      </div>
    );
  }
  if (customers.length === 0) {
    return (
      <div className="p-6 max-w-none mx-auto">
        <div className="card">
          <EmptyState message="No customers found." />
        </div>
      </div>
    );
  }

  const onSubmit = async (data: CustomerFormData) => {
    setFormError('');
    setSubmitting(true);
    
    const payload = {
      business_name: data.business_name || '',
      contact_person: data.contact_person,
      phone: data.phone,
      email: data.email || '',
      address_line1: data.address_line1,
      address_line2: data.address_line2 || '',
      city: data.city,
      state: data.state,
      postal_code: data.postal_code || '',
      credit_period: data.credit_period_days ? Number(data.credit_period_days) : 30,
    };
    
    // Add distributor_id for super admins
    if (isSuperAdmin && distributor_id) {
      (payload as any).distributor_id = distributor_id;
    }
    
    try {
      const result = await api.customers.create(payload);
      setShowAdd(false);
      reset(initialForm);
      fetchCustomers();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setFormError(apiError.message || 'Failed to add customer');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitEdit = async (data: EditCustomerFormData) => {
    setEditError('');
    setEditSubmitting(true);
    
    try {
      // Only include fields that are in UpdateCustomerRequest
      const updatePayload: any = {
        contact_person: data.contact_person,
        phone: data.phone,
        email: data.email || '',
        address_line1: data.address_line1,
        address_line2: data.address_line2 || '',
        city: data.city,
        state: data.state,
        postal_code: data.postal_code || '',
        credit_period: data.credit_period_days ? Number(data.credit_period_days) : 30,
      };
      
      if (editId) {
        await api.customers.update(editId, updatePayload);
        setShowEdit(false);
        resetEdit(initialForm);
        setEditId(null);
        fetchCustomers();
      }
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setEditError(apiError.message || 'Failed to update customer');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditId(customer.customer_id);
    resetEdit({
      business_name: customer.business_name || '',
      contact_person: customer.contact_person || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: customer.postal_code || '',
      credit_period_days: customer.credit_period?.toString() || '',
    });
    setShowEdit(true);
  };

  const openDetailsModal = (customer: Customer) => {
    setDetailsCustomer(customer);
    setShowDetails(true);
  };

  const handleSavePreferredDriver = async () => {
    if (!detailsCustomer || !selectedDriver) return;
    setSavingDriver(true);
    try {
      await api.customers.setPreferredDriver(detailsCustomer.customer_id, selectedDriver);
      setDriverSuccess(true);
      setTimeout(() => setDriverSuccess(false), 3000);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error setting preferred driver:', apiError);
    } finally {
      setSavingDriver(false);
    }
  };

  const handleSaveStopSupply = async () => {
    if (!detailsCustomer) return;
    setSavingStop(true);
    try {
      await api.customers.setStopSupply(detailsCustomer.customer_id, stopSupply, stopReason);
      setStopSuccess(true);
      setTimeout(() => setStopSuccess(false), 3000);
      fetchCustomers();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error setting stop supply:', apiError);
    } finally {
      setSavingStop(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.customers.delete(customerId);
      fetchCustomers();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error deleting customer:', apiError);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  return (
    <div className="p-6 max-w-none mx-auto">
      <div className="mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage customer information and relationships</p>
        </div>
        <div className="flex flex-row flex-wrap gap-4 justify-end items-center w-full sm:w-auto">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
            onClick={() => setShowAdd(true)}
          >
            + Add Customer
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Customers
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, code, phone..."
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
                Created Date From
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
                Created Date To
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
            Search Customers
          </button>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
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
          <div className="p-8 text-center text-gray-500">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters() ? 'No customers match your search criteria.' : 'No customers found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer Code</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Business Name</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact Person</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created Date</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-white">{customer.customer_code}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.business_name || '-'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.contact_person}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.phone}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        customer.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        customer.status === 'inactive' ? 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                      {customer.created_at ? formatDate(customer.created_at) : '-'}
                    </td>
                    <td className="px-4 py-2 text-center font-medium">
                      <div className="flex flex-row flex-nowrap gap-2 items-center justify-center min-w-[200px]">
                        <button
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold hover:bg-blue-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => openDetailsModal(customer)}
                        >
                          View
                        </button>
                        <button
                          className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-xs font-semibold hover:bg-yellow-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => openEditModal(customer)}
                        >
                          Edit
                        </button>
                        <button
                          className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-200 h-8 flex items-center justify-center min-w-[70px]"
                          onClick={() => handleDeleteCustomer(customer.customer_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAdd && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAdd(false);
              reset(initialForm);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => {
                setShowAdd(false);
                reset(initialForm);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Add New Customer</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Business Name"
                  type="text"
                  error={errors.business_name}
                  {...register('business_name')}
                />
                <FormInput
                  label="Contact Person *"
                  type="text"
                  error={errors.contact_person}
                  {...register('contact_person')}
                />
                <FormInput
                  label="Email"
                  type="email"
                  error={errors.email}
                  {...register('email')}
                />
                <FormInput
                  label="Phone *"
                  type="text"
                  error={errors.phone}
                  {...register('phone')}
                />
                <FormInput
                  label="Address Line 1 *"
                  type="text"
                  error={errors.address_line1}
                  {...register('address_line1')}
                />
                <FormInput
                  label="Address Line 2"
                  type="text"
                  error={errors.address_line2}
                  {...register('address_line2')}
                />
                <FormInput
                  label="City *"
                  type="text"
                  error={errors.city}
                  {...register('city')}
                />
                <FormInput
                  label="State *"
                  type="text"
                  error={errors.state}
                  {...register('state')}
                />
                <FormInput
                  label="Postal Code"
                  type="text"
                  error={errors.postal_code}
                  {...register('postal_code')}
                />
                <FormInput
                  label="Credit Period (Days)"
                  type="number"
                  error={errors.credit_period_days}
                  {...register('credit_period_days')}
                />
              </div>
              {formError && <div className="text-red-500 text-center mb-2">{formError}</div>}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAdd(false);
                    reset(initialForm);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center" disabled={submitting}>
                  {submitting && <span className="loader mr-2"></span>}
                  {submitting ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEdit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEdit(false);
              resetEdit(initialForm);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => {
                setShowEdit(false);
                resetEdit(initialForm);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Customer</h2>
            <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Business Name"
                  type="text"
                  error={editErrors.business_name}
                  {...registerEdit('business_name')}
                />
                <FormInput
                  label="Contact Person *"
                  type="text"
                  error={editErrors.contact_person}
                  {...registerEdit('contact_person')}
                />
                <FormInput
                  label="Email"
                  type="email"
                  error={editErrors.email}
                  {...registerEdit('email')}
                />
                <FormInput
                  label="Phone *"
                  type="text"
                  error={editErrors.phone}
                  {...registerEdit('phone')}
                />
                <FormInput
                  label="Address Line 1 *"
                  type="text"
                  error={editErrors.address_line1}
                  {...registerEdit('address_line1')}
                />
                <FormInput
                  label="Address Line 2"
                  type="text"
                  error={editErrors.address_line2}
                  {...registerEdit('address_line2')}
                />
                <FormInput
                  label="City *"
                  type="text"
                  error={editErrors.city}
                  {...registerEdit('city')}
                />
                <FormInput
                  label="State *"
                  type="text"
                  error={editErrors.state}
                  {...registerEdit('state')}
                />
                <FormInput
                  label="Postal Code"
                  type="text"
                  error={editErrors.postal_code}
                  {...registerEdit('postal_code')}
                />
                <FormInput
                  label="Credit Period (Days)"
                  type="number"
                  error={editErrors.credit_period_days}
                  {...registerEdit('credit_period_days')}
                />
              </div>
              {editError && <div className="text-red-500 text-center mb-2">{editError}</div>}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEdit(false);
                    resetEdit(initialForm);
                  }}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center" disabled={editSubmitting}>
                  {editSubmitting && <span className="loader mr-2"></span>}
                  {editSubmitting ? 'Saving...' : 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {showDetails && detailsCustomer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetails(false);
              setDetailsCustomer(null);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-8 relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => {
                setShowDetails(false);
                setDetailsCustomer(null);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                <div className="space-y-2">
                  <div><strong>Customer Code:</strong> {detailsCustomer.customer_code}</div>
                  <div><strong>Business Name:</strong> {detailsCustomer.business_name || '-'}</div>
                  <div><strong>Contact Person:</strong> {detailsCustomer.contact_person}</div>
                  <div><strong>Email:</strong> {detailsCustomer.email || '-'}</div>
                  <div><strong>Phone:</strong> {detailsCustomer.phone}</div>
                  <div><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                      detailsCustomer.status === 'active' ? 'bg-green-100 text-green-800' :
                      detailsCustomer.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {detailsCustomer.status}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Address & Settings</h3>
                <div className="space-y-2">
                  <div><strong>Address:</strong> {detailsCustomer.address_line1}</div>
                  {detailsCustomer.address_line2 && <div><strong>Address 2:</strong> {detailsCustomer.address_line2}</div>}
                  <div><strong>City:</strong> {detailsCustomer.city}</div>
                  <div><strong>State:</strong> {detailsCustomer.state}</div>
                                     <div><strong>Postal Code:</strong> {detailsCustomer.postal_code || '-'}</div>
                   <div><strong>Country:</strong> Nigeria</div>
                   <div><strong>Credit Limit:</strong> ₹0.00</div>
                   <div><strong>Credit Period:</strong> {detailsCustomer.credit_period || '30'} days</div>
                   <div><strong>Created Date:</strong> {detailsCustomer.created_at ? formatDate(detailsCustomer.created_at) : '-'}</div>
                </div>
              </div>
            </div>
            
            {/* Additional Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-3">Actions</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(detailsCustomer)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                >
                  Edit Customer
                </button>
                <button
                  onClick={() => handleDeleteCustomer(detailsCustomer.customer_id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                >
                  Delete Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 