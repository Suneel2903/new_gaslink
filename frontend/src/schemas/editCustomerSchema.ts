import { z } from 'zod';

// Edit Customer Schema for react-hook-form + zod
// TODO: Add async validation for duplicate email check
export const editCustomerSchema = z.object({
  business_name: z.string().optional(),
  contact_person: z.string().min(1, 'Contact person is required'),
  phone: z.string().min(1, 'Phone number is required').regex(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number').min(10, 'Phone number must be at least 10 digits'),
  email: z.string().optional().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Please enter a valid email address',
  }),
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postal_code: z.string().optional(),
  credit_period_days: z.string().optional().refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Credit period must be a positive number',
  }),
});

export type EditCustomerFormData = z.infer<typeof editCustomerSchema>; 