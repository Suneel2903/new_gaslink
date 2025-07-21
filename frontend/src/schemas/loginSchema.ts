// Dev Notes:
// - Use z.object({...}) to define your schema fields and validation rules.
// - Use zodResolver(schema) with react-hook-form's useForm for validation.
// - Use z.infer<typeof schema> for TypeScript types.
// - Use reset() to set defaultValues for edit forms.
// - See other schemas in this folder for more patterns.
// - TODO: For async validation (e.g., duplicate email), use .refine(async (...)) or handle in onSubmit.

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>; 