import { formatDate } from './utils';

export interface TimesheetDayEntry {
  day: string;
  date: string;
  time_in?: string;
  time_out?: string;
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

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function downloadTimesheetPdf(data: TimesheetPdfData) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Please allow popups to download/print the Time Sheet PDF.');
    return;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;

  // Build full 7-day entries from data.entries or default
  let dayRows: Array<{
    day: string;
    date: string;
    time_in: string;
    time_out: string;
    hours: string;
  }> = [];

  if (data.entries && data.entries.length > 0) {
    dayRows = data.entries.map((e, idx) => ({
      day: e.day || DEFAULT_DAYS[idx] || `Day ${idx + 1}`,
      date: e.date ? formatDate(e.date) : '',
      time_in: e.time_in || '',
      time_out: e.time_out || '',
      hours: e.hours !== undefined && e.hours !== '' && Number(e.hours) > 0 ? Number(e.hours).toFixed(1) : ''
    }));
  } else {
    dayRows = DEFAULT_DAYS.map((day) => ({
      day,
      date: '',
      time_in: '',
      time_out: '',
      hours: ''
    }));
  }

  // Ensure minimum 7 days are displayed
  if (dayRows.length < 7) {
    const existingDays = dayRows.map((r) => r.day);
    for (const d of DEFAULT_DAYS) {
      if (!existingDays.includes(d)) {
        dayRows.push({
          day: d,
          date: '',
          time_in: '',
          time_out: '',
          hours: ''
        });
      }
    }
  }

  const totalCalculated = dayRows.reduce((acc, row) => acc + (Number(row.hours) || 0), 0);
  const totalDisplay = data.total_hours ? Number(data.total_hours).toFixed(1) : totalCalculated.toFixed(1);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Time Sheet - ${data.work_order_tracking}</title>
  <style>
    @page {
      size: A4 portrait;
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
      padding: 24px;
      font-size: 13px;
      line-height: 1.4;
    }
    .timesheet-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
    }
    .top-company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2B7A9B;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-logo {
      height: 40px;
      width: auto;
      max-width: 150px;
      object-fit: contain;
    }
    .company-title {
      font-size: 14px;
      font-weight: 800;
      color: #2B7A9B;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 28px;
      font-weight: 400;
      letter-spacing: 1px;
      color: #0f172a;
      text-align: center;
      margin-bottom: 24px;
    }
    .meta-fields {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      gap: 20px;
      font-size: 13px;
    }
    .field-group {
      display: flex;
      align-items: center;
      gap: 10px;
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
      background: #cbd5e1;
      color: #0f172a;
      font-weight: 700;
      font-size: 12.5px;
      padding: 8px 12px;
      border: 1px solid #94a3b8;
      text-align: center;
    }
    .table th.th-day {
      text-align: left;
      width: 20%;
    }
    .table th.th-date {
      width: 22%;
    }
    .table th.th-time {
      width: 19%;
    }
    .table th.th-hours {
      text-align: right;
      width: 20%;
    }
    .table td {
      padding: 8px 12px;
      font-size: 12.5px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      height: 34px;
    }
    .table td.day-col {
      font-weight: 600;
      background: #f8fafc;
    }
    .table td.date-col {
      text-align: center;
      font-family: monospace;
    }
    .table td.time-col {
      text-align: center;
      font-family: monospace;
    }
    .table td.hours-col {
      text-align: right;
      font-weight: 700;
      font-family: monospace;
      font-size: 13px;
    }
    .total-row-container {
      display: flex;
      justify-content: flex-end;
      margin-top: -1px;
      margin-bottom: 30px;
    }
    .total-hours-box {
      display: flex;
      width: 39%;
      border: 1px solid #cbd5e1;
      border-top: none;
    }
    .total-hours-label {
      width: 48.7%;
      padding: 8px 12px;
      font-weight: 700;
      font-size: 12.5px;
      border-right: 1px solid #cbd5e1;
      text-align: right;
      background: #f1f5f9;
    }
    .total-hours-value {
      width: 51.3%;
      padding: 8px 12px;
      font-weight: 800;
      font-size: 13.5px;
      text-align: right;
      font-family: monospace;
      color: #0f172a;
      background: #f8fafc;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-top: 30px;
      font-size: 13px;
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
        Job Ticket: <strong>${data.work_order_tracking || 'WO-REF'}</strong><br/>
        Facility: <strong>${data.facility_name || 'Healthcare Site'}</strong>
      </div>
    </div>

    <!-- Main Title (Centered) -->
    <div class="doc-title">Time Sheet</div>

    <!-- Employee Name & Week Start Metadata -->
    <div class="meta-fields">
      <div class="field-group" style="flex: 1.2;">
        <span class="field-label">Employee's Name</span>
        <div class="field-input-box">${data.employee_name || 'Assessor'}</div>
      </div>
      <div class="field-group" style="flex: 0.8;">
        <span class="field-label">Week Start</span>
        <div class="field-input-box">${data.week_start || formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <!-- Monday to Sunday Table (Matching Template) -->
    <table class="table">
      <thead>
        <tr>
          <th class="th-day">Day</th>
          <th class="th-date">Date</th>
          <th class="th-time">Time In</th>
          <th class="th-time">Time Out</th>
          <th class="th-hours">Total Hours</th>
        </tr>
      </thead>
      <tbody>
        ${dayRows.map((row) => `
          <tr>
            <td class="day-col">${row.day}</td>
            <td class="date-col">${row.date || ''}</td>
            <td class="time-col">${row.time_in || ''}</td>
            <td class="time-col">${row.time_out || ''}</td>
            <td class="hours-col">${row.hours ? `${row.hours}` : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Total Hours Sum Box on Right -->
    <div class="total-row-container">
      <div class="total-hours-box">
        <div class="total-hours-label">Total Hours</div>
        <div class="total-hours-value">${totalDisplay}</div>
      </div>
    </div>

    <!-- Bottom Signature Row (Matching Template) -->
    <div class="signature-row">
      <div class="field-group" style="flex: 1.1;">
        <span class="field-label">Employee's Name</span>
        <div class="field-input-box">${data.signature_name || data.employee_name || ''}</div>
      </div>
      <div class="field-group" style="flex: 1;">
        <span class="field-label">Signature</span>
        <div class="field-input-box" style="font-family: cursive; font-size: 13px; color: #1e3a8a;">
          ✓ ${data.signature_name || data.employee_name || ''} (Signed)
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
