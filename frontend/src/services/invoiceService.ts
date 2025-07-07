import apiClient from './apiClient';
import { auth } from './firebase';
import axios from 'axios';

export interface InvoiceItem {
  invoice_item_id: string;
  cylinder_type_id: string;
  quantity: number;
  unit_price: number;
  discount_per_unit: number;
  total_price: number;
  cylinder_type_name: string;
}

export interface Invoice {
  invoice_id: string;
  distributor_id: string;
  customer_id: string;
  order_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  issued_by?: string;
  due_date_overridden: boolean;
  credit_period_overridden: boolean;
  overridden_by?: string;
  overridden_at?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
  // Additional fields from joins
  business_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  total_credits?: number;
  outstanding_amount?: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DisputeRequest {
  reason: string;
  dispute_type?: 'amount' | 'quantity';
  disputed_amount?: number;
  disputed_quantities?: { [cylinder_type_id: string]: number };
  description?: string;
}

export interface CreditNoteRequest {
  amount: number;
  reason: string;
}

export interface InvoiceGenerationCheck {
  can_generate: boolean;
  order_status: string;
  existing_invoice: string | null;
  message: string;
}

class InvoiceService {
  // Create invoice from delivered order
  async createFromOrder(orderId: string): Promise<{ message: string; invoice: Invoice }> {
    const response = await apiClient.post(`/invoices/create-from-order/${orderId}`);
    return response.data;
  }

  // Get all invoices with pagination and filters
  async getAllInvoices(params?: {
    status?: string;
    customer_id?: string;
    page?: number;
    limit?: number;
  }): Promise<InvoiceListResponse> {
    const response = await apiClient.get('/invoices', { params });
    return response.data;
  }

  // Get specific invoice by ID
  async getInvoice(id: string): Promise<{ invoice: Invoice }> {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data;
  }

  // Raise dispute on invoice
  async raiseDispute(invoiceId: string, data: DisputeRequest): Promise<{ message: string; dispute: any }> {
    const response = await apiClient.post(`/invoices/${invoiceId}/dispute`, data);
    return response.data;
  }

  // Issue credit note for invoice
  async issueCreditNote(invoiceId: string, data: CreditNoteRequest): Promise<{ message: string; credit_note: any }> {
    const response = await apiClient.post(`/invoices/${invoiceId}/credit-note`, data);
    return response.data;
  }

  // Cancel invoice
  async cancelInvoice(invoiceId: string): Promise<{ message: string; inventory_adjustments_created: number }> {
    const response = await apiClient.post(`/invoices/${invoiceId}/cancel`);
    return response.data;
  }

  // Update invoice statuses (cron job)
  async updateStatuses(): Promise<{ message: string; overdue_invoices_updated: number; total_overdue_invoices: number }> {
    const response = await apiClient.post('/invoices/update-statuses');
    return response.data;
  }

  // Check if invoice can be generated for order
  async checkInvoiceGeneration(orderId: string): Promise<InvoiceGenerationCheck> {
    const response = await apiClient.get(`/invoices/from-order/${orderId}`);
    return response.data;
  }

  // Download invoice PDF
  async downloadInvoice(id: string): Promise<Blob> {
    const response = await apiClient.get(`/invoices/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Fetch invoice by order ID
  async fetchInvoiceByOrderId(order_id: string): Promise<Invoice> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/invoices/from-order/${order_id}`,
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
    const response = await apiClient.post('/invoices/check-multiple', { order_ids: orderIds });
    return response.data;
  }

  // Upload invoice PDF for OCR extraction
  async uploadInvoicePDF(file: File): Promise<{ success: boolean; items_inserted: number }> {
    const token = await auth.currentUser?.getIdToken(true);
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/ocr/invoice/upload`,
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

  // Fetch all corporation invoices for review
  async fetchCorporationInvoices(): Promise<any[]> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/ocr/corporation-invoices`,
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
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/ocr/erv/upload`,
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

  // Fetch all outgoing ERVs
  async fetchOutgoingERVs(): Promise<any[]> {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/ocr/outgoing-ervs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.ervs;
  }
}

export default new InvoiceService();
export const fetchInvoiceByOrderId = async (order_id: string) => {
  const token = await auth.currentUser?.getIdToken(true);
  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL}/invoices/from-order/${order_id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}; 