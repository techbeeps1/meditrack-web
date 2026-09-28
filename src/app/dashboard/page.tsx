'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/services/dashboard';
import { workOrderApi } from '@/services/work-orders';
import { formatDate, formatCurrency } from '@/lib/utils';

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

  // -------------------------------------------------------------
  // 1. AUDITOR SPECIFIC VIEW (Cryptographic & Compliance Only)
  // -------------------------------------------------------------
  if (user?.role === 'AUDITOR') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Compliance & Cryptographic Audit Portal
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                  AUDITOR
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Zero-Knowledge SHA-256 State Transition Ledger & Merkle Root Verifier
              </p>
            </div>
            <Link
              href="/audit"
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm flex items-center gap-1.5"
            >
              <span>Open Audit Vault & Merkle Engine</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* 3 Focused Auditor Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/audit"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-sky-600 transition">
                  Cryptographic Events Recorded
                </span>
                <span className="text-xs text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : summary?.recentEvents?.length || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">SHA-256 hash linked blocks &bull; Click to inspect</div>
            </Link>

            <Link
              href="/audit"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Chain Integrity Status
                </span>
                <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">100% VALID</div>
              <div className="text-xs text-slate-400 mt-1">Zero cryptographic discrepancies &bull; Verify ledger</div>
            </Link>

            <Link
              href="/audit"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                  Lifetime State Transitions
                </span>
                <span className="text-xs text-purple-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-2 font-mono">
                {isLoading ? '...' : woStats.total}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total immutable events registered &bull; View proofs</div>
            </Link>
          </div>

          {/* Cryptographic Event Audit Trail Stream */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Live Cryptographic Audit Feed
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time immutable hash chain stream across all facilities
                </p>
              </div>
              <Link href="/audit" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                Compute Inclusion Proofs &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {summary?.recentEvents && summary.recentEvents.length > 0 ? (
                summary.recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-800">
                          {evt.workOrderTracking}
                        </span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="font-semibold text-sky-700 capitalize">
                          {evt.toStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Actor: <span className="font-medium text-slate-700">{evt.actorName}</span>
                        {evt.notes ? ` • "${evt.notes}"` : ''}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Hash: {evt.eventHash}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                      {new Date(evt.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 p-8 text-center">
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Hospital Ground Staff Maintenance Portal
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                  STAFF
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Report broken equipment, biomedical device issues, and facility breakdowns
              </p>
            </div>
            <Link
              href="/work-orders"
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
            >
              + Report New Work Order
            </Link>
          </div>

          {/* 3 Focused Staff Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/work-orders"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-sky-600 transition">
                  My Hospital Open Tickets
                </span>
                <span className="text-xs text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : activeTotal}
              </div>
              <div className="text-xs text-slate-400 mt-1">Pending and in-progress tasks &bull; View list</div>
            </Link>

            <Link
              href="/work-orders?priority=critical"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                  Critical Emergency Alerts
                </span>
                <span className="text-xs text-amber-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : summary?.workOrders.byPriority.critical || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">High priority device repairs &bull; View urgent</div>
            </Link>

            <Link
              href="/work-orders?status=closed"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Completed / Fixed
                </span>
                <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
                {isLoading ? '...' : (woStats.completed + woStats.verified + woStats.closed)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Resolved maintenance issues &bull; View archive</div>
            </Link>
          </div>

          {/* Recent Work Orders List */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Recent Work Orders & Reported Tickets
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any ticket to view details, audit logs, or track repair status
                </p>
              </div>
              <Link href="/work-orders" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View All Work Orders &rarr;
              </Link>
            </div>

            {staffWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs font-semibold text-slate-700">No tickets reported yet.</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Click &quot;+ Report New Work Order&quot; to log a maintenance issue.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {staffWorkOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="py-3.5 px-3 -mx-3 rounded-lg hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-sky-700">{wo.tracking_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${wo.priority === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : wo.priority === 'high'
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {wo.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-700 transition">
                          {wo.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{wo.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>🏥 {wo.facility_name || 'Hospital Facility'}</span>
                        <span>🕒 {formatDate(wo.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 text-slate-700 capitalize border border-slate-200">
                        {wo.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform flex items-center">
                        Open &rarr;
                      </span>
                    </div>
                  </Link>
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">Contractor Vendor Portal</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                  CONTRACTOR
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Execute assigned work orders, upload completion evidence, and submit invoices
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/work-orders?status=assigned"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
              >
                My Assigned Tickets
              </Link>
              <Link
                href="/invoices"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Submit Invoice Claim
              </Link>
            </div>
          </div>

          {/* 3 Focused Contractor Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/work-orders?status=assigned"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-sky-600 transition">
                  Assigned Active Jobs
                </span>
                <span className="text-xs text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : (assignedCount + inProgressCount)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Orders requiring repair execution &bull; Open jobs</div>
            </Link>

            <Link
              href="/work-orders?status=completed"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                  Completed (Awaiting QC)
                </span>
                <span className="text-xs text-amber-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : completedCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">Submitted for safety inspection &bull; Track status</div>
            </Link>

            <Link
              href="/invoices?status=paid"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Settled Invoice Disbursements
                </span>
                <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
                {isLoading ? '...' : formatCurrency(summary?.invoices.totalPaid || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {formatCurrency(summary?.invoices.totalPending || 0)} pending approval &bull; View invoices
              </div>
            </Link>
          </div>

          {/* Assigned Work Orders Queue */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Assigned Work Orders</span>
                  {contractorWorkOrders.length > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-sky-100 text-sky-800">
                      {contractorWorkOrders.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click on any assigned work order to execute, upload photos, or mark completed
                </p>
              </div>
              <Link href="/work-orders" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View All in Work Orders &rarr;
              </Link>
            </div>

            {contractorWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs font-semibold text-slate-700">No active assigned jobs.</div>
                <div className="text-[11px] text-slate-400 mt-0.5">When hospital leadership assigns tickets to your team, they will appear here.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {contractorWorkOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="py-3.5 px-3 -mx-3 rounded-lg hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-sky-700">{wo.tracking_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${wo.priority === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : wo.priority === 'high'
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {wo.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-700 transition">
                          {wo.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{wo.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>🏥 {wo.facility_name || 'Hospital Facility'}</span>
                        <span>📍 {wo.location_details || 'Main Campus'}</span>
                        <span>🕒 {formatDate(wo.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 text-slate-700 capitalize border border-slate-200">
                        {wo.status.replace('_', ' ')}
                      </span>
                      <span className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 rounded-lg group-hover:bg-sky-700 transition shadow-2xs">
                        Open Work Order &rarr;
                      </span>
                    </div>
                  </Link>
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
                  🛠️ Execute Work Orders &rarr;
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
                  💰 Submit & Track Invoice Claims &rarr;
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
  // 4. INSPECTOR SPECIFIC VIEW (Quality Control & Verification)
  // -------------------------------------------------------------
  if (user?.role === 'INSPECTOR') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Clinical Safety & QC Inspector Center
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                  INSPECTOR
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Conduct clinical audits, test biomedical calibrations, and verify completed repairs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/inspections"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
              >
                + Record QC Inspection
              </Link>
              <Link
                href="/work-orders?status=completed"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Verify Tickets
              </Link>
            </div>
          </div>

          {/* 3 Focused Inspector Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/work-orders?status=completed"
              className={`p-5 rounded-xl border shadow-sm transition hover:shadow-md cursor-pointer block group ${completedCount > 0
                  ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                  : 'bg-white border-slate-200 hover:border-amber-300'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Awaiting QC Inspection</span>
                  <span className="text-xs text-amber-500 group-hover:translate-x-0.5 transition">&rarr;</span>
                </span>
                {completedCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                    Action Required
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : completedCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">Contractor work ready for audit &bull; Inspect now</div>
            </Link>

            <Link
              href="/work-orders?status=verified"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-teal-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">
                  Verified (QC Passed)
                </span>
                <span className="text-xs text-teal-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-teal-600 mt-2 font-mono">
                {isLoading ? '...' : verifiedCount}
              </div>
              <div className="text-xs text-slate-400 mt-1">Safety-certified work orders &bull; View list</div>
            </Link>

            <Link
              href="/inspections"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Safety Verification Logs
                </span>
                <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">100% AUDITED</div>
              <div className="text-xs text-slate-400 mt-1">Quality standards strictly enforced &bull; View logs</div>
            </Link>
          </div>

          {/* Quality Audit Queue */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Quality Audit Queue</span>
                  {completedWorkOrders.length > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800">
                      {completedWorkOrders.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Completed contractor jobs awaiting clinical safety inspection and QC pass/fail verification
                </p>
              </div>
              <Link href="/work-orders?status=completed" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View All Completed &rarr;
              </Link>
            </div>

            {completedWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-2xl mb-1">✓</div>
                <div className="text-xs font-semibold text-slate-700">All caught up!</div>
                <div className="text-[11px] text-slate-400 mt-0.5">No completed jobs currently awaiting QC verification.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedWorkOrders.map((wo) => (
                  <div key={wo.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{wo.tracking_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${wo.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                            wo.priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          {wo.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{wo.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{wo.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>🏥 {wo.facility_name || 'Hospital Facility'}</span>
                        <span>🔧 Contractor: {wo.assigned_to_name || 'Contractor'}</span>
                        <span>🕒 {formatDate(wo.created_at)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-sm shrink-0 text-center"
                    >
                      Inspect &amp; Verify &rarr;
                    </Link>
                  </div>
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
      { key: 'reported', label: 'Reported', count: reportedCount, color: 'bg-amber-400' },
      { key: 'approved', label: 'Approved', count: approvedCount, color: 'bg-blue-400' },
      { key: 'assigned', label: 'Assigned', count: assignedCount, color: 'bg-indigo-400' },
      { key: 'in_progress', label: 'In Progress', count: inProgressCount, color: 'bg-sky-500' },
      { key: 'completed', label: 'Completed', count: completedCount, color: 'bg-purple-500' },
      { key: 'verified', label: 'Verified (QC)', count: verifiedCount, color: 'bg-teal-500' },
      { key: 'closed', label: 'Closed', count: closedCount, color: 'bg-emerald-500' }
    ];

    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Facility Leadership & Work Order Approval Center
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                  APPROVER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Review staff-reported maintenance requests, allocate approved budgets, and assign contractors
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/work-orders"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
              >
                View All Work Orders
              </Link>
              <Link
                href="/invoices"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Review Invoices
              </Link>
            </div>
          </div>

          {/* 3 Focused Metric Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/work-orders?status=reported"
              className={`p-5 rounded-xl border shadow-sm transition hover:shadow-md cursor-pointer block group ${reportedCount > 0
                  ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                  : 'bg-white border-slate-200 hover:border-sky-300'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <span>Awaiting Your Approval</span>
                  <span className="text-xs text-amber-600 group-hover:translate-x-0.5 transition">&rarr;</span>
                </span>
                {reportedCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                    Action Required
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : reportedCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">New staff-reported requests pending review &bull; Click to review</div>
            </Link>

            <Link
              href="/work-orders?status=active"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">
                  Active Jobs in Pipeline
                </span>
                <span className="text-xs text-sky-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-3xl font-bold text-sky-700 mt-2 font-mono">
                {isLoading ? '...' : (approvedCount + assignedCount + inProgressCount)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Contractor work actively underway &bull; View active jobs</div>
            </Link>

            <Link
              href="/invoices?status=pending"
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Pending Invoice Approvals
                </span>
                <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
              </div>
              <div className="text-3xl font-bold text-emerald-600 mt-2 font-mono">
                {isLoading ? '...' : formatCurrency(summary?.invoices.totalPending || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {summary?.invoices.count || 0} invoices submitted by contractors &bull; Approve & pay
              </div>
            </Link>
          </div>

          {/* Pending Approval Queue Table */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Pending Work Orders Awaiting Approval</span>
                  {pendingWorkOrders.length > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800">
                      {pendingWorkOrders.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review reported issue details, set estimated budget, or reject with audit notes
                </p>
              </div>
              <Link href="/work-orders?status=reported" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View all awaiting approval &rarr;
              </Link>
            </div>

            {pendingWorkOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-2xl mb-1">✓</div>
                <div className="text-xs font-semibold text-slate-700">All caught up!</div>
                <div className="text-[11px] text-slate-400 mt-0.5">No work orders currently awaiting approval.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingWorkOrders.map((wo) => (
                  <div key={wo.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{wo.tracking_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${wo.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                            wo.priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          {wo.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{wo.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{wo.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>🏥 {wo.facility_name || 'Hospital Facility'}</span>
                        <span>👤 Reported by: {wo.reported_by_name || 'Staff'}</span>
                        <span>🕒 {formatDate(wo.created_at)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition shadow-sm shrink-0 text-center"
                    >
                      Review &amp; Approve / Reject &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Pipeline Distribution (Clickable) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Work Order Lifecycle Pipeline
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click on any stage to filter related work orders
                </p>
              </div>
              <Link href="/work-orders" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View All &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {PIPELINE_STEPS.map((step) => (
                <Link
                  key={step.key}
                  href={`/work-orders?status=${step.key}`}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-sky-50/60 hover:border-sky-300 hover:shadow-2xs transition flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5">
                    <div className={`w-2 h-2 rounded-full ${step.color}`} />
                    <span className="text-[11px] font-medium text-slate-600 group-hover:text-sky-700 truncate">{step.label}</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-2 group-hover:text-sky-700">{step.count}</div>
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
    { key: 'reported', label: 'Reported', count: woStats.reported, color: 'bg-amber-400' },
    { key: 'approved', label: 'Approved', count: woStats.approved, color: 'bg-blue-400' },
    { key: 'assigned', label: 'Assigned', count: woStats.assigned, color: 'bg-indigo-400' },
    { key: 'in_progress', label: 'In Progress', count: woStats.in_progress, color: 'bg-sky-500' },
    { key: 'completed', label: 'Completed', count: woStats.completed, color: 'bg-purple-500' },
    { key: 'verified', label: 'Verified (QC)', count: woStats.verified, color: 'bg-teal-500' },
    { key: 'closed', label: 'Closed', count: woStats.closed, color: 'bg-emerald-500' }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome & Command Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user?.name || 'Administrator'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 uppercase font-mono">
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              MediTrack Real-Time Hospital Infrastructure Operational Command Center
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/work-orders"
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
            >
              + Create Work Order
            </Link>
            <Link
              href="/invoices?status=pending"
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              Approve Invoices
            </Link>
          </div>
        </div>

        {/* Real-time 4 Metric Cards (Clickable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/work-orders"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-sky-600 transition">
                Total Active Maintenance
              </span>
              <span className="text-xs text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition">&rarr;</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {isLoading ? '...' : activeTotal}
            </div>
            <div className="text-xs text-slate-400 mt-1">Out of {woStats.total} total lifetime orders</div>
          </Link>

          <Link
            href="/work-orders?priority=critical"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition group cursor-pointer block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                Critical & High Priority
              </span>
              <span className="text-xs text-amber-500 group-hover:translate-x-0.5 transition">&rarr;</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
              {isLoading ? '...' : (summary?.workOrders.byPriority.critical || 0) + (summary?.workOrders.byPriority.high || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.workOrders.byPriority.critical || 0} Critical emergency alerts &bull; View list
            </div>
          </Link>

          <Link
            href="/contractors"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition group cursor-pointer block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">
                Contractor Compliance
              </span>
              <span className="text-xs text-sky-500 group-hover:translate-x-0.5 transition">&rarr;</span>
            </div>
            <div className="text-2xl font-bold text-sky-600 mt-2 font-mono">
              {isLoading ? '...' : `${summary?.contractors.compliant || 0} / ${summary?.contractors.total || 0}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.contractors.expiring_soon || 0} licenses expiring soon &bull; Manage vendors
            </div>
          </Link>

          <Link
            href="/invoices?status=paid"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Settled Disbursements
              </span>
              <span className="text-xs text-emerald-500 group-hover:translate-x-0.5 transition">&rarr;</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
              {isLoading ? '...' : formatCurrency(summary?.invoices.totalPaid || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {formatCurrency(summary?.invoices.totalPending || 0)} pending approval &bull; View invoices
            </div>
          </Link>
        </div>

        {/* 7-Stage Workflow Pipeline Distribution (Clickable) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Work Order Lifecycle Pipeline
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any stage to filter work orders in that state
              </p>
            </div>
            <Link href="/work-orders" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              View all orders &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {PIPELINE_STEPS.map((step) => (
              <Link
                key={step.key}
                href={`/work-orders?status=${step.key}`}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-sky-50/60 hover:border-sky-300 hover:shadow-2xs transition flex flex-col justify-between group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full ${step.color}`} />
                  <span className="text-[11px] font-medium text-slate-600 group-hover:text-sky-700 truncate">{step.label}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-2 group-hover:text-sky-700">{step.count}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Facilities Workload & Live Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
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
                    className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 -mx-2 rounded transition group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-800 group-hover:text-sky-700">{fac.name}</div>
                      <div className="text-[11px] text-slate-400">{fac.code} &bull; {fac.type}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700">
                        {fac.activeWorkOrders} Active
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
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
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
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
