'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkOrder } from '@/types/workOrder';
import { workOrderApi } from '@/services/work-orders';

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  isWorksEngineer?: boolean;
  isWorksInspector?: boolean;
  urgency: string;
  uBadge: { bg: string; text: string; border: string };
  onSuccess?: () => void;
}

export default function AssessmentModal({
  isOpen,
  onClose,
  workOrder,
  isWorksEngineer = false,
  isWorksInspector = false,
  urgency,
  uBadge,
  onSuccess
}: AssessmentModalProps) {
  const queryClient = useQueryClient();

  const [assessmentType, setAssessmentType] = useState<'offsite' | 'onsite'>(
    workOrder.assessment_type || 'offsite'
  );
  const [assessmentItems, setAssessmentItems] = useState<Array<{ id: string; description: string; cost: number | '' }>>([
    { id: 'item-1', description: 'Diagnostic & Maintenance Service', cost: '' }
  ]);
  const [assessmentWorkTypes, setAssessmentWorkTypes] = useState<string[]>(['Maintenance', 'Repair']);
  const [onsiteAssessmentPhotos, setOnsiteAssessmentPhotos] = useState<File[]>([]);
  const [estimatedDays, setEstimatedDays] = useState<number | ''>(workOrder.estimated_days || 3);
  const [assessmentNotes, setAssessmentNotes] = useState(workOrder.assessment_notes || '');
  const [showAssessmentTimesheet, setShowAssessmentTimesheet] = useState(false);
  const [assessmentTimesheetWeekStart, setAssessmentTimesheetWeekStart] = useState<string>('');
  const [assessmentTimesheetDays, setAssessmentTimesheetDays] = useState([
    { day: 'Monday', date: '', hours: '' },
    { day: 'Tuesday', date: '', hours: '' },
    { day: 'Wednesday', date: '', hours: '' },
    { day: 'Thursday', date: '', hours: '' },
    { day: 'Friday', date: '', hours: '' },
    { day: 'Saturday', date: '', hours: '' },
    { day: 'Sunday', date: '', hours: '' }
  ]);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  // Auto-initialize timesheet with current week's Monday and dates
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mondayObj = new Date(today);
      mondayObj.setDate(diffToMonday);
      const mondayIso = mondayObj.toISOString().split('T')[0];

      setAssessmentTimesheetWeekStart(mondayIso);

      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const initialDays = dayNames.map((dayName, idx) => {
        const d = new Date(mondayObj);
        d.setDate(mondayObj.getDate() + idx);
        return {
          day: dayName,
          date: d.toISOString().split('T')[0],
          hours: ''
        };
      });

      if (workOrder?.inspector_timesheet_data || workOrder?.engineer_timesheet_data) {
        try {
          const rawTs = isWorksEngineer ? workOrder.engineer_timesheet_data : workOrder.inspector_timesheet_data;
          if (rawTs) {
            const parsed = JSON.parse(rawTs);
            if (Array.isArray(parsed) && parsed.length === 7) {
              setAssessmentTimesheetDays(parsed);
            } else {
              setAssessmentTimesheetDays(initialDays);
            }
          } else {
            setAssessmentTimesheetDays(initialDays);
          }
        } catch (_) {
          setAssessmentTimesheetDays(initialDays);
        }
      } else {
        setAssessmentTimesheetDays(initialDays);
      }
    }
  }, [isOpen, workOrder, isWorksEngineer]);

  const totalCalculatedCost = assessmentItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  const totalTsHours = assessmentTimesheetDays.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

  const assessmentMutation = useMutation({
    mutationFn: async () => {
      setAssessmentError(null);

      // 1. Upload Onsite Photos if provided
      if (assessmentType === 'onsite' && onsiteAssessmentPhotos.length > 0) {
        const photoFormData = new FormData();
        for (const file of onsiteAssessmentPhotos) {
          photoFormData.append('photos', file);
        }
        photoFormData.append('caption', 'Onsite Technical Assessment Photo Evidence');
        photoFormData.append('stage', 'inspection');
        await workOrderApi.uploadPhotos(workOrder.id, photoFormData);
      }

      // 2. Submit Assessment Payload
      return workOrderApi.submitAssessment(workOrder.id, {
        assessment_type: assessmentType,
        assessor_role: isWorksEngineer ? 'works_engineer' : 'works_inspector',
        assessor_estimate: totalCalculatedCost,
        assessment_hours: totalTsHours > 0 ? totalTsHours : undefined,
        estimated_days: estimatedDays !== '' ? Number(estimatedDays) : undefined,
        charge_code: assessmentType === 'onsite' ? 'ONS' : 'PRE',
        assessment_notes: assessmentNotes || undefined,
        itemized_breakdown: {
          items: assessmentItems,
          categories: assessmentWorkTypes
        },
        timesheet_data: totalTsHours > 0 ? assessmentTimesheetDays : undefined,
        timesheet_hours: totalTsHours > 0 ? totalTsHours : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setAssessmentError(err.response?.data?.message || err.message || 'Failed to record site assessment');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 uppercase tracking-wider">
                Technical Assessment
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{workOrder.tracking_number}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}>
                {urgency}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1.5 tracking-tight">
              Conduct Site Assessment &amp; Technical Scoping
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Record itemized work scope breakdown, onsite photo evidence, and assessment timesheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-bold transition cursor-pointer active:scale-95"
          >
            ✕
          </button>
        </div>

        {assessmentError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {assessmentError}
          </div>
        )}

        {/* 1. Assessment Mode Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
            1. Assessment Mode &bull; Evaluation Type *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setAssessmentType('offsite')}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 select-none ${
                assessmentType === 'offsite'
                  ? 'border-sky-500 bg-sky-50/70 text-slate-900 ring-2 ring-sky-500 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  checked={assessmentType === 'offsite'}
                  onChange={() => setAssessmentType('offsite')}
                  className="h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs">
                  Offsite (Evidence Photos)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Remote diagnostic review based on uploaded site photographs and telemetry.
                </p>
              </div>
            </div>

            <div
              onClick={() => setAssessmentType('onsite')}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 select-none ${
                assessmentType === 'onsite'
                  ? 'border-sky-500 bg-sky-50/70 text-slate-900 ring-2 ring-sky-500 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  checked={assessmentType === 'onsite'}
                  onChange={() => setAssessmentType('onsite')}
                  className="h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs">
                  Onsite (Physical Site Visit)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Direct physical inspection, biomedical instrument testing, and site evaluation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Onsite Photo Evidence Upload (Shown when Onsite selected) */}
        {assessmentType === 'onsite' && (
          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-sky-900 uppercase tracking-wide">
                  Onsite Physical Visit &bull; Picture Evidence *
                </label>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Upload inspection photos taken during physical site assessment.
                </p>
              </div>
              <span className="text-xs font-bold text-sky-700 font-mono">
                {onsiteAssessmentPhotos.length} photos selected
              </span>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  setOnsiteAssessmentPhotos(Array.from(e.target.files));
                }
              }}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700 cursor-pointer bg-white p-2 rounded-xl border border-sky-200"
            />

            {onsiteAssessmentPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {onsiteAssessmentPhotos.map((file, idx) => (
                  <div key={idx} className="relative group p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-600 font-mono block max-w-[120px] truncate px-1">
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Scope Classification Types */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
            2. Required Work Scope Classification *
          </label>
          <div className="flex flex-wrap gap-2">
            {['Maintenance', 'Repair', 'Change / Replace', 'Calibration', 'Alteration'].map((cat) => {
              const isSelected = assessmentWorkTypes.includes(cat);
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    if (isSelected) {
                      setAssessmentWorkTypes(assessmentWorkTypes.filter((c) => c !== cat));
                    } else {
                      setAssessmentWorkTypes([...assessmentWorkTypes, cat]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Itemized Work Breakdown & Cost Calculation */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
                3. Itemized Work Scope &amp; Cost Breakdown *
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Specify each required maintenance / repair task and estimated line cost.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssessmentItems([
                  ...assessmentItems,
                  { id: `item-${Date.now()}`, description: '', cost: '' }
                ]);
              }}
              className="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 rounded-lg transition"
            >
              + Add Scope Item
            </button>
          </div>

          <div className="space-y-2.5">
            {assessmentItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-400 font-mono w-6 text-center shrink-0">
                  #{index + 1}
                </span>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => {
                    const updated = [...assessmentItems];
                    updated[index].description = e.target.value;
                    setAssessmentItems(updated);
                  }}
                  placeholder="e.g. Diagnostic testing, valve replacement, PCB soldering..."
                  className="flex-1 px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="relative w-36 shrink-0">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 text-xs font-mono font-bold">
                    R
                  </span>
                  <input
                    type="number"
                    value={item.cost}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      const updated = [...assessmentItems];
                      updated[index].cost = val;
                      setAssessmentItems(updated);
                    }}
                    placeholder="Cost"
                    className="w-full pl-7 pr-2.5 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                {assessmentItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = assessmentItems.filter((_, i) => i !== index);
                      setAssessmentItems(updated);
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="Remove item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Total Cost & Turnaround Days Summary */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Total Estimated Scope Cost:</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                R {totalCalculatedCost.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-900">
                Turnaround (Days) *:
              </label>
              <input
                type="number"
                min="1"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 3"
                className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-900 focus:bg-white focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* 4. Assessment Timesheet Section */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setShowAssessmentTimesheet(!showAssessmentTimesheet)}
            className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                4. Assessment Timesheet (Monday &ndash; Sunday)
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-100 text-sky-800 font-mono">
                {totalTsHours} Hours Logged
              </span>
            </div>
            <span className="text-xs font-bold text-sky-600 flex items-center gap-1">
              {showAssessmentTimesheet ? 'Hide Timesheet ▲' : 'Show Timesheet ▼'}
            </span>
          </button>

          {showAssessmentTimesheet && (
            <div className="p-5 bg-white space-y-4 border-t border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-700">Week Start Date (Monday):</label>
                  <input
                    type="date"
                    value={assessmentTimesheetWeekStart}
                    onChange={(e) => {
                      const dateVal = e.target.value;
                      setAssessmentTimesheetWeekStart(dateVal);
                      if (dateVal) {
                        const [y, m, d] = dateVal.split('-').map(Number);
                        const baseDate = new Date(y, m - 1, d);
                        const updated = assessmentTimesheetDays.map((dayObj, i) => {
                          const dayDate = new Date(baseDate);
                          dayDate.setDate(baseDate.getDate() + i);
                          const year = dayDate.getFullYear();
                          const month = String(dayDate.getMonth() + 1).padStart(2, '0');
                          const dayNum = String(dayDate.getDate()).padStart(2, '0');
                          return { ...dayObj, date: `${year}-${month}-${dayNum}` };
                        });
                        setAssessmentTimesheetDays(updated);
                      }
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500 shadow-2xs cursor-pointer"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = assessmentTimesheetDays.map((d, i) => ({
                        ...d,
                        hours: i < 5 ? '8' : ''
                      }));
                      setAssessmentTimesheetDays(updated);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                  >
                    + Set 8 hrs (Mon-Fri)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = assessmentTimesheetDays.map((d) => ({
                        ...d,
                        hours: ''
                      }));
                      setAssessmentTimesheetDays(updated);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 transition cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
                {assessmentTimesheetDays.map((dayRow, idx) => {
                  const formattedDisplayDate = dayRow.date
                    ? (() => {
                        try {
                          const [y, m, d] = dayRow.date.split('-').map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        } catch {
                          return dayRow.date;
                        }
                      })()
                    : '—';

                  return (
                    <div key={dayRow.day} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1.5 shadow-2xs">
                      <div className="font-bold text-xs text-slate-900">{dayRow.day.slice(0, 3)}</div>
                      <div className="text-[11px] font-semibold text-sky-700 font-mono bg-white py-0.5 px-1 rounded border border-slate-200/60 truncate">
                        {formattedDisplayDate}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={dayRow.hours}
                        onChange={(e) => {
                          const updated = [...assessmentTimesheetDays];
                          updated[idx].hours = e.target.value;
                          setAssessmentTimesheetDays(updated);
                        }}
                        placeholder="0 hrs"
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Assessment Scope Notes & Observations */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
            5. Technical Scope &amp; Observations (Optional)
          </label>
          <textarea
            rows={3}
            value={assessmentNotes}
            onChange={(e) => setAssessmentNotes(e.target.value)}
            placeholder="Detail equipment condition, failure root causes, site constraints, and technical recommendations..."
            className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              assessmentItems.some((item) => !item.description.trim()) ||
              totalCalculatedCost <= 0 ||
              !estimatedDays ||
              Number(estimatedDays) <= 0 ||
              assessmentMutation.isPending
            }
            onClick={() => assessmentMutation.mutate()}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
              assessmentItems.some((item) => !item.description.trim()) ||
              totalCalculatedCost <= 0 ||
              assessmentMutation.isPending
                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-black active:bg-slate-800 text-white hover:shadow active:scale-95 cursor-pointer'
            }`}
          >
            {assessmentMutation.isPending ? 'Recording Assessment...' : 'Record Site Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}
