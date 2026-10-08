'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder, ContractorQuotation } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';

interface SubmitQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  initialQuotation?: ContractorQuotation | null;
  onSuccess?: () => void;
}

export default function SubmitQuotationModal({
  isOpen,
  onClose,
  workOrder,
  initialQuotation,
  onSuccess
}: SubmitQuotationModalProps) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number | ''>('');
  const [turnaroundDays, setTurnaroundDays] = useState<number | ''>(5);
  const [quoteRef, setQuoteRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-fill existing quotation details when opening for edit
  useEffect(() => {
    if (!isOpen) return;

    // Find quote from props or from workOrder.quotations list
    const existingQuote = initialQuotation || (workOrder.quotations && workOrder.quotations.length > 0 ? workOrder.quotations[0] : null);

    if (existingQuote) {
      setAmount(existingQuote.amount || '');
      setQuoteRef(existingQuote.quote_ref || '');

      const existingNotes = existingQuote.notes || '';
      const turnaroundMatch = existingNotes.match(/Proposed Turnaround:\s*(\d+)/i);
      if (turnaroundMatch && turnaroundMatch[1]) {
        setTurnaroundDays(Number(turnaroundMatch[1]));
      }

      // Clean notes from turnaround prefix
      const cleanNotes = existingNotes
        .replace(/Proposed Turnaround:\s*\d+\s*working day\(s\)\s*(•\s*)?/i, '')
        .trim();
      setNotes(cleanNotes);
    } else {
      setAmount('');
      setTurnaroundDays(5);
      setQuoteRef('');
      setNotes('');
    }
  }, [isOpen, workOrder, initialQuotation]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!amount || Number(amount) <= 0) {
        throw new Error('Please enter a valid quotation amount greater than 0');
      }
      return workOrderApi.submitContractorQuotation(workOrder.id, {
        amount: Number(amount),
        quote_ref: quoteRef.trim() || undefined,
        notes: [
          turnaroundDays ? `Proposed Turnaround: ${turnaroundDays} working day(s)` : null,
          notes.trim() || null
        ].filter(Boolean).join(' • ')
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
      setError(err.response?.data?.message || err.message || 'Failed to submit contractor quotation');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                Blind Bidding
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{workOrder.tracking_number}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">Submit Formal Contractor Quotation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit your formal commercial bid for Works Engineer review and comparison.
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

        {/* Scope Reference Notice */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <span className="font-bold text-slate-800 block">Required Job Scope:</span>
          <p className="text-[11px] leading-relaxed line-clamp-2">{workOrder.title} &bull; {workOrder.description}</p>
        </div>

        {/* Quotation Amount & Turnaround Days */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Quotation Amount (R) *
            </label>
            <div className="relative rounded-lg shadow-2xs">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs font-mono font-bold">
                R
              </span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 45000"
                className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Turnaround (Days) *
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={turnaroundDays}
              onChange={(e) => setTurnaroundDays(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 5"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Quote Reference */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Quotation Reference Number (Optional)
          </label>
          <input
            type="text"
            value={quoteRef}
            onChange={(e) => setQuoteRef(e.target.value)}
            placeholder="e.g. QUOTE-2026-APEX-01"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
          />
        </div>

        {/* Scope Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Scope Details &amp; Turnaround (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Itemized parts, warranty terms, technician availability..."
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
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
            disabled={!amount || Number(amount) <= 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 shadow-xs"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Commercial Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
