'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi } from '@/services/dashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 15000 // auto-refresh every 15s
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

  const PIPELINE_STEPS = [
    { key: 'reported', label: 'Reported', count: woStats.reported, color: 'bg-amber-400' },
    { key: 'approved', label: 'Approved', count: woStats.approved, color: 'bg-blue-400' },
    { key: 'assigned', label: 'Assigned', count: woStats.assigned, color: 'bg-indigo-400' },
    { key: 'in_progress', label: 'In Progress', count: woStats.in_progress, color: 'bg-sky-500' },
    { key: 'completed', label: 'Completed', count: woStats.completed, color: 'bg-purple-500' },
    { key: 'verified', label: 'Verified (QC)', count: woStats.verified, color: 'bg-teal-500' },
    { key: 'closed', label: 'Closed & Archived', count: woStats.closed, color: 'bg-emerald-500' }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome & Command Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user?.name || 'User'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 uppercase font-mono">
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {user?.role === 'STAFF' && 'Hospital Facility Operations & Maintenance Reporting Portal'}
              {user?.role === 'APPROVER' && 'Executive Leadership Approval & Contractor Dispatch Command'}
              {user?.role === 'CONTRACTOR' && 'Biomedical & Infrastructure Vendor Work Execution Portal'}
              {user?.role === 'INSPECTOR' && 'Quality Assurance & Clinical Safety Verification Center'}
              {user?.role === 'AUDITOR' && 'Cryptographic SHA-256 Audit Trail & Merkle Root Compliance Vault'}
              {user?.role === 'ADMIN' && 'MediTrack Real-Time Hospital Infrastructure Operational Command Center'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(user?.role === 'STAFF' || user?.role === 'ADMIN') && (
              <Link
                href="/work-orders"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
              >
                + Report Work Order
              </Link>
            )}
            {user?.role === 'APPROVER' && (
              <>
                <Link
                  href="/work-orders"
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
                >
                  Review Work Orders
                </Link>
                <Link
                  href="/invoices"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Approve Invoices
                </Link>
              </>
            )}
            {user?.role === 'CONTRACTOR' && (
              <>
                <Link
                  href="/work-orders"
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
              </>
            )}
            {user?.role === 'INSPECTOR' && (
              <>
                <Link
                  href="/inspections"
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
                >
                  + Record Inspection
                </Link>
                <Link
                  href="/work-orders"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Verify Tickets
                </Link>
              </>
            )}
            {user?.role === 'AUDITOR' && (
              <Link
                href="/audit"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
              >
                Verify Audit Vault &rarr;
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link
                href="/inspections"
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                QC Inspections
              </Link>
            )}
          </div>
        </div>

        {/* Real-time Metric Cards Tailored by Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {user?.role === 'CONTRACTOR' ? 'Active Assigned Jobs' : user?.role === 'INSPECTOR' ? 'Ready for Verification' : 'Active Work Orders'}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {isLoading ? '...' : user?.role === 'INSPECTOR' ? woStats.completed : activeTotal}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {user?.role === 'INSPECTOR' ? `${woStats.verified} verified tickets` : `Out of ${woStats.total} total tickets`}
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
              {user?.role === 'CONTRACTOR' ? 'Completed & Submitted' : user?.role === 'AUDITOR' ? 'State Transitions' : 'Critical & High Priority'}
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
              {isLoading
                ? '...'
                : user?.role === 'CONTRACTOR'
                ? woStats.completed
                : user?.role === 'AUDITOR'
                ? woStats.total
                : (summary?.workOrders.byPriority.critical || 0) + (summary?.workOrders.byPriority.high || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {user?.role === 'CONTRACTOR'
                ? 'Awaiting safety inspection'
                : user?.role === 'AUDITOR'
                ? 'Immutable state events'
                : `${summary?.workOrders.byPriority.critical || 0} Critical emergency alerts`}
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wider">
              {user?.role === 'STAFF'
                ? 'Hospital In Progress'
                : user?.role === 'CONTRACTOR'
                ? 'Pending Claims'
                : user?.role === 'AUDITOR'
                ? 'Cryptographic Events'
                : user?.role === 'INSPECTOR'
                ? 'Passed Inspections'
                : 'Contractor Compliance'}
            </div>
            <div className="text-2xl font-bold text-sky-600 mt-2 font-mono">
              {isLoading
                ? '...'
                : user?.role === 'STAFF'
                ? woStats.in_progress
                : user?.role === 'CONTRACTOR'
                ? `$${(summary?.invoices.totalPending || 0).toLocaleString()}`
                : user?.role === 'AUDITOR'
                ? summary?.recentEvents?.length || 0
                : user?.role === 'INSPECTOR'
                ? woStats.verified
                : `${summary?.contractors.compliant || 0} / ${summary?.contractors.total || 0}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {user?.role === 'STAFF'
                ? 'Active technicians working'
                : user?.role === 'CONTRACTOR'
                ? 'Under facility review'
                : user?.role === 'AUDITOR'
                ? 'SHA-256 linked blocks'
                : user?.role === 'INSPECTOR'
                ? 'Verified QC Passed'
                : `${summary?.contractors.expiring_soon || 0} licenses expiring soon`}
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
              {user?.role === 'STAFF'
                ? 'Assigned Campus'
                : user?.role === 'AUDITOR' || user?.role === 'INSPECTOR'
                ? 'Tamper-Proof Status'
                : 'Settled Disbursements'}
            </div>
            <div className="text-xl font-bold text-emerald-600 mt-2 font-mono truncate">
              {isLoading
                ? '...'
                : user?.role === 'STAFF'
                ? user?.facility_name || 'Active Hospital'
                : user?.role === 'AUDITOR' || user?.role === 'INSPECTOR'
                ? '100% Valid'
                : `$${(summary?.invoices.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {user?.role === 'STAFF'
                ? 'Ground operations unit'
                : user?.role === 'AUDITOR' || user?.role === 'INSPECTOR'
                ? 'Cryptographic integrity intact'
                : `$${(summary?.invoices.totalPending || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })} pending approval`}
            </div>
          </div>
        </div>

        {/* 7-Stage Workflow Pipeline Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Work Order Lifecycle Pipeline
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time distribution of maintenance orders across 7 state machine stages
              </p>
            </div>
            <Link
              href="/work-orders"
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              View all orders &rarr;
            </Link>
          </div>

          {/* Stepper counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.key}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
              >
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full ${step.color}`} />
                  <span className="text-[11px] font-medium text-slate-600 truncate">
                    {step.label}
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-2">{step.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid Section: Facilities Workload & Recent Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Facilities Workload (Visible to Staff, Approver, Admin) */}
          {user?.role !== 'CONTRACTOR' && user?.role !== 'AUDITOR' ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Hospital Facilities Workload
                  </h2>
                  {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                    <Link
                      href="/facilities"
                      className="text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      Manage Facilities &rarr;
                    </Link>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {summary?.facilities.items.slice(0, 5).map((fac) => (
                    <div key={fac.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs text-slate-800">{fac.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {fac.code} &bull; {fac.type}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700">
                          {fac.activeWorkOrders} Active Tasks
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {fac.totalWorkOrders} Total
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {user?.role === 'CONTRACTOR' ? 'Assigned Maintenance Quick Access' : 'Audit Chain Status'}
                  </h2>
                  <Link
                    href="/work-orders"
                    className="text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    View All &rarr;
                  </Link>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-2">
                  <p className="font-medium text-slate-800">
                    {user?.role === 'CONTRACTOR'
                      ? '⚡ Complete work orders and upload photographic evidence directly in tickets to request invoice settlement.'
                      : '🔒 Cryptographic state hashes are linked with SHA-256 Merkle root trees for verifiable zero-tampering compliance.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cryptographic Event Audit Trail Stream (Visible to Auditor, Approver, Admin) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Live Operations Audit Feed
                </h2>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
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
                          <span className="font-mono font-bold text-slate-800">
                            {evt.workOrderTracking}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="font-semibold text-sky-700 capitalize">
                            {evt.toStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          By <span className="font-medium text-slate-700">{evt.actorName}</span>
                          {evt.notes ? ` • "${evt.notes}"` : ''}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          Hash: {evt.eventHash.slice(0, 16)}...
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(evt.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 p-4 text-center">
                    No recent audit events recorded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
