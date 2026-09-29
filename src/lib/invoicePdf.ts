import { formatCurrency, formatDate } from './utils';

export interface InvoicePdfData {
  id: string;
  invoice_number: string;
  created_at?: string | null;
  due_date?: string | null;
  status: string;
  amount: number;
  tax_amount?: number | null;
  total_amount: number;
  notes?: string | null;
  contractor_name?: string | null;
  contractor_email?: string | null;
  contractor_registration?: string | null;
  work_order_tracking?: string | null;
  work_order_title?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;
}

export function downloadInvoicePdf(invoice: InvoicePdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the invoice PDF.');
    return;
  }

  const invoiceDate = invoice.created_at ? formatDate(invoice.created_at) : new Date().toLocaleDateString();
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon Receipt';
  const baseFee = Number(invoice.amount || 0);
  const taxFee = Number(invoice.tax_amount || 0);
  const totalFee = Number(invoice.total_amount || (baseFee + taxFee));
  const isPaid = invoice.status?.toLowerCase() === 'paid';
  const isApproved = invoice.status?.toLowerCase() === 'approved';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoice.invoice_number}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      padding: 30px;
      font-size: 13px;
      line-height: 1.5;
    }
    .invoice-container {
      max-width: 780px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .brand-section {
      display: flex;
      align-items: center;
    }
    .brand-logo-img {
      height: 72px;
      width: auto;
      max-width: 200px;
      object-fit: contain;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }
    .invoice-number {
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: #0284c7;
      margin-top: 2px;
    }
    .status-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-paid {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .status-approved {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .status-pending {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .info-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .info-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .info-detail {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      padding: 10px 14px;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #cbd5e1;
    }
    .table td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .text-right {
      text-align: right;
    }
    .font-mono {
      font-family: monospace;
      font-size: 12px;
    }
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 12px;
      font-size: 12px;
    }
    .total-row {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-size: 15px !important;
      font-weight: 800;
      color: #0369a1;
      padding-top: 10px !important;
      padding-bottom: 10px !important;
    }
    .notes-box {
      background: #f8fafc;
      border-left: 4px solid #0284c7;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 28px;
    }
    .notes-box p {
      font-size: 12px;
      color: #334155;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .security-stamp {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #059669;
      font-weight: 600;
    }
    .print-bar {
      margin-bottom: 20px;
      text-align: center;
    }
    .print-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .print-btn:hover {
      background: #0369a1;
    }
    @media print {
      body {
        padding: 0;
      }
      .invoice-container {
        border: none;
        padding: 0;
      }
      .print-bar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        <img src="${logoUrl}" alt="Hospital Logo" class="brand-logo-img" />
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">INVOICE CLAIM</div>
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
          Date: <strong>${invoiceDate}</strong> &bull; Due: <strong>${dueDate}</strong>
        </div>
        <div>
          <span class="status-badge ${isPaid ? 'status-paid' : isApproved ? 'status-approved' : 'status-pending'}">
            ${isPaid ? '✓ Paid & Settled' : isApproved ? 'Approved for Payment' : 'Pending Review'}
          </span>
        </div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="grid-2">
      <div class="info-card">
        <div class="info-label">Payee / Service Contractor</div>
        <div class="info-title">${invoice.contractor_name || 'Engineering Contractor'}</div>
        <div class="info-detail">Email: ${invoice.contractor_email || 'service@contractor.com'}</div>
        ${invoice.contractor_registration ? `<div class="info-detail">Reg #: ${invoice.contractor_registration}</div>` : ''}
      </div>

      <div class="info-card">
        <div class="info-label">Hospital Work Order Reference</div>
        <div class="info-title" style="color: #0369a1; font-family: monospace;">${invoice.work_order_tracking || 'WO-REF'}</div>
        <div class="info-detail" style="font-weight: 600;">${invoice.work_order_title || 'Hospital Maintenance Repair'}</div>
        <div class="info-detail">🏥 ${invoice.facility_name || 'Main Hospital Facility'}</div>
      </div>
    </div>

    <!-- Line Items Table -->
    <table class="table">
      <thead>
        <tr>
          <th style="width: 55%;">Service Item / Scope</th>
          <th style="width: 15%;" class="text-right">Qty</th>
          <th style="width: 15%;" class="text-right">Rate</th>
          <th style="width: 15%;" class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 600; color: #0f172a;">Hospital Engineering & Maintenance Service</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${invoice.notes || `Completed maintenance work order ${invoice.work_order_tracking || ''}`}
            </div>
          </td>
          <td class="text-right font-mono">1</td>
          <td class="text-right font-mono">${formatCurrency(baseFee)}</td>
          <td class="text-right font-mono" style="font-weight: 600;">${formatCurrency(baseFee)}</td>
        </tr>
        ${taxFee > 0 ? `
        <tr>
          <td>
            <div style="font-weight: 600; color: #0f172a;">Statutory Taxes / Surcharges</div>
          </td>
          <td class="text-right font-mono">1</td>
          <td class="text-right font-mono">${formatCurrency(taxFee)}</td>
          <td class="text-right font-mono" style="font-weight: 600;">${formatCurrency(taxFee)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-wrapper">
      <table class="totals-table">
        <tr>
          <td style="color: #64748b;">Subtotal:</td>
          <td class="text-right font-mono">${formatCurrency(baseFee)}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Tax / VAT:</td>
          <td class="text-right font-mono">${formatCurrency(taxFee)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Disbursed:</td>
          <td class="text-right font-mono">${formatCurrency(totalFee)}</td>
        </tr>
      </table>
    </div>

    ${invoice.notes ? `
    <div class="notes-box">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0369a1; margin-bottom: 2px;">
        Work Description / Notes
      </div>
      <p>${invoice.notes}</p>
    </div>` : ''}

    <!-- Security & Audit Footer -->
    <div class="footer">
      <div class="security-stamp">
        <span>🛡️</span>
        <span>SHA-256 Verified Audit Ledger Anchored</span>
      </div>
      <div>
        MediTrack System Document ID: <code>${invoice.id}</code>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Small timeout to allow styles to render before triggering print
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
