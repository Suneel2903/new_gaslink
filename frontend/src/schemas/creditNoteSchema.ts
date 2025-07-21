import { z } from 'zod';

// Credit Note Schema for react-hook-form + zod
// TODO: Add async validation for amount if needed
export const creditNoteSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreditNoteFormData = z.infer<typeof creditNoteSchema>; 