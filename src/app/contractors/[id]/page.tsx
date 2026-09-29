'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { contractorApi } from '@/services/contractors';
import { workCategoryApi } from '@/services/work-categories';
import { API_SERVER_URL } from '@/services/api';
import { ComplianceStatus } from '@/types/contractor';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const COMPLIANCE_BADGES: Record<ComplianceStatus, { bg: string; text: string; border: string; label: string }> = {
  compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '100% Fully Compliant' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Document Expiration Warning' },
  non_compliant: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Non-Compliant (Expired Documents)' }
};

const APPROVAL_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Approved & Active' },
  pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending LM Approval' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Onboarding Rejected' }
};

export default function ContractorProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('Certification');
  const [expiryDate, setExpiryDate] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Line Manager Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Edit Contractor State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    registration_number: '',
    specialty: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    compliance_status: 'compliant' as any,
    rating: 5.0
  });
  const [editError, setEditError] = useState<string | null>(null);

  const { data: contractor, isLoading, isError } = useQuery({
    queryKey: ['contractor', id],
    queryFn: () => contractorApi.getContractorById(id),
    enabled: !!id
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['work-categories'],
    queryFn: () => workCategoryApi.getCategories()
  });

  const categories = categoriesData?.data || [];

  const updateContractorMutation = useMutation({
    mutationFn: async () => {
      if (!editFormData.name.trim()) throw new Error('Company name is required');
      if (!editFormData.email.trim()) throw new Error('Email is required');
      return contractorApi.updateContractor(id, {
        ...editFormData,
        name: editFormData.name.trim(),
        registration_number: editFormData.registration_number.toUpperCase().trim(),
        specialty: editFormData.specialty.trim(),
        email: editFormData.email.trim(),
        rating: Number(editFormData.rating)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      setIsEditModalOpen(false);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.message || err.message || 'Failed to update contractor');
    }
  });

  const openEditModal = () => {
    if (!contractor) return;
    setEditFormData({
      name: contractor.name,
      registration_number: contractor.registration_number,
      specialty: contractor.specialty,
      contact_person: contractor.contact_person || '',
      email: contractor.email,
      phone: contractor.phone || '',
      city: contractor.city || '',
      state: contractor.state || '',
      address: contractor.address || '',
      compliance_status: contractor.compliance_status || 'compliant',
      rating: contractor.rating || 5.0
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!docFile) throw new Error('Please select a document file');
      const formData = new FormData();
      formData.append('title', docTitle);
      formData.append('document_type', docType);
      formData.append('expiry_date', expiryDate);
      formData.append('file', docFile);
      return contractorApi.uploadDocument(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      setIsDocModalOpen(false);
      setDocTitle('');
      setExpiryDate('');
      setDocFile(null);
      setDocError(null);
    },
    onError: (err: any) => {
      setDocError(err.response?.data?.message || 'Failed to upload document');
    }
  });

  const reviewContractorMutation = useMutation({
    mutationFn: async () => {
      if (reviewDecision === 'reject' && !rejectionReason.trim()) {
        throw new Error('Please provide a mandatory reason for rejecting this contractor.');
      }
      return contractorApi.reviewContractor(id, {
        decision: reviewDecision,
        rejection_reason: reviewDecision === 'reject' ? rejectionReason.trim() : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      setIsReviewModalOpen(false);
      setReviewError(null);
    },
    onError: (err: any) => {
      setReviewError(err.response?.data?.message || err.message || 'Failed to submit contractor review');
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading contractor profile & compliance records...
        </div>
      </AppLayout>
    );
  }

  if (isError || !contractor) {
    return (
      <AppLayout>
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center space-y-4">
          <p className="text-red-600 font-medium">Contractor profile not found.</p>
          <Link
            href="/contractors"
            className="inline-block px-4 py-2 bg-sky-600 text-white rounded text-sm font-medium"
          >
            &larr; Back to Contractor Directory
          </Link>
        </div>
      </AppLayout>
    );
  }

  const cBadge = COMPLIANCE_BADGES[contractor.compliance_status] || COMPLIANCE_BADGES.compliant;
  const aBadge = APPROVAL_BADGES[contractor.approval_status || 'active'] || APPROVAL_BADGES.active;
  const canUpload = user?.role === 'ADMIN' || (user?.role === 'CONTRACTOR' && user?.id === contractor.id);
  const canEdit = user?.role === 'ADMIN';
  const canReview = user?.role === 'ADMIN';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Link href="/contractors" className="hover:text-gray-900 hover:underline">
            Contractors
          </Link>
          <span>&rsaquo;</span>
          <span className="font-mono text-gray-700">{contractor.registration_number}</span>
        </div>

        {/* Governance Onboarding Banner */}
        {contractor.approval_status === 'pending_approval' && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-900">Contractor Status: Inactive / Pending Admin Activation</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                This contractor is currently inactive and cannot be assigned to hospital work orders until activated by an Administrator.
              </p>
            </div>
            {canReview && (
              <button
                onClick={() => {
                  setReviewDecision('approve');
                  setRejectionReason('');
                  setReviewError(null);
                  setIsReviewModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition shrink-0"
              >
                Activate Contractor
              </button>
            )}
          </div>
        )}

        {contractor.approval_status === 'rejected' && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-rose-900">
            <h3 className="text-sm font-bold">Contractor Onboarding Rejected</h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Reason: {contractor.rejection_reason || 'Application did not satisfy vendor compliance criteria.'}
            </p>
          </div>
        )}

        {/* Top Profile Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sky-700 text-sm">
                {contractor.registration_number}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${aBadge.bg} ${aBadge.text} ${aBadge.border}`}
              >
                {aBadge.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">
              {contractor.name}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Specialty: <span className="font-semibold text-gray-700">{contractor.specialty}</span> &bull; Rating: ★ {contractor.rating ? contractor.rating.toFixed(1) : '5.0'} / 5.0
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canReview && contractor.approval_status === 'pending_approval' && (
              <button
                onClick={() => {
                  setReviewDecision('approve');
                  setRejectionReason('');
                  setReviewError(null);
                  setIsReviewModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                Review Application
              </button>
            )}
            {canEdit && (
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
            )}
            {canUpload && (
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                + Upload Compliance Certificate
              </button>
            )}
          </div>
        </div>

        {/* Grid: Details & Compliance Vault */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Vault (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compliance Documents */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Compliance Documents & Licenses ({contractor.documents?.length || 0})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Verified insurance policies, medical device service accreditations, and state licenses.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Document Title</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Expiry Date</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {!contractor.documents || contractor.documents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-xs text-gray-400">
                          No compliance documents uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      contractor.documents.map((doc) => {
                        const isExpired = doc.status === 'expired' || new Date(doc.expiry_date) < new Date();
                        const isWarning = doc.status === 'expiring_soon';

                        return (
                          <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900 text-xs">
                              {doc.title}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600">
                              {doc.document_type}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-700">
                              {formatDate(doc.expiry_date)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  isExpired
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : isWarning
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {isExpired ? 'Expired' : isWarning ? 'Expiring Soon' : 'Valid'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <a
                                href={doc.file_url.startsWith('http') ? doc.file_url : `${API_SERVER_URL}${doc.file_url.startsWith('/') ? '' : '/'}${doc.file_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                              >
                                View File &rarr;
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assigned Work Orders */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Assigned Hospital Work Orders ({contractor.work_orders?.length || 0})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Tracking #</th>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Facility</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {!contractor.work_orders || contractor.work_orders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-400">
                          No active or past work orders assigned to this contractor yet.
                        </td>
                      </tr>
                    ) : (
                      contractor.work_orders.map((wo) => (
                        <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-sky-700 text-xs">
                            <Link href={`/work-orders/${wo.id}`} className="hover:underline">
                              {wo.tracking_number}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-gray-900">
                            {wo.title}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {wo.facility_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                              {wo.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Metadata (1 Col) */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Contractor Contact & Location
              </h2>
              <div>
                <div className="text-xs text-gray-500">Contact Officer</div>
                <div className="text-sm font-semibold text-gray-900">
                  {contractor.contact_person || 'Engineering Dispatch'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Email Address</div>
                <div className="text-xs text-sky-700 font-mono">
                  {contractor.email}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Phone Support</div>
                <div className="text-xs text-gray-800 font-medium">
                  {contractor.phone || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Registered Address</div>
                <div className="text-xs text-gray-700">
                  {contractor.address ? `${contractor.address}, ${contractor.city || ''}, ${contractor.state || ''}` : 'Boston, MA'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Document Modal */}
        {isDocModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  Upload Compliance Certificate / License
                </h3>
                <button
                  onClick={() => setIsDocModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {docError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {docError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. ISO 13485 Medical Device Service Accreditation"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Document Type *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="Certification">Certification</option>
                    <option value="Insurance">Insurance Policy</option>
                    <option value="License">State Board License</option>
                    <option value="Safety Protocol">Safety & Environmental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Expiration Date *
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Certificate File (PDF / PNG / JPG) *
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!docTitle || !expiryDate || !docFile || uploadDocMutation.isPending}
                  onClick={() => uploadDocMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {uploadDocMutation.isPending ? 'Uploading...' : 'Save & Verify Document'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Contractor Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Edit Contractor Profile
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {contractor.id} &bull; Reg: {contractor.registration_number}
                  </p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {editError && (
                <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {editError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateContractorMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Company / Contractor Name *
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
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.description ? `(${c.description})` : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Biomedical Equipment">Biomedical Equipment (Diagnostic &amp; Life Support)</option>
                          <option value="HVAC">HVAC &amp; Cleanroom Air Flow</option>
                          <option value="Electrical">Electrical &amp; Generators (High Voltage / Circuits)</option>
                          <option value="Plumbing">Plumbing &amp; Dialysis Water Filtration</option>
                          <option value="Structural">Structural, Architectural &amp; Paint</option>
                          <option value="Sanitation">Sterilization &amp; Sanitation</option>
                        </>
                      )}
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
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateContractorMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                  >
                    {updateContractorMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Line Manager Review Modal */}
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Line Manager Contractor Onboarding Review
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    ID: {contractor.id} &bull; Reg: {contractor.registration_number}
                  </p>
                </div>
                <button
                  onClick={() => setIsReviewModalOpen(false)}
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
                  <span className="font-bold text-slate-900 text-sm">{contractor.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    Pending LM Review
                  </span>
                </div>
                <div className="text-slate-600">
                  Specialty: <span className="font-semibold text-slate-800">{contractor.specialty}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Contact: {contractor.contact_person || 'N/A'} &bull; {contractor.email} &bull; {contractor.phone || 'No phone'}
                </div>
                {contractor.address && (
                  <div className="text-slate-500 text-[11px]">
                    Address: {contractor.address}, {contractor.city || ''} {contractor.state || ''}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  reviewContractorMutation.mutate();
                }}
                className="space-y-4"
              >
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
                    onClick={() => setIsReviewModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewContractorMutation.isPending}
                    className={`px-4 py-2 text-xs font-bold text-white rounded-md transition-colors disabled:opacity-50 ${
                      reviewDecision === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {reviewContractorMutation.isPending
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
