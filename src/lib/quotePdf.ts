import { formatCurrency, formatDate } from './utils';

export interface QuotePdfData {
  quote_number: string;
  issued_date?: string | null;
  work_order_tracking?: string | null;
  work_order_title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;
  contractor_name?: string | null;
  contractor_contact?: string | null;
  contractor_phone?: string | null;
  contractor_email?: string | null;
  contractor_bank_name?: string | null;
  contractor_bank_acc?: string | null;
  contractor_bank_branch?: string | null;
  contractor_bank_swift?: string | null;
  quote_amount: number;
  labour_amount?: number | null;
  materials_amount?: number | null;
  quote_notes?: string | null;
  terms_days?: number | string | null;
}

export function downloadQuotePdf(quote: QuotePdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the Quote PDF.');
    return;
  }

  const quoteDate = quote.issued_date ? formatDate(quote.issued_date) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalAmount = Number(quote.quote_amount || 0);
  const labour = quote.labour_amount ? Number(quote.labour_amount) : Math.round(totalAmount * 0.70 * 100) / 100;
  const materials = quote.materials_amount ? Number(quote.materials_amount) : Math.round((totalAmount - labour) * 100) / 100;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quote - ${quote.quote_number}</title>
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
      color: #1e293b;
      background: #ffffff;
      padding: 40px;
      font-size: 13px;
      line-height: 1.5;
    }
    .quote-container {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid #2B7A9B;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-logo {
      height: 48px;
      width: auto;
      max-width: 170px;
      object-fit: contain;
    }
    .company-title {
      font-size: 16px;
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
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .quote-title {
      font-size: 32px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .quote-pill {
      background: #f1f5f9;
      color: #334155;
      font-size: 14px;
      font-weight: 700;
      padding: 10px 22px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 20px;
    }
    .to-section {
      max-width: 400px;
    }
    .section-label {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 2px solid #0f172a;
      display: inline-block;
      padding-bottom: 2px;
    }
    .recipient-name {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .recipient-detail {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
    .date-section {
      text-align: right;
    }
    .date-label {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .date-value {
      font-size: 13px;
      color: #334155;
      font-weight: 600;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table th {
      background: #cbd5e1;
      color: #0f172a;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      text-align: left;
    }
    .table th.text-right {
      text-align: right;
    }
    .table td {
      padding: 14px;
      font-size: 13px;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }
    .table td.text-right {
      text-align: right;
    }
    .table tr:last-child td {
      border-bottom: none;
    }
    .total-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 14px;
      border-top: 1.5px solid #0f172a;
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 36px;
    }
    .total-label {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .total-amount {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1.1fr;
      gap: 32px;
      margin-bottom: 32px;
    }
    .info-block-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 2px solid #0f172a;
      display: inline-block;
      padding-bottom: 2px;
    }
    .bank-details {
      font-size: 12px;
      color: #334155;
      line-height: 1.6;
    }
    .bank-header {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .terms-list {
      list-style-type: disc;
      padding-left: 18px;
      font-size: 11.5px;
      color: #475569;
      line-height: 1.6;
    }
    .contact-section {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11.5px;
      color: #334155;
    }
    .contact-name {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .contact-line {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }
    .footer-stamp {
      margin-top: 36px;
      padding-top: 14px;
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

  <div class="quote-container">
    <!-- Company Logo & Top Header -->
    <div class="top-company-header">
      <div class="company-brand">
        <img src="${logoUrl}" alt="Company Logo" class="company-logo" />
        <div>
          <div class="company-title">${quote.contractor_name || 'OMV HOLDINGS (PTY) LTD'}</div>
          <div class="company-tagline">Healthcare Infrastructure & Specialist Maintenance</div>
        </div>
      </div>
      <div style="font-size: 11px; color: #64748b; text-align: right;">
        Ref: <strong>${quote.work_order_tracking || 'WO-REF'}</strong>
      </div>
    </div>

    <!-- Header Title & Quote Number -->
    <div class="header-row">
      <div class="quote-title">QUOTE</div>
      <div class="quote-pill">${quote.quote_number}</div>
    </div>

    <!-- TO & Issued Date Metadata -->
    <div class="meta-grid">
      <div class="to-section">
        <div class="section-label">TO:</div>
        <div class="recipient-name">${quote.client_name || 'Muzikayise Nkosi'}</div>
        <div class="recipient-detail">${quote.client_phone || '+27 61 484 5282'}</div>
        <div class="recipient-detail">${quote.client_email || 'muzikayise.nk@gmail.com'}</div>
        <div class="recipient-detail" style="font-weight: 600; color: #1e293b; margin-top: 4px;">
          ${quote.facility_name || 'Metro General Hospital'} - ${quote.facility_address || 'Main Campus (NC DOH)'}
        </div>
      </div>

      <div class="date-section">
        <div class="date-label">ISSUED DATE</div>
        <div class="date-value">${quoteDate}</div>
      </div>
    </div>

    <!-- Line Item Breakdown Table -->
    <table class="table">
      <thead>
        <tr>
          <th style="width: 72%;">DESCRIPTION</th>
          <th style="width: 28%;" class="text-right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${quote.work_order_title || 'Specialist Hospital Engineering Maintenance Work'}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
              ${quote.quote_notes || 'Contractor on-site scoping, engineering overhaul, component diagnostics & technical repair.'}
            </div>
          </td>
          <td class="text-right" style="font-weight: 600;">${formatCurrency(labour)}</td>
        </tr>
        <tr>
          <td>
            <div style="font-weight: 600;">Specialist Replacement Parts, Consumables & Technical Calibration</div>
          </td>
          <td class="text-right" style="font-weight: 600;">${formatCurrency(materials)}</td>
        </tr>
        <tr style="background: #f8fafc; font-size: 12px;">
          <td style="color: #64748b; font-weight: 600;">Subtotal (Excl. VAT)</td>
          <td class="text-right" style="font-weight: 600; color: #334155;">${formatCurrency(totalAmount)}</td>
        </tr>
        <tr style="background: #f8fafc; font-size: 12px;">
          <td style="color: #64748b; font-weight: 600;">VAT (15% Standard Rate)</td>
          <td class="text-right" style="font-weight: 600; color: #334155;">${formatCurrency(Math.round(totalAmount * 0.15 * 100) / 100)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Total Bar -->
    <div class="total-bar">
      <div class="total-label">TOTAL (INCL. 15% VAT)</div>
      <div class="total-amount">${formatCurrency(Math.round(totalAmount * 1.15 * 100) / 100)}</div>
    </div>

    <!-- Bottom Information Grid: Payment Info & Terms -->
    <div class="bottom-grid">
      <div>
        <div class="info-block-title">PAYMENT INFORMATION:</div>
        <div class="bank-details">
          <div class="bank-header">Bank Details :</div>
          <div>${quote.contractor_contact || quote.contractor_name || 'Ms Grizelda Madamombe'}</div>
          <div><strong>Bank:</strong> ${quote.contractor_bank_name || 'CAPITEC'}</div>
          <div><strong>Acc:</strong> ${quote.contractor_bank_acc || '1655735916'}</div>
          <div><strong>Branch:</strong> ${quote.contractor_bank_branch || '470010'}</div>
          <div><strong>Swift:</strong> ${quote.contractor_bank_swift || 'CABLZJJ'}</div>
        </div>

        <!-- Contact Information -->
        <div class="contact-section">
          <div class="info-block-title" style="margin-bottom: 6px;">CONTACT INFORMATION:</div>
          <div class="contact-name">${quote.contractor_contact || 'Grizelda Madamombe'}</div>
          <div class="contact-line">
            <span>📞</span>
            <span>${quote.contractor_phone || '067 406 4167'}</span>
          </div>
          <div class="contact-line">
            <span>✉️</span>
            <span>${quote.contractor_email || 'grizelda.martin@gmail.com'}</span>
          </div>
        </div>
      </div>

      <div>
        <div class="info-block-title">TERM & CONDITIONS</div>
        <ul class="terms-list">
          <li>Quotation valid for 30 calendar days from issued date (${quoteDate}).</li>
          <li>Subject to formal NC DOH Client Gateway budget authorization & Work Order Issue.</li>
          <li>All workmanship executed under statutory SANS / OHS hospital compliance standards.</li>
          <li>Statutory 3-Way Statutory Handover sign-off mandatory upon physical completion.</li>
          <li>Settlement terms payable within ${quote.terms_days || '30'} days following verified certificate issuance.</li>
        </ul>
      </div>
    </div>

    <!-- Security & Ledger Verification Stamp -->
    <div class="footer-stamp">
      <span>MEDITRACK GATEWAY: OFFICIAL STATUTORY QUOTATION DOCUMENT</span>
      <span>WO: ${quote.work_order_tracking || 'REF'}</span>
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
