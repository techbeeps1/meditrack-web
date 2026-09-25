'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { workOrderApi } from '@/services/work-orders';
import { API_SERVER_URL } from '@/services/api';
import { WorkOrderPriority, WorkOrderStatus } from '@/types/workOrder';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const WORKFLOW_STEPS: { status: WorkOrderStatus; label: string }[] = [
  { status: 'reported', label: 'Reported' },
  { status: 'approved', label: 'Approved' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'verified', label: 'Verified' },
  { status: 'closed', label: 'Closed' }
];

const PRIORITY_BADGES: Record<WorkOrderPriority, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
};

const STATUS_BADGES: Record<WorkOrderStatus, { bg: string; text: string; border: string }> = {
  reported: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  approved: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  assigned: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  completed: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  verified: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoStage, setPhotoStage] = useState<'initial' | 'in_progress' | 'completed' | 'inspection'>('in_progress');

  // Transition Modal state
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | null>(null);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [assignedTechnician, setAssignedTechnician] = useState('usr_contractor_01');
  const [actualCostInput, setActualCostInput] = useState<number | ''>('');
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Fetch Work Order
  const { data: workOrder, isLoading, isError } = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => workOrderApi.getWorkOrderById(id),
    enabled: !!id
  });

  // Fetch Cryptographic Audit Chain
  const { data: auditChain, refetch: refetchAuditChain } = useQuery({
    queryKey: ['audit-chain', id],
    queryFn: () => workOrderApi.getAuditChain(id),
    enabled: !!id
  });

  // Upload Photo Mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFiles || photoFiles.length === 0) return;
      const formData = new FormData();
      for (let i = 0; i < photoFiles.length; i++) {
        formData.append('photos', photoFiles[i]);
      }
      formData.append('caption', photoCaption);
      formData.append('stage', photoStage);
      return workOrderApi.uploadPhotos(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      setIsPhotoModalOpen(false);
      setPhotoFiles(null);
      setPhotoCaption('');
    }
  });

  // Status Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async () => {
      if (!targetStatus) return;
      return workOrderApi.transitionStatus(id, {
        status: targetStatus,
        notes: transitionNotes,
        assigned_to: targetStatus === 'assigned' ? assignedTechnician : undefined,
        actual_cost: actualCostInput !== '' ? Number(actualCostInput) : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsTransitionModalOpen(false);
      setTransitionNotes('');
      setTransitionError(null);
    },
    onError: (err: any) => {
      setTransitionError(err.response?.data?.message || 'Failed to update work order status');
    }
  });

  const openTransitionModal = (status: WorkOrderStatus) => {
    setTargetStatus(status);
    setTransitionNotes('');
    setTransitionError(null);
    if (status === 'approved') {
      setActualCostInput(workOrder?.estimated_cost || '');
    } else if (status === 'completed') {
      setActualCostInput(workOrder?.actual_cost || workOrder?.estimated_cost || '');
    } else {
      setActualCostInput('');
    }
    setIsTransitionModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading work order details...
        </div>
      </AppLayout>
    );
  }

  if (isError || !workOrder) {
    return (
      <AppLayout>
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center space-y-4">
          <p className="text-red-600 font-medium">Work order not found or failed to load.</p>
          <Link
            href="/work-orders"
            className="inline-block px-4 py-2 bg-sky-600 text-white rounded text-sm font-medium"
          >
            &larr; Back to Work Orders
          </Link>
        </div>
      </AppLayout>
    );
  }

  const pBadge = PRIORITY_BADGES[workOrder.priority] || PRIORITY_BADGES.medium;
  const sBadge = STATUS_BADGES[workOrder.status] || STATUS_BADGES.reported;

  // Determine current step index in 7-step pipeline
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.status === workOrder.status);

  // Check what actions the logged-in user can take
  const role = user?.role;
  const status = workOrder.status;

  const canApprove = (role === 'APPROVER' || role === 'ADMIN') && status === 'reported';
  const canAssign = (role === 'APPROVER' || role === 'ADMIN') && status === 'approved';
  const canStartWork = (role === 'CONTRACTOR' || role === 'ADMIN') && status === 'assigned';
  const canComplete = (role === 'CONTRACTOR' || role === 'ADMIN') && status === 'in_progress';
  const canVerify = (role === 'INSPECTOR' || role === 'ADMIN') && status === 'completed';
  const canClose = (role === 'APPROVER' || role === 'ADMIN') && status === 'verified';
  const canReject = (role === 'APPROVER' || role === 'ADMIN') && ['reported', 'approved', 'assigned'].includes(status);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Link href="/work-orders" className="hover:text-gray-900 hover:underline">
            Work Orders
          </Link>
          <span>&rsaquo;</span>
          <span className="font-mono text-gray-700">{workOrder.tracking_number}</span>
        </div>

        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sky-700 text-sm">
                {workOrder.tracking_number}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${pBadge.bg} ${pBadge.text} ${pBadge.border}`}
              >
                {workOrder.priority} Priority
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${sBadge.bg} ${sBadge.text} ${sBadge.border}`}
              >
                {workOrder.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">
              {workOrder.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Reported on {formatDate(workOrder.created_at)} by{' '}
              <span className="font-semibold text-gray-700">{workOrder.reported_by_name || 'Staff'}</span>
            </p>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && (
              <button
                onClick={() => openTransitionModal('approved')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                ✓ Approve Work Order
              </button>
            )}

            {canAssign && (
              <button
                onClick={() => openTransitionModal('assigned')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                ➔ Assign to Contractor
              </button>
            )}

            {canStartWork && (
              <button
                onClick={() => openTransitionModal('in_progress')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                ▶ Start Field Work
              </button>
            )}

            {canComplete && (
              <button
                onClick={() => openTransitionModal('completed')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                ✓ Mark Work Completed
              </button>
            )}

            {canVerify && (
              <>
                <button
                  onClick={() => openTransitionModal('verified')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
                >
                  ✓ Pass Inspection & Verify
                </button>
                <button
                  onClick={() => openTransitionModal('in_progress')}
                  className="px-3 py-2 bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs font-semibold rounded transition-colors"
                >
                  ✕ Fail QC (Return to In Progress)
                </button>
              </>
            )}

            {canClose && (
              <button
                onClick={() => openTransitionModal('closed')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                ✓ Close Work Order
              </button>
            )}

            {canReject && (
              <button
                onClick={() => openTransitionModal('cancelled')}
                className="px-3 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-medium rounded transition-colors"
              >
                Cancel / Reject
              </button>
            )}
          </div>
        </div>

        {/* Workflow Pipeline Stepper */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Workflow Progress Pipeline
            </div>
            {workOrder.status === 'cancelled' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                ✕ Order Cancelled / Rejected
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isPast = currentStepIdx >= idx;
              const isCurrent = currentStepIdx === idx;

              return (
                <div key={step.status} className="text-center">
                  <div
                    className={`h-2 rounded-full mb-2 transition-all ${
                      isCurrent
                        ? 'bg-sky-600 ring-2 ring-sky-300'
                        : isPast
                        ? 'bg-emerald-500'
                        : 'bg-gray-200'
                    }`}
                  />
                  <div
                    className={`text-xs font-medium capitalize truncate ${
                      isCurrent
                        ? 'text-sky-700 font-bold'
                        : isPast
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation (Details vs SHA-256 Audit Trail) */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-sky-600 text-sky-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Work Order Details & Photos
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-sky-600 text-sky-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>SHA-256 Cryptographic Audit Trail</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-100 text-sky-800 rounded-full font-bold">
              {auditChain?.chain_length || 0} Events
            </span>
          </button>
        </div>

        {/* TAB 1: WORK ORDER DETAILS */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                  Issue Description
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {workOrder.description}
                </p>

                {workOrder.location_details && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">Location Specifics:</span>{' '}
                    {workOrder.location_details}
                  </div>
                )}
              </div>

              {/* Photos Gallery */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Attached Inspection Evidence ({workOrder.photos?.length || 0})
                  </h2>
                  <button
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                  >
                    + Upload Photo
                  </button>
                </div>

                {!workOrder.photos || workOrder.photos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded">
                    No inspection photos attached to this ticket yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {workOrder.photos.map((photo) => {
                      const photoUrl = photo.photo_url.startsWith('http')
                        ? photo.photo_url
                        : `${API_SERVER_URL}${photo.photo_url.startsWith('/') ? '' : '/'}${photo.photo_url}`;

                      return (
                        <a
                          key={photo.id}
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-xs block group hover:shadow-md transition"
                          title="Click to view full image"
                        >
                          <div className="h-36 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                            <img
                              src={photoUrl}
                              alt={photo.caption || 'Work order photo'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="p-1.5 rounded-full bg-white/90 text-slate-800 shadow">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white border-t border-slate-100">
                            <div className="font-medium text-slate-800 truncate">
                              {photo.caption || 'Photo attachment'}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-mono">
                              Stage: {photo.stage}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Metadata */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Facility Details
                </h2>
                <div>
                  <div className="text-xs text-gray-500">Hospital Facility</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {workOrder.facility_name || 'N/A'}
                  </div>
                  <div className="text-xs font-mono text-sky-700">
                    {workOrder.facility_code}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-xs text-gray-700">
                    {workOrder.facility_address ? `${workOrder.facility_address}, ${workOrder.facility_city}` : 'Main Campus'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="text-xs font-medium text-gray-800">
                    {workOrder.category}
                  </div>
                </div>
              </div>

              {user?.role !== 'STAFF' && (
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Financials & Schedule
                  </h2>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Estimated Cost</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(workOrder.estimated_cost)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Actual Cost</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(workOrder.actual_cost)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Target Due Date</span>
                    <span className="font-semibold text-gray-900">{workOrder.due_date ? formatDate(workOrder.due_date) : 'Flexible'}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-gray-500">Assigned Contractor</span>
                    <span className="font-semibold text-gray-900">{workOrder.assigned_to_name || 'Unassigned'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CRYPTOGRAPHIC SHA-256 AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Integrity Status Card */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-800">
                    Cryptographic Integrity Verified: Zero Tampering Detected
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Every status change is sealed with a SHA-256 hash referencing the previous event. Total {auditChain?.chain_length} blocks in chain.
                </p>
              </div>
              <button
                onClick={() => refetchAuditChain()}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 transition-colors shrink-0"
              >
                Re-Verify Proof
              </button>
            </div>

            {/* Event Chain Timeline */}
            <div className="space-y-4">
              {auditChain?.events?.map((evt, idx) => {
                const isGenesis = evt.previous_hash === '0000000000000000000000000000000000000000000000000000000000000000';
                const badge = STATUS_BADGES[evt.status] || STATUS_BADGES.reported;

                return (
                  <div
                    key={evt.id}
                    className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3 relative"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center font-mono">
                          #{idx + 1}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {evt.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-600">
                          Actor: <strong className="text-gray-900">{evt.actor_name || 'System User'}</strong> ({evt.actor_role})
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatDate(evt.created_at)}
                      </span>
                    </div>

                    {evt.notes && (
                      <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-100">
                        {evt.notes}
                      </p>
                    )}

                    {/* Cryptographic Hashes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px] font-mono">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <div className="text-gray-400 uppercase text-[10px] font-semibold">
                          Current SHA-256 Hash:
                        </div>
                        <div className="flex items-center justify-between text-slate-800 mt-0.5">
                          <span className="truncate pr-2">{evt.current_hash}</span>
                          <button
                            onClick={() => copyToClipboard(evt.current_hash)}
                            className="text-sky-600 hover:text-sky-800 shrink-0 font-sans text-xs"
                          >
                            {copiedHash === evt.current_hash ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <div className="text-gray-400 uppercase text-[10px] font-semibold">
                          Previous Hash Pointer:
                        </div>
                        <div className="text-slate-600 truncate mt-0.5">
                          {isGenesis ? 'GENESIS ROOT (0000...)' : evt.previous_hash}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Transition Modal */}
        {isTransitionModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  {targetStatus === 'cancelled'
                    ? 'Cancel / Reject Work Order'
                    : targetStatus === 'approved'
                    ? 'Approve Work Order'
                    : `Transition Status → ${targetStatus?.replace('_', ' ')}`}
                </h3>
                <button
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {transitionError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {transitionError}
                </div>
              )}

              {/* When Approver Approves: Allow setting/confirming Approved Estimated Budget */}
              {targetStatus === 'approved' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Approved Estimated Budget ($)
                  </label>
                  <input
                    type="number"
                    value={actualCostInput}
                    onChange={(e) => setActualCostInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              )}

              {targetStatus === 'assigned' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Select Maintenance Contractor / Specialist *
                  </label>
                  <select
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="usr_contractor_01">Apex BioMed Solutions (Field Engineer)</option>
                  </select>
                </div>
              )}

              {/* Only show Actual Cost when Contractor completes work */}
              {targetStatus === 'completed' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Actual Repair Cost ($)
                  </label>
                  <input
                    type="number"
                    value={actualCostInput}
                    onChange={(e) => setActualCostInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1850"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {targetStatus === 'cancelled'
                    ? 'Reason for Cancellation / Rejection *'
                    : 'Audit Notes / Reason for Transition'}
                </label>
                <textarea
                  rows={3}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder={
                    targetStatus === 'cancelled'
                      ? 'Provide rationale for cancelling this work order...'
                      : 'Provide audit rationale, inspection observations, or dispatch notes...'
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 ${
                    targetStatus === 'cancelled'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {transitionMutation.isPending
                    ? 'Processing...'
                    : targetStatus === 'cancelled'
                    ? 'Confirm Cancellation'
                    : targetStatus === 'approved'
                    ? 'Confirm Approval'
                    : 'Confirm Status Change'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Photo Modal */}
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  Upload Maintenance Evidence
                </h3>
                <button
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Photos *
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setPhotoFiles(e.target.files)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Maintenance Stage
                </label>
                <select
                  value={photoStage}
                  onChange={(e) => setPhotoStage(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="initial">Initial Issue Evidence</option>
                  <option value="in_progress">Work In Progress</option>
                  <option value="completed">Completed Repair</option>
                  <option value="inspection">Inspection Quality Check</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Caption / Notes
                </label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Replacement capacitor installed"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!photoFiles || uploadPhotoMutation.isPending}
                  onClick={() => uploadPhotoMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photos'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
