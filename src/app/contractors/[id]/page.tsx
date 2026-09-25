'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { contractorApi } from '@/services/contractors';
import { API_SERVER_URL } from '@/services/api';
import { ComplianceStatus } from '@/types/contractor';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const COMPLIANCE_BADGES: Record<ComplianceStatus, { bg: string; text: string; border: string; label: string }> = {
  compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '100% Fully Compliant' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Document Expiration Warning' },
  non_compliant: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Non-Compliant (Expired Documents)' }
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

  const { data: contractor, isLoading, isError } = useQuery({
    queryKey: ['contractor', id],
    queryFn: () => contractorApi.getContractorById(id),
    enabled: !!id
  });

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
  const canUpload = user?.role === 'ADMIN' || user?.role === 'APPROVER' || (user?.role === 'CONTRACTOR' && user?.id === contractor.id);

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

        {/* Top Profile Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sky-700 text-sm">
                {contractor.registration_number}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${cBadge.bg} ${cBadge.text} ${cBadge.border}`}
              >
                {cBadge.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">
              {contractor.name}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Specialty: <span className="font-semibold text-gray-700">{contractor.specialty}</span> &bull; Rating: ★ {contractor.rating ? contractor.rating.toFixed(1) : '5.0'} / 5.0
            </p>
          </div>

          {canUpload && (
            <button
              onClick={() => setIsDocModalOpen(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded shadow-sm transition-colors shrink-0"
            >
              + Upload Compliance Certificate
            </button>
          )}
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
      </div>
    </AppLayout>
  );
}
