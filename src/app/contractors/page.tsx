'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { contractorApi } from '@/services/contractors';
import { workCategoryApi } from '@/services/work-categories';
import { Contractor, ComplianceStatus, CreateContractorInput } from '@/types/contractor';
import { useAuth } from '@/hooks/useAuth';

const contractorFormSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  registration_number: z.string().min(3, 'Registration number is required').toUpperCase(),
  specialty: z.string().min(2, 'Specialty is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email address format'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  compliance_status: z.enum(['compliant', 'warning', 'non_compliant']),
  rating: z.coerce.number().min(0).max(5)
});

type ContractorFormData = z.infer<typeof contractorFormSchema>;

const COMPLIANCE_BADGES: Record<ComplianceStatus, { bg: string; text: string; border: string; label: string }> = {
  compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Compliant' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Expiring Soon / Warning' },
  non_compliant: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Non-Compliant' }
};

const APPROVAL_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Approved' },
  pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending LM Review' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Rejected' }
};

export const CONTRACTOR_SPECIALTIES = [
  { value: 'Biomedical Equipment', label: 'Biomedical Equipment (Diagnostic & Life Support)' },
  { value: 'HVAC', label: 'HVAC & Cleanroom Air Flow' },
  { value: 'Electrical', label: 'Electrical & Generators (High Voltage / Circuits)' },
  { value: 'Plumbing', label: 'Plumbing & Dialysis Water Filtration' },
  { value: 'Structural', label: 'Structural, Architectural & Paint' },
  { value: 'Sanitation', label: 'Sterilization & Sanitation' }
];

export default function ContractorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Line Manager Review State
  const [reviewingContractor, setReviewingContractor] = useState<Contractor | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contractors', { search, compliance_status: complianceFilter, approval_status: approvalFilter }],
    queryFn: () =>
      contractorApi.getContractors({
        search: search || undefined,
        compliance_status: complianceFilter === 'all' ? undefined : complianceFilter,
        approval_status: approvalFilter === 'all' ? undefined : approvalFilter
      })
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['work-categories'],
    queryFn: () => workCategoryApi.getCategories()
  });

  const contractors = data?.data || [];
  const categories = categoriesData?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ContractorFormData>({
    resolver: zodResolver(contractorFormSchema),
    defaultValues: {
      name: '',
      registration_number: '',
      specialty: '',
      email: '',
      compliance_status: 'compliant',
      rating: 5.0
    }
  });

  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<ContractorFormData>({
    name: '',
    registration_number: '',
    specialty: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    compliance_status: 'compliant',
    rating: 5.0
  });

  const createMutation = useMutation({
    mutationFn: (formData: ContractorFormData) =>
      contractorApi.createContractor(formData as CreateContractorInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to register contractor');
    }
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, rejection_reason }: { id: string; decision: 'approve' | 'reject'; rejection_reason?: string }) =>
      contractorApi.reviewContractor(id, { decision, rejection_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      closeReviewModal();
    },
    onError: (err: any) => {
      setReviewError(err.response?.data?.message || 'Failed to submit contractor review');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateContractorInput> }) =>
      contractorApi.updateContractor(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      queryClient.invalidateQueries({ queryKey: ['contractor', editingContractor?.id] });
      closeEditModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to update contractor details');
    }
  });

  const openModal = () => {
    reset({
      name: '',
      registration_number: '',
      specialty: '',
      contact_person: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      address: '',
      compliance_status: 'compliant',
      rating: 5.0
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const openEditModal = (c: Contractor) => {
    setEditingContractor(c);
    setEditFormData({
      name: c.name,
      registration_number: c.registration_number,
      specialty: c.specialty,
      contact_person: c.contact_person || '',
      email: c.email,
      phone: c.phone || '',
      city: c.city || '',
      state: c.state || '',
      address: c.address || '',
      compliance_status: c.compliance_status || 'compliant',
      rating: c.rating || 5.0
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingContractor(null);
    setFormError(null);
  };

  const onSubmit = (formData: ContractorFormData) => {
    createMutation.mutate(formData);
  };

  const onEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContractor) return;
    if (!editFormData.name.trim()) {
      setFormError('Company name is required');
      return;
    }
    if (!editFormData.email.trim()) {
      setFormError('Email is required');
      return;
    }
    updateMutation.mutate({
      id: editingContractor.id,
      payload: {
        ...editFormData,
        name: editFormData.name.trim(),
        registration_number: editFormData.registration_number.toUpperCase().trim(),
        specialty: editFormData.specialty.trim(),
        email: editFormData.email.trim(),
        rating: Number(editFormData.rating)
      }
    });
  };

  const openReviewModal = (c: Contractor) => {
    setReviewingContractor(c);
    setReviewDecision('approve');
    setRejectionReason('');
    setReviewError(null);
  };

  const closeReviewModal = () => {
    setReviewingContractor(null);
    setReviewDecision('approve');
    setRejectionReason('');
    setReviewError(null);
  };

  const onReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingContractor) return;
    if (reviewDecision === 'reject' && !rejectionReason.trim()) {
      setReviewError('Please provide a mandatory reason for rejecting this contractor.');
      return;
    }
    reviewMutation.mutate({
      id: reviewingContractor.id,
      decision: reviewDecision,
      rejection_reason: reviewDecision === 'reject' ? rejectionReason.trim() : undefined
    });
  };

  const canManage = user?.role === 'ADMIN';
  const canRegister = user?.role === 'ADMIN';
  const canReview = user?.role === 'ADMIN';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Contractor Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Registered engineering partners, approval governance, and assigned tasks.
            </p>
          </div>
          {canRegister && (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors shrink-0"
            >
              + Register Contractor
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="w-full lg:w-80">
            <input
              type="text"
              placeholder="Search contractor, specialty, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Approval Status Tabs */}
            <div className="flex space-x-1 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-gray-500 self-center mr-1">Status:</span>
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Approved' },
                { key: 'pending_approval', label: 'Pending Review' },
                { key: 'rejected', label: 'Rejected' }
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setApprovalFilter(st.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    approvalFilter === st.key
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Registration #</th>
                  <th className="px-4 py-3">Contractor Name</th>
                  <th className="px-4 py-3">Specialty</th>
                  <th className="px-4 py-3">Governance Status</th>
                  <th className="px-4 py-3 text-center">Active Jobs</th>
                  <th className="px-4 py-3 text-center">Docs</th>
                  <th className="px-4 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Loading contractor directory...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-red-600">
                      Error loading contractors. Please check backend connection.
                    </td>
                  </tr>
                ) : contractors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No contractors found matching criteria.
                    </td>
                  </tr>
                ) : (
                  contractors.map((c) => {
                    const aBadge = APPROVAL_BADGES[c.approval_status || 'active'] || APPROVAL_BADGES.active;

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-sky-700 whitespace-nowrap">
                          <Link href={`/contractors/${c.id}`} className="hover:underline">
                            {c.registration_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/contractors/${c.id}`}
                            className="font-medium text-gray-900 hover:text-sky-700 block text-xs md:text-sm"
                          >
                            {c.name}
                          </Link>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            ★ {c.rating ? c.rating.toFixed(1) : '5.0'} / 5.0
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                          {c.specialty}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${aBadge.bg} ${aBadge.text} ${aBadge.border}`}
                          >
                            {aBadge.label}
                          </span>
                          {c.approval_status === 'rejected' && c.rejection_reason && (
                            <p className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate" title={c.rejection_reason}>
                              Reason: {c.rejection_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 whitespace-nowrap">
                          {c.active_jobs_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-sky-700 whitespace-nowrap">
                          {c.document_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {canReview && c.approval_status === 'pending_approval' && (
                              <button
                                onClick={() => openReviewModal(c)}
                                title="Line Manager Onboarding Review"
                                className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition-colors shadow-2xs"
                              >
                                Review
                              </button>
                            )}
                            {canManage && (
                              <button
                                onClick={() => openEditModal(c)}
                                title="Edit Contractor Name & Details"
                                className="inline-flex items-center justify-center p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 rounded-md border border-amber-200 transition-colors shadow-2xs"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            <Link
                              href={`/contractors/${c.id}`}
                              title="View Contractor Profile & Compliance Vault"
                              className="inline-flex items-center justify-center p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 rounded-md border border-sky-200 transition-colors shadow-2xs"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Register Contractor Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Register Specialized Contractor
                </h3>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      {...register('name')}
                      placeholder="e.g. Apex BioMed Solutions"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Registration # *
                    </label>
                    <input
                      {...register('registration_number')}
                      placeholder="e.g. REG-BIO-2026"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    {errors.registration_number && (
                      <p className="text-xs text-red-600 mt-1">{errors.registration_number.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Work Category &amp; Engineering Specialty *
                  </label>
                  <select
                    {...register('specialty')}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">Select Category / Specialty...</option>
                    {categories.length > 0
                      ? categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.description ? `(${c.description})` : ''}
                          </option>
                        ))
                      : CONTRACTOR_SPECIALTIES.map((sp) => (
                          <option key={sp.value} value={sp.value}>
                            {sp.label}
                          </option>
                        ))}
                  </select>
                  {errors.specialty && (
                    <p className="text-xs text-red-600 mt-1">{errors.specialty.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      {...register('contact_person')}
                      placeholder="e.g. David Henderson"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Business Email *
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="service@contractor.com"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      {...register('phone')}
                      placeholder="+1 (555) 010-0004"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      City & State
                    </label>
                    <input
                      {...register('city')}
                      placeholder="e.g. Boston, MA"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
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
                    {isSubmitting || createMutation.isPending ? 'Registering...' : 'Register Contractor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Contractor Modal */}
        {isEditModalOpen && editingContractor && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Edit Contractor Profile
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {editingContractor.id} &bull; Reg: {editingContractor.registration_number}
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
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

              <form onSubmit={onEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      required
                      placeholder="e.g. Apex BioMed Solutions"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Registration # *
                    </label>
                    <input
                      value={editFormData.registration_number}
                      onChange={(e) => setEditFormData({ ...editFormData, registration_number: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. REG-BIO-2026"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Work Category &amp; Engineering Specialty *
                    </label>
                    <select
                      value={editFormData.specialty}
                      onChange={(e) => setEditFormData({ ...editFormData, specialty: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="">Select Category / Specialty...</option>
                      {categories.length > 0
                        ? categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} {c.description ? `(${c.description})` : ''}
                            </option>
                          ))
                        : CONTRACTOR_SPECIALTIES.map((sp) => (
                            <option key={sp.value} value={sp.value}>
                              {sp.label}
                            </option>
                          ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Compliance Status *
                    </label>
                    <select
                      value={editFormData.compliance_status}
                      onChange={(e) => setEditFormData({ ...editFormData, compliance_status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="compliant">Compliant</option>
                      <option value="warning">Expiring Soon / Warning</option>
                      <option value="non_compliant">Non-Compliant</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      value={editFormData.contact_person || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                      placeholder="e.g. David Henderson"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Business Email *
                    </label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      required
                      placeholder="service@contractor.com"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      value={editFormData.phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="+1 (555) 010-0004"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      City & State
                    </label>
                    <input
                      value={editFormData.city || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      placeholder="e.g. Boston, MA"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Performance Rating (0-5)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editFormData.rating}
                      onChange={(e) => setEditFormData({ ...editFormData, rating: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="e.g. 100 Technology Square, Suite 400"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Line Manager Review Modal */}
        {reviewingContractor && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Line Manager Contractor Onboarding Review
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    ID: {reviewingContractor.id} &bull; Reg: {reviewingContractor.registration_number}
                  </p>
                </div>
                <button
                  onClick={closeReviewModal}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {reviewError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {reviewError}
                </div>
              )}

              {/* Contractor Snapshot Card */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{reviewingContractor.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    Pending LM Review
                  </span>
                </div>
                <div className="text-slate-600">
                  Specialty: <span className="font-semibold text-slate-800">{reviewingContractor.specialty}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Contact: {reviewingContractor.contact_person || 'N/A'} &bull; {reviewingContractor.email} &bull; {reviewingContractor.phone || 'No phone'}
                </div>
                {reviewingContractor.address && (
                  <div className="text-slate-500 text-[11px]">
                    Address: {reviewingContractor.address}, {reviewingContractor.city || ''} {reviewingContractor.state || ''}
                  </div>
                )}
              </div>

              <form onSubmit={onReviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Review Decision *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewDecision('approve')}
                      className={`py-2 px-3 text-xs font-bold rounded-md border text-center transition-colors ${
                        reviewDecision === 'approve'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-200'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Approve Contractor
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('reject')}
                      className={`py-2 px-3 text-xs font-bold rounded-md border text-center transition-colors ${
                        reviewDecision === 'reject'
                          ? 'bg-rose-50 text-rose-700 border-rose-400 ring-2 ring-rose-200'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Reject Application
                    </button>
                  </div>
                </div>

                {reviewDecision === 'reject' && (
                  <div>
                    <label className="block text-xs font-semibold text-rose-700 mb-1">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this contractor application is being rejected (e.g. invalid medical accreditations, missing insurance)..."
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-md text-xs text-gray-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                )}

                {reviewDecision === 'approve' && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded border border-emerald-200">
                    Approving this contractor will activate their profile and make them eligible for Work Order assignment across all hospital facilities.
                  </p>
                )}

                <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewMutation.isPending}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-md transition-colors disabled:opacity-50 ${
                      reviewDecision === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {reviewMutation.isPending
                      ? 'Submitting...'
                      : reviewDecision === 'approve'
                      ? 'Confirm Approval'
                      : 'Confirm Rejection'}
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
