import { formatCurrency, formatDate } from './utils';

export interface WorkOrderPdfData {
  tracking_number: string;
  title: string;
  description: string;
  status: string;
  category: string;
  priority: string;
  urgency_category?: string | null;
  funding_route?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  estimated_days?: number | null;
  facility_name?: string | null;
  facility_address?: string | null;
  facility_city?: string | null;
  location_details?: string | null;
  reported_by_name?: string | null;
  assigned_to_name?: string | null;
  contractor_name?: string | null;
  contractor_contact?: string | null;
  contractor_phone?: string | null;
  contractor_email?: string | null;
  lead_assessor_name?: string | null;
  lead_assessor_role?: string | null;
  charge_code?: string | null;
  assessment_mode?: string | null;
  assessment_notes?: string | null;
  estimated_cost: number;
  actual_cost?: number | null;
  contractor_critical_quote_cost?: number | null;
  system_quote_no?: string | null;
  contractor_quote_ref?: string | null;
}

export function downloadWorkOrderPdf(wo: WorkOrderPdfData) {
  const printWindow = window.open('', '_blank', 'width=900,height=950');
  if (!printWindow) {
    alert('Please allow popups to download/print the Work Order PDF.');
    return;
  }

  const issueDate = wo.created_at
    ? formatDate(wo.created_at)
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueDate = wo.due_date ? formatDate(wo.due_date) : 'Within SLA Framework';
  const approvedBudget = Number(
    wo.actual_cost !== undefined && wo.actual_cost !== null && Number(wo.actual_cost) > 0
      ? wo.actual_cost
      : wo.contractor_critical_quote_cost !== undefined && wo.contractor_critical_quote_cost !== null && Number(wo.contractor_critical_quote_cost) > 0
      ? wo.contractor_critical_quote_cost
      : wo.estimated_cost || 0
  );
  const subtotal = Math.round((approvedBudget / 1.15) * 100) / 100;
  const vat = Math.round((approvedBudget - subtotal) * 100) / 100;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Work Order - ${wo.tracking_number}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm;
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
      font-size: 12px;
      line-height: 1.5;
    }
    .wo-container {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2.5px solid #008DA6;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-logo {
      height: 46px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
    }
    .company-title {
      font-size: 15px;
      font-weight: 800;
      color: #008DA6;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-tagline {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
      margin-top: 1px;
    }
    .doc-badge-col {
      text-align: right;
    }
    .doc-main-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-number {
      font-family: "Courier New", Courier, monospace;
      font-size: 14px;
      font-weight: 700;
      color: #008DA6;
      margin-top: 2px;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .card-heading {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #008DA6;
      letter-spacing: 0.6px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      font-size: 11px;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin: 16px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .scope-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .scope-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .scope-desc {
      font-size: 11.5px;
      color: #334155;
      line-height: 1.6;
      white-space: pre-line;
    }
    .table-spec {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11.5px;
    }
    .table-spec th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 10px;
    }
    .table-spec td {
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .amount-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 16px;
      font-size: 11.5px;
    }
    .amount-table th {
      background: #008DA6;
      color: #ffffff;
      font-weight: 700;
      padding: 7px 10px;
      text-transform: uppercase;
      font-size: 10px;
    }
    .amount-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .totals-block {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .totals-table {
      width: 280px;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .totals-table td {
      padding: 4px 8px;
    }
    .grand-total {
      font-weight: 800;
      font-size: 13px;
      color: #008DA6;
      border-top: 2px solid #008DA6;
      border-bottom: 2px solid #008DA6;
    }
    .instruction-box {
      background: #f8fafc;
      border-left: 3px solid #008DA6;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      font-size: 10.5px;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .sig-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #fcfcfd;
    }
    .sig-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .sig-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 6px;
    }
    .sig-sub {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #94a3b8;
    }
    .no-print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: white;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
    }
    .print-btn {
      background: #008DA6;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #007387;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Official Work Order Document</strong> — ${wo.tracking_number}</div>
    <button class="print-btn" onclick="window.print()">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4"></path></svg>
      Print / Save PDF
    </button>
  </div>

  <div style="height: 36px;" class="no-print-bar-spacer"></div>

  <div class="wo-container">
    <!-- Top Header -->
    <div class="top-company-header">
      <div class="company-brand">
        <img src="${logoUrl}" alt="Logo" class="company-logo" onerror="this.style.display='none'" />
        <div>
          <div class="company-title">Meditrack Healthcare SLA</div>
          <div class="company-tagline">Quantum Built Facilities Management &amp; Engineering</div>
        </div>
      </div>
      <div class="doc-badge-col">
        <div class="doc-main-title">Work Order</div>
        <div class="doc-number">${wo.tracking_number}</div>
        <div class="status-badge">Status: Assigned &amp; Dispatched</div>
      </div>
    </div>

    <!-- 2 Column Overview Details -->
    <div class="grid-2">
      <!-- Facility & Location -->
      <div class="info-card">
        <div class="card-heading">Hospital Facility &amp; Location</div>
        <div class="info-row">
          <span class="info-label">Facility:</span>
          <span class="info-value">${wo.facility_name || 'Healthcare Facility'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location / Room:</span>
          <span class="info-value">${wo.location_details || 'Main Building'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Address:</span>
          <span class="info-value">${wo.facility_address || wo.facility_city || 'Regional Health Complex'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reported By:</span>
          <span class="info-value">${wo.reported_by_name || 'Hospital Staff'}</span>
        </div>
      </div>

      <!-- Contractor & Schedule -->
      <div class="info-card">
        <div class="card-heading">Contractor &amp; Execution Schedule</div>
        <div class="info-row">
          <span class="info-label">Assigned Specialist:</span>
          <span class="info-value" style="color:#008DA6; font-weight:700;">${wo.contractor_name || wo.assigned_to_name || 'Assigned Specialist'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Category:</span>
          <span class="info-value">${wo.category}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Issue Date:</span>
          <span class="info-value">${issueDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Target Due Date:</span>
          <span class="info-value" style="color:#b91c1c; font-weight:700;">${dueDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Urgency SLA:</span>
          <span class="info-value">${wo.urgency_category || wo.priority}</span>
        </div>
      </div>
    </div>

    <!-- Scope of Works -->
    <div class="section-title">1. Scope of Works &amp; Technical Requirements</div>
    <div class="scope-box">
      <div class="scope-title">${wo.title}</div>
      <div class="scope-desc">${wo.description || 'Maintenance and repairs to be executed in strict compliance with healthcare engineering specifications.'}</div>
    </div>

    <!-- Engineering Assessment Reference -->
    <div class="section-title">2. Engineering Assessment &amp; Governance</div>
    <table class="table-spec">
      <thead>
        <tr>
          <th>Assessment Mode</th>
          <th>Charge Code</th>
          <th>Lead Assessor</th>
          <th>Est. Turnaround</th>
          <th>System Quote / Ref</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-transform: capitalize;">${wo.assessment_mode || 'Preliminary'}</td>
          <td><strong>${wo.charge_code || 'PRE'}</strong></td>
          <td>${wo.lead_assessor_name || 'Technical Inspector'}</td>
          <td>${wo.estimated_days ? `${wo.estimated_days} Days` : '4–8 Days'}</td>
          <td style="font-family: monospace;">${wo.contractor_quote_ref || wo.system_quote_no || 'QT-DIRECT-DISPATCH'}</td>
        </tr>
      </tbody>
    </table>

    <!-- Commercial & Financial Authorization -->
    <div class="section-title">3. Approved Budget &amp; Commercial Terms</div>
    <table class="amount-table">
      <thead>
        <tr>
          <th>Item / Service Description</th>
          <th style="width: 90px; text-align: center;">Charge Code</th>
          <th style="width: 140px; text-align: right;">Amount (ZAR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${wo.title}</strong><br>
            <span style="font-size: 10.5px; color:#64748b;">Healthcare facility maintenance, repairs &amp; commissioning adherence</span>
          </td>
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${wo.charge_code || 'PRE'}</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-block">
      <table class="totals-table">
        <tr>
          <td class="info-label">Subtotal (Excl. VAT):</td>
          <td class="info-value">${formatCurrency(subtotal)}</td>
        </tr>
        <tr>
          <td class="info-label">VAT (15%):</td>
          <td class="info-value">${formatCurrency(vat)}</td>
        </tr>
        <tr class="grand-total">
          <td style="padding: 6px 8px; font-weight: 800;">Total Approved Budget:</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 800;">${formatCurrency(approvedBudget)}</td>
        </tr>
      </table>
    </div>

    <!-- Execution Instructions -->
    <div class="instruction-box">
      <strong>Specialist Execution &amp; Invoicing Mandatory Notice:</strong><br>
      1. All work must adhere to SANS 10400 healthcare facility regulations and occupational safety requirements.<br>
      2. Digital sign-off (Works Engineer, Facilities Manager, Works Inspector) is mandatory upon job completion.<br>
      3. Submitted contractor invoice claims are verified and disbursed in compliance with healthcare maintenance SLA.
    </div>

    <!-- Dual Sign-off Grid -->
    <div class="signature-grid">
      <div class="sig-box">
        <div class="sig-title">Quantum Built Authorized Dispatch</div>
        <div style="font-size: 11px; font-weight: 700; color: #008DA6; margin-bottom: 12px;">Digitally Authorized &amp; Approved</div>
        <div class="sig-line"></div>
        <div class="sig-sub">
          <span>Operations Officer</span>
          <span>Date: ${issueDate}</span>
        </div>
      </div>

      <div class="sig-box">
        <div class="sig-title">Contractor Acceptance &amp; Mobilization</div>
        <div style="height: 18px;"></div>
        <div class="sig-line"></div>
        <div class="sig-sub">
          <span>Specialist Contractor Sign-off</span>
          <span>Date: _________________</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>Meditrack Healthcare SLA Operations — Confidential Document</span>
      <span>Tracking Ref: ${wo.tracking_number}</span>
      <span>Generated: ${new Date().toLocaleString()}</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Auto open print dialog
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
