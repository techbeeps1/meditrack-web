import { formatDate } from './utils';

export interface TimesheetDayEntry {
  day: string;
  date: string;
  task?: string;
  hours: number | string;
}

export interface TimesheetPdfData {
  employee_name: string;
  employee_role?: string;
  week_start: string;
  work_order_tracking: string;
  work_order_title: string;
  facility_name?: string;
  entries: TimesheetDayEntry[];
  total_hours: number | string;
  signature_name?: string;
  signature_date?: string;
}

export function downloadTimesheetPdf(data: TimesheetPdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the Time Sheet PDF.');
    return;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  // Filter or use active dynamic entries
  const rawEntries = (data.entries && data.entries.length > 0)
    ? data.entries
    : [
        { day: 'Day 1', date: '', task: 'Site inspection & diagnostic scoping', hours: '4.0' }
      ];

  const dayRows = rawEntries.map((e, idx) => ({
    day: e.day || `Day ${idx + 1}`,
    date: e.date ? formatDate(e.date) : '',
    task: e.task || '',
    hours: e.hours !== undefined && e.hours !== '' && Number(e.hours) > 0 ? Number(e.hours).toFixed(1) : ''
  }));

  const totalCalculated = dayRows.reduce((acc, row) => acc + (Number(row.hours) || 0), 0);
  const totalDisplay = data.total_hours ? Number(data.total_hours).toFixed(1) : totalCalculated.toFixed(1);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Time Sheet - ${data.work_order_tracking}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
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
      font-size: 13px;
      line-height: 1.5;
    }
    .timesheet-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
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
    .doc-title {
      font-size: 32px;
      font-weight: 300;
      letter-spacing: 1px;
      color: #0f172a;
      text-align: center;
      margin-bottom: 28px;
    }
    .meta-fields {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 20px;
      font-size: 13px;
    }
    .field-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    .field-label {
      font-weight: 500;
      color: #0f172a;
      white-space: nowrap;
    }
    .field-input-box {
      border: 1px solid #94a3b8;
      border-radius: 3px;
      padding: 6px 12px;
      min-height: 32px;
      flex: 1;
      font-weight: 600;
      color: #0f172a;
      background: #f8fafc;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0px;
    }
    .table th {
      background: #94a3b8;
      color: #0f172a;
      font-weight: 700;
      font-size: 12.5px;
      padding: 9px 12px;
      border: 1px solid #64748b;
      text-align: left;
    }
    .table th.text-center {
      text-align: center;
    }
    .table th.text-right {
      text-align: right;
    }
    .table td {
      padding: 9px 12px;
      font-size: 12.5px;
      border: 1px solid #94a3b8;
      color: #1e293b;
      height: 38px;
    }
    .table td.day-col {
      font-weight: 600;
      background: #f8fafc;
      width: 16%;
    }
    .table td.date-col {
      width: 16%;
      text-align: center;
      font-family: monospace;
    }
    .table td.task-col {
      width: 52%;
      color: #334155;
    }
    .table td.hours-col {
      width: 16%;
      text-align: right;
      font-weight: 700;
      font-family: monospace;
      font-size: 13px;
    }
    .total-row-container {
      display: flex;
      justify-content: flex-end;
      margin-top: -1px;
      margin-bottom: 36px;
    }
    .total-hours-box {
      display: flex;
      width: 32%;
      border: 1px solid #94a3b8;
      border-top: none;
    }
    .total-hours-label {
      width: 50%;
      padding: 9px 12px;
      font-weight: 700;
      font-size: 12.5px;
      border-right: 1px solid #94a3b8;
      text-align: right;
      background: #f1f5f9;
    }
    .total-hours-value {
      width: 50%;
      padding: 9px 12px;
      font-weight: 800;
      font-size: 14px;
      text-align: right;
      font-family: monospace;
      color: #2B7A9B;
      background: #f8fafc;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-top: 36px;
      font-size: 13px;
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

  <div class="timesheet-container">
    <!-- Company Logo & Top Header -->
    <div class="top-company-header">
      <div class="company-brand">
        <img src="${logoUrl}" alt="Company Logo" class="company-logo" />
        <div>
          <div class="company-title">QUANTUM BUILT / MEDITRACK SERVICES</div>
          <div style="font-size: 10px; color: #64748b; font-weight: 600;">Technical Engineering & Statutory Compliance Division</div>
        </div>
      </div>
      <div style="font-size: 11px; color: #64748b; text-align: right;">
        Ticket: <strong>${data.work_order_tracking || 'WO-REF'}</strong><br/>
        Facility: <strong>${data.facility_name || 'Hospital Site'}</strong>
      </div>
    </div>

    <!-- Main Title -->
    <div class="doc-title">Time Sheet</div>

    <!-- Employee Name & Week Start Metadata -->
    <div class="meta-fields">
      <div class="field-group" style="flex: 1.2;">
        <span class="field-label">Employee's Name</span>
        <div class="field-input-box">${data.employee_name || 'David Vance (Site Works Assessor)'}</div>
      </div>
      <div class="field-group" style="flex: 0.8;">
        <span class="field-label">Period / Start Date</span>
        <div class="field-input-box">${data.week_start || formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <!-- Dynamic Days Timesheet Table -->
    <table class="table">
      <thead>
        <tr>
          <th class="day-col">Day</th>
          <th class="date-col text-center">Date</th>
          <th class="task-col">Task / Inspection Scope Description</th>
          <th class="hours-col text-right">Total Hours</th>
        </tr>
      </thead>
      <tbody>
        ${dayRows.map((row) => `
          <tr>
            <td class="day-col">${row.day}</td>
            <td class="date-col">${row.date || '-'}</td>
            <td class="task-col">${row.task || (row.hours ? `On-site diagnostic inspection for ${data.work_order_tracking}` : '-')}</td>
            <td class="hours-col">${row.hours ? `${row.hours} hrs` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Total Hours Sum Block -->
    <div class="total-row-container">
      <div class="total-hours-box">
        <div class="total-hours-label">Total Hours</div>
        <div class="total-hours-value">${totalDisplay} hrs</div>
      </div>
    </div>

    <!-- Bottom Sign-off Section -->
    <div class="signature-row">
      <div class="field-group" style="flex: 1.1;">
        <span class="field-label">Employee's Name</span>
        <div class="field-input-box">${data.signature_name || data.employee_name || 'David Vance'}</div>
      </div>
      <div class="field-group" style="flex: 1;">
        <span class="field-label">Signature</span>
        <div class="field-input-box" style="font-family: cursive; font-size: 14px; color: #1e3a8a;">
          ✓ ${data.signature_name || data.employee_name || 'David Vance'} (Digital Signed)
        </div>
      </div>
      <div class="field-group" style="flex: 0.7;">
        <span class="field-label">Date</span>
        <div class="field-input-box">${data.signature_date || new Date().toLocaleDateString('en-GB')}</div>
      </div>
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
