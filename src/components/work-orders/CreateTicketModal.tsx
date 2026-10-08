'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { workOrderApi } from '@/services/work-orders';
import { facilityApi } from '@/services/facilities';
import { workCategoryApi } from '@/services/work-categories';

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

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPhotos, setSelectedPhotos] = useState<FileList | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Facilities for Dropdown
  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilityApi.getFacilities(),
    enabled: isOpen
  });

  const facilities = facilitiesData?.data || [];

  const { data: categoriesData } = useQuery({
    queryKey: ['work-categories'],
    queryFn: () => workCategoryApi.getCategories(),
    enabled: isOpen
  });

  const categories = categoriesData?.data || [];
  const userFacility = facilities.find((f: any) => f.id === user?.facility_id) || facilities[0];

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
      handleClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to report work order');
    }
  });

  const handleClose = () => {
    reset();
    setSelectedPhotos(null);
    setPhotoError(null);
    setFormError(null);
    onClose();
  };

  const onSubmit = (data: CreateWOFormData) => {
    if (!selectedPhotos || selectedPhotos.length === 0) {
      setPhotoError('Please attach at least 1 initial evidence photo');
      return;
    }
    setPhotoError(null);
    setFormError(null);
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Request a New Maintenance Ticket</h3>
            <p className="text-xs text-gray-500 mt-0.5">Report hospital equipment or facility infrastructure breakdown</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Priority Level & Urgency Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Priority Level &amp; Urgency SLA *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { value: 'Critical 0–24h' as const, label: 'Critical 0–24h' },
                { value: 'Very urgent 2–4 days' as const, label: 'Very urgent 2–4 days' },
                { value: 'Urgent 4–8 days' as const, label: 'Urgent 4–8 days' },
                { value: '8+ days or statutory' as const, label: '8+ days or statutory' }
              ].map((item) => {
                const isSelected = selectedUrgency === item.value;
                return (
                  <div
                    key={item.value}
                    onClick={() => handleUrgencyChange(item.value)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/60 ring-1 ring-sky-600 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className={`text-xs ${isSelected ? 'text-sky-900 font-bold' : 'text-gray-900'}`}>
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Issue Title *
            </label>
            <input
              {...register('title')}
              placeholder="e.g. ICU Ventilator #4 Alarm Calibration Failure"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hospital Facility *
              </label>
              {user?.role === 'STAFF' ? (
                <div>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 flex items-center justify-between select-none">
                    <span className="truncate">{userFacility?.name || 'Metro General Hospital'}</span>
                    <span className="text-[10px] text-slate-500 font-mono bg-slate-200 px-1.5 py-0.5 rounded ml-2 shrink-0">Assigned</span>
                  </div>
                  <input type="hidden" {...register('facility_id')} value={userFacility?.id || facilities[0]?.id || ''} />
                </div>
              ) : (
                <select
                  {...register('facility_id')}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {facilities.length === 0 ? (
                    <option value="">No Facilities Available</option>
                  ) : (
                    facilities.map((fac: any) => (
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category *
              </label>
              <select
                {...register('category')}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                {categories.length > 0 ? (
                  categories.map((c: any) => (
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Specific Location / Room
            </label>
            <input
              {...register('location_details')}
              placeholder="e.g. 3rd Floor, Trauma Room 302"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Detailed Description *
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Describe symptoms, device serials, or error codes observed..."
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Estimated Cost (R)
                </label>
                <input
                  {...register('estimated_cost')}
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Due Date
                </label>
                <input
                  {...register('due_date')}
                  type="date"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Attach Initial Evidence Photo <span className="text-rose-600 font-semibold">* (Required, at least 1 image)</span>
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
              className={`w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border ${
                photoError ? 'border-rose-300' : 'border-gray-300'
              } file:text-xs file:font-semibold file:bg-gray-50 hover:file:bg-gray-100 cursor-pointer`}
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

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting || createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
