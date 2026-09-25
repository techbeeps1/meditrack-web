'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { inspectionApi } from '@/services/inspections';
import { workOrderApi } from '@/services/work-orders';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export default function InspectionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [inspectionResult, setInspectionResult] = useState<'PASS' | 'FAIL'>('PASS');
  const [observations, setObservations] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<FileList | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Checklist states
  const [checklist, setChecklist] = useState({
    calibration: true,
    electricalSafety: true,
    sterilization: true,
    functionalTesting: true
  });

  // Fetch Inspections
  const { data, isLoading, isError } = useQuery({
    queryKey: ['inspections', { search, result: resultFilter }],
    queryFn: () =>
      inspectionApi.getInspections({
        search: search || undefined,
        result: resultFilter === 'all' ? undefined : resultFilter
      })
  });

  // Fetch Completed or In Verification Work Orders for inspection
  const { data: woData } = useQuery({
    queryKey: ['work-orders-for-inspection'],
    queryFn: () => workOrderApi.getWorkOrders({ limit: 100 })
  });

  const inspections = data?.data || [];
  const candidateWorkOrders = (woData?.data || []).filter(
    (wo) => wo.status === 'completed' || wo.status === 'verified' || wo.status === 'in_progress'
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkOrderId) throw new Error('Please select a work order to inspect');
      if (!observations) throw new Error('Please enter inspection observations');

      const formData = new FormData();
      formData.append('work_order_id', selectedWorkOrderId);
      formData.append('result', inspectionResult);
      formData.append('observations', observations);
      formData.append('recommendations', recommendations);
      formData.append('checklist_results', JSON.stringify(checklist));

      if (selectedPhotos && selectedPhotos.length > 0) {
        for (let i = 0; i < selectedPhotos.length; i++) {
          formData.append('photos', selectedPhotos[i]);
        }
      }

      return inspectionApi.createInspection(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to submit inspection');
    }
  });

  const openModal = () => {
    setSelectedWorkOrderId(candidateWorkOrders[0]?.id || '');
    setInspectionResult('PASS');
    setObservations('');
    setRecommendations('');
    setSelectedPhotos(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPhotos(null);
    setFormError(null);
  };

  const canInspect = user?.role === 'INSPECTOR' || user?.role === 'ADMIN';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Quality & Safety Inspections
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Verify completed maintenance work orders, execute safety checklists, and sign off audit proofs.
            </p>
          </div>
          {canInspect && (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors shrink-0"
            >
              + Conduct Quality Inspection
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Search work order tracking # or observations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex space-x-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['all', 'PASS', 'FAIL'].map((st) => (
              <button
                key={st}
                onClick={() => setResultFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md uppercase transition-colors ${
                  resultFilter === st
                    ? 'bg-sky-50 text-sky-700 border border-sky-300 font-semibold'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {st === 'all' ? 'All Results' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Inspection Date</th>
                  <th className="px-4 py-3">Work Order Tracking</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Lead Inspector</th>
                  <th className="px-4 py-3">Observations & Remarks</th>
                  <th className="px-4 py-3 text-center">Photos</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3 text-center w-16">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Loading inspection logs...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-red-600">
                      Error loading inspections. Please check connection.
                    </td>
                  </tr>
                ) : inspections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No quality inspections recorded yet.
                    </td>
                  </tr>
                ) : (
                  inspections.map((insp) => {
                    const isPass = insp.result === 'PASS';

                    return (
                      <tr key={insp.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {formatDate(insp.inspected_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/work-orders/${insp.work_order_id}`}
                            className="font-mono font-medium text-sky-700 hover:underline block"
                          >
                            {insp.work_order_tracking || 'WO-REF'}
                          </Link>
                          <div className="text-xs text-gray-400 truncate max-w-xs">
                            {insp.work_order_title}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {insp.facility_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-900 font-medium">
                          {insp.inspector_name || 'Marcus Chen (Safety Inspector)'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">
                          {insp.observations}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-sky-700 whitespace-nowrap">
                          {insp.photo_count || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isPass
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {insp.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Link
                            href={`/work-orders/${insp.work_order_id}`}
                            title="View Work Order & Cryptographic Audit Vault"
                            className="inline-flex items-center justify-center p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 rounded-md border border-sky-200 transition-colors shadow-2xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conduct Quality Inspection Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  Execute Quality & Safety Inspection
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Work Order *
                </label>
                <select
                  value={selectedWorkOrderId}
                  onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="">Select Completed Work Order...</option>
                  {candidateWorkOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.tracking_number} &bull; {wo.title} ({wo.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Inspection Verdict *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionResult('PASS')}
                    className={`py-2 px-3 text-xs font-bold rounded-md border text-center transition-colors ${
                      inspectionResult === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ✓ PASS (Verify Ticket)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionResult('FAIL')}
                    className={`py-2 px-3 text-xs font-bold rounded-md border text-center transition-colors ${
                      inspectionResult === 'FAIL'
                        ? 'bg-red-50 text-red-700 border-red-400 ring-2 ring-red-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ✕ FAIL (Re-work Required)
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2 text-xs">
                <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider mb-1">
                  Safety & Calibration Checklist:
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={checklist.calibration}
                    onChange={(e) => setChecklist({ ...checklist, calibration: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-gray-700">OEM Tolerance & Calibration Verified</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={checklist.electricalSafety}
                    onChange={(e) => setChecklist({ ...checklist, electricalSafety: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-gray-700">Dielectric & Ground Leakage Current Safe</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={checklist.sterilization}
                    onChange={(e) => setChecklist({ ...checklist, sterilization: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-gray-700">Sanitation & Area Cleanliness Compliant</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Inspector Observations & Notes *
                </label>
                <textarea
                  rows={3}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Record testing values, calibrated readings, or failure reasons..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Attach Inspection Photo Evidence (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setSelectedPhotos(e.target.files)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedWorkOrderId || !observations || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit Inspection Sign-Off'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
