'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { workOrderApi } from '@/services/work-orders';
import { facilityApi } from '@/services/facilities';
import { workCategoryApi } from '@/services/work-categories';
import { useAuth } from '@/hooks/useAuth';
import { WorkOrderPriority, WorkOrderStatus, UrgencyCategory, FundingRoute } from '@/types/workOrder';
import { formatDate, formatCurrency } from '@/lib/utils';

const createWOSchema = z.object({
  title: z.string().min(3, 'Title is required (min 3 chars)'),
  description: z.string().min(5, 'Detailed description is required'),
  facility_id: z.string().min(1, 'Please select a facility'),
  location_details: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  urgency_category: z.enum([
    'Critical 0–24h',
    'Very urgent 2–4 days',
    'Urgent 4–8 days',
    '8+ days or statutory'
  ]),
  estimated_cost: z.coerce.number().min(0).optional(),
  due_date: z.string().optional()
});

type CreateWOFormData = z.infer<typeof createWOSchema>;

const URGENCY_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Critical 0–24h': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Critical 0–24h' },
  'Very urgent 2–4 days': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Very urgent 2–4 days' },
  'Urgent 4–8 days': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Urgent 4–8 days' },
  '8+ days or statutory': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: '8+ days or statutory' }
};

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

function WorkOrdersContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const initialStatus = searchParams.get('status') || 'all';
  const initialPriority = searchParams.get('priority') || 'all';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>(initialPriority);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<FileList | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Facilities for Dropdown
  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilityApi.getFacilities()
  });

  const facilities = facilitiesData?.data || [];

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openModal();
    }
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
    const priorityParam = searchParams.get('priority');
    if (priorityParam) {
      setPriorityFilter(priorityParam);
    }
  }, [searchParams, facilitiesData]);

  // Fetch Work Orders
  const { data, isLoading, isError } = useQuery({
    queryKey: ['work-orders', { search, status: statusFilter, priority: priorityFilter }],
    queryFn: () =>
      workOrderApi.getWorkOrders({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter
      })
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['work-categories'],
    queryFn: () => workCategoryApi.getCategories()
  });

  const workOrders = data?.data || [];
  const categories = categoriesData?.data || [];
  const userFacility = facilities.find((f) => f.id === user?.facility_id) || facilities[0];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<CreateWOFormData>({
    resolver: zodResolver(createWOSchema),
    defaultValues: {
      category: 'Biomedical Equipment',
      priority: 'medium',
      urgency_category: 'Urgent 4–8 days',
      estimated_cost: 0
    }
  });

  const selectedUrgency = watch('urgency_category');

  // Sync priority when urgency changes
  const handleUrgencyChange = (urgency: 'Critical 0–24h' | 'Very urgent 2–4 days' | 'Urgent 4–8 days' | '8+ days or statutory') => {
    setValue('urgency_category', urgency);
    if (urgency === 'Critical 0–24h') {
      setValue('priority', 'critical');
    } else if (urgency === 'Very urgent 2–4 days') {
      setValue('priority', 'high');
    } else if (urgency === 'Urgent 4–8 days') {
      setValue('priority', 'medium');
    } else if (urgency === '8+ days or statutory') {
      setValue('priority', 'low');
    }
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (formData: CreateWOFormData) => {
      const dataPayload = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          dataPayload.append(key, String(val));
        }
      });

      if (selectedPhotos && selectedPhotos.length > 0) {
        for (let i = 0; i < selectedPhotos.length; i++) {
          dataPayload.append('photos', selectedPhotos[i]);
        }
      }

      return workOrderApi.createWorkOrder(dataPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to report work order');
    }
  });

  const [photoError, setPhotoError] = useState<string | null>(null);

  const openModal = () => {
    const defaultFacilityId = user?.facility_id || (facilities.length > 0 ? facilities[0].id : '');
    reset({
      title: '',
      description: '',
      facility_id: defaultFacilityId,
      location_details: '',
      category: 'Biomedical Equipment',
      priority: 'medium',
      urgency_category: 'Urgent 4–8 days',
      estimated_cost: 0,
      due_date: ''
    });
    setSelectedPhotos(null);
    setPhotoError(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPhotos(null);
    setPhotoError(null);
    setFormError(null);
  };

  const onSubmit = (formData: CreateWOFormData) => {
    if (!selectedPhotos || selectedPhotos.length === 0) {
      setPhotoError('At least 1 photo / evidence image is required to report this issue.');
      return;
    }
    setPhotoError(null);
    createMutation.mutate(formData);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Work Orders &amp; Maintenance Tickets
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              NC DOH &amp; Quantum Built HVAC Maintenance SLA: Fast-Track Route B Advance Funding &amp; Statutory Schedule.
            </p>
          </div>
          {(user?.role === 'STAFF' || user?.role === 'ADMIN') && (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors shrink-0"
            >
              + Report Work Order
            </button>
          )}
        </div>

        {/* Urgency SLA Overview Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center md:text-left">
          <div className="px-2 py-1.5 md:py-0">
            <div className="text-xs font-semibold text-gray-900">Critical 0–24h</div>
          </div>
          <div className="px-2 py-1.5 md:py-0 md:pl-4">
            <div className="text-xs font-semibold text-gray-900">Very urgent 2–4 days</div>
          </div>
          <div className="px-2 py-1.5 md:py-0 md:pl-4">
            <div className="text-xs font-semibold text-gray-900">Urgent 4–8 days</div>
          </div>
          <div className="px-2 py-1.5 md:py-0 md:pl-4">
            <div className="text-xs font-semibold text-gray-900">8+ days or statutory</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder="Search tracking #, title, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Priorities</option>
              <option value="Critical 0–24h">Critical 0–24h</option>
              <option value="Very urgent 2–4 days">Very urgent 2–4 days</option>
              <option value="Urgent 4–8 days">Urgent 4–8 days</option>
              <option value="8+ days or statutory">8+ days or statutory</option>
            </select>
          </div>

          <div className="flex space-x-1 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
            {[
              'all',
              'active',
              'reported',
              'approved',
              'assigned',
              'in_progress',
              'completed',
              'verified',
              'closed',
              'cancelled'
            ].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors shrink-0 ${
                  statusFilter === st
                    ? 'bg-sky-50 text-sky-700 border border-sky-300 font-semibold'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {st === 'active' ? 'Active Pipeline' : st.replace('_', ' ')}
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
                  <th className="px-4 py-3">Tracking #</th>
                  <th className="px-4 py-3">Work Order Title</th>
                  <th className="px-4 py-3">Facility &amp; Location</th>
                  <th className="px-4 py-3">Urgency &amp; Funding</th>
                  <th className="px-4 py-3">Category</th>
                  {user?.role !== 'STAFF' && <th className="px-4 py-3">Est. Cost</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={user?.role === 'STAFF' ? 7 : 8} className="px-4 py-12 text-center text-gray-500">
                      Loading work orders...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={user?.role === 'STAFF' ? 7 : 8} className="px-4 py-12 text-center text-red-600">
                      Error fetching work orders. Please check connection.
                    </td>
                  </tr>
                ) : workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'STAFF' ? 7 : 8} className="px-4 py-12 text-center text-gray-500">
                      No work orders found. Click &quot;+ Report Work Order&quot; to create a new ticket.
                    </td>
                  </tr>
                ) : (
                  workOrders.map((wo) => {
                    const urgency = wo.urgency_category || (
                      wo.priority === 'critical' ? 'Critical 0–24h' :
                      wo.priority === 'high' ? 'Very urgent 2–4 days' :
                      wo.priority === 'medium' ? 'Urgent 4–8 days' : '8+ days or statutory'
                    );
                    const uBadge = URGENCY_BADGES[urgency] || URGENCY_BADGES['Urgent 4–8 days'];
                    const sBadge = STATUS_BADGES[wo.status] || STATUS_BADGES.reported;
                    const isRouteB = wo.funding_route === 'route_b' || urgency === 'Critical 0–24h';
                    const isStatutory = urgency === '8+ days or statutory';

                    return (
                      <tr key={wo.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-sky-700 whitespace-nowrap">
                          <Link href={`/work-orders/${wo.id}`} className="hover:underline">
                            {wo.tracking_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/work-orders/${wo.id}`}
                            className="font-medium text-gray-900 hover:text-sky-700 block text-xs md:text-sm"
                          >
                            {wo.title}
                          </Link>
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                            {wo.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="font-medium text-gray-900 text-xs">{wo.facility_name || 'N/A'}</div>
                          <div className="text-xs text-gray-400 truncate max-w-xs">{wo.location_details || 'Main Building'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}
                            >
                              {urgency}
                            </span>
                            {isRouteB && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Route B (QB Advance)
                              </span>
                            )}
                            {isStatutory && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                Statutory Notice (30d/15d)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-medium whitespace-nowrap">
                          {wo.category}
                        </td>
                        {user?.role !== 'STAFF' && (
                          <td className="px-4 py-3 font-mono text-gray-900 text-xs whitespace-nowrap">
                            {formatCurrency(wo.estimated_cost)}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border ${sBadge.bg} ${sBadge.text} ${sBadge.border}`}
                          >
                            {wo.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Link
                            href={`/work-orders/${wo.id}`}
                            title="View Work Order Details & SHA-256 Audit Vault"
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

        {/* Create Work Order Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Report New Maintenance Issue
                  </h3>
                  <p className="text-xs text-gray-500">NC DOH &amp; Quantum Built Maintenance Intake</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* 1. Priority Level & Urgency Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Priority Level &amp; Urgency SLA *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        value: 'Critical 0–24h' as const,
                        label: 'Critical 0–24h'
                      },
                      {
                        value: 'Very urgent 2–4 days' as const,
                        label: 'Very urgent 2–4 days'
                      },
                      {
                        value: 'Urgent 4–8 days' as const,
                        label: 'Urgent 4–8 days'
                      },
                      {
                        value: '8+ days or statutory' as const,
                        label: '8+ days or statutory'
                      }
                    ].map((item) => {
                      const isSelected = selectedUrgency === item.value;
                      return (
                        <div
                          key={item.value}
                          onClick={() => handleUrgencyChange(item.value)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-sky-600 bg-sky-50/50 ring-1 ring-sky-600'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <span className={`text-xs font-semibold ${isSelected ? 'text-sky-900 font-bold' : 'text-gray-900'}`}>
                            {item.label}
                          </span>
                          <input
                            type="radio"
                            value={item.value}
                            checked={isSelected}
                            onChange={() => handleUrgencyChange(item.value)}
                            className="text-sky-600 focus:ring-sky-500 h-3.5 w-3.5 cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Issue Title *
                  </label>
                  <input
                    {...register('title')}
                    placeholder="e.g. ICU Ventilator #4 Alarm Calibration Failure"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Hospital Facility *
                    </label>
                    {user?.role === 'STAFF' ? (
                      <div>
                        <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-900 flex items-center justify-between select-none">
                          <span className="truncate">{userFacility?.name || 'Metro General Hospital'} ({userFacility?.code || 'FAC-MGH-01'})</span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-200 px-1.5 py-0.5 rounded ml-2 shrink-0">Assigned</span>
                        </div>
                        <input type="hidden" {...register('facility_id')} value={userFacility?.id || facilities[0]?.id || ''} />
                      </div>
                    ) : (
                      <select
                        {...register('facility_id')}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      >
                        {facilities.length === 0 ? (
                          <option value="">No Facilities Available</option>
                        ) : (
                          facilities.map((fac) => (
                            <option key={fac.id} value={fac.id}>
                              {fac.name} ({fac.code})
                            </option>
                          ))
                        )}
                      </select>
                    )}
                    {errors.facility_id && (
                      <p className="text-xs text-red-600 mt-1">{errors.facility_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      {...register('category')}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Biomedical Equipment">Biomedical Equipment</option>
                          <option value="HVAC">HVAC &amp; Air Flow</option>
                          <option value="Electrical">Electrical &amp; Generators</option>
                          <option value="Plumbing">Plumbing &amp; Filtration</option>
                          <option value="Structural">Structural &amp; Architectural</option>
                          <option value="Sanitation">Sterilization &amp; Sanitation</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Specific Location / Room
                  </label>
                  <input
                    {...register('location_details')}
                    placeholder="e.g. 3rd Floor, Trauma Room 302"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Detailed Description *
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Describe symptoms, device serials, or error codes observed..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  {errors.description && (
                    <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
                  )}
                </div>

                {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Estimated Cost (R)
                      </label>
                      <input
                        {...register('estimated_cost')}
                        type="number"
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Target Due Date
                      </label>
                      <input
                        {...register('due_date')}
                        type="date"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Attach Initial Evidence Photo <span className="text-rose-600 font-semibold">* (Required, at least 1 image, max 5)</span>
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      setSelectedPhotos(e.target.files);
                      if (e.target.files && e.target.files.length > 0) {
                        setPhotoError(null);
                      }
                    }}
                    className={`w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border ${
                      photoError ? 'border-rose-300' : 'border-gray-300'
                    } file:text-xs file:font-medium file:bg-gray-50 hover:file:bg-gray-100`}
                  />
                  {photoError && (
                    <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {photoError}
                    </p>
                  )}
                  {selectedPhotos && selectedPhotos.length > 0 && !photoError && (
                    <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {selectedPhotos.length} {selectedPhotos.length === 1 ? 'evidence photo' : 'evidence photos'} selected
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting || createMutation.isPending ? 'Submitting...' : 'Submit Work Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function WorkOrdersPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-8 text-center text-sm text-slate-400">Loading Work Orders...</div>
        </AppLayout>
      }
    >
      <WorkOrdersContent />
    </Suspense>
  );
}
