import { z } from 'zod';

// Payment Schema for react-hook-form + zod
// TODO: Add async validation for payment reference if needed
export const paymentSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  payment_method: z.string().min(1, 'Payment method is required'),
  payment_reference: z.string().optional(),
  allocation_mode: z.enum(['auto', 'manual']),
  notes: z.string().optional(),
});

export type PaymentFormData = z.infer<typeof paymentSchema>; 