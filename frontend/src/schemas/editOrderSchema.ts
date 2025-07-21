import { z } from 'zod';

export const editOrderItemSchema = z.object({
  cylinder_type_id: z.string().min(1, 'Cylinder type is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(1000, 'Quantity cannot exceed 1000'),
});

export const editOrderSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  delivery_date: z.string().min(1, 'Delivery date is required'),
  items: z.array(editOrderItemSchema).min(1, 'At least one item is required'),
});

export type EditOrderFormData = z.infer<typeof editOrderSchema>; 