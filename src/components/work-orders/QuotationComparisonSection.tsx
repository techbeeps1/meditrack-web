'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { downloadQuotePdf } from '@/lib/quotePdf';

interface QuotationComparisonSectionProps {
  workOrder: WorkOrder;
  isWorksEngineer: boolean;
  hasAssignScope: boolean;
  userRole: string;
  onOpenInviteModal?: () => void;
  onOpenSubmitQuoteModal: () => void;
  onOpenReevaluateModal: () => void;
}

export default function QuotationComparisonSection({
  workOrder,
  isWorksEngineer,
  hasAssignScope,
  userRole,
  onOpenInviteModal,
  onOpenSubmitQuoteModal,
  onOpenReevaluateModal
}: QuotationComparisonSectionProps) {
  const queryClient = useQueryClient();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [recommendationNotes, setRecommendationNotes] = useState('');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Record<string, boolean>>({});

  const recommendQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, notes }: { quoteId: string; notes: string }) => {
      setRecommendationError(null);
      return workOrderApi.recommendContractorQuotation(workOrder.id, {
        quoteId,
        recommendationNotes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
    },
    onError: (err: any) => {
      setRecommendationError(err.response?.data?.message || err.message || 'Failed to submit recommendation');
    }
  });

  const approveRecommendationMutation = useMutation({
    mutationFn: async () => {
      return workOrderApi.reviewContractorRecommendation(workOrder.id, {
        action: 'approved',
        notes: 'Approved by Contractor Approver'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
    }
  });

  const status = (workOrder.status || '').toLowerCase();
  const canContractorQuote = userRole === 'CONTRACTOR' && ['reported', 'approved'].includes(status) && !workOrder.assigned_to;
  const isQuotingPhase = ['reported', 'approved'].includes(status) && !workOrder.assigned_to;

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Multi-Contractor Quotations &amp; Technical Review
            </h2>
            {workOrder.quotations && workOrder.quotations.length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 font-mono">
                {workOrder.quotations.length} Quote(s) Submitted
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Awaiting Contractor Quotes
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Blind contractor bidding &bull; Works Engineer recommendation &bull; Contractor Approver final assignment
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(hasAssignScope || userRole === 'ADMIN' || userRole === 'APPROVER') && !workOrder.assigned_to && ['reported', 'approved'].includes(status) && onOpenInviteModal && (
            <button
              type="button"
              onClick={onOpenInviteModal}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {workOrder.invited_contractor_ids ? 'Manage Invitations' : '+ Invite Contractor(s)'}
            </button>
          )}

          {canContractorQuote && (
            <button
              type="button"
              onClick={onOpenSubmitQuoteModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              + Submit Formal Quotation &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Contractor Approver Recommendation Action Banner */}
      {workOrder.selected_contractor_quote_id && isQuotingPhase && (
        <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-600 animate-pulse" />
              <span className="font-bold text-purple-950 text-sm">
                Works Engineer Recommendation Submitted
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-900 uppercase">
              Awaiting Approver Action
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-1 text-slate-700">
            <div>
              Recommended Contractor:{' '}
              <strong className="text-purple-950">
                {workOrder.quotations?.find((q) => q.id === workOrder.selected_contractor_quote_id)?.contractor_name || 'Selected Contractor'}
              </strong>{' '}
              (Quoted:{' '}
              <strong className="text-purple-950 font-mono">
                {formatCurrency(workOrder.quotations?.find((q) => q.id === workOrder.selected_contractor_quote_id)?.amount || 0)}
              </strong>)
            </div>
            {workOrder.engineer_recommendation_notes && (
              <div className="text-[11px] text-slate-600 pt-1 border-t border-purple-50">
                <strong>Engineer Rationale:</strong> {workOrder.engineer_recommendation_notes}
              </div>
            )}
          </div>

          {hasAssignScope && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onOpenReevaluateModal}
                className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer"
              >
                Re-evaluate Quotes
              </button>
              <button
                type="button"
                disabled={approveRecommendationMutation.isPending}
                onClick={() => approveRecommendationMutation.mutate()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {approveRecommendationMutation.isPending ? 'Assigning...' : 'Approve & Assign Contractor'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Re-evaluation Alert if returned by Approver */}
      {workOrder.contractor_approver_action === 'reevaluate' && !workOrder.selected_contractor_quote_id && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1">
          <div className="font-bold flex items-center justify-between">
            <span>Quotation Re-evaluation Requested by Approver</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 uppercase font-bold">
              Revision Required
            </span>
          </div>
          <p className="text-amber-800 text-[11px]">
            <strong>Approver Feedback:</strong> {workOrder.contractor_approver_notes || 'Please re-evaluate candidate quotes.'}
          </p>
        </div>
      )}

      {/* Multi-Contractor Quotations Comparison Table */}
      {workOrder.quotations && workOrder.quotations.length > 0 ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Contractor / Vendor</th>
                  <th className="p-3">Quote Ref</th>
                  <th className="p-3">Quoted Amount (R)</th>
                  <th className="p-3">Submitted Date</th>
                  <th className="p-3">Status</th>
                  {isWorksEngineer && isQuotingPhase && <th className="p-3 text-right">Select</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {workOrder.quotations.map((q) => {
                  const isRecommended = q.id === workOrder.selected_contractor_quote_id;
                  const isAssigned = q.status === 'assigned' || q.contractor_id === workOrder.assigned_to;
                  const isExpanded = !!expandedQuoteIds[q.id];

                  let parsedBreakdown: { work_types?: string[]; turnaround_days?: number | string; items?: any[] } | null = null;
                  if (q.breakdown) {
                    try {
                      parsedBreakdown = typeof q.breakdown === 'string' ? JSON.parse(q.breakdown) : q.breakdown;
                    } catch (_) {}
                  }
                  const itemCount = parsedBreakdown?.items && Array.isArray(parsedBreakdown.items) ? parsedBreakdown.items.length : 0;

                  return (
                    <React.Fragment key={q.id}>
                      <tr key={q.id} className={isRecommended ? 'bg-purple-50/40' : isAssigned ? 'bg-emerald-50/40' : ''}>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{q.contractor_name || 'Contractor'}</div>
                          {q.notes && <div className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">{q.notes}</div>}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{q.quote_ref || '-'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(q.amount)}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {formatDate(q.created_at)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isAssigned
                                ? 'bg-emerald-100 text-emerald-800'
                                : isRecommended
                                ? 'bg-purple-100 text-purple-800'
                                : q.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isAssigned ? 'Assigned' : isRecommended ? 'Recommended' : q.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedQuoteIds((prev) => ({
                                  ...prev,
                                  [q.id]: !prev[q.id]
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                                isExpanded
                                  ? 'bg-slate-800 text-white shadow-xs'
                                  : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                              }`}
                              title="View Itemized Work Scope & Rates Breakdown"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              <span>{isExpanded ? 'Hide' : itemCount > 0 ? `Breakdown (${itemCount})` : 'Breakdown'}</span>
                            </button>

                            {isWorksEngineer && isQuotingPhase && (
                              <input
                                type="radio"
                                name="selectedQuote"
                                checked={selectedQuoteId === q.id || (!selectedQuoteId && isRecommended)}
                                onChange={() => setSelectedQuoteId(q.id)}
                                className="h-4 w-4 text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer ml-1"
                              />
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Itemized Work Scope Breakdown Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={6} className="p-3 sm:p-5">
                            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                              {/* Header Info */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <span>Itemized Work Scope &amp; Commercial Breakdown</span>
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                      {q.quote_ref || `QTE-${q.id.slice(-6).toUpperCase()}`}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Vendor: <strong className="text-slate-800">{q.contractor_name || 'Contractor'}</strong> &bull; Submitted: {formatDate(q.created_at)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {parsedBreakdown?.turnaround_days && (
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                      ⏱️ Turnaround: {parsedBreakdown.turnaround_days} Days
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      let parsedItems = undefined;
                                      let parsedWorkTypes = undefined;
                                      let turnaroundDays = undefined;
                                      if (q.breakdown) {
                                        try {
                                          const parsed = typeof q.breakdown === 'string' ? JSON.parse(q.breakdown) : q.breakdown;
                                          if (parsed && Array.isArray(parsed.items)) parsedItems = parsed.items;
                                          if (parsed && Array.isArray(parsed.work_types)) parsedWorkTypes = parsed.work_types;
                                          if (parsed && parsed.turnaround_days) turnaroundDays = parsed.turnaround_days;
                                        } catch (_) {}
                                      }
                                      downloadQuotePdf({
                                        quote_number: q.quote_ref || `QTE-${q.id.slice(-6).toUpperCase()}`,
                                        issued_date: q.created_at,
                                        work_order_tracking: workOrder.tracking_number,
                                        work_order_title: workOrder.title,
                                        client_name: workOrder.facility_name || 'Northern Cape Department of Health',
                                        facility_name: workOrder.facility_name,
                                        contractor_name: q.contractor_name || 'Contractor',
                                        quote_amount: Number(q.amount || 0),
                                        items: parsedItems,
                                        work_types: parsedWorkTypes,
                                        terms_days: turnaroundDays || 15,
                                        quote_notes: q.notes
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-[#008DA6] hover:bg-[#007387] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Quote PDF
                                  </button>
                                </div>
                              </div>

                              {/* Work Scope Classification Pills */}
                              {parsedBreakdown?.work_types && parsedBreakdown.work_types.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    Required Scope Classification:
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {parsedBreakdown.work_types.map((type, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center gap-1"
                                      >
                                        <span className="text-sky-600">✓</span> {type}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Line Items Table */}
                              {parsedBreakdown?.items && parsedBreakdown.items.length > 0 ? (
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                                      <tr>
                                        <th className="p-2.5 w-12 text-center">#</th>
                                        <th className="p-2.5">Scope / Item Description</th>
                                        <th className="p-2.5 w-20 text-center">Qty</th>
                                        <th className="p-2.5 w-28 text-right">Unit Price (R)</th>
                                        <th className="p-2.5 w-32 text-right">Subtotal (R)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {parsedBreakdown.items.map((it: any, itemIdx: number) => {
                                        const qty = Number(it.qty) || 1;
                                        const cost = Number(it.cost !== undefined ? it.cost : it.unit_price !== undefined ? it.unit_price : it.subtotal || 0);
                                        const unitPrice = it.unit_price !== undefined ? Number(it.unit_price) : (qty > 0 ? cost / qty : cost);
                                        const lineSubtotal = qty * unitPrice;
                                        return (
                                          <tr key={itemIdx}>
                                            <td className="p-2.5 text-center font-mono text-slate-400 font-bold">{itemIdx + 1}</td>
                                            <td className="p-2.5 text-slate-800 font-medium">{it.description || 'Specialist Healthcare Service'}</td>
                                            <td className="p-2.5 text-center font-mono text-slate-600">{qty}</td>
                                            <td className="p-2.5 text-right font-mono text-slate-600">
                                              {unitPrice.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                              {lineSubtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50/70 border-t border-slate-200 font-medium text-xs">
                                      <tr>
                                        <td colSpan={4} className="p-2 text-right text-slate-600">Subtotal (Excl. VAT):</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-800">
                                          R{(Number(q.amount || 0) / 1.15).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td colSpan={4} className="p-2 text-right text-slate-600">VAT (15.00%):</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-800">
                                          R{(Number(q.amount || 0) - (Number(q.amount || 0) / 1.15)).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                      <tr className="border-t border-slate-300 bg-slate-100/90 font-bold">
                                        <td colSpan={4} className="p-2.5 text-right text-slate-900">Total Commercial Bid (ZAR):</td>
                                        <td className="p-2.5 text-right font-mono text-[#008DA6] text-sm">
                                          {formatCurrency(q.amount)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                                  Lump-Sum Commercial Bid: <strong className="font-mono text-slate-900">{formatCurrency(q.amount)}</strong>
                                </div>
                              )}

                              {/* Technical Notes */}
                              {q.notes && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                                  <strong>Technical &amp; Execution Notes:</strong> {q.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Works Engineer Technical Recommendation Box */}
          {isWorksEngineer && isQuotingPhase && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              {recommendationError && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {recommendationError}
                </div>
              )}
              <label className="block text-xs font-bold text-slate-800">
                Works Engineer Technical Recommendation Rationale:
              </label>
              <textarea
                rows={2}
                value={recommendationNotes}
                onChange={(e) => setRecommendationNotes(e.target.value)}
                placeholder="State technical justification, rate competitiveness, or contractor OEM specialty..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    (!selectedQuoteId && !workOrder.selected_contractor_quote_id) ||
                    recommendQuoteMutation.isPending
                  }
                  onClick={() =>
                    recommendQuoteMutation.mutate({
                      quoteId: selectedQuoteId || workOrder.selected_contractor_quote_id || '',
                      notes: recommendationNotes.trim()
                    })
                  }
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {recommendQuoteMutation.isPending
                    ? 'Submitting Recommendation...'
                    : 'Submit Recommendation to Approver &rarr;'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
          No commercial quotations submitted by contractors yet. When contractors submit quotes, they will appear here for Works Engineer technical comparison and recommendation.
        </div>
      )}
    </div>
  );
}
