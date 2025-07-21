import { z } from 'zod';

export const customerSchema = z.object({
  customer_code: z
    .string()
    .min(1, 'Customer code is required')
    .min(2, 'Customer code must be at least 2 characters')
    .max(50, 'Customer code cannot exceed 50 characters'),
  business_name: z
    .string()
    .optional(),
  contact_person: z
    .string()
    .min(1, 'Contact person is required')
    .min(2, 'Contact person must be at least 2 characters')
    .max(100, 'Contact person cannot exceed 100 characters'),
  email: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address',
    }),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number')
    .min(10, 'Phone number must be at least 10 digits'),
  address_line1: z
    .string()
    .min(1, 'Address line 1 is required')
    .min(5, 'Address line 1 must be at least 5 characters'),
  address_line2: z
    .string()
    .optional(),
  city: z
    .string()
    .min(1, 'City is required')
    .min(2, 'City must be at least 2 characters'),
  state: z
    .string()
    .min(1, 'State is required')
    .min(2, 'State must be at least 2 characters'),
  postal_code: z
    .string()
    .optional(),
  country: z
    .string()
    .optional(),
  credit_limit: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Credit limit must be a positive number',
    }),
  credit_period_days: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Credit period must be a positive number',
    }),
  payment_terms: z
    .string()
    .optional(),
  discount: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Discount must be a positive number',
    }),
});

export type CustomerFormData = z.infer<typeof customerSchema>; 