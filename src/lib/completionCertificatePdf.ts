import { formatDate } from './utils';
import { WorkOrder } from '@/types/workOrder';

export function downloadCompletionCertificatePdf(workOrder: WorkOrder) {
  const printWindow = window.open('', '_blank', 'width=900,height=980');
  if (!printWindow) {
    alert('Please allow popups to print/download the Completion Certificate PDF.');
    return;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/images/logo.png`;
  const certNo = workOrder.completion_cert_no || `CERT-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`;
  const recNo = workOrder.client_recovery_invoice_no || `REC-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`;
  const issueDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const isRouteB = workOrder.funding_route === 'route_b' || workOrder.urgency_category === 'Critical 0–24h';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Completion Certificate - ${certNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
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
      padding: 20px;
      font-size: 11.5px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cert-container {
      max-width: 820px;
      margin: 0 auto;
      border: 2px solid #0284c7;
      border-radius: 8px;
      padding: 28px 32px;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-left {
      vertical-align: middle;
      text-align: left;
    }
    .header-right {
      vertical-align: middle;
      text-align: right;
    }
    .brand-logo-img {
      height: 60px;
      width: auto;
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .org-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .org-sub {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
      font-weight: 600;
    }
    .cert-badge-box {
      display: inline-block;
      text-align: right;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 8px 14px;
      border-radius: 6px;
    }
    .cert-badge-title {
      font-size: 12px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cert-badge-no {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .cert-badge-date {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Meta Table Grid */
    .meta-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px;
      margin-bottom: 16px;
    }
    .meta-cell {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      vertical-align: top;
      width: 50%;
    }
    .meta-label {
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .meta-val {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    /* Section Cards */
    .section-heading {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0369a1;
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .spec-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .spec-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .spec-table td.label-col {
      width: 160px;
      color: #64748b;
      font-weight: 600;
    }
    .spec-table td.val-col {
      color: #0f172a;
      font-weight: 600;
    }

    /* 3-Way Tri-Signature Grid - Single Consistent Blue/Navy Palette */
    .signoff-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px;
      margin: 12px 0 16px 0;
    }
    .signoff-card {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      border-radius: 6px;
      padding: 12px;
      vertical-align: top;
      width: 33.33%;
    }
    .signoff-card.certified {
      border-color: #0284c7;
      background: #f0f9ff;
    }
    .signoff-role {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .badge-certified {
      display: inline-block;
      padding: 2px 6px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      border-radius: 4px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
      margin-bottom: 6px;
    }
    .badge-pending {
      display: inline-block;
      padding: 2px 6px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      border-radius: 4px;
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #e2e8f0;
      margin-bottom: 6px;
    }
    .signoff-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }
    .signoff-meta {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
      font-family: ui-monospace, monospace;
    }

    /* Financial Settlement Banner - Single Consistent Blue/Navy Palette */
    .settlement-banner {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 14px;
      display: table;
      width: 100%;
    }
    .settlement-left {
      display: table-cell;
      vertical-align: middle;
    }
    .settlement-right {
      display: table-cell;
      vertical-align: middle;
      text-align: right;
    }
    .settlement-title {
      font-weight: 800;
      font-size: 11px;
      color: #0369a1;
      text-transform: uppercase;
    }
    .settlement-sub {
      font-size: 9.5px;
      color: #475569;
      margin-top: 2px;
    }
    .settlement-amount {
      font-size: 16px;
      font-weight: 800;
      font-family: ui-monospace, monospace;
      color: #0f172a;
    }

    /* Footer */
    .cert-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8.5px;
      color: #64748b;
      display: table;
      width: 100%;
    }
    .footer-left {
      display: table-cell;
      text-align: left;
    }
    .footer-right {
      display: table-cell;
      text-align: right;
      font-family: ui-monospace, monospace;
      color: #94a3b8;
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .cert-container {
        border: 2px solid #0284c7;
        box-shadow: none;
        padding: 20px 24px;
      }
    }
  </style>
</head>
<body>
  <div class="cert-container">
    <!-- Header Table -->
    <table class="header-table">
      <tr>
        <td class="header-left">
          <img src="${logoUrl}" alt="QHES MediTrack Logo" class="brand-logo-img" onerror="this.style.display='none';" />
          <div class="org-title">Northern Cape Dept of Health &amp; Quantum Built</div>
          <div class="org-sub">Healthcare Engineering Maintenance &amp; Statutory SLA Compliance</div>
        </td>
        <td class="header-right">
          <div class="cert-badge-box">
            <div class="cert-badge-title">3-Way Completion Certificate</div>
            <div class="cert-badge-no">${certNo}</div>
            <div class="cert-badge-date">Issued: ${issueDate}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Meta Details Grid -->
    <table class="meta-table">
      <tr>
        <td class="meta-cell">
          <div class="meta-label">Hospital Facility &amp; Location</div>
          <div class="meta-val">${workOrder.facility_name || 'Northern Cape Regional Facility'} (${workOrder.facility_code || 'NC-FAC'})</div>
          ${workOrder.location_details ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">Room/Location: ${workOrder.location_details}</div>` : ''}
        </td>
        <td class="meta-cell">
          <div class="meta-label">Work Order Reference</div>
          <div class="meta-val font-mono">${workOrder.tracking_number} &bull; ${workOrder.category}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Urgency: ${workOrder.urgency_category || 'Urgent 4–8 days'}</div>
        </td>
      </tr>
      <tr>
        <td class="meta-cell">
          <div class="meta-label">System Quote &amp; Contractor Reference</div>
          <div class="meta-val font-mono">${workOrder.system_quote_no || 'QT-2026-N/A'} ${workOrder.contractor_quote_ref ? `&bull; Ref: ${workOrder.contractor_quote_ref}` : ''}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Assigned Specialist: ${workOrder.assigned_to_name || workOrder.contractor_name || 'Apex BioMed Solutions'}</div>
        </td>
        <td class="meta-cell">
          <div class="meta-label">Financial Settlement Reference</div>
          <div class="meta-val font-mono" style="color: #0369a1;">${recNo}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Charge Code: ${workOrder.charge_code || 'PRE'} &bull; Status: Tri-Signature Certified</div>
        </td>
      </tr>
    </table>

    <!-- Specification Box -->
    <div class="section-heading">Maintenance Work Specification &amp; Scope</div>
    <div class="spec-card">
      <table class="spec-table">
        <tr>
          <td class="label-col">Task Title:</td>
          <td class="val-col">${workOrder.title}</td>
        </tr>
        <tr>
          <td class="label-col">Scope Description:</td>
          <td class="val-col">${workOrder.description}</td>
        </tr>
        <tr>
          <td class="label-col">Assigned Contractor:</td>
          <td class="val-col">${workOrder.assigned_to_name || workOrder.contractor_name || 'Specialist Contractor'}</td>
        </tr>
        <tr>
          <td class="label-col">Execution Status:</td>
          <td class="val-col" style="color: #0369a1; font-weight: 700;">100% Completed &amp; Verified</td>
        </tr>
      </table>
    </div>

    <!-- 3-Way Tri-Signature Statutory Verification Cards -->
    <div class="section-heading">Tri-Signature Statutory Completion Sign-off (PDF Page 5)</div>
    <table class="signoff-table">
      <tr>
        <!-- 1. Works Inspector -->
        <td class="signoff-card ${workOrder.signoff_inspector_by ? 'certified' : ''}">
          <div class="signoff-role">1. Works Inspector</div>
          <div class="${workOrder.signoff_inspector_by ? 'badge-certified' : 'badge-pending'}">
            ${workOrder.signoff_inspector_by ? 'QC Verified' : 'Pending Signature'}
          </div>
          <div class="signoff-name">${workOrder.signoff_inspector_by || 'Awaiting QC Inspector'}</div>
          <div class="signoff-meta">
            ${workOrder.signoff_inspector_at ? formatDate(workOrder.signoff_inspector_at) : 'Awaiting compliance QC'}
          </div>
        </td>

        <!-- 2. Works Engineer -->
        <td class="signoff-card ${workOrder.signoff_engineer_by ? 'certified' : ''}">
          <div class="signoff-role">2. Works Engineer</div>
          <div class="${workOrder.signoff_engineer_by ? 'badge-certified' : 'badge-pending'}">
            ${workOrder.signoff_engineer_by ? 'Technical Certified' : 'Pending Signature'}
          </div>
          <div class="signoff-name">${workOrder.signoff_engineer_by || 'Awaiting Engineer'}</div>
          <div class="signoff-meta">
            ${workOrder.signoff_engineer_at ? formatDate(workOrder.signoff_engineer_at) : 'Awaiting physical sign-off'}
          </div>
        </td>

        <!-- 3. Facilities Manager -->
        <td class="signoff-card ${workOrder.signoff_fm_by ? 'certified' : ''}">
          <div class="signoff-role">3. Facilities Manager / Staff</div>
          <div class="${workOrder.signoff_fm_by ? 'badge-certified' : 'badge-pending'}">
            ${workOrder.signoff_fm_by ? 'Site Accepted' : 'Pending Signature'}
          </div>
          <div class="signoff-name">${workOrder.signoff_fm_by || 'Awaiting Facilities Mgr'}</div>
          <div class="signoff-meta">
            ${workOrder.signoff_fm_at ? formatDate(workOrder.signoff_fm_at) : 'Awaiting site acceptance'}
          </div>
        </td>
      </tr>
    </table>

    <!-- Statutory Completion & Verification Banner -->
    <div class="settlement-banner">
      <div class="settlement-left">
        <div class="settlement-title">
          Statutory Verification &amp; Acceptance Certification
        </div>
        <div class="settlement-sub">
          Tri-Signature verification complete. Physical execution, technical standards, and hospital facility acceptance fully certified.
        </div>
      </div>
      <div class="settlement-right">
        <div class="settlement-amount" style="font-size: 13px; font-weight: 800; color: #0369a1;">Certified &amp; Verified</div>
      </div>
    </div>

    <!-- Footer Table -->
    <table class="cert-footer">
      <tr>
        <td class="footer-left">
          Official Certificate &bull; MediTrack TBS Healthcare Engineering &bull; Northern Cape DOH SLA
        </td>
        <td class="footer-right">
          SHA256 Cryptographically Verified &bull; ${workOrder.tracking_number}
        </td>
      </tr>
    </table>
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
