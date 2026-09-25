export type InvoiceStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Invoice {
  id: string;
  invoice_number: string;
  work_order_id: string;
  contractor_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  due_date: string;
  notes?: string | null;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  work_order_tracking?: string;
  work_order_title?: string;
  work_order_status?: string;
  work_order_category?: string;
  contractor_name?: string;
  contractor_reg?: string;
  contractor_email?: string;
  contractor_phone?: string;
  facility_name?: string;
}

export interface InvoiceSummary {
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  totalApproved: number;
}

export interface CreateInvoiceInput {
  work_order_id: string;
  contractor_id: string;
  amount: number;
  tax_amount?: number;
  due_date: string;
  notes?: string;
}

export interface UpdateInvoiceStatusInput {
  status: InvoiceStatus;
  notes?: string;
}
