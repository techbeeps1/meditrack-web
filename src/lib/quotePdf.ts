import { formatCurrency, formatDate } from './utils';

export interface QuoteItem {
  id?: string;
  description: string;
  qty?: number;
  unit_price?: number;
  cost?: number;
  subtotal?: number;
}

export interface QuotePdfData {
  quote_number: string;
  issued_date?: string | null;
  valid_through?: string | null;
  work_order_tracking?: string | null;
  work_order_title?: string | null;
  client_name?: string | null;
  client_address_1?: string | null;
  client_address_2?: string | null;
  client_address_3?: string | null;
  client_vat_nr?: string | null;
  facility_name?: string | null;
  facility_address?: string | null;
  contractor_name?: string | null;
  contractor_vat_nr?: string | null;
  contractor_address_1?: string | null;
  contractor_address_2?: string | null;
  contractor_address_3?: string | null;
  contractor_phone?: string | null;
  contractor_email?: string | null;
  contractor_bank_name?: string | null;
  contractor_bank_acc?: string | null;
  contractor_bank_branch?: string | null;
  contractor_bank_swift?: string | null;
  quote_amount: number;
  items?: QuoteItem[];
  work_types?: string[];
  quote_notes?: string | null;
  terms_days?: number | string | null;
}

// Convert numeric ZAR amount into South African standard uppercase words
function numberToWordsZAR(amount: number): string {
  const units = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const thousands = ['', 'THOUSAND', 'MILLION', 'BILLION'];

  function convertChunk(num: number): string {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' HUNDRED ';
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      str += teens[num - 10] + ' ';
    } else if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num >= 1 && num <= 9) {
      str += units[num] + ' ';
    }
    return str.trim();
  }

  const rounded = Math.round(Number(amount || 0) * 100) / 100;
  const rands = Math.floor(rounded);
  const cents = Math.round((rounded - rands) * 100);

  if (rands === 0 && cents === 0) return 'ZERO ZAR AND 00 CENTS';

  let words = '';
  let temp = rands;
  let chunkIdx = 0;

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkWords = convertChunk(chunk);
      words = (chunkWords + (thousands[chunkIdx] ? ' ' + thousands[chunkIdx] : '') + ' ' + words).trim();
    }
    temp = Math.floor(temp / 1000);
    chunkIdx++;
  }

  const formattedCents = cents < 10 ? `0${cents}` : `${cents}`;
  return `${words || 'ZERO'} ZAR AND ${formattedCents} CENTS`;
}

export function downloadQuotePdf(quote: QuotePdfData) {
  const printWindow = window.open('', '_blank', 'width=900,height=980');
  if (!printWindow) {
    alert('Please allow popups to download/print the Quote PDF.');
    return;
  }

  const issueDateObj = quote.issued_date ? new Date(quote.issued_date) : new Date();
  const issueDateFormatted = issueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const validDays = Number(quote.terms_days) || 15;
  const validThroughObj = new Date(issueDateObj);
  validThroughObj.setDate(validThroughObj.getDate() + validDays);
  const validThroughFormatted = quote.valid_through
    ? formatDate(quote.valid_through)
    : validThroughObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Normalise line items
  let lineItems: Array<{ description: string; qty: number; unitPrice: number; subtotal: number }> = [];

  if (quote.items && Array.isArray(quote.items) && quote.items.length > 0) {
    lineItems = quote.items.map((it) => {
      const qty = Number(it.qty) || 1;
      const cost = Number(it.cost !== undefined ? it.cost : it.unit_price !== undefined ? it.unit_price : it.subtotal || 0);
      const unitPrice = it.unit_price !== undefined ? Number(it.unit_price) : (qty > 0 ? cost / qty : cost);
      const lineSubtotal = qty * unitPrice;
      return {
        description: it.description || 'Specialist Healthcare Service',
        qty,
        unitPrice,
        subtotal: lineSubtotal
      };
    });
  } else {
    // Fallback single item from total amount
    const totalAmt = Number(quote.quote_amount || 0);
    lineItems = [
      {
        description: quote.work_order_title || 'Technical Specialist Maintenance Execution',
        qty: 1,
        unitPrice: totalAmt,
        subtotal: totalAmt
      }
    ];
  }

  const subtotalSum = lineItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const grandTotal = Number(quote.quote_amount || subtotalSum);
  const subtotalExclVat = Math.round((grandTotal / 1.15) * 100) / 100;
  const vatAmount = Math.round((grandTotal - subtotalExclVat) * 100) / 100;

  const amountInWords = numberToWordsZAR(grandTotal);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Price Quote #${quote.quote_number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 30px 20px;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .quote-card {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 48px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }

    /* Top Brand Header */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .brand-logo-img {
      height: 44px;
      width: auto;
      max-width: 170px;
      object-fit: contain;
    }
    .brand-text-logo {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #008DA6;
    }

    /* Made For & Dates Grid */
    .info-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 20px;
    }
    .made-for-col {
      font-size: 11.5px;
      color: #1e293b;
      line-height: 1.5;
    }
    .made-for-title {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 3px;
    }
    .client-company {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .dates-col {
      text-align: right;
      font-size: 12px;
      line-height: 1.6;
    }
    .date-row {
      color: #0f172a;
    }
    .date-row span.label {
      color: #64748b;
      font-weight: 500;
      margin-right: 4px;
    }
    .date-row span.val {
      font-weight: 700;
    }

    /* Centered Title */
    .quote-headline {
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      margin-bottom: 26px;
      padding-bottom: 4px;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .items-table thead th {
      border-bottom: 1px solid #0f172a;
      padding: 10px 8px;
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      text-align: left;
    }
    .items-table thead th.th-qty {
      width: 60px;
      text-align: center;
    }
    .items-table thead th.th-price {
      width: 120px;
      text-align: right;
    }
    .items-table thead th.th-total {
      width: 120px;
      text-align: right;
    }

    .items-table tbody td {
      padding: 11px 8px;
      font-size: 11.5px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .items-table tbody td.td-qty {
      text-align: center;
      font-weight: 600;
    }
    .items-table tbody td.td-price {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
    }
    .items-table tbody td.td-total {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #0f172a;
    }

    /* Amount in Words */
    .amount-words-line {
      border-top: 1px solid #e2e8f0;
      padding: 10px 0;
      font-size: 9px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }

    /* Totals Summary */
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-box {
      width: 260px;
      font-size: 12px;
      line-height: 1.6;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      color: #475569;
    }
    .totals-row.grand-total {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #0f172a;
      padding-top: 6px;
      margin-top: 4px;
    }
    .totals-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #0f172a;
    }

    /* Bottom 3-Column Footer */
    .bottom-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .bottom-col {
      flex: 1;
    }
    .bottom-col-title {
      font-weight: 800;
      color: #0f172a;
      font-size: 11.5px;
      margin-bottom: 3px;
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .quote-card {
        border: none;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="quote-card">
    <!-- Top Header -->
    <div class="top-header">
      <div>
        <img src="${logoUrl}" alt="MediTrack TBS Logo" class="brand-logo-img" onerror="this.style.display='none';" />
        <div class="brand-text-logo">INV24 / MEDITRACK</div>
      </div>
    </div>

    <!-- Made For & Dates -->
    <div class="info-grid">
      <div class="made-for-col">
        <div class="made-for-title">Made For:</div>
        <div class="client-company">${quote.client_name || quote.facility_name || 'Northern Cape Department of Health'}</div>
        <div>${quote.facility_address || '100 Medical Center Blvd'}</div>
        <div>${quote.facility_name ? `Healthcare Facility: ${quote.facility_name}` : 'Regional Healthcare Facility'}</div>
        <div>VAT nr: ${quote.client_vat_nr || '4900123456'}</div>
      </div>

      <div class="dates-col">
        <div class="date-row">
          <span class="label">Issue Date:</span>
          <span class="val">${issueDateFormatted}</span>
        </div>
        <div class="date-row">
          <span class="label">Valid Through:</span>
          <span class="val">${validThroughFormatted}</span>
        </div>
      </div>
    </div>

    <!-- Title -->
    <h1 class="quote-headline">Price Quote # ${quote.quote_number}</h1>

    <!-- Itemized Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="th-qty">Qty</th>
          <th class="th-price">Unit Price</th>
          <th class="th-total">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item) => `
          <tr>
            <td>
              <strong>${item.description}</strong>
            </td>
            <td class="td-qty">${item.qty}</td>
            <td class="td-price">${item.unitPrice.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="td-total">${item.subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Amount in Words -->
    <div class="amount-words-line">
      ${amountInWords}
    </div>

    <!-- Totals -->
    <div class="totals-wrapper">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="totals-val">R${subtotalExclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row">
          <span>VAT(15.00%):</span>
          <span class="totals-val">R${vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row grand-total">
          <span>Total:</span>
          <span class="totals-val" style="color: #008DA6;">R${grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>

    <!-- Bottom 3-Column Information -->
    <div class="bottom-grid">
      <div class="bottom-col">
        <div class="bottom-col-title">[${quote.contractor_name || 'Apex BioMed Solutions (Pty) Ltd'}]</div>
        <div>VAT nr: ${quote.contractor_vat_nr || '4820199482'}</div>
      </div>

      <div class="bottom-col">
        <div>${quote.contractor_address_1 || '12 Industrial Parkway, Techno Park'}</div>
        <div>${quote.contractor_address_2 || 'Kimberley, Northern Cape, 8301'}</div>
        <div>Phone: ${quote.contractor_phone || '+27 (0)53 831 4900'}</div>
      </div>

      <div class="bottom-col">
        <div class="bottom-col-title">[Payment Details]</div>
        <div>Bank: ${quote.contractor_bank_name || 'First National Bank (FNB)'}</div>
        <div>Acc: ${quote.contractor_bank_acc || '62890123456'}</div>
        <div>Branch: ${quote.contractor_bank_branch || '250655'}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
