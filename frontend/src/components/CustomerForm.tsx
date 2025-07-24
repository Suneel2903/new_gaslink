import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, type CustomerFormData } from '../schemas/customerSchema';

interface CustomerFormProps {
  mode: 'add' | 'edit';
  initialValues: CustomerFormData;
  onSubmit: (data: CustomerFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  contacts: CustomerFormData['contacts'];
  setContacts: React.Dispatch<React.SetStateAction<CustomerFormData['contacts']>>;
  contactsError: string;
  setContactsError: React.Dispatch<React.SetStateAction<string>>;
  cylinderDiscounts: CustomerFormData['cylinder_discounts'];
  setCylinderDiscounts: React.Dispatch<React.SetStateAction<CustomerFormData['cylinder_discounts']>>;
  discountError: string;
  setDiscountError: React.Dispatch<React.SetStateAction<string>>;
  cylinderTypes: any[];
  drivers: any[];
  preferredDriverId: string;
  setPreferredDriverId: React.Dispatch<React.SetStateAction<string>>;
  gstin: string;
  setGstin: React.Dispatch<React.SetStateAction<string>>;
  gstinError: string;
  setGstinError: React.Dispatch<React.SetStateAction<string>>;
  gstinLoading: boolean;
  handleFetchGstin: () => void;
  enableGraceRecovery: boolean;
  setEnableGraceRecovery: React.Dispatch<React.SetStateAction<boolean>>;
  gracePeriodDays: number;
  setGracePeriodDays: React.Dispatch<React.SetStateAction<number>>;
  billingAddress: any;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  loading,
  contacts,
  setContacts,
  contactsError,
  setContactsError,
  cylinderDiscounts,
  setCylinderDiscounts,
  discountError,
  setDiscountError,
  cylinderTypes,
  drivers,
  preferredDriverId,
  setPreferredDriverId,
  gstin,
  setGstin,
  gstinError,
  setGstinError,
  gstinLoading,
  handleFetchGstin,
  enableGraceRecovery,
  setEnableGraceRecovery,
  gracePeriodDays,
  setGracePeriodDays,
  billingAddress,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    control,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialValues,
  });

  // useFieldArray for contacts
  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control,
    name: 'contacts',
  });

  // useFieldArray for cylinder discounts
  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount,
  } = useFieldArray({
    control,
    name: 'cylinder_discounts',
  });

  useEffect(() => {
    console.log('[CustomerForm] props on mount:', {
      mode,
      initialValues,
      contacts,
      cylinderDiscounts,
      preferredDriverId,
      gstin,
      enableGraceRecovery,
      gracePeriodDays,
      billingAddress,
    });
  }, []);

  useEffect(() => {
    console.log('[CustomerForm] contacts changed:', contacts);
  }, [contacts]);

  useEffect(() => {
    console.log('[CustomerForm] cylinderDiscounts changed:', cylinderDiscounts);
  }, [cylinderDiscounts]);

  console.log('[CustomerForm] Rendering form');

  const handleFormSubmit = (data: CustomerFormData) => {
    console.log('[CustomerForm] handleFormSubmit called with data:', data);
    try {
      onSubmit(data);
    } catch (err) {
      console.error('[CustomerForm] Error in onSubmit:', err);
    }
  };

  // Log validation errors if present
  if (Object.keys(errors).length > 0) {
    console.error('[CustomerForm] Validation errors:', errors);
  }

  // Render all validation errors at the top of the form
  // This will help the user see what is blocking submission
  const renderValidationErrors = () => (
    Object.keys(errors).length > 0 && (
      <div className="w-full px-4 py-2 rounded mb-4 text-center font-semibold bg-red-100 text-red-800">
        {Object.entries(errors).map(([field, err]) => (
          <div key={field}>
            {field}: {err?.message || 'This field is required'}
            {field === 'contacts' && ' (At least one valid contact is required)'}
            {field === 'cylinder_discounts' && ' (At least one valid cylinder discount is required)'}
          </div>
        ))}
      </div>
    )
  );

  // Minimal required field for test
  return (
    <form className="space-y-8 px-8 py-6 overflow-y-auto flex-1 w-full min-w-0" onSubmit={handleSubmit(handleFormSubmit)}>
      {renderValidationErrors()}
      {/* Main Info Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-blue-700">Customer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name <span className="text-red-600">*</span>
            </label>
            <input {...register('business_name', { required: true })} className="border rounded px-2 py-1 w-full" placeholder="Business Name" />
            {errors.business_name && <div className="text-red-500 text-xs mt-1">{errors.business_name.message || 'Business Name is required'}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1 <span className="text-red-600">*</span>
            </label>
            <input {...register('address_line1', { required: true })} className="border rounded px-2 py-1 w-full" placeholder="Address Line 1" />
            {errors.address_line1 && <div className="text-red-500 text-xs mt-1">{errors.address_line1.message || 'Address Line 1 is required'}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input {...register('address_line2')} className="border rounded px-2 py-1 w-full" placeholder="Address Line 2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City <span className="text-red-600">*</span>
            </label>
            <input {...register('city', { required: true })} className="border rounded px-2 py-1 w-full" placeholder="City" />
            {errors.city && <div className="text-red-500 text-xs mt-1">{errors.city.message || 'City is required'}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State <span className="text-red-600">*</span>
            </label>
            <input {...register('state', { required: true })} className="border rounded px-2 py-1 w-full" placeholder="State" />
            {errors.state && <div className="text-red-500 text-xs mt-1">{errors.state.message || 'State is required'}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input {...register('postal_code')} className="border rounded px-2 py-1 w-full" placeholder="Postal Code" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input type="hidden" {...register('country')} value="India" />
            <p className="border rounded px-2 py-1 w-full bg-gray-100 text-sm text-gray-700">India</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Period (days)</label>
            <input type="number" {...register('credit_period_days')} defaultValue={30} min={0} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Grace Cylinder Recovery</label>
            <input
              type="checkbox"
              checked={!!enableGraceRecovery}
              onChange={e => setEnableGraceRecovery(e.target.checked)}
              className="h-4 w-4 border-gray-300 rounded"
            />
            <span className="text-xs">Enable</span>
            <input
              type="number"
              min="0"
              value={gracePeriodDays ?? 0}
              onChange={e => setGracePeriodDays(Number(e.target.value))}
              className="border rounded px-2 py-1 w-24 ml-4"
              placeholder="Days"
              disabled={!enableGraceRecovery}
            />
            <span className="text-xs ml-1">Days</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Driver</label>
            <select
              {...register('preferred_driver_id')}
              className="border rounded px-2 py-1 w-full"
              defaultValue=""
            >
              <option value="">-- None --</option>
              {drivers && drivers.length > 0 && drivers.map(driver => (
                <option key={driver.driver_id} value={driver.driver_id}>{driver.name}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              className="btn-primary mt-2"
              onClick={() => alert('Feature coming soon')}
            >
              Stop Supply
            </button>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      {/* Contact Persons Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-blue-700">Contact Persons</h3>
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm mb-2">
          <div className="flex gap-2 mb-2 font-semibold text-xs text-gray-600">
            <span className="flex-1">Name</span>
            <span className="flex-1">Phone</span>
            <span className="flex-1">Email</span>
            <span className="w-20 text-center">Primary</span>
            <span className="w-16"></span>
          </div>
          {contactFields.map((field, idx) => (
            <div key={field.id} className="flex flex-col md:flex-row gap-2 mb-2 items-center w-full min-w-0">
              <input {...register(`contacts.${idx}.name` as const)} className="border rounded px-2 py-1 flex-1 min-w-0" placeholder="Name" />
              <input {...register(`contacts.${idx}.phone` as const)} className="border rounded px-2 py-1 flex-1 min-w-0" placeholder="Phone" />
              <input {...register(`contacts.${idx}.email` as const)} className="border rounded px-2 py-1 flex-1 min-w-0" placeholder="Email" />
              <div className="flex items-center justify-center w-20 h-full">
                <input type="radio" checked={!!(contactFields[idx]?.is_primary)} onChange={() => {
                  contactFields.forEach((_, i) => setValue(`contacts.${i}.is_primary`, i === idx));
                }} name="primaryContact" className="align-middle" />
                <span className="ml-1 text-xs">Primary</span>
              </div>
              {contactFields.length > 1 && (<button type="button" onClick={() => removeContact(idx)} className="text-red-600 hover:underline ml-2">Remove</button>)}
            </div>
          ))}
          {contactFields.length < 3 && (<button type="button" onClick={() => appendContact({ name: '', phone: '', email: '', is_primary: false })} className="text-blue-600 hover:underline mt-1">+ Add Contact</button>)}
        </div>
      </div>
      <hr className="my-2" />
      {/* Cylinder Discounts Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-blue-700">Cylinder Discounts</h3>
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm mb-2">
          {discountFields.map((field, idx) => {
            const selectedType = cylinderTypes.find(ct => ct.cylinder_type_id === discountFields[idx]?.cylinder_type_id);
            return (
              <div key={field.id} className="flex flex-col md:flex-row gap-2 mb-2 items-center w-full min-w-0">
                <select {...register(`cylinder_discounts.${idx}.cylinder_type_id` as const)} className="border rounded px-2 py-1 flex-1 min-w-0">
                  <option value="">Select Cylinder Type</option>
                  {cylinderTypes.map(ct => (
                    <option key={ct.cylinder_type_id} value={ct.cylinder_type_id}>{ct.name} ({ct.capacity_kg ?? ct.weight_kg ?? ''} kg)</option>
                  ))}
                </select>
                <input type="number" min="0" {...register(`cylinder_discounts.${idx}.per_kg_discount` as const)} className="border rounded px-2 py-1 w-32 min-w-0" placeholder="Discount (₹)" />
                <input type="date" {...register(`cylinder_discounts.${idx}.effective_from` as const)} className="border rounded px-2 py-1 w-40 min-w-0" placeholder="Effective From" />
                {discountFields.length > 1 && (<button type="button" onClick={() => removeDiscount(idx)} className="text-red-600 hover:underline ml-2">Remove</button>)}
              </div>
            );
          })}
          {discountFields.length < cylinderTypes.length && (<button type="button" onClick={() => appendDiscount({ cylinder_type_id: '', per_kg_discount: 0, effective_from: '' })} className="text-blue-600 hover:underline mt-1">+ Add Discount</button>)}
        </div>
      </div>
      <hr className="my-2" />
      {/* GST Details Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-blue-700">GST Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          <div>
            <label className="block text-xs text-gray-500">GSTIN</label>
            <div className="flex gap-2 items-center">
              <input
                {...register('gstin')}
                className="border rounded px-2 py-1 flex-1"
                placeholder="Enter GSTIN"
              />
              <button type="button" onClick={handleFetchGstin} className="btn-primary px-3 py-1" disabled={gstinLoading || !gstin}>
                {gstinLoading ? 'Fetching...' : 'Fetch Details'}
              </button>
            </div>
            {gstinError && <div className="text-red-500 text-sm mt-1">{gstinError}</div>}
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing Address Line 1</label>
            <input type="text" value={billingAddress.billing_address_line1 || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing Address Line 2</label>
            <input type="text" value={billingAddress.billing_address_line2 || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing City</label>
            <input type="text" value={billingAddress.billing_city || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing State</label>
            <input type="text" value={billingAddress.billing_state || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing Pincode</label>
            <input type="text" value={billingAddress.billing_pincode || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Billing State Code</label>
            <input type="text" value={billingAddress.billing_state_code || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Trade Name</label>
            <input type="text" value={billingAddress.trade_name || ''} readOnly className="border rounded px-2 py-1 w-full bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button
          type="submit"
          onClick={() => console.log('[CustomerForm] Save button clicked')}
          className="btn-primary flex items-center"
          disabled={loading}
        >
          {loading ? 'Saving...' : mode === 'add' ? 'Save Customer' : 'Update Customer'}
        </button>
      </div>
    </form>
  );
};

export default CustomerForm; 