import apiClient from './apiClient';
import type {
  Payment,
  CreatePaymentRequest,
  OutstandingInvoice,
  PaymentSummary
} from '../types';

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