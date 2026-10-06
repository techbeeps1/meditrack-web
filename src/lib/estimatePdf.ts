import { formatCurrency, formatDate } from './utils';

export interface EstimateLineItem {
  code: string;
  description: string;
  qty: number | string;
  unit_cost: number | string;
  total: number | string;
}

export interface EstimatePdfData {
  estimate_number: string;
  estimate_date?: string | null;
  expiry_date?: string | null;
  work_order_tracking?: string | null;
  work_order_title?: string | null;
  
  // Customer Details
  customer_name?: string | null;
  customer_contact?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;

  // Assessor / Estimator Details
  estimate_by_name?: string | null;
  estimate_by_role?: string | null;
  estimate_by_charge_code?: string | null;
  estimate_by_phone?: string | null;
  estimate_by_email?: string | null;

  // Items & Financials
  items?: EstimateLineItem[];
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  total_amount?: number;

  // Comments & Notes
  comments?: string | null;
}

export function downloadEstimatePdf(data: EstimatePdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the Estimate Form PDF.');
    return;
  }

  const estDate = data.estimate_date 
    ? formatDate(data.estimate_date) 
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const expDate = data.expiry_date 
    ? formatDate(data.expiry_date) 
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      })();

  const subtotal = Number(data.subtotal || 0);
  const tax = data.tax_amount !== undefined ? Number(data.tax_amount) : Math.round(subtotal * 0.15 * 100) / 100;
  const shipping = Number(data.shipping_amount || 0);
  const discount = Number(data.discount_amount || 0);
  // Total is always mathematically consistent: Subtotal + Tax + Shipping - Discount
  const total = Math.round((subtotal + tax + shipping - discount) * 100) / 100;

  // If specific items passed, use them; otherwise create 1 exact row matching the recorded assessment
  const items: EstimateLineItem[] = (data.items && data.items.length > 0) ? data.items : [
    {
      code: data.estimate_by_charge_code || 'ONS',
      description: data.work_order_title 
        ? `${data.estimate_by_charge_code ? `[${data.estimate_by_charge_code}] ` : ''}Technical Assessment & Maintenance Scoping — ${data.work_order_title}`
        : 'Technical Engineering Assessment & Maintenance Scoping',
      qty: 1,
      unit_cost: subtotal,
      total: subtotal
    }
  ];

  // Fill up table rows up to 7 rows for standard aesthetic look
  const rowCount = Math.max(7, items.length);
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    if (i < items.length) {
      rows.push(items[i]);
    } else {
      rows.push({ code: '', description: '', qty: '', unit_cost: '', total: '' });
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Estimate - ${data.estimate_number}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 16mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      padding: 30px;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .estimate-container {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #2B7A9B;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-logo {
      height: 44px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
    }
    .company-title {
      font-size: 15px;
      font-weight: 800;
      color: #2B7A9B;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-tagline {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .main-title {
      font-size: 32px;
      font-weight: 900;
      color: #0f172a;
      text-align: center;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .estimate-num-row {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 24px;
    }
    .estimate-num-val {
      color: #0f172a;
      font-weight: 800;
      border-bottom: 1px solid #94a3b8;
      padding: 0 12px 2px 12px;
      display: inline-block;
    }
    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 20px;
    }
    .col-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: 8px;
    }
    .field-line {
      border-bottom: 1px solid #cbd5e1;
      padding: 4px 6px;
      min-height: 24px;
      font-size: 12px;
      color: #334155;
    }
    .field-line strong {
      color: #0f172a;
    }
    .date-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 20px;
    }
    .date-field-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .date-label {
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
    }
    .date-box {
      border-bottom: 1px solid #94a3b8;
      flex: 1;
      padding: 2px 6px;
      font-weight: 600;
      color: #1e293b;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .table th {
      background: #e2e8f0;
      color: #0f172a;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 10px;
      border: 1px solid #94a3b8;
      text-align: left;
    }
    .table th.text-center {
      text-align: center;
    }
    .table th.text-right {
      text-align: right;
    }
    .table td {
      padding: 7px 10px;
      font-size: 12px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      height: 28px;
    }
    .table td.text-center {
      text-align: center;
    }
    .table td.text-right {
      text-align: right;
    }
    .bottom-layout {
      display: grid;
      grid-template-columns: 1.3fr 0.9fr;
      gap: 20px;
      align-items: flex-start;
      margin-top: 6px;
    }
    .comments-box {
      border: 1px solid #94a3b8;
      border-radius: 2px;
      padding: 10px 12px;
      min-height: 120px;
    }
    .comments-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .comments-text {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.45;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 5px 8px;
      font-size: 12px;
      border: 1px solid #94a3b8;
    }
    .summary-table td.label-col {
      font-weight: 600;
      color: #0f172a;
      background: #f8fafc;
      width: 50%;
      text-align: left;
    }
    .summary-table td.val-col {
      text-align: right;
      font-weight: 700;
      font-family: monospace;
      color: #1e293b;
      width: 50%;
    }
    .summary-table tr.total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      background: #f1f5f9;
      font-size: 13.5px;
      font-weight: 800;
    }
    .summary-table tr.total-row td.val-col {
      color: #2B7A9B;
    }
    .footer-stamp {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-family: monospace;
    }
    .print-actions {
      margin-bottom: 20px;
      text-align: center;
    }
    .print-btn {
      background: #2B7A9B;
      color: #ffffff;
      border: none;
      padding: 9px 24px;
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

  <div class="estimate-container">
    <!-- Top Company Header -->
    <div class="top-company-header">
      <div class="company-brand">
        <img src="${logoUrl}" alt="Company Logo" class="company-logo" />
        <div>
          <div class="company-title">QUANTUM BUILT / MEDITRACK</div>
          <div class="company-tagline">Healthcare Infrastructure & Engineering Assessment Division</div>
        </div>
      </div>
      <div style="font-size: 11px; color: #64748b; text-align: right;">
        Ref: <strong>${data.work_order_tracking || 'WO-REF'}</strong>
      </div>
    </div>

    <!-- Title & Estimate Number -->
    <div class="main-title">Estimate</div>
    <div class="estimate-num-row">
      Estimate Number <span class="estimate-num-val">${data.estimate_number}</span>
    </div>

    <!-- 2 Column Block: Customer vs Estimate By -->
    <div class="two-col-grid">
      <div>
        <div class="col-title">Customer</div>
        <div class="field-line"><strong>Client:</strong> ${data.customer_name || 'Northern Cape Department of Health'}</div>
        <div class="field-line"><strong>Facility:</strong> ${data.facility_name || 'Hospital Campus'}</div>
        <div class="field-line"><strong>Contact / FM:</strong> ${data.customer_contact || 'Site Facilities Manager'}</div>
        <div class="field-line"><strong>Address:</strong> ${data.facility_address || 'Northern Cape, South Africa'}</div>
      </div>

      <div>
        <div class="col-title">Estimate By</div>
        <div class="field-line"><strong>Assessor:</strong> ${data.estimate_by_name || 'David Vance (Site Works Assessor)'}</div>
        <div class="field-line"><strong>Role / Scope:</strong> ${data.estimate_by_role || 'Works Engineer / HVAC Specialist'}</div>
        <div class="field-line"><strong>Charge Code:</strong> ${data.estimate_by_charge_code || 'ONS'} (${data.estimate_by_charge_code === 'ONS' ? 'Onsite Technical Inspection' : data.estimate_by_charge_code === 'PRE' ? 'Pre-Estimation Scoping' : 'Gazette Standard'})</div>
        <div class="field-line"><strong>Contact:</strong> ${data.estimate_by_phone || '+27 82 450 1192'} | ${data.estimate_by_email || 'assessment@quantumbuilt.co.za'}</div>
      </div>
    </div>

    <!-- Date Section -->
    <div class="date-grid">
      <div class="date-field-group">
        <span class="date-label">Estimate Date</span>
        <div class="date-box">${estDate}</div>
      </div>
      <div class="date-field-group">
        <span class="date-label">Expiry Date</span>
        <div class="date-box">${expDate}</div>
      </div>
    </div>

    <!-- Itemized Assessment Table -->
    <table class="table">
      <thead>
        <tr>
          <th style="width: 16%;">Item Code</th>
          <th style="width: 48%;">Description</th>
          <th style="width: 8%;" class="text-center">Qty</th>
          <th style="width: 14%;" class="text-right">Unit Cost</th>
          <th style="width: 14%;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td style="font-weight: 600; font-family: monospace;">${r.code || ''}</td>
            <td>${r.description || ''}</td>
            <td class="text-center">${r.qty !== '' ? r.qty : ''}</td>
            <td class="text-right">${r.unit_cost !== '' ? formatCurrency(Number(r.unit_cost)) : ''}</td>
            <td class="text-right" style="font-weight: 600;">${r.total !== '' ? formatCurrency(Number(r.total)) : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Bottom Layout: Comments & Summary -->
    <div class="bottom-layout">
      <div class="comments-box">
        <div class="comments-title">Comments</div>
        <div class="comments-text">
          ${data.comments || `Initial technical assessment & diagnostic verification for ticket ${data.work_order_tracking}. Recommended scope includes compressor overhaul, electrical safety check, and parts replacement in accordance with SANS 10400 healthcare compliance.`}
        </div>
      </div>

      <table class="summary-table">
        <tbody>
          <tr>
            <td class="label-col">Subtotal</td>
            <td class="val-col">${formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <td class="label-col">Tax (15% VAT)</td>
            <td class="val-col">${formatCurrency(tax)}</td>
          </tr>
          <tr>
            <td class="label-col">Shipping</td>
            <td class="val-col">${shipping > 0 ? formatCurrency(shipping) : '-'}</td>
          </tr>
          <tr>
            <td class="label-col">Discount</td>
            <td class="val-col">${discount > 0 ? `-${formatCurrency(discount)}` : '-'}</td>
          </tr>
          <tr class="total-row">
            <td class="label-col">Total</td>
            <td class="val-col">${formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Security Stamp -->
    <div class="footer-stamp">
      <span>MEDITRACK STATUTORY ASSESSMENT FORM &bull; SLA VERIFIED</span>
      <span>WO: ${data.work_order_tracking || 'REF'}</span>
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
