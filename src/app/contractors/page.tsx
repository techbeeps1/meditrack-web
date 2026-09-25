'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { contractorApi } from '@/services/contractors';
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

export default function ContractorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contractors', { search, compliance_status: complianceFilter }],
    queryFn: () =>
      contractorApi.getContractors({
        search: search || undefined,
        compliance_status: complianceFilter === 'all' ? undefined : complianceFilter
      })
  });

  const contractors = data?.data || [];

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

  const onSubmit = (formData: ContractorFormData) => {
    createMutation.mutate(formData);
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'APPROVER';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Contractor Registry & Compliance Vault
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Qualified medical engineering partners, certifications, and compliance monitoring.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors shrink-0"
            >
              + Register Contractor
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Search contractor, specialty, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex space-x-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['all', 'compliant', 'warning', 'non_compliant'].map((st) => (
              <button
                key={st}
                onClick={() => setComplianceFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  complianceFilter === st
                    ? 'bg-sky-50 text-sky-700 border border-sky-300 font-semibold'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {st.replace('_', ' ')}
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
                  <th className="px-4 py-3">Registration #</th>
                  <th className="px-4 py-3">Contractor Name</th>
                  <th className="px-4 py-3">Specialty</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-center">Active Jobs</th>
                  <th className="px-4 py-3 text-center">Docs</th>
                  <th className="px-4 py-3">Compliance</th>
                  <th className="px-4 py-3 text-center w-16">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Loading contractor directory...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-red-600">
                      Error loading contractors. Please check backend connection.
                    </td>
                  </tr>
                ) : contractors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No contractors found matching criteria.
                    </td>
                  </tr>
                ) : (
                  contractors.map((c) => {
                    const cBadge = COMPLIANCE_BADGES[c.compliance_status] || COMPLIANCE_BADGES.compliant;

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
                        <td className="px-4 py-3 text-gray-600">
                          <div className="text-xs font-medium text-gray-900">{c.contact_person || 'N/A'}</div>
                          <div className="text-xs text-gray-400 truncate max-w-xs">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 whitespace-nowrap">
                          {c.active_jobs_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-sky-700 whitespace-nowrap">
                          {c.document_count || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cBadge.bg} ${cBadge.text} ${cBadge.border}`}
                          >
                            {cBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
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
                    Engineering Specialty *
                  </label>
                  <input
                    {...register('specialty')}
                    placeholder="e.g. Biomedical & Diagnostic Imaging Systems"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
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
      </div>
    </AppLayout>
  );
}
