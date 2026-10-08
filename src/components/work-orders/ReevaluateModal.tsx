'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';

interface ReevaluateModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  onSuccess?: () => void;
}

export default function ReevaluateModal({
  isOpen,
  onClose,
  workOrder,
  onSuccess
}: ReevaluateModalProps) {
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reevaluateMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!notes.trim()) {
        throw new Error('Please provide re-evaluation instructions for the Works Engineer');
      }
      return workOrderApi.reviewContractorRecommendation(workOrder.id, {
        action: 'reevaluate',
        notes: notes.trim()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || 'Failed to submit re-evaluation request');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 uppercase">
                Procurement Review
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{workOrder.tracking_number}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">Request Quotation Re-evaluation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Return this work order to the Works Engineer with instructions to reassess bids.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Re-evaluation Feedback &amp; Scope Guidance *
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why the quote was returned (e.g. Budget ceiling exceeded, alternative candidate contractor preferred, request revised parts breakdown)..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!notes.trim() || reevaluateMutation.isPending}
            onClick={() => reevaluateMutation.mutate()}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition disabled:opacity-50 shadow-xs"
          >
            {reevaluateMutation.isPending ? 'Sending...' : 'Request Re-evaluation'}
          </button>
        </div>
      </div>
    </div>
  );
}
