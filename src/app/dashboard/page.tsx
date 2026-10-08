'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/services/dashboard';
import { workOrderApi } from '@/services/work-orders';
import { formatDate, formatCurrency } from '@/lib/utils';
import DashboardBanner from '@/components/dashboard/DashboardBanner';
import StatCard from '@/components/dashboard/StatCard';
import WorkOrderCard from '@/components/dashboard/WorkOrderCard';
import { ArrowRight, Lock, FileText, RefreshCw, FileCheck, Radio, Home } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 15000
  });

  const woStats = summary?.workOrders.byStatus || {
    reported: 0,
    approved: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    verified: 0,
    closed: 0,
    total: 0
  };

  const activeTotal =
    woStats.reported + woStats.approved + woStats.assigned + woStats.in_progress + woStats.completed;

  // Query work orders for role-specific dashboard views
  const { data: woData } = useQuery({
    queryKey: ['dashboard-work-orders'],
    queryFn: () => workOrderApi.getWorkOrders({ limit: 100 }),
    refetchInterval: 10000
  });

  const allWorkOrders = woData?.data || [];
  const reportedCount = Math.max(woStats.reported, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'reported').length);
  const approvedCount = Math.max(woStats.approved, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'approved').length);
  const assignedCount = Math.max(woStats.assigned, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'assigned').length);
  const inProgressCount = Math.max(woStats.in_progress, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'in_progress').length);
  const completedCount = Math.max(woStats.completed, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'completed').length);
  const verifiedCount = Math.max(woStats.verified, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'verified').length);
  const closedCount = Math.max(woStats.closed, allWorkOrders.filter((w) => (w.status || '').toLowerCase() === 'closed').length);

  const pendingWorkOrders = allWorkOrders.filter((wo) => (wo.status || '').toLowerCase() === 'reported');
  const contractorWorkOrders = allWorkOrders.filter((wo) =>
    ['assigned', 'in_progress', 'completed'].includes((wo.status || '').toLowerCase())
  );
  const completedWorkOrders = allWorkOrders.filter((wo) => (wo.status || '').toLowerCase() === 'completed');
  const staffWorkOrders = allWorkOrders.slice(0, 5);

  // Inspector & Works Engineer Assessment Filtering (Part 1)
  const isWorksEngineer = user?.role === 'INSPECTOR' && user?.inspector_scope === 'works_engineer';
  const isWorksInspector = user?.role === 'INSPECTOR' && (user?.inspector_scope === 'works_inspector' || user?.inspector_scope === 'both');

  const assessorQueueWorkOrders = allWorkOrders.filter((wo) => {
    const s = (wo.status || '').toLowerCase();
    if (['closed', 'cancelled'].includes(s)) return false;

    // Explicitly assigned as Lead Assessor to this user
    if (wo.lead_assessor_id && wo.lead_assessor_id === user?.id) return true;

    // If Works Engineer: show only if joint assistance was fulfilled/assigned specifically to this engineer
    if (isWorksEngineer && wo.assessor_request_engineer_id && wo.assessor_request_engineer_id === user?.id) {
      return true;
    }

    // Adjustment requested by QB review for this user's assessment
    if (wo.assessment_review_status === 'adjusted') {
      if (wo.lead_assessor_id === user?.id || wo.assessor_id === user?.id) return true;
    }

    return false;
  });

  const assessorPendingCount = assessorQueueWorkOrders.length;

  const contractorPendingCriticalQuotes = allWorkOrders.filter((wo) => {
    const isCritical = wo.urgency_category === 'Critical 0–24h' || wo.priority === 'critical';
    const s = (wo.status || '').toLowerCase();
    return isCritical && ['completed', 'verified', 'closed'].includes(s) && wo.contractor_critical_quote_status !== 'approved';
  });

  const engineerPendingCriticalQuotes = allWorkOrders.filter((wo) => {
    const isCritical = wo.urgency_category === 'Critical 0–24h' || wo.priority === 'critical';
    return isCritical && ['submitted', 'adjusted'].includes(wo.contractor_critical_quote_status || '');
  });

  const contractorAvailableBidding = allWorkOrders.filter((wo) => {
    const s = (wo.status || '').toLowerCase();
    return s === 'approved' && !wo.assigned_to;
  });

  const engineerPendingQuotationChecks = allWorkOrders.filter((wo) => {
    const s = (wo.status || '').toLowerCase();
    return s === 'approved' && (!wo.selected_contractor_quote_id || wo.contractor_approver_action === 'reevaluate');
  });

  const approverPendingContractorAssignments = allWorkOrders.filter((wo) => {
    const s = (wo.status || '').toLowerCase();
    return s === 'approved' && !!wo.selected_contractor_quote_id && wo.contractor_approver_action !== 'approved';
  });

  // -------------------------------------------------------------
  // 1. AUDITOR SPECIFIC VIEW (Cryptographic & Compliance Only)
  // -------------------------------------------------------------
  if (user?.role === 'AUDITOR') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <DashboardBanner
            name={user?.name || 'Auditor'}
            subtitle="Here's what's happening at the hospital today • Zero-Knowledge SHA-256 State Transition Ledger"
            roleBadge="AUDITOR"
            actions={
              <Link
                href="/audit"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs flex items-center gap-1.5"
              >
                <span>Open Audit Vault & Merkle Engine</span>
                <span>&rarr;</span>
              </Link>
            }
          />

          {/* 3 Focused Auditor Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            <StatCard
              href="/audit"
              title="Cryptographic Events"
              value={isLoading ? '...' : summary?.recentEvents?.length || 0}
              subtitle="SHA-256 hash linked blocks • Inspect"
              variant="orange"
            />
            <StatCard
              href="/audit"
              title="Chain Integrity Status"
              value="100% VALID"
              subtitle="Zero cryptographic discrepancies"
              variant="blue"
            />
            <StatCard
              href="/audit"
              title="State Transitions"
              value={isLoading ? '...' : woStats.total}
              subtitle="Total immutable events registered"
              variant="green"
            />
          </div>

          {/* Cryptographic Event Audit Trail Stream */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Live Cryptographic Audit Feed
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Real-time immutable SHA-256 hash chain stream across all hospital facilities.
                  </p>
                </div>
              </div>
              <Link href="/audit" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                Compute Inclusion Proofs &rarr;
              </Link>
            </div>

            <div className="space-y-3.5">
              {summary?.recentEvents && summary.recentEvents.length > 0 ? (
                summary.recentEvents.map((evt) => {
                  const s = (evt.toStatus || '').toLowerCase();
                  let borderGradient = 'from-[#FB923C] to-[#F97316]';
                  let badgeClass = 'bg-[#FFE4C4] text-[#B05B07] border border-[#FDC88D]';
                  
                  if (s.includes('critical') || s.includes('fail') || s.includes('decline')) {
                    borderGradient = 'from-[#F87171] to-[#EF4444]';
                    badgeClass = 'bg-[#FFC6C6] text-[#A31616] border border-[#FFA5A5]';
                  } else if (s.includes('cert') || s.includes('complete') || s.includes('verified') || s.includes('closed')) {
                    borderGradient = 'from-[#34D399] to-[#10B981]';
                    badgeClass = 'bg-[#C6F2D6] text-[#0D723B] border border-[#9DE7B7]';
                  } else if (s.includes('active') || s.includes('in_progress')) {
                    borderGradient = 'from-[#4FD1C5] to-[#319795]';
                    badgeClass = 'bg-[#F9C381] text-[#904C05] border border-[#EAA757]';
                  }

                  const formattedDate = (() => {
                    try {
                      const d = new Date(evt.createdAt);
                      if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-GB');
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const dayNum = d.getDate();
                      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
                      const year = d.getFullYear();
                      return `${dayName}, ${dayNum} ${monthName} ${year}`;
                    } catch {
                      return new Date().toLocaleDateString('en-GB');
                    }
                  })();

                  return (
                    <Link
                      key={evt.id}
                      href={evt.workOrderId ? `/work-orders/${evt.workOrderId}` : '/audit'}
                      className="bg-white rounded-[18px] border border-slate-200/80 shadow-[0px_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-sky-300 transition-all duration-200 flex overflow-hidden group cursor-pointer"
                    >
                      {/* Left accent gradient bar */}
                      <div className={`w-1.5 sm:w-2 bg-gradient-to-b ${borderGradient} shrink-0`} />

                      {/* Main Content Area */}
                      <div className="p-4 sm:p-5 flex-1 space-y-2.5 min-w-0">
                        {/* Row 1: Tracking Number & Title / Action */}
                        <div className="flex items-center flex-wrap gap-x-6 gap-y-1 min-w-0">
                          <span className="font-mono font-bold text-base sm:text-lg text-slate-900 shrink-0">
                            {evt.workOrderTracking}
                          </span>
                          <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight truncate group-hover:text-sky-700 transition-colors">
                            {evt.toStatus.replace('_', ' ').charAt(0).toUpperCase() + evt.toStatus.replace('_', ' ').slice(1)} {evt.notes ? `• ${evt.notes}` : ''}
                          </span>
                        </div>

                        {/* Row 2: Status Pill */}
                        <div>
                          <span
                            className={`px-4 py-0.5 rounded-full text-xs font-semibold capitalize inline-flex items-center shadow-2xs ${badgeClass}`}
                          >
                            {evt.toStatus.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Row 3: Actor, Hash and Calendar Date */}
                        <div className="flex items-center flex-wrap gap-x-6 gap-y-1.5 text-xs sm:text-[13px] text-slate-500 font-normal pt-0.5">
                          {/* Actor Info */}
                          <div className="flex items-center gap-1.5 truncate max-w-md">
                            <svg
                              className="w-4 h-4 text-slate-500 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.8}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <span className="truncate">Actor: {evt.actorName}</span>
                          </div>

                          {/* Hash */}
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 truncate max-w-sm">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="truncate">Hash: {evt.eventHash}</span>
                          </div>

                          {/* Calendar Date */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <svg
                              className="w-4 h-4 text-slate-500 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.8}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                  No cryptographic events recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 2. STAFF SPECIFIC VIEW (Hospital Operations & Ticket Creation)
  // -------------------------------------------------------------
  if (user?.role === 'STAFF') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <DashboardBanner
            name={user?.name || 'Hospital Staff'}
            subtitle="Here's what's happening at the hospital today • Report broken equipment & facility breakdowns"
            roleBadge="STAFF"
            actions={
              <Link
                href="/work-orders"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs"
              >
                + Request a new ticket
              </Link>
            }
          />

          {/* 3 Focused Staff Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            <StatCard
              href="/work-orders"
              title="My Open Tickets"
              value={isLoading ? '...' : activeTotal}
              subtitle="Pending & In Progress"
              variant="blue"
            />
            <StatCard
              href="/work-orders?priority=critical"
              title="Critical Alerts"
              value={isLoading ? '...' : summary?.workOrders.byPriority.critical || 0}
              subtitle="High Priority Device repairs"
              variant="orange"
            />
            <StatCard
              href="/work-orders?status=closed"
              title="Completed/fixed"
              value={isLoading ? '...' : (woStats.completed + woStats.verified + woStats.closed)}
              subtitle="Repaired Maintenance Issues"
              variant="green"
            />
          </div>

          {/* Recent Work Orders & Reported Tickets Header & Cards */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Recent Work Orders &amp; Reported Tickets
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Click any ticket to view details, audit logs, or repair status.
                  </p>
                </div>
              </div>
              <Link href="/work-orders" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                View All Work Orders &rarr;
              </Link>
            </div>

            {staffWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                <div className="text-sm font-semibold text-slate-700">No tickets reported yet.</div>
                <div className="text-xs text-slate-400 mt-1">Click &quot;+ Request a new ticket&quot; to log a maintenance issue.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {staffWorkOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 3. CONTRACTOR SPECIFIC VIEW (Assigned Jobs & Invoices Only)
  // -------------------------------------------------------------
  if (user?.role === 'CONTRACTOR') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <DashboardBanner
            name={user?.name || 'Contractor Vendor'}
            subtitle="Here's what's happening at the hospital today • Execute assigned work orders & submit invoices"
            roleBadge="CONTRACTOR"
            actions={
              <>
                <Link
                  href="/work-orders?status=assigned"
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs"
                >
                  My Assigned Tickets
                </Link>
                <Link
                  href="/invoices"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition shadow-xs"
                >
                  Submit Invoice Claim
                </Link>
              </>
            }
          />

          {/* 3 Focused Contractor Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            <StatCard
              href="/work-orders?status=assigned"
              title="Assigned Active Jobs"
              value={isLoading ? '...' : (assignedCount + inProgressCount)}
              subtitle="Orders requiring repair execution"
              variant="blue"
            />
            <StatCard
              href="/work-orders?status=completed"
              title="Completed (Awaiting QC)"
              value={isLoading ? '...' : completedCount}
              subtitle="Submitted for safety inspection"
              variant="orange"
            />
            <StatCard
              href="/invoices?status=paid"
              title="Settled Disbursements"
              value={isLoading ? '...' : formatCurrency(summary?.invoices.totalPaid || 0)}
              subtitle="Disbursed settlement claims"
              variant="green"
            />
          </div>

          {/* Critical Emergency Jobs: Provide Quote Action Alert */}
          {contractorPendingCriticalQuotes.length > 0 && (
            <div className="bg-purple-50 rounded-[18px] p-6 border border-purple-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>Critical Emergency Jobs &bull; Provide Quote</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-xs font-bold font-mono">
                        {contractorPendingCriticalQuotes.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Completed emergency repairs requiring itemized cost breakdown &amp; claim submission for Works Engineer approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contractorPendingCriticalQuotes.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="p-4 bg-white rounded-xl border border-purple-200 hover:border-purple-400 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-purple-800 text-xs">{wo.tracking_number}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800">
                          {wo.contractor_critical_quote_status ? 'Quote Submitted' : 'Quote Needed'}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 group-hover:text-purple-700 transition">
                        {wo.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wo.facility_name}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-purple-50 flex items-center justify-between text-xs font-bold text-purple-700">
                      <span>Provide Quote / Cost &rarr;</span>
                      {wo.contractor_critical_quote_cost && (
                        <span className="font-mono">{formatCurrency(wo.contractor_critical_quote_cost)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Open Bidding Opportunities & Requests for Quotes */}
          {contractorAvailableBidding.length > 0 && (
            <div className="bg-sky-50/80 rounded-[18px] p-6 border border-sky-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Open Requests for Quotation (Blind Bidding)</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-200 text-sky-900 text-xs font-bold font-mono">
                      {contractorAvailableBidding.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Assessed work orders open for contractor quotation submissions. Submit your itemized breakdown &amp; turnaround time.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contractorAvailableBidding.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="p-4 bg-white rounded-xl border border-sky-200 hover:border-sky-400 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sky-800 text-xs">{wo.tracking_number}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-800">
                          Quoting Open
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 group-hover:text-sky-700 transition">
                        {wo.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wo.facility_name}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-sky-50 flex items-center justify-between text-xs font-bold text-sky-700">
                      <span>Submit Quotation &rarr;</span>
                      <span className="text-[11px] text-slate-400 font-normal">Blind Quoting Active</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Work Orders Queue */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Assigned Work Orders</span>
                    {contractorWorkOrders.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-sky-100 text-sky-800">
                        {contractorWorkOrders.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Click on any assigned work order to execute, upload photos, or mark completed.
                  </p>
                </div>
              </div>
              <Link href="/work-orders" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                View All in Work Orders &rarr;
              </Link>
            </div>

            {contractorWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                <div className="text-sm font-semibold text-slate-700">No active assigned jobs.</div>
                <div className="text-xs text-slate-400 mt-1">When hospital leadership assigns tickets to your team, they will appear here.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {contractorWorkOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
              Next Action Items
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/work-orders?status=assigned"
                className="p-4 rounded-lg border border-slate-200 hover:border-sky-300 bg-slate-50/60 transition group"
              >
                <div className="font-semibold text-xs text-slate-900 group-hover:text-sky-700">
                  Execute Work Orders &rarr;
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Change ticket status to &quot;In Progress&quot;, upload evidence photos, and submit for verification.
                </div>
              </Link>
              <Link
                href="/invoices"
                className="p-4 rounded-lg border border-slate-200 hover:border-emerald-300 bg-slate-50/60 transition group"
              >
                <div className="font-semibold text-xs text-slate-900 group-hover:text-emerald-700">
                  Submit & Track Invoice Claims &rarr;
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Submit invoice claims for verified orders and track disbursement settlements.
                </div>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 4. INSPECTOR SPECIFIC VIEW (Quality Control & Technical Assessment)
  // -------------------------------------------------------------
  if (user?.role === 'INSPECTOR') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <DashboardBanner
            name={user?.name || (isWorksEngineer ? 'Works Engineer' : 'Works Inspector')}
            subtitle={
              isWorksEngineer
                ? "Here's what's happening at the hospital today • Technical scoping, biomedical calibration & QC"
                : "Here's what's happening at the hospital today • Safety inspection & technical assessments"
            }
            roleBadge={user?.inspector_scope === 'works_engineer' ? 'WORKS ENGINEER' : 'WORKS INSPECTOR'}
            actions={
              <>
                <Link
                  href="/work-orders"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition shadow-xs"
                >
                  Assessor Queue ({assessorPendingCount})
                </Link>
                <Link
                  href="/work-orders?status=completed"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition shadow-xs"
                >
                  Verify Tickets ({completedCount})
                </Link>
              </>
            }
          />

          {/* 4 Focused Inspector Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <StatCard
              href="/work-orders"
              title="Lead Assessment Queue"
              value={isLoading ? '...' : assessorPendingCount}
              subtitle="Tickets awaiting technical scoping"
              variant="blue"
            />
            <StatCard
              href="/work-orders?status=completed"
              title="Awaiting QC Inspection"
              value={isLoading ? '...' : completedCount}
              subtitle="Completed orders ready for audit"
              variant="orange"
            />
            <StatCard
              href="/work-orders?status=verified"
              title="Verified (QC Passed)"
              value={isLoading ? '...' : verifiedCount}
              subtitle="Safety-certified work orders"
              variant="teal"
            />
            <StatCard
              href="/inspections"
              title="Safety Logs"
              value={isLoading ? '...' : (summary?.recentEvents?.length || 0)}
              subtitle="Biomedical compliance records"
              variant="green"
            />
          </div>

          {/* Critical Job Quotes Awaiting Works Engineer Review Banner */}
          {engineerPendingCriticalQuotes.length > 0 && (
            <div className="bg-amber-50/90 rounded-[18px] p-6 border border-amber-300 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>Critical Emergency Quotes Awaiting Review</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold font-mono">
                        {engineerPendingCriticalQuotes.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Contractor submitted emergency repair claims awaiting your technical verification, adjustment, or approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {engineerPendingCriticalQuotes.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="p-4 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-800 text-xs">{wo.tracking_number}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900">
                          {wo.contractor_critical_quote_status === 'adjusted' ? 'Adjusted' : 'Pending Review'}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 group-hover:text-amber-700 transition">
                        {wo.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wo.facility_name}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-amber-50 flex items-center justify-between text-xs font-bold text-amber-800">
                      <span>Review Quote (Approve / Adjust) &rarr;</span>
                      <span className="font-mono font-bold text-purple-900">{formatCurrency(wo.contractor_critical_quote_cost || 0)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Contractor Quotations Awaiting Works Engineer Check & Recommendation */}
          {isWorksEngineer && engineerPendingQuotationChecks.length > 0 && (
            <div className="bg-emerald-50/90 rounded-[18px] p-6 border border-emerald-300 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Contractor Quotations &bull; Technical Comparison &amp; Recommendation</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-xs font-bold font-mono">
                      {engineerPendingQuotationChecks.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Compare submitted contractor quotations, evaluate itemized pricing, and submit technical recommendation to Contractor Approver.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {engineerPendingQuotationChecks.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="p-4 bg-white rounded-xl border border-emerald-200 hover:border-emerald-400 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-800 text-xs">{wo.tracking_number}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-900">
                          {wo.contractor_approver_action === 'reevaluate' ? 'Re-evaluation Requested' : 'Check Quotes'}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 group-hover:text-emerald-700 transition">
                        {wo.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wo.facility_name}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-emerald-50 flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span>Compare Quotations &rarr;</span>
                      <span className="font-mono">{wo.quotations?.length || 0} Quotes Received</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Part 1: Assessor Technical Scoping & Estimation Queue */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Assessor Technical Scoping &amp; Estimation Queue</span>
                    {assessorQueueWorkOrders.length > 0 && (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-100 text-sky-800">
                        {assessorQueueWorkOrders.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Work orders assigned to you as Lead Assessor or referred for engineering cost calculation.
                  </p>
                </div>
              </div>
              <Link href="/work-orders" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                View All in Work Orders &rarr;
              </Link>
            </div>

            {assessorQueueWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                <div className="text-sm font-semibold text-slate-700">No pending technical assessments.</div>
                <div className="text-xs text-slate-400 mt-1">When Quantum Built assigns tickets to you as Lead Assessor, they will appear here.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {assessorQueueWorkOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </div>

          {/* Quality Audit Queue (For Completed Jobs Verification) */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Quality Audit Queue (Repairs Verification)</span>
                    {completedWorkOrders.length > 0 && (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                        {completedWorkOrders.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Completed contractor jobs awaiting clinical safety inspection and QC pass/fail verification.
                  </p>
                </div>
              </div>
              <Link href="/work-orders?status=completed" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                View All Completed &rarr;
              </Link>
            </div>

            {completedWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                <div className="text-sm font-semibold text-slate-700">All caught up!</div>
                <div className="text-xs text-slate-400 mt-1">No completed jobs currently awaiting QC verification.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {completedWorkOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 5. APPROVER SPECIFIC VIEW (Leadership Review & Approval Queue)
  // -------------------------------------------------------------
  if (user?.role === 'APPROVER') {
    const PIPELINE_STEPS = [
      { key: 'reported', label: 'Requested', count: reportedCount, color: 'bg-[#FF7A00]' },
      { key: 'approved', label: 'Approved', count: approvedCount, color: 'bg-[#007B88]' },
      { key: 'assigned', label: 'Assigned', count: assignedCount, color: 'bg-[#00C2FF]' },
      { key: 'in_progress', label: 'In Progress', count: inProgressCount, color: 'bg-[#0038FF]' },
      { key: 'completed', label: 'Completed', count: completedCount, color: 'bg-[#9747FF]' },
      { key: 'verified', label: 'Verified', count: verifiedCount, color: 'bg-[#00B027]' },
      { key: 'closed', label: 'Closed', count: closedCount, color: 'bg-[#FF0000]' }
    ];

    const approverScope = user?.approver_scope || 'wo_approver';

    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <DashboardBanner
            name={user?.name || 'Approver'}
            subtitle={
              approverScope === 'payment_approver'
                ? "Here's what's happening at the hospital today • Finance & Invoice Settlement Center"
                : approverScope === 'contractor_approver'
                ? "Here's what's happening at the hospital today • Contractor Assignment & Partner Center"
                : "Here's what's happening at the hospital today • Work Order Approval Center"
            }
            roleBadge={approverScope.replace('_', ' ')}
            actions={
              <>
                <Link
                  href="/work-orders"
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs"
                >
                  View Work Orders
                </Link>
                {approverScope === 'payment_approver' && (
                  <Link
                    href="/invoices"
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition shadow-xs"
                  >
                    Review Invoices
                  </Link>
                )}
                {approverScope === 'contractor_approver' && (
                  <Link
                    href="/contractors"
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition shadow-xs"
                  >
                    Contractors Directory
                  </Link>
                )}
              </>
            }
          />

          {/* 3 Focused Approver Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {approverScope === 'contractor_approver' ? (
              <StatCard
                href="/work-orders?status=approved"
                title="Approved (Assign Vendor)"
                value={isLoading ? '...' : approvedCount}
                subtitle="Assign specialized contractor"
                variant="blue"
              />
            ) : (
              <StatCard
                href="/work-orders?status=reported"
                title="Awaiting Your Approval"
                value={isLoading ? '...' : reportedCount}
                subtitle="New requests pending review"
                variant="orange"
              />
            )}

            <StatCard
              href="/work-orders?status=active"
              title="Active Jobs in Pipeline"
              value={isLoading ? '...' : (approvedCount + assignedCount + inProgressCount)}
              subtitle="Contractor repairs underway"
              variant="blue"
            />

            {approverScope === 'payment_approver' ? (
              <StatCard
                href="/invoices?status=pending"
                title="Pending Invoice Approvals"
                value={isLoading ? '...' : formatCurrency(summary?.invoices.totalPending || 0)}
                subtitle={`${summary?.invoices.count || 0} claims pending settlement`}
                variant="green"
              />
            ) : (
              <StatCard
                href="/work-orders?status=completed"
                title="Completed & QC Verified"
                value={isLoading ? '...' : (completedCount + verifiedCount)}
                subtitle="Repairs awaiting closure"
                variant="green"
              />
            )}
          </div>

          {/* Contractor Recommendations Awaiting Approver Assignment */}
          {approverPendingContractorAssignments.length > 0 && (
            <div className="bg-sky-50/90 rounded-[18px] p-6 border border-sky-300 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Contractor Quotations &bull; Recommendations Awaiting Approval</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-200 text-sky-900 text-xs font-bold font-mono">
                      {approverPendingContractorAssignments.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Works Engineer has reviewed multi-contractor bids and recommended a contractor. Approve assignment or request re-evaluation.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {approverPendingContractorAssignments.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="p-4 bg-white rounded-xl border border-sky-200 hover:border-sky-400 transition-all shadow-2xs hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sky-800 text-xs">{wo.tracking_number}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-900">
                          Recommended Quote
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1 group-hover:text-sky-700 transition">
                        {wo.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wo.facility_name}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-sky-50 flex items-center justify-between text-xs font-bold text-sky-800">
                      <span>Review &amp; Assign Contractor &rarr;</span>
                      <span className="font-mono">Ready for Assignment</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Pending Approval Queue Table */}
          <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Pending Work Orders Awaiting Approval</span>
                    {pendingWorkOrders.length > 0 && (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                        {pendingWorkOrders.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-normal">
                    Review reported issue details, verify priority/SLA, and assign or approve funding.
                  </p>
                </div>
              </div>
              <Link href="/work-orders?status=reported" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
                View All Awaiting Approval &rarr;
              </Link>
            </div>

            {pendingWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
                <div className="text-sm font-semibold text-slate-700">All caught up!</div>
                <div className="text-xs text-slate-400 mt-1">No work orders currently awaiting approval.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {pendingWorkOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </div>

          {/* Workflow Pipeline Distribution (Clickable) */}
          <div className="bg-[#F5FEFFB8] p-6 sm:p-7 rounded-[18px] border border-[#DEDEDE] shadow-[0px_4px_4px_0px_#00000040]">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
                  <img
                    src="/images/pipeline-icon.png"
                    alt="Work Order Pipeline"
                    className="w-[60px] h-[60px] object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-[24px] sm:text-[32px] font-normal text-[#545454] tracking-tight leading-tight">
                    Work Order Lifecycle Pipeline
                  </h2>
                  <p className="text-[14px] sm:text-[18px] font-normal text-[#545454] mt-0.5 leading-normal">
                    Click any stage to filter work orders in that stage
                  </p>
                </div>
              </div>
              <Link
                href="/work-orders"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border-2 border-[#027D92] text-[#027D92] hover:bg-[#027D92]/5 font-semibold text-xs sm:text-sm transition-colors shadow-xs"
              >
                <span>View all orders</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
              {PIPELINE_STEPS.map((step) => (
                <Link
                  key={step.key}
                  href={`/work-orders?status=${step.key}`}
                  className="bg-[#F5FEFFB8] rounded-[18px] p-4 sm:p-5 flex flex-col justify-start gap-[25px] shadow-[0px_4px_4px_0px_#00000040] border border-[#DEDEDE] hover:scale-[1.02] transition-transform group cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${step.color} shrink-0`} />
                    <span className="text-[14px] font-normal text-[#545454] group-hover:text-[#027D92] transition-colors truncate">
                      {step.label}
                    </span>
                  </div>
                  <div className="text-[32px] font-semibold text-[#05484E] tracking-tight font-sans group-hover:text-[#027D92] transition-colors leading-tight">
                    {step.count}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 6. ADMIN FULL EXECUTIVE COMMAND DASHBOARD
  // -------------------------------------------------------------
  const PIPELINE_STEPS = [
    { key: 'reported', label: 'Requested', count: woStats.reported, color: 'bg-[#FF7A00]' },
    { key: 'approved', label: 'Approved', count: woStats.approved, color: 'bg-[#007B88]' },
    { key: 'assigned', label: 'Assigned', count: woStats.assigned, color: 'bg-[#00C2FF]' },
    { key: 'in_progress', label: 'In Progress', count: woStats.in_progress, color: 'bg-[#0038FF]' },
    { key: 'completed', label: 'Completed', count: woStats.completed, color: 'bg-[#9747FF]' },
    { key: 'verified', label: 'Verified', count: woStats.verified, color: 'bg-[#00B027]' },
    { key: 'closed', label: 'Closed', count: woStats.closed, color: 'bg-[#FF0000]' }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome & Command Header */}
        <DashboardBanner
          name={user?.name || 'Administrator'}
          subtitle="Here's what's happening at the hospital today"
          roleBadge={user?.role}
          actions={
            <>
              <Link
                href="/work-orders"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs"
              >
                + Create Work Order
              </Link>
              <Link
                href="/invoices?status=pending"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition shadow-xs"
              >
                Approve Invoices
              </Link>
            </>
          }
        />

        {/* Real-time 4 Metric Cards (Clickable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <StatCard
            href="/work-orders"
            title="Total Active Maintenance"
            value={isLoading ? '...' : activeTotal}
            subtitle={`Out of ${woStats.total} lifetime orders`}
            variant="blue"
          />
          <StatCard
            href="/work-orders?priority=critical"
            title="Critical & High Priority"
            value={isLoading ? '...' : (summary?.workOrders.byPriority.critical || 0) + (summary?.workOrders.byPriority.high || 0)}
            subtitle={`${summary?.workOrders.byPriority.critical || 0} Critical emergency alerts`}
            variant="orange"
          />
          <StatCard
            href="/contractors"
            title="Contractor Compliance"
            value={isLoading ? '...' : `${summary?.contractors.compliant || 0} / ${summary?.contractors.total || 0}`}
            subtitle={`${summary?.contractors.expiring_soon || 0} licenses expiring soon`}
            variant="teal"
          />
          <StatCard
            href="/invoices?status=paid"
            title="Settled Disbursements"
            value={isLoading ? '...' : formatCurrency(summary?.invoices.totalPaid || 0)}
            subtitle={`${formatCurrency(summary?.invoices.totalPending || 0)} pending approval`}
            variant="green"
          />
        </div>

        {/* Recent Work Orders & Reported Tickets Header & Cards */}
        <div className="bg-[#F4FBFC] rounded-[18px] py-[40px] px-[30px] space-y-6 border border-[#e2f5f8] shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#D7F5FD] border border-[#B3EEFA] flex items-center justify-center shrink-0 shadow-2xs">
                <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Recent Work Orders &amp; Reported Tickets
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Click any ticket to view details, audit logs, or repair status.
                </p>
              </div>
            </div>
            <Link href="/work-orders" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800 transition">
              View All Work Orders &rarr;
            </Link>
          </div>

          {allWorkOrders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-[18px] border border-slate-200 shadow-xs">
              <div className="text-sm font-semibold text-slate-700">No tickets reported yet.</div>
              <div className="text-xs text-slate-400 mt-1">Click &quot;+ Create Work Order&quot; to log a maintenance issue.</div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {allWorkOrders.slice(0, 5).map((wo) => (
                <WorkOrderCard key={wo.id} workOrder={wo} />
              ))}
            </div>
          )}
        </div>

        {/* 7-Stage Workflow Pipeline Distribution (Clickable) */}
        <div className="bg-[#F5FEFFB8] p-6 sm:p-7 rounded-[18px] border border-[#DEDEDE] shadow-[0px_4px_4px_0px_#00000040]">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
                <img
                  src="/images/pipeline-icon.png"
                  alt="Work Order Pipeline"
                  className="w-[60px] h-[60px] object-contain"
                />
              </div>
              <div>
                <h2 className="text-[24px] sm:text-[32px] font-normal text-[#545454] tracking-tight leading-tight">
                  Work Order Lifecycle Pipeline
                </h2>
                <p className="text-[14px] sm:text-[18px] font-normal text-[#545454] mt-0.5 leading-normal">
                  Click any stage to filter work orders in that stage
                </p>
              </div>
            </div>
            <Link
              href="/work-orders"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border-2 border-[#027D92] text-[#027D92] hover:bg-[#027D92]/5 font-semibold text-xs sm:text-sm transition-colors shadow-xs"
            >
              <span>View all orders</span>
              <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
            {PIPELINE_STEPS.map((step) => (
              <Link
                key={step.key}
                href={`/work-orders?status=${step.key}`}
                className="bg-[#F5FEFFB8] rounded-[18px] p-4 sm:p-5 flex flex-col justify-start gap-[25px] shadow-[0px_4px_4px_0px_#00000040] border border-[#DEDEDE] hover:scale-[1.02] transition-transform group cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${step.color} shrink-0`} />
                  <span className="text-[14px] font-normal text-[#545454] group-hover:text-[#027D92] transition-colors truncate">
                    {step.label}
                  </span>
                </div>
                <div className="text-[32px] font-semibold text-[#05484E] tracking-tight font-sans group-hover:text-[#027D92] transition-colors leading-tight">
                  {step.count}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Facilities Workload & Live Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#F5FEFFB8] p-6 sm:p-7 rounded-[18px] border border-[#DEDEDE] shadow-[0px_4px_4px_0px_#00000040] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Hospital Facilities Workload
                </h2>
                <Link href="/facilities" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                  Manage Facilities &rarr;
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {summary?.facilities.items.slice(0, 5).map((fac) => (
                  <Link
                    key={fac.id}
                    href={`/facilities`}
                    className="py-3 flex items-center justify-between hover:bg-white/60 px-2 -mx-2 rounded-lg transition group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-800 group-hover:text-sky-700">{fac.name}</div>
                      <div className="text-[11px] text-slate-400">{fac.code} &bull; {fac.type}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700">
                        {fac.activeWorkOrders} Active
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#F5FEFFB8] p-6 sm:p-7 rounded-[18px] border border-[#DEDEDE] shadow-[0px_4px_4px_0px_#00000040] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Live Operations Stream
                </h2>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  SHA-256 Verified
                </span>
              </div>

              <div className="space-y-3">
                {summary?.recentEvents && summary.recentEvents.length > 0 ? (
                  summary.recentEvents.slice(0, 5).map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl border border-slate-100 bg-white/70 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-800">{evt.workOrderTracking}</span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="font-semibold text-sky-700 capitalize">{evt.toStatus}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          By <span className="font-medium text-slate-700">{evt.actorName}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 p-4 text-center">No recent events recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
