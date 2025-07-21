import axiosInstance from './axiosInstance';
import { auth } from './firebase';
import type {
  Invoice,
  InvoiceListResponse,
  DisputeRequest,
  CreditNoteRequest,
  InvoiceGenerationCheck,
  Dispute,
  CreditNote,
  AC4ERVInvoice,
  OutgoingERV
} from '../types';

class InvoiceService {
  // Create invoice from delivered order
  async createFromOrder(orderId: string): Promise<{ message: string; invoice: Invoice }> {
    const response = await axiosInstance.post(`/invoices/create-from-order/${orderId}`);
    return response.data;
  }

  // Get all invoices with pagination and filters
  async getAllInvoices(params?: {
    distributor_id?: string;
    status?: string;
    customer_id?: string;
    page?: number;
    limit?: number;
  }): Promise<InvoiceListResponse> {
    const response = await axiosInstance.get('/invoices', { params });
    return response.data;
  }

  // Get specific invoice by ID
  async getInvoice(id: string): Promise<{ invoice: Invoice }> {
    const response = await axiosInstance.get(`/invoices/${id}`);
    return response.data;
  }

  // Raise dispute on invoice
  async raiseDispute(invoiceId: string, data: DisputeRequest): Promise<{ message: string; dispute: Dispute }> {
    const response = await axiosInstance.post(`/invoices/${invoiceId}/dispute`, data);
    return response.data;
  }

  // Issue credit note for invoice
  async issueCreditNote(invoiceId: string, data: CreditNoteRequest): Promise<{ message: string; credit_note: CreditNote }> {
    const response = await axiosInstance.post(`/invoices/${invoiceId}/credit-note`, data);
    return response.data;
  }

  // Cancel invoice
  async cancelInvoice(invoiceId: string): Promise<{ message: string; inventory_adjustments_created: number }> {
    const response = await axiosInstance.post(`/invoices/${invoiceId}/cancel`);
    return response.data;
  }

  // Update invoice statuses (cron job)
  async updateStatuses(): Promise<{ message: string; overdue_invoices_updated: number; total_overdue_invoices: number }> {
    const response = await axiosInstance.post('/invoices/update-statuses');
    return response.data;
  }

  // Check if invoice can be generated for order
  async checkInvoiceGeneration(orderId: string): Promise<InvoiceGenerationCheck> {
    const response = await axiosInstance.get(`/invoices/from-order/${orderId}`);
    return response.data;
  }

  // Download invoice PDF
  async downloadInvoice(id: string): Promise<Blob> {
    const response = await axiosInstance.get(`/invoices/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Fetch invoice by order ID
  async fetchInvoiceByOrderId(order_id: string): Promise<Invoice> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axiosInstance.get(
      `${import.meta.env['VITE_API_BASE_URL']}/invoices/from-order/${order_id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }

  // Batch check invoices for multiple order_ids
  async checkMultipleInvoices(orderIds: string[]): Promise<Record<string, { invoice_id: string; status: string } | null>> {
    const response = await axiosInstance.post('/invoices/check-multiple', { order_ids: orderIds });
    return response.data;
  }

  // Upload invoice PDF for OCR extraction
  async uploadInvoicePDF(file: File): Promise<{ success: boolean; items_inserted: number }> {
    const token = await auth.currentUser?.getIdToken(true);
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await axiosInstance.post(
      `${import.meta.env['VITE_API_BASE_URL']}/ocr/invoice/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Fetch all AC4/ERV invoices for review
  async fetchCorporationInvoices(): Promise<AC4ERVInvoice[]> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axiosInstance.get(
      `${import.meta.env['VITE_API_BASE_URL']}/ocr/corporation-invoices`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.invoices;
  }

  // Upload ERV PDF for OCR extraction
  async uploadERVPDF(file: File): Promise<{ success: boolean }> {
    const token = await auth.currentUser?.getIdToken(true);
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await axiosInstance.post(
      `${import.meta.env['VITE_API_BASE_URL']}/ocr/erv/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Fetch all outgoing ERVs for review
  async fetchOutgoingERVs(): Promise<OutgoingERV[]> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axiosInstance.get(
      `${import.meta.env['VITE_API_BASE_URL']}/ocr/outgoing-ervs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.ervs;
  }

  // Generate GST E-Invoice for an invoice
  async generateEinvoice(invoiceId: string): Promise<any> {
    const response = await axiosInstance.post(`/gst/generate/${invoiceId}`);
    return response.data;
  }
}

export default new InvoiceService();

// Legacy function for backward compatibility
export const fetchInvoiceByOrderId = async (order_id: string) => {
  const token = await auth.currentUser?.getIdToken(true);
  const response = await axiosInstance.get(
    `${import.meta.env['VITE_API_BASE_URL']}/invoices/from-order/${order_id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}; 