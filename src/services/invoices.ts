import api from './api';
import { Invoice, InvoiceSummary, CreateInvoiceInput, UpdateInvoiceStatusInput } from '@/types/invoice';

export const invoiceService = {
  async getInvoices(params?: { status?: string; contractorId?: string; facilityId?: string; search?: string; page?: number; limit?: number }) {
    const res = await api.get('/invoices', { params });
    return {
      invoices: (res.data.data || []) as Invoice[],
      meta: res.data.meta || { total: 0, page: 1, limit: 20, totalPages: 1 },
      summary: (res.data.extra || { totalBilled: 0, totalPaid: 0, totalPending: 0, totalApproved: 0 }) as InvoiceSummary
    };
  },

  async getFinancialSummary() {
    const res = await api.get('/invoices/summary');
    return res.data.data as InvoiceSummary;
  },

  async getInvoiceById(id: string) {
    const res = await api.get(`/invoices/${id}`);
    return res.data.data as Invoice;
  },

  async createInvoice(data: CreateInvoiceInput) {
    const res = await api.post('/invoices', data);
    return res.data.data as Invoice;
  },

  async updateInvoiceStatus(id: string, data: UpdateInvoiceStatusInput) {
    const res = await api.patch(`/invoices/${id}/status`, data);
    return res.data.data as Invoice;
  }
};
