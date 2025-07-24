import { z } from 'zod';

export const customerContactSchema = z.object({
  name: z.string().min(2, 'Contact name is required'),
  phone: z.string().optional(),
  email: z.string().optional().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Please enter a valid email address',
  }),
  is_primary: z.boolean(),
});

export const customerCylinderDiscountSchema = z.object({
  cylinder_type_id: z.string().min(1, 'Cylinder type is required'),
  per_kg_discount: z.coerce.number().min(0, 'Discount must be >= 0'),
  effective_from: z.string().optional(),
});

export const customerSchema = z.object({
  customer_code: z.string().optional(),
  business_name: z.string().optional(),
  email: z.string().optional().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Please enter a valid email address',
  }),
  address_line1: z.string().min(1, 'Address line 1 is required').min(5, 'Address line 1 must be at least 5 characters'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required').min(2, 'City must be at least 2 characters'),
  state: z.string().min(1, 'State is required').min(2, 'State must be at least 2 characters'),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  credit_limit: z.string().optional().refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Credit limit must be a positive number',
  }),
  credit_period_days: z.string().optional().refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Credit period must be a positive number',
  }),
  payment_terms: z.string().optional(),
  billing_address_line1: z.string().optional(),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_pincode: z.string().optional(),
  billing_state_code: z.string().optional(),
  gstin: z.string().optional(),
  trade_name: z.string().optional(),
  state_code: z.string().optional(),
  preferred_driver_id: z.string().optional(),
  enable_grace_cylinder_recovery: z.boolean().optional(),
  grace_period_cylinder_recovery_days: z.coerce.number().optional(),
  contacts: z.array(customerContactSchema).min(1, 'At least one contact is required').max(3, 'Maximum 3 contacts allowed').refine(arr => arr.some(c => c.is_primary), { message: 'At least one contact must be marked as primary' }),
  cylinder_discounts: z.array(customerCylinderDiscountSchema).min(1, 'At least one cylinder discount is required'),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type CustomerContact = z.infer<typeof customerContactSchema>;
export type CustomerCylinderDiscount = z.infer<typeof customerCylinderDiscountSchema>; 