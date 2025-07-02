import { apiClient } from './apiClient';

export interface Payment {
  payment_id: string;
  customer_id: string;
  distributor_id: string;
  customer_name: string;
  phone: string;
  distributor_name: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  allocation_mode: 'auto' | 'manual';
  received_by_name: string;
  received_at: string;
  notes?: string;
  created_at: string;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  allocation_id: string;
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  allocated_amount: number;
  invoice_status: string;
}

export interface CreatePaymentRequest {
  customer_id: string;
  distributor_id: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  allocation_mode: 'auto' | 'manual';
  notes?: string;
  allocations?: Array<{ invoice_id: string; allocated_amount: number }>;
}

export interface OutstandingInvoice {
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  allocated_amount: number;
  outstanding_amount: number;
  status: string;
  created_at: string;
}

export interface PaymentSummary {
  total_payments: number;
  total_amount: number;
  payment_method: string;
  allocation_mode: string;
}

export const paymentService = {
  // Get all payments
  getAllPayments: async (): Promise<Payment[]> => {
    const response = await apiClient.get('/payments');
    return response.data;
  },

  // Get payment by ID
  getPaymentById: async (paymentId: string): Promise<Payment> => {
    const response = await apiClient.get(`/payments/${paymentId}`);
    return response.data;
  },

  // Create new payment
  createPayment: async (paymentData: CreatePaymentRequest): Promise<Payment> => {
    const response = await apiClient.post('/payments', paymentData);
    return response.data;
  },

  // Get outstanding invoices for customer
  getOutstandingInvoices: async (customerId: string): Promise<OutstandingInvoice[]> => {
    const response = await apiClient.get(`/payments/outstanding/${customerId}`);
    return response.data;
  },

  // Get payment summary/reports
  getPaymentSummary: async (params?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    distributorId?: string;
  }): Promise<PaymentSummary[]> => {
    const response = await apiClient.get('/payments/summary/reports', { params });
    return response.data;
  }
}; 