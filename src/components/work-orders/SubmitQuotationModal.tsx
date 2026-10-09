'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder, ContractorQuotation } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';
import { formatCurrency } from '@/lib/utils';

interface SubmitQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  initialQuotation?: ContractorQuotation | null;
  onSuccess?: () => void;
}

interface ScopeItem {
  id: string;
  description: string;
  cost: number | '';
}

const AVAILABLE_WORK_TYPES = [
  'Maintenance',
  'Repair',
  'Change / Replace',
  'Calibration',
  'Alteration',
  'Specialist Service'
];

export default function SubmitQuotationModal({
  isOpen,
  onClose,
  workOrder,
  initialQuotation,
  onSuccess
}: SubmitQuotationModalProps) {
  const queryClient = useQueryClient();

  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>(['Maintenance', 'Repair']);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([
    { id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: '' }
  ]);
  const [turnaroundDays, setTurnaroundDays] = useState<number | ''>(3);
  const [quoteRef, setQuoteRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pre-fill existing quotation details when opening for edit
  useEffect(() => {
    if (!isOpen) return;

    const existingQuote = initialQuotation || (workOrder.quotations && workOrder.quotations.length > 0 ? workOrder.quotations[0] : null);

    if (existingQuote) {
      setQuoteRef(existingQuote.quote_ref || '');

      let parsedBreakdown: any = null;
      if (existingQuote.breakdown) {
        try {
          parsedBreakdown = typeof existingQuote.breakdown === 'string' ? JSON.parse(existingQuote.breakdown) : existingQuote.breakdown;
        } catch (_) {}
      }

      if (parsedBreakdown && Array.isArray(parsedBreakdown.items) && parsedBreakdown.items.length > 0) {
        setScopeItems(parsedBreakdown.items.map((it: any, idx: number) => ({
          id: it.id || `item-${idx + 1}`,
          description: it.description || '',
          cost: it.cost !== undefined ? it.cost : (it.subtotal || '')
        })));
        if (Array.isArray(parsedBreakdown.work_types) && parsedBreakdown.work_types.length > 0) {
          setSelectedWorkTypes(parsedBreakdown.work_types);
        }
        if (parsedBreakdown.turnaround_days) {
          setTurnaroundDays(parsedBreakdown.turnaround_days);
        }
      } else {
        // Fallback with total amount in single line item
        setScopeItems([
          {
            id: 'item-1',
            description: workOrder.title || 'Technical Specialist Maintenance Execution',
            cost: existingQuote.amount || ''
          }
        ]);
      }

      const existingNotes = existingQuote.notes || '';
      const turnaroundMatch = existingNotes.match(/Proposed Turnaround:\s*(\d+)/i);
      if (turnaroundMatch && turnaroundMatch[1] && !parsedBreakdown?.turnaround_days) {
        setTurnaroundDays(Number(turnaroundMatch[1]));
      }

      const cleanNotes = existingNotes
        .replace(/Proposed Turnaround:\s*\d+\s*working day\(s\)\s*(•\s*)?/i, '')
        .trim();
      setNotes(cleanNotes);
    } else {
      setSelectedWorkTypes(['Maintenance', 'Repair']);
      setScopeItems([
        { id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: '' }
      ]);
      setTurnaroundDays(3);
      setQuoteRef('');
      setNotes('');
      setError(null);
    }
  }, [isOpen, workOrder, initialQuotation]);

  // Handle Work Scope Classification toggles
  const toggleWorkType = (type: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Dynamic Scope Item actions
  const addScopeItem = () => {
    const nextId = `item-${Date.now()}-${scopeItems.length + 1}`;
    setScopeItems((prev) => [...prev, { id: nextId, description: '', cost: '' }]);
  };

  const updateScopeItemDescription = (id: string, description: string) => {
    setScopeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description } : item))
    );
  };

  const updateScopeItemCost = (id: string, costValue: string) => {
    const numCost = costValue === '' ? '' : Math.max(0, Number(costValue));
    setScopeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, cost: numCost } : item))
    );
  };

  const removeScopeItem = (id: string) => {
    if (scopeItems.length <= 1) return;
    setScopeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalCalculatedCost = scopeItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      setError(null);

      if (selectedWorkTypes.length === 0) {
        throw new Error('Please select at least one Work Scope Classification');
      }

      const validItems = scopeItems.filter((it) => it.description.trim() !== '');
      if (validItems.length === 0) {
        throw new Error('Please enter at least one itemized work scope description');
      }

      if (totalCalculatedCost <= 0) {
        throw new Error('Total quotation amount must be greater than R 0. Please specify line item costs.');
      }

      const breakdownPayload = {
        work_types: selectedWorkTypes,
        items: scopeItems.map((item, idx) => ({
          id: item.id || `item-${idx + 1}`,
          index: idx + 1,
          description: item.description.trim() || `Scope Task #${idx + 1}`,
          cost: Number(item.cost) || 0
        })),
        total_amount: totalCalculatedCost,
        turnaround_days: Number(turnaroundDays) || 3
      };

      const breakdownJsonString = JSON.stringify(breakdownPayload);

      return workOrderApi.submitContractorQuotation(workOrder.id, {
        amount: totalCalculatedCost,
        quote_ref: quoteRef.trim() || undefined,
        breakdown: breakdownJsonString,
        notes: [
          turnaroundDays ? `Proposed Turnaround: ${turnaroundDays} working day(s)` : null,
          selectedWorkTypes.length > 0 ? `Classification: ${selectedWorkTypes.join(', ')}` : null,
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                Blind Commercial Bidding
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{workOrder.tracking_number}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Submit Formal Contractor Quotation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit your itemized commercial bid for Works Engineer review and comparison.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* 1. Scope Reference Notice */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">Required Job Scope:</span>
          <p className="text-xs text-slate-800 font-medium leading-relaxed">{workOrder.title}</p>
          {workOrder.description && (
            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{workOrder.description}</p>
          )}
        </div>

        {/* 2. REQUIRED WORK SCOPE CLASSIFICATION */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            2. Required Work Scope Classification *
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_WORK_TYPES.map((type) => {
              const isSelected = selectedWorkTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleWorkType(type)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. ITEMIZED WORK SCOPE & COST BREAKDOWN */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                3. Itemized Work Scope &amp; Cost Breakdown *
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Specify each required maintenance / repair task and estimated line cost.
              </p>
            </div>
            <button
              type="button"
              onClick={addScopeItem}
              className="px-3 py-1.5 text-xs font-bold text-sky-800 bg-sky-100 hover:bg-sky-200 active:bg-sky-300 border border-sky-300 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <span>+</span>
              <span>Add Scope Item</span>
            </button>
          </div>

          {/* Line Items List */}
          <div className="space-y-2.5">
            {scopeItems.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2.5 transition focus-within:border-sky-400"
              >
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg shrink-0 select-none">
                  #{idx + 1}
                </span>

                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateScopeItemDescription(item.id, e.target.value)}
                  placeholder="e.g. Technical Diagnostic & Core Maintenance"
                  className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />

                <div className="relative w-32 shrink-0">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 text-xs font-mono font-bold">
                    R
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.cost}
                    onChange={(e) => updateScopeItemCost(item.id, e.target.value)}
                    placeholder="Cost"
                    className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400"
                  />
                </div>

                {scopeItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScopeItem(item.id)}
                    title="Remove item"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Summary Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Estimated Scope Cost:
              </span>
              <span className="text-base font-extrabold font-mono text-slate-900">
                R {totalCalculatedCost.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Turnaround (Days) *:
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={turnaroundDays}
                onChange={(e) => setTurnaroundDays(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 text-center focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Optional Formal Quote Ref & Commercial Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contractor Quote Reference / Ref #
            </label>
            <input
              type="text"
              value={quoteRef}
              onChange={(e) => setQuoteRef(e.target.value)}
              placeholder="e.g. QT-APEX-2026-004"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Warranty &amp; Commercial Terms (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 6-month warranty on components..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={totalCalculatedCost <= 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {submitMutation.isPending ? 'Submitting Quote...' : `Submit Commercial Quote (${formatCurrency(totalCalculatedCost)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
