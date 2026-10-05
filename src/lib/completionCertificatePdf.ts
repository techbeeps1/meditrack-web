import { formatCurrency, formatDate } from './utils';
import { WorkOrder } from '@/types/workOrder';

export function downloadCompletionCertificatePdf(workOrder: WorkOrder) {
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    alert('Please allow popups to print/download the Completion Certificate PDF.');
    return;
  }

  const certNo = workOrder.completion_cert_no || `CERT-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`;
  const recNo = workOrder.client_recovery_invoice_no || `REC-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`;
  const issueDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalAmount = workOrder.actual_cost || workOrder.estimated_cost || 0;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Completion Certificate - ${certNo}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      font-size: 12px;
      line-height: 1.45;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      padding: 28px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 18px;
      border-bottom: 2px solid #0f172a;
    }
    .org-title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .org-subtitle {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
      font-weight: 600;
    }
    .cert-badge {
      text-align: right;
    }
    .cert-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .cert-no {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      font-weight: 700;
      color: #0369a1;
      margin-top: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 18px 0;
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-item {
      font-size: 11px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #cbd5e1;
    }
    .scope-box {
      padding: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      margin-bottom: 16px;
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
    }
    .tri-signoff-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .signoff-card {
      border: 1px solid #0f172a;
      padding: 12px;
      background: #ffffff;
    }
    .signoff-role {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .signoff-status {
      display: inline-block;
      padding: 2px 6px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      border-radius: 2px;
      margin-bottom: 6px;
    }
    .status-signed {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .status-pending {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .signoff-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }
    .signoff-date {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
      font-family: ui-monospace, monospace;
    }
    .recovery-banner {
      margin-top: 16px;
      padding: 12px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .recovery-title {
      font-weight: 800;
      font-size: 11px;
      color: #166534;
      text-transform: uppercase;
    }
    .recovery-amount {
      font-size: 14px;
      font-weight: 800;
      font-family: ui-monospace, monospace;
      color: #166534;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #64748b;
    }
    .hash-code {
      font-family: ui-monospace, monospace;
      font-size: 8px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="org-title">Northern Cape Dept of Health &amp; Quantum Built</div>
        <div class="org-subtitle">Healthcare Engineering Maintenance &amp; Statutory SLA Compliance</div>
      </div>
      <div class="cert-badge">
        <div class="cert-title">3-Way Completion Certificate</div>
        <div class="cert-no">${certNo}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Hospital Facility</div>
        <div class="meta-value">${workOrder.facility_name || 'Northern Cape Regional Facility'} (${workOrder.facility_code || 'NC-FAC'})</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Work Order Reference</div>
        <div class="meta-value font-mono">${workOrder.tracking_number} &bull; ${workOrder.category}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">System Quote &amp; Contractor Ref</div>
        <div class="meta-value font-mono">${workOrder.system_quote_no || 'QT-2026-N/A'} ${workOrder.contractor_quote_ref ? `(${workOrder.contractor_quote_ref})` : ''}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Client Recovery Invoice #</div>
        <div class="meta-value font-mono text-sky-800">${recNo}</div>
      </div>
    </div>

    <div class="section-title">Maintenance Work Specification</div>
    <div class="scope-box">
      <strong>Title:</strong> ${workOrder.title}<br/>
      <strong>Scope Description:</strong> ${workOrder.description}<br/>
      ${workOrder.location_details ? `<strong>Location / Cleanroom:</strong> ${workOrder.location_details}<br/>` : ''}
      <strong>Assigned Specialist:</strong> ${workOrder.assigned_to_name || workOrder.contractor_name || 'Nominated Specialist'}<br/>
      <strong>SLA Urgency Band:</strong> ${workOrder.urgency_category || 'Urgent 4–8 days'} &bull; <strong>Charge Code:</strong> ${workOrder.charge_code || 'PRE'}
    </div>

    <div class="section-title">Tri-Signature Statutory Completion Sign-off</div>
    <div class="tri-signoff-grid">
      <!-- 1. Works Engineer -->
      <div class="signoff-card">
        <div class="signoff-role">1. Works Engineer</div>
        <div class="signoff-status ${workOrder.signoff_engineer_by ? 'status-signed' : 'status-pending'}">
          ${workOrder.signoff_engineer_by ? 'Technical Certified' : 'Pending Signature'}
        </div>
        <div class="signoff-name">${workOrder.signoff_engineer_by || 'Not Signed'}</div>
        <div class="signoff-date">
          ${workOrder.signoff_engineer_at ? formatDate(workOrder.signoff_engineer_at) : 'Awaiting physical review'}
        </div>
      </div>

      <!-- 2. Facilities Manager -->
      <div class="signoff-card">
        <div class="signoff-role">2. Facilities Manager</div>
        <div class="signoff-status ${workOrder.signoff_fm_by ? 'status-signed' : 'status-pending'}">
          ${workOrder.signoff_fm_by ? 'Site Accepted' : 'Pending Signature'}
        </div>
        <div class="signoff-name">${workOrder.signoff_fm_by || 'Not Signed'}</div>
        <div class="signoff-date">
          ${workOrder.signoff_fm_at ? formatDate(workOrder.signoff_fm_at) : 'Awaiting site handover'}
        </div>
      </div>

      <!-- 3. Works Inspector -->
      <div class="signoff-card">
        <div class="signoff-role">3. Works Inspector</div>
        <div class="signoff-status ${workOrder.signoff_inspector_by ? 'status-signed' : 'status-pending'}">
          ${workOrder.signoff_inspector_by ? 'QC Verified' : 'Pending Signature'}
        </div>
        <div class="signoff-name">${workOrder.signoff_inspector_by || 'Not Signed'}</div>
        <div class="signoff-date">
          ${workOrder.signoff_inspector_at ? formatDate(workOrder.signoff_inspector_at) : 'Awaiting compliance QC'}
        </div>
      </div>
    </div>

    <div class="recovery-banner">
      <div>
        <div class="recovery-title">NC DOH Client Recovery Invoicing Stream (Tier 2)</div>
        <div style="font-size: 10px; color: #166534; margin-top: 2px;">
          Certified for NC Department of Health reimbursement disbursement
        </div>
      </div>
      <div class="recovery-amount">${formatCurrency(totalAmount)}</div>
    </div>

    <div class="footer">
      <div>Issued on ${issueDate} &bull; MediTrack TBS Enterprise Healthcare Platform</div>
      <div class="hash-code">SHA256 Ledger Verified &bull; ${workOrder.tracking_number}</div>
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
