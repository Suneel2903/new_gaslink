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
import type { ApiError, Customer, CustomerCylinderDiscount, CylinderType, CustomerContact } from '../types';
import driverService from '../services/driverService';
import CustomerForm from '../components/CustomerForm';

interface SearchFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const initialForm: CustomerFormData = {
  customer_code: '',
  business_name: '',
  email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Nigeria',
  credit_limit: '',
  credit_period_days: '',
  payment_terms: '',
  billing_address_line1: '',
  billing_address_line2: '',
  billing_city: '',
  billing_state: '',
  billing_pincode: '',
  billing_state_code: '',
  gstin: '',
  trade_name: '',
  state_code: '',
  preferred_driver_id: '',
  enable_grace_cylinder_recovery: false,
  grace_period_cylinder_recovery_days: undefined,
  contacts: [],
  cylinder_discounts: [],
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
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [cylinderDiscounts, setCylinderDiscounts] = useState<CustomerCylinderDiscount[]>([]);
  const [discountError, setDiscountError] = useState('');
  const [contacts, setContacts] = useState<CustomerContact[]>([{
    name: '',
    phone: '',
    email: '',
    is_primary: true
  }]);
  const [contactsError, setContactsError] = useState('');
  const [drivers, setDrivers] = useState<{ driver_id: string; name: string }[]>([]);
  const [preferredDriverId, setPreferredDriverId] = useState('');
  const [gstin, setGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState({
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_pincode: '',
    billing_state_code: '',
    trade_name: '',
  });
  const [gstinLoading, setGstinLoading] = useState(false);
  const [gstinError, setGstinError] = useState('');
  const [enableGraceRecovery, setEnableGraceRecovery] = useState(false);
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [tradeName, setTradeName] = useState('');
  const [stateCode, setStateCode] = useState('');
  // 1. Add toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Add editCustomerData state
  const [editCustomerData, setEditCustomerData] = useState(initialForm);

  // Add discount row
  const handleAddDiscount = () => {
    if (cylinderDiscounts.length < cylinderTypes.length) {
      setCylinderDiscounts([
        ...cylinderDiscounts,
        { cylinder_type_id: '', per_kg_discount: 0 }
      ]);
    }
  };
  // Remove discount row
  const handleRemoveDiscount = (idx: number) => {
    setCylinderDiscounts(cylinderDiscounts.filter((_, i) => i !== idx));
  };
  // Update discount row
  const handleDiscountChange = (idx: number, field: keyof CustomerCylinderDiscount, value: any) => {
    setCylinderDiscounts(cylinderDiscounts.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };
  // Prevent duplicate cylinder types
  const usedCylinderTypeIds = cylinderDiscounts.map(d => d.cylinder_type_id);
  // Validate discounts before submit
  const validateDiscounts = () => {
    if (cylinderDiscounts.length === 0) {
      setDiscountError('At least one discount is required');
      return false;
    }
    for (const d of cylinderDiscounts) {
      if (!d.cylinder_type_id) {
        setDiscountError('Select cylinder type for all discounts');
        return false;
      }
      if (d.per_kg_discount < 0) {
        setDiscountError('Discount amount must be >= 0');
        return false;
      }
    }
    setDiscountError('');
    return true;
  };

  // Add contact row
  const handleAddContact = () => {
    if ((contacts || []).length < 3) {
      setContacts([...(contacts || []), { name: '', phone: '', email: '', is_primary: false }]);
    }
  };
  // Remove contact row
  const handleRemoveContact = (idx: number) => {
    const newContacts = contacts.filter((_, i) => i !== idx);
    // Ensure at least one is primary
    if (!newContacts.some(c => c.is_primary) && newContacts.length > 0) {
      newContacts[0].is_primary = true;
    }
    setContacts(newContacts);
  };
  // Update contact row
  const handleContactChange = (idx: number, field: keyof CustomerContact, value: any) => {
    setContacts(contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  // Set primary contact
  const handleSetPrimaryContact = (idx: number) => {
    setContacts(contacts.map((c, i) => ({ ...c, is_primary: i === idx })));
  };
  // Validate contacts before submit
  const validateContacts = () => {
    if (!contacts || contacts.length === 0) {
      setContactsError('At least one contact is required');
      return false;
    }
    if (!contacts.some(c => c.is_primary)) {
      setContactsError('At least one contact must be marked as primary');
      return false;
    }
    for (const c of contacts) {
      if (!c.name || c.name.length < 2) {
        setContactsError('Contact name is required and must be at least 2 characters');
        return false;
      }
    }
    setContactsError('');
    return true;
  };

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
    setValue,
    formState: { errors },
    reset,
    getValues,
    clearErrors,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialForm,
  });

  // Sync contacts to form data
  useEffect(() => {
    setValue('contacts', contacts);
    console.log('[DEBUG] useEffect: contacts synced to form', contacts);
  }, [contacts, setValue]);

  // Sync cylinderDiscounts to form data
  useEffect(() => {
    setValue('cylinder_discounts', cylinderDiscounts);
    console.log('[DEBUG] useEffect: cylinderDiscounts synced to form', cylinderDiscounts);
  }, [cylinderDiscounts, setValue]);

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

  // Fetch drivers on modal open
  useEffect(() => {
    if (showAdd || showEdit) {
      api.customers.getDrivers().then(res => {
        const users = res.data?.drivers || [];
        setDrivers(users.map((user: any) => ({ driver_id: user.driver_id, name: user.driver_name })));
      });
    }
  }, [showAdd, showEdit]);

  // 1. GSTIN fetch handler: Use a placeholder if api.customers.fetchGstinDetails does not exist
  const handleFetchGstin = async () => {
    setGstinLoading(true);
    setGstinError('');
    try {
      // TODO: Replace with actual GSTIN fetch API call when backend is ready
      // const res = await api.customers.fetchGstinDetails(gstin);
      // const data = res.data?.data || res.data;
      // setBillingAddress({ ... });
      setTimeout(() => {
        setBillingAddress({
          billing_address_line1: 'Sample Address 1',
          billing_address_line2: 'Sample Address 2',
          billing_city: 'Sample City',
          billing_state: 'Sample State',
          billing_pincode: '123456',
          billing_state_code: '12',
          trade_name: 'Sample Trade',
        });
        setGstinLoading(false);
      }, 1000);
    } catch (err) {
      setGstinError('Failed to fetch GSTIN details');
      setGstinLoading(false);
    }
  };

  // 2. Ensure at least one discount row is present when modal opens
  useEffect(() => {
    if ((showAdd || showEdit) && cylinderDiscounts.length === 0 && cylinderTypes.length > 0) {
      setCylinderDiscounts([{ cylinder_type_id: '', per_kg_discount: 0 }]);
    }
  }, [showAdd, showEdit, cylinderTypes]);

  // 1. Add debug logging to cylinder types fetch
  useEffect(() => {
    if (showAdd || showEdit) {
      api.cylinderTypes.getAll(distributor_id || '').then(res => {
        const types = res.data?.data || res.data || [];
        setCylinderTypes(types);
        console.log('Fetched cylinder types:', types, 'for distributor_id:', distributor_id);
      });
    }
  }, [showAdd, showEdit, distributor_id]);

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
    // Always sync local state to form data before validation
    setValue('contacts', contacts);
    setValue('cylinder_discounts', cylinderDiscounts);
    await new Promise(r => setTimeout(r, 0)); // allow state to flush
    const currentValues = getValues();
    console.log('[DEBUG] onSubmit called', currentValues, errors);
    // 3. Log validation errors if present
    if (Object.keys(errors).length > 0) {
      console.log('[DEBUG] Validation errors:', errors);
    }
    // 4. Check contacts and discounts
    if (!contacts || contacts.length === 0) {
      console.log('[DEBUG] No contacts provided');
      setContactsError('At least one contact is required');
      return;
    } else {
      setContactsError('');
    }
    if (!cylinderDiscounts || cylinderDiscounts.length === 0) {
      console.log('[DEBUG] No cylinder discounts provided');
      setDiscountError('At least one cylinder discount is required');
      return;
    } else {
      setDiscountError('');
    }
    setFormError('');
    setSubmitting(true);
    // Build payload with all required fields
    const { customer_code, ...restValues } = currentValues;
    const payload = {
      ...restValues,
      business_name: restValues.business_name || '',
      address_line1: restValues.address_line1 || '',
      city: restValues.city || '',
      state: restValues.state || '',
      customer_code: customer_code || '',
      contacts: contacts,
      cylinder_discounts: cylinderDiscounts,
    };
    // Add distributor_id for super admins
    if (isSuperAdmin && distributor_id) {
      (payload as any).distributor_id = distributor_id;
    }
    try {
      console.log('[DEBUG] Payload to be sent to api.customers.create:', payload);
      const result = await api.customers.create(payload);
      console.log('[DEBUG] API response:', result);
      setShowAdd(false);
      reset(initialForm);
      console.log('[DEBUG] Modal closed, resetting form');
      fetchCustomers();
      console.log('[DEBUG] Customer list refreshed');
      setToast({ type: 'success', message: 'Customer saved successfully!' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('[DEBUG] Error in onSubmit:', apiError);
      setFormError(apiError.message || 'Failed to add customer');
      setToast({ type: 'error', message: apiError.message || 'Failed to save customer' });
      setTimeout(() => setToast(null), 4000);
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
        contacts: contacts,
        cylinder_discounts: cylinderDiscounts,
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

  const openEditModal = async (customerOrId: string | Customer) => {
    let customer = customerOrId;
    // If only an ID is provided, fetch the full customer object
    if (typeof customerOrId === 'string') {
      // Fetch full customer by ID from API
      try {
        const res = await api.customers.getById(customerOrId);
        customer = res.data;
        console.log('[openEditModal] Loaded full customer by ID:', customer);
      } catch (err) {
        console.error('[openEditModal] Failed to fetch customer by ID:', err);
        return;
      }
    }
    // Map all fields for edit form initial values
    setEditCustomerData({
      ...initialForm,
      ...customer,
      contacts: (customer.contacts || []).map(c => ({
        name: c.name || '',
        is_primary: !!c.is_primary,
        email: c.email || '',
        phone: c.phone || '',
      })),
      cylinder_discounts: (customer.cylinder_discounts || []).map(d => ({
        cylinder_type_id: d.cylinder_type_id || '',
        per_kg_discount: Number(d.per_kg_discount) || 0,
        effective_from: d.effective_from || '',
        cylinder_type_name: d.cylinder_type_name || '',
        capacity_kg: d.capacity_kg !== undefined ? Number(d.capacity_kg) : undefined,
      })),
      gstin: customer.gstin || '',
      email: customer.email || '',
      phone: customer.phone || '',
      // Map any other fields as needed
    });
    console.log('[openEditModal] Edit initial values (should include gstin):', {
      ...initialForm,
      ...customer,
      gstin: customer.gstin || '',
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

  // Add this handler for adding a customer
  const handleAddCustomer = async (data: CustomerFormData) => {
    const payload = { ...data };
    if (distributor_id) {
      payload.distributor_id = distributor_id;
    }
    console.log('[CustomersPage] handleAddCustomer payload:', payload);
    setSubmitting(true);
    setFormError('');
    try {
      const result = await api.customers.create(payload);
      console.log('[CustomersPage] API response:', result);
      setShowAdd(false);
      reset(initialForm);
      fetchCustomers();
      setToast({ type: 'success', message: 'Customer saved successfully!' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('[CustomersPage] Error creating customer:', apiError);
      setFormError(apiError.message || 'Failed to add customer');
      setToast({ type: 'error', message: apiError.message || 'Failed to save customer' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
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
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.business_name || '-'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.contacts && customer.contacts.length > 0 ? (customer.contacts.find(c => c.is_primary)?.name || customer.contacts[0].name) : '-'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{customer.contacts && customer.contacts.length > 0 ? (customer.contacts.find(c => c.is_primary)?.phone || customer.contacts[0].phone) : '-'}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowAdd(false);
            reset(initialForm);
          }
        }}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-0 relative animate-fade-in max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white z-10 border-b px-8 py-4 rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-900">Add New Customer</h2>
            </div>
            {toast && (
              <div className={`w-full px-4 py-2 rounded mb-4 text-center font-semibold ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{toast.message}</div>
            )}
            <CustomerForm
              mode="add"
              initialValues={initialForm}
              onSubmit={handleAddCustomer}
              onCancel={() => { setShowAdd(false); reset(initialForm); }}
              loading={submitting}
              contacts={contacts}
              setContacts={setContacts}
              contactsError={contactsError}
              setContactsError={setContactsError}
              cylinderDiscounts={cylinderDiscounts}
              setCylinderDiscounts={setCylinderDiscounts}
              discountError={discountError}
              setDiscountError={setDiscountError}
              cylinderTypes={cylinderTypes}
              drivers={drivers}
              preferredDriverId={preferredDriverId}
              setPreferredDriverId={setPreferredDriverId}
              gstin={gstin}
              setGstin={setGstin}
              gstinError={gstinError}
              setGstinError={setGstinError}
              gstinLoading={gstinLoading}
              handleFetchGstin={handleFetchGstin}
              enableGraceRecovery={enableGraceRecovery}
              setEnableGraceRecovery={setEnableGraceRecovery}
              gracePeriodDays={gracePeriodDays}
              setGracePeriodDays={setGracePeriodDays}
              billingAddress={billingAddress}
            />
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowEdit(false);
            resetEdit(initialForm);
          }
        }}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-0 relative animate-fade-in max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white z-10 border-b px-8 py-4 rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-900">Edit Customer</h2>
            </div>
            {toast && (
              <div className={`w-full px-4 py-2 rounded mb-4 text-center font-semibold ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{toast.message}</div>
            )}
            <CustomerForm
              mode="edit"
              initialValues={editCustomerData}
              onSubmit={handleSubmitEdit(onSubmitEdit)}
              onCancel={() => { setShowEdit(false); resetEdit(initialForm); }}
              loading={editSubmitting}
              contacts={contacts}
              setContacts={setContacts}
              contactsError={contactsError}
              setContactsError={setContactsError}
              cylinderDiscounts={cylinderDiscounts}
              setCylinderDiscounts={setCylinderDiscounts}
              discountError={discountError}
              setDiscountError={setDiscountError}
              cylinderTypes={cylinderTypes}
              drivers={drivers}
              preferredDriverId={preferredDriverId}
              setPreferredDriverId={setPreferredDriverId}
              gstin={gstin}
              setGstin={setGstin}
              gstinError={gstinError}
              setGstinError={setGstinError}
              gstinLoading={gstinLoading}
              handleFetchGstin={handleFetchGstin}
              enableGraceRecovery={enableGraceRecovery}
              setEnableGraceRecovery={setEnableGraceRecovery}
              gracePeriodDays={gracePeriodDays}
              setGracePeriodDays={setGracePeriodDays}
              billingAddress={billingAddress}
            />
          </div>
        </div>
      )}

      {/* Customer Details Modal (restore to table/grid layout) */}
      {showDetails && detailsCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetails(false);
              setDetailsCustomer(null);
            }
          }}>
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
                  <div><strong>Business Name:</strong> {detailsCustomer.business_name || '-'}</div>
                  <div><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                      detailsCustomer.status === 'active' ? 'bg-green-100 text-green-800' :
                      detailsCustomer.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {detailsCustomer.status}
                    </span>
                  </div>
                  <div><strong>GSTIN:</strong> {detailsCustomer.gstin || '-'}</div>
                  <div><strong>Preferred Driver:</strong> {detailsCustomer.preferred_driver_id || '-'}</div>
                  <div><strong>Grace Cylinder Recovery:</strong> {detailsCustomer.enable_grace_cylinder_recovery ? 'Yes' : 'No'}</div>
                  <div><strong>Grace Period Days:</strong> {detailsCustomer.grace_period_cylinder_recovery_days ?? '-'}</div>
                  <div><strong>Created Date:</strong> {detailsCustomer.created_at ? formatDate(detailsCustomer.created_at) : '-'}</div>
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
                  <div><strong>Country:</strong> {detailsCustomer.country || '-'}</div>
                  <div><strong>Credit Limit:</strong> ₹{detailsCustomer.credit_limit ?? '0.00'}</div>
                  <div><strong>Credit Period:</strong> {detailsCustomer.credit_period_days || '30'} days</div>
                </div>
              </div>
            </div>
            {/* Contacts Section */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Contact Persons</h3>
              {detailsCustomer.contacts && detailsCustomer.contacts.length > 0 ? (
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Phone</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-center">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsCustomer.contacts.map((c, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">{c.phone}</td>
                        <td className="p-2">{c.email}</td>
                        <td className="p-2 text-center">{c.is_primary ? 'Yes' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-gray-500">No contacts found.</div>}
            </div>
            {/* Cylinder Discounts Section */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Cylinder Discounts</h3>
              {detailsCustomer.cylinder_discounts && detailsCustomer.cylinder_discounts.length > 0 ? (
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Cylinder Type</th>
                      <th className="p-2 text-right">Discount (₹)</th>
                      <th className="p-2 text-right">Capacity (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsCustomer.cylinder_discounts.map((d, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{d.cylinder_type_name || '-'}</td>
                        <td className="p-2 text-right">{(d.per_cylinder_discount ?? d.per_kg_discount ?? 0)}</td>
                        <td className="p-2 text-right">{typeof d.capacity_kg === 'number' ? d.capacity_kg : d.capacity_kg || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-gray-500">No discounts found.</div>}
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
                onClick={() => handleSavePreferredDriver()}
                disabled={savingDriver}
              >
                {savingDriver ? 'Saving...' : 'Save Preferred Driver'}
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold ml-2"
                onClick={() => handleSaveStopSupply()}
                disabled={savingStop}
              >
                {savingStop ? 'Saving...' : 'Save Stop Supply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
