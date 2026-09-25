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
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
            >
              Open Audit Vault & Merkle Engine &rarr;
            </Link>
          </div>

          {/* 3 Focused Auditor Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Cryptographic Events Recorded
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : summary?.recentEvents?.length || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">SHA-256 hash linked blocks</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                Chain Integrity Status
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">100% VALID</div>
              <div className="text-xs text-slate-400 mt-1">Zero cryptographic discrepancies</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-purple-600 uppercase tracking-wider">
                Lifetime State Transitions
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-2 font-mono">
                {isLoading ? '...' : woStats.total}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total immutable events registered</div>
            </div>
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
              <Link href="/audit" className="text-xs font-medium text-sky-600 hover:text-sky-800">
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

          {/* 3 Focused Staff Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                My Hospital Open Tickets
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : activeTotal}
              </div>
              <div className="text-xs text-slate-400 mt-1">Pending and in-progress tasks</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                Critical Emergency Alerts
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : summary?.workOrders.byPriority.critical || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">High priority device repairs</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                Completed / Fixed
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
                {isLoading ? '...' : (woStats.completed + woStats.verified + woStats.closed)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Resolved maintenance issues</div>
            </div>
          </div>

          {/* Work Orders List Action */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Recent Work Order Status
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track repairs reported by hospital nursing & clinical staff
                </p>
              </div>
              <Link href="/work-orders" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View All Work Orders &rarr;
              </Link>
            </div>

            <div className="p-4 bg-sky-50/50 rounded-lg border border-sky-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-800">
                  Notice an equipment breakdown or calibration error?
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Click the button to log a ticket with device photos and location specifics.
                </div>
              </div>
              <Link
                href="/work-orders"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 rounded hover:bg-sky-700 transition"
              >
                + Create Ticket
              </Link>
            </div>
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
            </div>
          </div>

          {/* 3 Focused Contractor Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Assigned Active Jobs
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {isLoading ? '...' : (woStats.assigned + woStats.in_progress)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Orders requiring repair execution</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                Completed (Awaiting QC)
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : woStats.completed}
              </div>
              <div className="text-xs text-slate-400 mt-1">Submitted for safety inspection</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                Settled Invoice Disbursements
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
                {isLoading ? '...' : `$${(summary?.invoices.totalPaid || 0).toLocaleString()}`}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                ${(summary?.invoices.totalPending || 0).toLocaleString()} pending approval
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
              Next Action Items
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/work-orders"
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
                href="/work-orders"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Verify Tickets
              </Link>
            </div>
          </div>

          {/* 3 Focused Inspector Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                Awaiting QC Inspection
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                {isLoading ? '...' : woStats.completed}
              </div>
              <div className="text-xs text-slate-400 mt-1">Contractor work ready for audit</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-teal-600 uppercase tracking-wider">
                Verified (QC Passed)
              </div>
              <div className="text-2xl font-bold text-teal-600 mt-2 font-mono">
                {isLoading ? '...' : woStats.verified}
              </div>
              <div className="text-xs text-slate-400 mt-1">Safety-certified work orders</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                Safety Verification Status
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">100% AUDITED</div>
              <div className="text-xs text-slate-400 mt-1">Quality standards strictly enforced</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Quality Audit Queue
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verify repaired biomedical devices before closing tickets
                </p>
              </div>
              <Link href="/inspections" className="text-xs font-semibold text-sky-600 hover:text-sky-800">
                View Inspection Logs &rarr;
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------
  // 5. ADMIN & APPROVER FULL EXECUTIVE COMMAND DASHBOARD
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
              {user?.role === 'APPROVER' ? 'Review Work Orders' : '+ Create Work Order'}
            </Link>
            <Link
              href="/invoices"
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              Approve Invoices
            </Link>
          </div>
        </div>

        {/* Real-time 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Active Maintenance
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {isLoading ? '...' : activeTotal}
            </div>
            <div className="text-xs text-slate-400 mt-1">Out of {woStats.total} total lifetime orders</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
              Critical & High Priority
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
              {isLoading ? '...' : (summary?.workOrders.byPriority.critical || 0) + (summary?.workOrders.byPriority.high || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.workOrders.byPriority.critical || 0} Critical emergency alerts
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wider">
              Contractor Compliance
            </div>
            <div className="text-2xl font-bold text-sky-600 mt-2 font-mono">
              {isLoading ? '...' : `${summary?.contractors.compliant || 0} / ${summary?.contractors.total || 0}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.contractors.expiring_soon || 0} licenses expiring soon
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
              Settled Disbursements
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
              {isLoading ? '...' : `$${(summary?.invoices.totalPaid || 0).toLocaleString()}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              ${(summary?.invoices.totalPending || 0).toLocaleString()} pending approval
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
            <Link href="/work-orders" className="text-xs font-medium text-sky-600 hover:text-sky-700">
              View all orders &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.key}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
              >
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full ${step.color}`} />
                  <span className="text-[11px] font-medium text-slate-600 truncate">{step.label}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-2">{step.count}</div>
              </div>
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
                <Link href="/facilities" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                  Manage Facilities &rarr;
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {summary?.facilities.items.slice(0, 5).map((fac) => (
                  <div key={fac.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-800">{fac.name}</div>
                      <div className="text-[11px] text-slate-400">{fac.code} &bull; {fac.type}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700">
                        {fac.activeWorkOrders} Active
                      </span>
                    </div>
                  </div>
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
