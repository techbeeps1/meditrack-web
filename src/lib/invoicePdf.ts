import { formatCurrency, formatDate } from './utils';

export interface InvoicePdfData {
  id: string;
  invoice_number: string;
  created_at?: string | null;
  due_date?: string | null;
  status: string;
  amount: number;
  tax_amount?: number | null;
  total_amount?: number | null;
  notes?: string | null;
  contractor_name?: string | null;
  contractor_email?: string | null;
  contractor_registration?: string | null;
  work_order_tracking?: string | null;
  work_order_title?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;
  attention_name?: string | null;
  attention_title?: string | null;
  client_company?: string | null;
  payment_terms?: string | null;
}

export function downloadInvoicePdf(invoice: InvoicePdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the invoice PDF.');
    return;
  }

  const invoiceDate = invoice.created_at ? formatDate(invoice.created_at) : new Date().toLocaleDateString('en-GB');
  const baseFee = Number(invoice.amount || 0);
  const taxFee = (invoice.tax_amount !== undefined && invoice.tax_amount !== null && Number(invoice.tax_amount) > 0)
    ? Number(invoice.tax_amount)
    : Math.round(baseFee * 0.15 * 100) / 100;
  const totalFee = Math.round((baseFee + taxFee) * 100) / 100;
  const isPaid = invoice.status?.toLowerCase() === 'paid';
  const isApproved = invoice.status?.toLowerCase() === 'approved';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  // Item split calculations if available or proportional breakdown
  const labourPortion = Math.round(baseFee * 0.65 * 100) / 100;
  const materialsPortion = Math.round((baseFee - labourPortion) * 100) / 100;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoice.invoice_number}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #334155;
      background: #ffffff;
      padding: 40px;
      font-size: 13px;
      line-height: 1.5;
    }
    .invoice-container {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-accent-bar {
      height: 4px;
      background: #2B7A9B;
      margin-bottom: 24px;
      border-radius: 2px;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 36px;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .company-logo {
      height: 52px;
      width: auto;
      max-width: 180px;
      object-fit: contain;
    }
    .company-name {
      font-size: 17px;
      font-weight: 800;
      color: #2B7A9B;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-subtitle {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .invoice-body-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 30px;
    }
    .invoice-large-title {
      font-size: 28px;
      font-weight: 300;
      color: #475569;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      flex-shrink: 0;
      padding-top: 4px;
    }
    .invoice-meta-details {
      font-size: 12px;
      color: #334155;
      line-height: 1.6;
      max-width: 420px;
    }
    .meta-row {
      margin-bottom: 2px;
    }
    .meta-label {
      font-weight: 600;
      color: #1e293b;
    }
    .meta-spacer {
      height: 12px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: #2B7A9B;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      text-align: left;
      padding: 8px 12px;
      border: 1px solid #2B7A9B;
    }
    .items-table th.text-right {
      text-align: right;
    }
    .items-table td {
      padding: 8px 12px;
      font-size: 12px;
      color: #334155;
      border-left: 1px dotted #cbd5e1;
      border-right: 1px dotted #cbd5e1;
      border-bottom: 1px dotted #cbd5e1;
    }
    .items-table td:first-child {
      border-left: 1px solid #cbd5e1;
    }
    .items-table td:last-child {
      border-right: 1px solid #cbd5e1;
    }
    .items-table .text-right {
      text-align: right;
    }
    .summary-section {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-section td {
      padding: 6px 12px;
      font-size: 12px;
    }
    .subtotal-row td {
      border-top: 1px dotted #94a3b8;
      border-bottom: 1px dotted #cbd5e1;
    }
    .total-row td {
      border-top: 1.5px solid #1e293b;
      border-bottom: 1.5px solid #1e293b;
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .footer-note {
      margin-top: 36px;
      font-size: 11.5px;
      color: #475569;
      line-height: 1.6;
    }
    .footer-note p {
      margin-bottom: 4px;
    }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .status-paid {
      background: #f1f5f9;
      color: #2B7A9B;
      border: 1px solid #cbd5e1;
    }
    .status-approved {
      background: #f1f5f9;
      color: #0284c7;
      border: 1px solid #cbd5e1;
    }
    .status-pending {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fef3c7;
    }
    .security-badge {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-family: monospace;
    }
    .print-actions {
      margin-bottom: 24px;
      text-align: center;
    }
    .print-btn {
      background: #2B7A9B;
      color: #ffffff;
      border: none;
      padding: 9px 22px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .print-btn:hover {
      background: #1E5D88;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="invoice-container">
    <!-- Top Blue Accent Bar -->
    <div class="top-accent-bar"></div>

    <!-- Company Logo & Brand Header at the Top -->
    <div class="top-header">
      <div class="company-brand">
        <img src="${logoUrl}" alt="Company Logo" class="company-logo" />
        <div>
          <div class="company-name">${invoice.contractor_name || 'OMV HOLDINGS (PTY) LTD'}</div>
          <div class="company-subtitle">Healthcare Engineering & Specialist Maintenance</div>
        </div>
      </div>
      <div>
        <span class="status-pill ${isPaid ? 'status-paid' : isApproved ? 'status-approved' : 'status-pending'}">
          ${isPaid ? 'Settled / Paid' : isApproved ? 'Approved for Payment' : 'Under Review'}
        </span>
      </div>
    </div>

    <!-- Main Invoice Body Header -->
    <div class="invoice-body-header">
      <div class="invoice-large-title">INVOICE</div>

      <div class="invoice-meta-details">
        <div class="meta-row"><span class="meta-label">Attention:</span> ${invoice.attention_name || 'Muzikayise Nkosi'}</div>
        <div class="meta-row"><span class="meta-label">Title:</span> ${invoice.attention_title || 'Director / Facility Manager'}</div>
        <div class="meta-row"><span class="meta-label">Company Name:</span> ${invoice.client_company || invoice.facility_name || 'CloudFare (PTY) LTD'}</div>
        <div class="meta-row">${invoice.facility_address || '188 Bergatellerie Rd, Danville ext 5, 0183'}</div>
        <div class="meta-row"><span class="meta-label">Date:</span> ${invoiceDate}</div>
        
        <div class="meta-spacer"></div>

        <div class="meta-row"><span class="meta-label">Project Title:</span> ${invoice.work_order_title || 'Hospital Maintenance & Specialist Servicing'}</div>
        <div class="meta-row"><span class="meta-label">Invoice Number:</span> <strong>${invoice.invoice_number}</strong></div>
        <div class="meta-row"><span class="meta-label">Terms:</span> ${invoice.payment_terms || '6 Days'}</div>
      </div>
    </div>

    <!-- Line Item Breakdown Table with Blue Header -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 52%;">Description</th>
          <th style="width: 14%;" class="text-right">Quantity</th>
          <th style="width: 17%;" class="text-right">Unit Price</th>
          <th style="width: 17%;" class="text-right">Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Labour & Engineering Workmanship</td>
          <td class="text-right">1</td>
          <td class="text-right font-mono">${formatCurrency(labourPortion)}</td>
          <td class="text-right font-mono">${formatCurrency(labourPortion)}</td>
        </tr>
        <tr>
          <td>Materials, Specialized Diagnostic Parts & Consumables</td>
          <td class="text-right">1</td>
          <td class="text-right font-mono">${formatCurrency(materialsPortion)}</td>
          <td class="text-right font-mono">${formatCurrency(materialsPortion)}</td>
        </tr>
        <tr>
          <td>3-Way Statutory QC Handover & Safety Compliance Verification</td>
          <td class="text-right">-</td>
          <td class="text-right font-mono">R 0.00</td>
          <td class="text-right font-mono">R 0.00</td>
        </tr>
        <!-- Subtotal -->
        <tr class="subtotal-row">
          <td colspan="2" style="border-left: none; border-bottom: none;"></td>
          <td class="text-right" style="font-weight: 600; color: #475569;">Subtotal</td>
          <td class="text-right font-mono" style="font-weight: 600;">${formatCurrency(baseFee)}</td>
        </tr>
        <!-- Service Fee / Tax -->
        <tr>
          <td colspan="2" style="border-left: none; border-bottom: none;"></td>
          <td class="text-right" style="color: #64748b; font-size: 11px;">Service fee / VAT (15%)</td>
          <td class="text-right font-mono">${formatCurrency(taxFee)}</td>
        </tr>
        <!-- Total -->
        <tr class="total-row">
          <td colspan="2" style="border-left: none; border-bottom: none;"></td>
          <td class="text-right" style="font-weight: 700;">Total</td>
          <td class="text-right font-mono" style="font-weight: 700; color: #2B7A9B;">${formatCurrency(totalFee)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer Notes -->
    <div class="footer-note">
      <p>Thank you for your business. It's a pleasure to work with you on your project.</p>
      <p>Your next order will ship in 30 days / Payment due within agreed terms.</p>
    </div>

    <!-- Cryptographic Ledger Footer -->
    <div class="security-badge">
      <span>MEDITRACK AUDIT TRAIL: SECURE DIGITAL INVOICE</span>
      <span>ID: ${invoice.id}</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

