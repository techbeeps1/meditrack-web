'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';
import { formatCurrency, formatDate } from '@/lib/utils';

interface QuotationComparisonSectionProps {
  workOrder: WorkOrder;
  isWorksEngineer: boolean;
  hasAssignScope: boolean;
  userRole: string;
  onOpenSubmitQuoteModal: () => void;
  onOpenReevaluateModal: () => void;
}

export default function QuotationComparisonSection({
  workOrder,
  isWorksEngineer,
  hasAssignScope,
  userRole,
  onOpenSubmitQuoteModal,
  onOpenReevaluateModal
}: QuotationComparisonSectionProps) {
  const queryClient = useQueryClient();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [recommendationNotes, setRecommendationNotes] = useState('');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

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
                  return (
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
                      {isWorksEngineer && isQuotingPhase && (
                        <td className="p-3 text-right">
                          <input
                            type="radio"
                            name="selectedQuote"
                            checked={selectedQuoteId === q.id || (!selectedQuoteId && isRecommended)}
                            onChange={() => setSelectedQuoteId(q.id)}
                            className="h-4 w-4 text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                      )}
                    </tr>
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
