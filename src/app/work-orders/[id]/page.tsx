'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { workOrderApi } from '@/services/work-orders';
import { contractorApi } from '@/services/contractors';
import { invoiceService } from '@/services/invoices';
import { inspectionApi } from '@/services/inspections';
import { userApi } from '@/services/users';
import { API_SERVER_URL } from '@/services/api';
import { WorkOrderPriority, WorkOrderStatus } from '@/types/workOrder';
import { formatDate, formatCurrency } from '@/lib/utils';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { downloadCompletionCertificatePdf } from '@/lib/completionCertificatePdf';
import { downloadQuotePdf } from '@/lib/quotePdf';
import { downloadTimesheetPdf } from '@/lib/timesheetPdf';
import { downloadEstimatePdf } from '@/lib/estimatePdf';
import { downloadWorkOrderPdf } from '@/lib/workOrderPdf';
import { useAuth } from '@/hooks/useAuth';
import { InviteContractorsModal } from '@/components/work-orders/InviteContractorsModal';
import SubmitQuotationModal from '@/components/work-orders/SubmitQuotationModal';

const WORKFLOW_STEPS: { status: WorkOrderStatus; label: string }[] = [
  { status: 'reported', label: 'Requested' },
  { status: 'approved', label: 'Approved' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'verified', label: 'Verified' },
  { status: 'closed', label: 'Closed' }
];

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

const QUOTE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  under_review: {
    label: 'Quote: Under Review (Quantum Built)',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  awaiting_client: {
    label: 'Quote: Awaiting Client Approval (NC DOH)',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200'
  },
  client_approved: {
    label: 'Quote: Approved by NC DOH',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200'
  },
  client_declined: {
    label: 'Quote: Declined by NC DOH (Renegotiation)',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200'
  }
};

export function matchesSpecialty(category: string | undefined | null, specialty: string | undefined | null): boolean {
  if (!category || !specialty) return false;
  const c = category.toLowerCase().trim();
  const s = specialty.toLowerCase().trim();

  // Direct containment
  if (s.includes(c) || c.includes(s)) return true;

  // Domain keyword dictionary mapping
  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    electrical: ['electrical', 'voltage', 'power', 'circuit', 'switch', 'generator', 'wiring', 'lighting'],
    biomedical: ['biomedical', 'biomed', 'diagnostic', 'imaging', 'mri', 'ventilator', 'dialysis', 'sensor', 'device', 'clinical', 'medical'],
    hvac: ['hvac', 'air', 'laminar', 'cleanroom', 'ventilation', 'chiller', 'cooling', 'heating', 'flow', 'filter'],
    plumbing: ['plumbing', 'water', 'filtration', 'gas', 'gases', 'pipe', 'drain', 'hydraulic', 'leakage', 'sewage'],
    structural: ['structural', 'paint', 'painting', 'building', 'masonry', 'roof', 'carpentry', 'door', 'wall', 'architectural'],
    sanitation: ['sanitation', 'sterilization', 'cleaning', 'waste', 'hygiene', 'disinfection']
  };

  for (const [catKey, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const isCategoryMatch = c.includes(catKey) || keywords.some((kw) => c.includes(kw));
    if (isCategoryMatch) {
      if (keywords.some((kw) => s.includes(kw))) {
        return true;
      }
    }
  }

  const cWords = c.split(/[\s,&/-]+/).filter((w) => w.length > 2);
  const sWords = s.split(/[\s,&/-]+/).filter((w) => w.length > 2);
  return cWords.some((cw) => sWords.some((sw) => sw.includes(cw) || cw.includes(sw)));
}

const EVENT_CONFIG: Record<string, { title: string; color: string; badge: string; label?: string }> = {
  reported: { title: 'Ticket Requested & Created', color: 'border-sky-500 text-sky-600', badge: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Requested' },
  lead_assigned: { title: 'Lead Works Assessor Designated', color: 'border-blue-500 text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Assessor Designated' },
  engineer_requested: { title: 'Works Engineer Referral Requested', color: 'border-amber-500 text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Engineer Requested' },
  engineer_fulfilled: { title: 'Works Engineer Referral Fulfilled', color: 'border-blue-500 text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Engineer Joined' },
  engineer_declined: { title: 'Works Engineer Referral Declined', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Engineer Declined' },
  assessment_submitted: { title: 'Technical Scoping & Estimate Submitted', color: 'border-indigo-500 text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Scoping Completed' },
  assessment_adjusted: { title: 'Estimate Adjustment Requested by QB', color: 'border-amber-500 text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Revision Requested' },
  assessment_rejected: { title: 'Estimate Scoping Rejected by QB', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Scoping Rejected' },
  approved: { title: 'Budget & Scope Approved by QB', color: 'border-blue-600 text-blue-700', badge: 'bg-blue-50 text-blue-800 border-blue-200', label: 'Approved' },
  assigned: { title: 'Contractor Assigned', color: 'border-indigo-600 text-indigo-700', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', label: 'Assigned' },
  quote_submitted: { title: 'Contractor Price Quotation Submitted', color: 'border-sky-600 text-sky-700', badge: 'bg-sky-50 text-sky-800 border-sky-200', label: 'Quote Submitted' },
  quote_client_gateway: { title: 'Quote Submitted to NC DOH Gateway', color: 'border-indigo-500 text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Client Gateway' },
  client_approved: { title: 'NC DOH Client Gateway Approved', color: 'border-blue-700 text-blue-800', badge: 'bg-blue-100 text-blue-900 border-blue-300', label: 'Client Approved' },
  client_declined: { title: 'NC DOH Client Gateway Declined', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Client Declined' },
  in_progress: { title: 'Work Started / In Progress', color: 'border-amber-500 text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'In Progress' },
  completed: { title: 'Repair Completed & Submitted for QC', color: 'border-purple-500 text-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Completed' },
  signoff_engineer: { title: '3-Way Sign-off: Works Engineer Pass', color: 'border-sky-600 text-sky-700', badge: 'bg-sky-50 text-sky-800 border-sky-200', label: 'Engineer Sign-off' },
  signoff_fm: { title: '3-Way Sign-off: Facilities Manager Pass', color: 'border-blue-600 text-blue-700', badge: 'bg-blue-50 text-blue-800 border-blue-200', label: 'FM Site Sign-off' },
  signoff_inspector: { title: '3-Way Sign-off: Works Inspector Pass', color: 'border-indigo-600 text-indigo-700', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', label: 'Inspector QC Pass' },
  signoff_rejected: { title: '3-Way Sign-off Rejected (Rework Required)', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Sign-off Rejected' },
  verified: { title: 'QC & Statutory Compliance Passed', color: 'border-blue-700 text-blue-800', badge: 'bg-blue-100 text-blue-900 border-blue-300', label: 'Verified' },
  cert_issued: { title: 'Statutory Certificate of Completion Issued', color: 'border-sky-700 text-sky-800', badge: 'bg-sky-100 text-sky-900 border-sky-300', label: 'Cert Issued' },
  client_recovery_submitted: { title: 'NC DOH Client Recovery Invoice Created', color: 'border-slate-600 text-slate-700', badge: 'bg-slate-100 text-slate-800 border-slate-300', label: 'Client Recovery' },
  invoice_submitted: { title: 'Contractor Invoice Claim Submitted', color: 'border-indigo-600 text-indigo-700', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', label: 'Invoice Claim' },
  invoice_approved: { title: 'Contractor Invoice Claim Approved', color: 'border-blue-600 text-blue-700', badge: 'bg-blue-50 text-blue-800 border-blue-200', label: 'Invoice Approved' },
  closed: { title: 'Work Order Closed & Settled', color: 'border-slate-800 text-slate-900', badge: 'bg-slate-100 text-slate-900 border-slate-300', label: 'Closed & Settled' },
  cancelled: { title: 'Work Order Cancelled / Rejected', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelled' }
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Delete Work Order Mutation (Admin Only)
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      return workOrderApi.deleteWorkOrder(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      router.push('/work-orders');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete work order');
    }
  });

  const handleDeleteWorkOrder = () => {
    if (window.confirm(`Are you sure you want to permanently delete work order ${workOrder?.tracking_number}? All linked inspections, invoices, and photos will be removed.`)) {
      deleteOrderMutation.mutate();
    }
  };

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoStage, setPhotoStage] = useState<'initial' | 'in_progress' | 'completed' | 'inspection'>('in_progress');

  // Transition Modal state
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | null>(null);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [assignedTechnician, setAssignedTechnician] = useState('usr_contractor_01');
  const [actualCostInput, setActualCostInput] = useState<number | ''>('');
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Contractor Start Job Evidence States (Optional Initial Photos + Optional PDF/DOC)
  const [startJobPhotos, setStartJobPhotos] = useState<File[]>([]);
  const [startJobDoc, setStartJobDoc] = useState<File | null>(null);

  // Contractor Completion Evidence States (Required Image + Optional PDF/DOC)
  const [completionPhotos, setCompletionPhotos] = useState<File[]>([]);
  const [completionDoc, setCompletionDoc] = useState<File | null>(null);

  // Inspection Modal state (for Inspector / Admin quality verification)
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<'PASS' | 'FAIL'>('PASS');
  const [inspectionObservations, setInspectionObservations] = useState('');
  const [inspectionRecommendations, setInspectionRecommendations] = useState('');
  const [selectedInspectionPhotos, setSelectedInspectionPhotos] = useState<FileList | null>(null);
  const [inspectionFormError, setInspectionFormError] = useState<string | null>(null);
  const [inspectionChecklist, setInspectionChecklist] = useState({
    calibration: true,
    electricalSafety: true,
    sterilization: true,
    functionalTesting: true
  });


  const defaultAssessmentTimesheetWeek = [
    { day: 'Monday', date: '', hours: '' },
    { day: 'Tuesday', date: '', hours: '' },
    { day: 'Wednesday', date: '', hours: '' },
    { day: 'Thursday', date: '', hours: '' },
    { day: 'Friday', date: '', hours: '' },
    { day: 'Saturday', date: '', hours: '' },
    { day: 'Sunday', date: '', hours: '' }
  ];

  // Itemized Assessment & Onsite Photo & Assessment Timesheet States
  const [assessmentItems, setAssessmentItems] = useState<Array<{ id: string; description: string; cost: number | '' }>>([
    { id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: '' }
  ]);
  const [assessmentWorkTypes, setAssessmentWorkTypes] = useState<string[]>(['Maintenance', 'Repair']);
  const [onsiteAssessmentPhotos, setOnsiteAssessmentPhotos] = useState<File[]>([]);
  const [showAssessmentTimesheet, setShowAssessmentTimesheet] = useState(false);
  const [assessmentTimesheetWeekStart, setAssessmentTimesheetWeekStart] = useState<string>('');
  const [assessmentTimesheetDays, setAssessmentTimesheetDays] = useState(defaultAssessmentTimesheetWeek);

  // Multi-Contractor Quoting & Recommendation States
  const [isSubmitQuotationModalOpen, setIsSubmitQuotationModalOpen] = useState(false);
  const [isInviteContractorsModalOpen, setIsInviteContractorsModalOpen] = useState(false);
  const [contractorQuoteAmountInput, setContractorQuoteAmountInput] = useState<number | ''>('');
  const [contractorQuoteRefInput, setContractorQuoteRefInput] = useState('');
  const [contractorQuoteNotesInput, setContractorQuoteNotesInput] = useState('');
  const [contractorQuoteError, setContractorQuoteError] = useState<string | null>(null);

  const [selectedQuoteIdToRecommend, setSelectedQuoteIdToRecommend] = useState<string>('');
  const [engineerRecommendationNotesInput, setEngineerRecommendationNotesInput] = useState('');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const [isReevaluateModalOpen, setIsReevaluateModalOpen] = useState(false);
  const [reevaluateNotesInput, setReevaluateNotesInput] = useState('');
  const [reevaluateError, setReevaluateError] = useState<string | null>(null);

  // Engineering Assessment Modal state
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [assessmentType, setAssessmentType] = useState<'offsite' | 'onsite'>('offsite');
  const [referToEngineer, setReferToEngineer] = useState(false);
  const [assessmentEstimate, setAssessmentEstimate] = useState<number | ''>('');
  const [assessmentHours, setAssessmentHours] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('');
  const [chargeCode, setChargeCode] = useState<'PRE' | 'ONS' | 'TRV' | 'EVI' | 'FIN'>('PRE');
  const [routeBOverride, setRouteBOverride] = useState(false);
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  // Part 1: Assign Lead Assessor State
  const [isAssignLeadModalOpen, setIsAssignLeadModalOpen] = useState(false);
  const [leadAssessorRoleInput, setLeadAssessorRoleInput] = useState<'works_inspector' | 'works_engineer'>('works_inspector');
  const [leadAssessorIdInput, setLeadAssessorIdInput] = useState<string>('');
  const [assignLeadError, setAssignLeadError] = useState<string | null>(null);

  // Part 1: Request Works Engineer State (by Works Inspector)
  const [isRequestEngineerModalOpen, setIsRequestEngineerModalOpen] = useState(false);
  const [engineerRequestReasonInput, setEngineerRequestReasonInput] = useState('');
  const [engineerRequestError, setEngineerRequestError] = useState<string | null>(null);

  // Part 1: Fulfill / Decline Engineer Request State (by Quantum Built Approver/Admin)
  const [isFulfillEngineerModalOpen, setIsFulfillEngineerModalOpen] = useState(false);
  const [fulfillEngineerIdInput, setFulfillEngineerIdInput] = useState('');
  const [declineEngineerReasonInput, setDeclineEngineerReasonInput] = useState('');
  const [handleEngineerRequestError, setHandleEngineerRequestError] = useState<string | null>(null);

  // Part 1: QB 3-Way Estimate Review State (Approve, Request Adjustment, Reject)
  const [isAdjustEstimateModalOpen, setIsAdjustEstimateModalOpen] = useState(false);
  const [adjustmentNotesInput, setAdjustmentNotesInput] = useState('');
  const [reviewEstimateError, setReviewEstimateError] = useState<string | null>(null);

  // Critical Job Contractor Quote & Engineering Review States
  const [isCriticalQuoteModalOpen, setIsCriticalQuoteModalOpen] = useState(false);
  const [criticalQuoteCost, setCriticalQuoteCost] = useState<number | ''>('');
  const [criticalQuoteWorkTypes, setCriticalQuoteWorkTypes] = useState<string[]>(['Repair']);
  const [criticalQuoteNotes, setCriticalQuoteNotes] = useState('');
  const [criticalQuoteError, setCriticalQuoteError] = useState<string | null>(null);

  const [isAdjustCriticalQuoteModalOpen, setIsAdjustCriticalQuoteModalOpen] = useState(false);
  const [adjustedCriticalQuoteCost, setAdjustedCriticalQuoteCost] = useState<number | ''>('');
  const [adjustCriticalQuoteNotes, setAdjustCriticalQuoteNotes] = useState('');
  const [adjustCriticalQuoteError, setAdjustCriticalQuoteError] = useState<string | null>(null);

  // Dedicated Separate Timesheet States for Inspector and Engineer (Monday to Sunday Template)
  const defaultTimesheetWeek = [
    { day: 'Monday', date: '', hours: '' },
    { day: 'Tuesday', date: '', hours: '' },
    { day: 'Wednesday', date: '', hours: '' },
    { day: 'Thursday', date: '', hours: '' },
    { day: 'Friday', date: '', hours: '' },
    { day: 'Saturday', date: '', hours: '' },
    { day: 'Sunday', date: '', hours: '' }
  ];

  const handleWeekStartUpdate = (
    newWeekStart: string,
    setWeekStart: (val: string) => void,
    setDays: React.Dispatch<React.SetStateAction<typeof defaultTimesheetWeek>>
  ) => {
    setWeekStart(newWeekStart);
    if (!newWeekStart) return;
    const startDate = new Date(newWeekStart);
    setDays((prev) =>
      prev.map((item, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return {
          ...item,
          date: d.toISOString().split('T')[0]
        };
      })
    );
  };

  const [isInspectorSignoffModalOpen, setIsInspectorSignoffModalOpen] = useState(false);
  const [inspectorWeekStart, setInspectorWeekStart] = useState<string>('');
  const [inspectorDays, setInspectorDays] = useState(defaultTimesheetWeek);
  const [inspectorSignoffError, setInspectorSignoffError] = useState<string | null>(null);

  const [isEngineerSignoffModalOpen, setIsEngineerSignoffModalOpen] = useState(false);
  const [engineerWeekStart, setEngineerWeekStart] = useState<string>('');
  const [engineerDays, setEngineerDays] = useState(defaultTimesheetWeek);
  const [engineerSignoffError, setEngineerSignoffError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'audit'>('details');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Fetch Work Order
  const { data: workOrder, isLoading, isError } = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => workOrderApi.getWorkOrderById(id),
    enabled: !!id
  });

  // Fetch Cryptographic Audit Chain
  const { data: auditChain, refetch: refetchAuditChain } = useQuery({
    queryKey: ['audit-chain', id],
    queryFn: () => workOrderApi.getAuditChain(id),
    enabled: !!id
  });

  // Fetch Registered Contractors List for Assignment
  const { data: contractorsData } = useQuery({
    queryKey: ['contractors-list'],
    queryFn: () => contractorApi.getContractors({ limit: 100 })
  });

  const contractors = contractorsData?.data || [];

  // Fetch Users List for Lead Assessor & Works Engineer Assignment
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userApi.getUsers({ limit: 100 })
  });

  const allUsers = usersData?.data || [];
  const worksInspectors = allUsers.filter(
    (u) => u.role === 'INSPECTOR' && ['works_inspector', 'both'].includes(u.inspector_scope || '')
  );
  const worksEngineers = allUsers.filter(
    (u) => u.role === 'INSPECTOR' && ['works_engineer', 'both'].includes(u.inspector_scope || '')
  );

  // Upload Photo Mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFiles || photoFiles.length === 0) return;
      const formData = new FormData();
      for (let i = 0; i < photoFiles.length; i++) {
        formData.append('photos', photoFiles[i]);
      }
      formData.append('caption', photoCaption);
      formData.append('stage', photoStage);
      return workOrderApi.uploadPhotos(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      setIsPhotoModalOpen(false);
      setPhotoFiles(null);
      setPhotoCaption('');
    }
  });

  // Budget Edit State & Mutation (for Approver & Admin)
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState<number | ''>('');

  const updateBudgetMutation = useMutation({
    mutationFn: async (newBudget: number) => {
      return workOrderApi.updateWorkOrder(id, { estimated_cost: newBudget });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsEditingBudget(false);
    }
  });

  // Invoice Generation State & Mutation
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [invoiceTax, setInvoiceTax] = useState<number>(0);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      return invoiceService.createInvoice({
        work_order_id: id,
        contractor_id: workOrder?.contractor_id || workOrder?.assigned_to || 'usr_contractor_01',
        amount: invoiceAmount || workOrder?.actual_cost || workOrder?.estimated_cost || 0,
        tax_amount: invoiceTax || 0,
        due_date: invoiceDueDate,
        notes: invoiceNotes || `Invoice claim for completed work order ${workOrder?.tracking_number} - ${workOrder?.title}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsInvoiceModalOpen(false);
      setInvoiceError(null);
    },
    onError: (err: any) => {
      setInvoiceError(err.response?.data?.message || 'Failed to generate invoice');
    }
  });

  const [invoiceActionError, setInvoiceActionError] = useState<string | null>(null);
  const [invoiceRequestSuccess, setInvoiceRequestSuccess] = useState(false);

  // Request Invoice Mutation (Approver/Admin prompts contractor to submit claim)
  const requestInvoiceMutation = useMutation({
    mutationFn: async () => {
      return invoiceService.requestInvoice(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setInvoiceRequestSuccess(true);
      setTimeout(() => setInvoiceRequestSuccess(false), 5000);
    },
    onError: (err: any) => {
      setInvoiceActionError(err.response?.data?.message || 'Failed to send invoice request to contractor');
    }
  });

  // Invoice Status Mutation (Directly Approve & Pay or Reject from Work Order page)
  const invoiceStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: 'approved' | 'paid' | 'rejected'; notes?: string }) => {
      if (!workOrder?.invoice_id) return;
      return invoiceService.updateInvoiceStatus(workOrder.invoice_id, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      setInvoiceActionError(null);
    },
    onError: (err: any) => {
      setInvoiceActionError(err.response?.data?.message || 'Failed to update invoice settlement status');
    }
  });

  const openInvoiceModal = () => {
    const baseAmt = workOrder?.actual_cost || workOrder?.estimated_cost || 0;
    setInvoiceAmount(baseAmt);
    setInvoiceTax(0);
    setInvoiceDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setInvoiceNotes(`Invoice claim for completed maintenance on ${workOrder?.tracking_number} (${workOrder?.title})`);
    setInvoiceError(null);
    setIsInvoiceModalOpen(true);
  };

  // Contractor Quote Modal State
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quotePrice, setQuotePrice] = useState<number | ''>('');
  const [contractorQuoteRef, setContractorQuoteRef] = useState('');
  const [directIssueJustification, setDirectIssueJustification] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const submitQuoteMutation = useMutation({
    mutationFn: async () => {
      if (quotePrice === '' || Number(quotePrice) <= 0) {
        throw new Error('Please enter a valid estimated price quote greater than 0');
      }
      return workOrderApi.updateWorkOrder(id, {
        estimated_cost: Number(quotePrice),
        contractor_quote_ref: contractorQuoteRef.trim() || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsQuoteModalOpen(false);
      setQuotePrice('');
      setContractorQuoteRef('');
      setQuoteNotes('');
      setQuoteError(null);
    },
    onError: (err: any) => {
      setQuoteError(err.response?.data?.message || err.message || 'Failed to submit price quote');
    }
  });

  const openQuoteModal = () => {
    setQuotePrice(workOrder?.estimated_cost || '');
    setContractorQuoteRef(workOrder?.contractor_quote_ref || '');
    setQuoteNotes('');
    setQuoteError(null);
    setIsQuoteModalOpen(true);
  };

  // Route A Quote Approval Lifecycle Mutation (PDF Page 4)
  const [isDeclineQuoteModalOpen, setIsDeclineQuoteModalOpen] = useState(false);
  const [clientDeclineReasonInput, setClientDeclineReasonInput] = useState('');
  const [quoteStatusError, setQuoteStatusError] = useState<string | null>(null);

  const updateQuoteStatusMutation = useMutation({
    mutationFn: async ({
      quoteStatus,
      clientApprovedBy,
      clientDeclineReason
    }: {
      quoteStatus: 'under_review' | 'awaiting_client' | 'client_approved' | 'client_declined';
      clientApprovedBy?: string;
      clientDeclineReason?: string;
    }) => {
      return workOrderApi.updateWorkOrder(id, {
        quote_status: quoteStatus,
        client_approved_by: clientApprovedBy,
        client_approved_at: quoteStatus === 'client_approved' ? new Date().toISOString() : undefined,
        client_decline_reason: clientDeclineReason !== undefined ? clientDeclineReason : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsDeclineQuoteModalOpen(false);
      setClientDeclineReasonInput('');
      setQuoteStatusError(null);
    },
    onError: (err: any) => {
      setQuoteStatusError(err.response?.data?.message || err.message || 'Failed to update quotation status');
    }
  });

  // 3-Way Tri-Signoff & Client Recovery Mutations (PDF Page 5)
  const [isSignoffRejectModalOpen, setIsSignoffRejectModalOpen] = useState(false);
  const [signoffRejectionReasonInput, setSignoffRejectionReasonInput] = useState('');
  const [signoffError, setSignoffError] = useState<string | null>(null);

  const signoffMutation = useMutation({
    mutationFn: async ({
      roleType,
      actorName,
      action,
      reason,
      timesheetData
    }: {
      roleType?: 'engineer' | 'fm' | 'inspector';
      actorName?: string;
      action: 'sign' | 'reject';
      reason?: string;
      timesheetData?: { entries: any[]; total_hours: number };
    }) => {
      const now = new Date().toISOString();
      if (action === 'reject') {
        return workOrderApi.updateWorkOrder(id, {
          signoff_rejection_reason: reason || 'Rework requested by stakeholder',
          status: 'in_progress'
        });
      }
      const updates: any = {};
      if (roleType === 'engineer') {
        updates.signoff_engineer_by = actorName || user?.name || 'Works Engineer';
        updates.signoff_engineer_at = now;
        if (timesheetData) {
          updates.engineer_timesheet_data = JSON.stringify(timesheetData.entries);
          updates.engineer_timesheet_hours = timesheetData.total_hours;
          updates.engineer_timesheet_by = actorName || user?.name || 'Works Engineer';
          updates.engineer_timesheet_at = now;
        }
      } else if (roleType === 'fm') {
        updates.signoff_fm_by = actorName || user?.name || 'Facilities Manager';
        updates.signoff_fm_at = now;
      } else if (roleType === 'inspector') {
        updates.signoff_inspector_by = actorName || user?.name || 'Works Inspector';
        updates.signoff_inspector_at = now;
        if (timesheetData) {
          updates.inspector_timesheet_data = JSON.stringify(timesheetData.entries);
          updates.inspector_timesheet_hours = timesheetData.total_hours;
          updates.inspector_timesheet_by = actorName || user?.name || 'Works Inspector';
          updates.inspector_timesheet_at = now;
        }
      }
      return workOrderApi.updateWorkOrder(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsSignoffRejectModalOpen(false);
      setIsInspectorSignoffModalOpen(false);
      setIsEngineerSignoffModalOpen(false);
      setSignoffRejectionReasonInput('');
      setSignoffError(null);
      setInspectorSignoffError(null);
      setEngineerSignoffError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to record sign-off';
      setSignoffError(msg);
      setInspectorSignoffError(msg);
      setEngineerSignoffError(msg);
    }
  });

  const clientRecoveryMutation = useMutation({
    mutationFn: async () => {
      return workOrderApi.updateWorkOrder(id, {
        client_recovery_status: 'submitted'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    }
  });

  // Status Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async () => {
      if (!targetStatus) return;
      const isOver50k = (workOrder?.assessor_estimate && workOrder.assessor_estimate > 50000) || workOrder?.funding_route === 'route_a';
      if (targetStatus === 'assigned' && isOver50k && !directIssueJustification.trim() && !transitionNotes.trim()) {
        throw new Error('Direct Issue Justification note is required when directly assigning a specialist contractor on jobs over R50,000 without tender.');
      }

      if (targetStatus === 'completed') {
        if (!completionPhotos || completionPhotos.length === 0) {
          throw new Error('Mandatory Evidence Required: Please upload at least 1 image/photo proof of the completed repair work.');
        }
      }

      const res = await workOrderApi.transitionStatus(id, {
        status: targetStatus,
        notes: transitionNotes,
        assigned_to: targetStatus === 'assigned' ? assignedTechnician : undefined,
        contractor_quote_ref: targetStatus === 'assigned' ? (contractorQuoteRef.trim() || undefined) : undefined,
        direct_issue_justification: targetStatus === 'assigned' ? (directIssueJustification.trim() || undefined) : undefined,
        actual_cost:
          targetStatus === 'completed'
            ? (actualCostInput !== '' ? Number(actualCostInput) : (workOrder?.actual_cost ?? workOrder?.estimated_cost ?? 0))
            : actualCostInput !== ''
            ? Number(actualCostInput)
            : undefined
      });

      // Upload start job initial assessment photos if provided
      if (targetStatus === 'in_progress' && startJobPhotos && startJobPhotos.length > 0) {
        const photoFormData = new FormData();
        for (let i = 0; i < startJobPhotos.length; i++) {
          photoFormData.append('photos', startJobPhotos[i]);
        }
        photoFormData.append('caption', 'Contractor Initial Site / Assessment Photo Evidence');
        photoFormData.append('stage', 'in_progress');
        await workOrderApi.uploadPhotos(id, photoFormData);
      }

      // Upload start job initial document (PDF or DOC/DOCX) if provided
      if (targetStatus === 'in_progress' && startJobDoc) {
        const docFormData = new FormData();
        docFormData.append('photos', startJobDoc);
        docFormData.append('caption', `Initial Site Document / Job Card: ${startJobDoc.name}`);
        docFormData.append('stage', 'in_progress');
        await workOrderApi.uploadPhotos(id, docFormData);
      }

      // Upload completion evidence photos
      if (targetStatus === 'completed' && completionPhotos && completionPhotos.length > 0) {
        const photoFormData = new FormData();
        for (let i = 0; i < completionPhotos.length; i++) {
          photoFormData.append('photos', completionPhotos[i]);
        }
        photoFormData.append('caption', 'Contractor Work Completion Photo Evidence');
        photoFormData.append('stage', 'completed');
        await workOrderApi.uploadPhotos(id, photoFormData);
      }

      // Upload optional completion document (PDF or DOC/DOCX)
      if (targetStatus === 'completed' && completionDoc) {
        const docFormData = new FormData();
        docFormData.append('photos', completionDoc);
        docFormData.append('caption', `Supporting Completion Document: ${completionDoc.name}`);
        docFormData.append('stage', 'completed');
        await workOrderApi.uploadPhotos(id, docFormData);
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      setIsTransitionModalOpen(false);
      setTransitionNotes('');
      setTransitionError(null);
      setCompletionPhotos([]);
      setCompletionDoc(null);
    },
    onError: (err: any) => {
      setTransitionError(err.response?.data?.message || err.message || 'Failed to update work order status');
    }
  });

  const openTransitionModal = (status: WorkOrderStatus) => {
    setTargetStatus(status);
    setTransitionNotes('');
    setTransitionError(null);
    if (status === 'in_progress') {
      setStartJobPhotos([]);
      setStartJobDoc(null);
    } else if (status === 'approved') {
      setActualCostInput('');
    } else if (status === 'completed') {
      setActualCostInput(workOrder?.estimated_cost ?? workOrder?.actual_cost ?? 0);
      setCompletionPhotos([]);
      setCompletionDoc(null);
    } else if (status === 'assigned') {
      const activeContractors = contractors.filter((c) => c.approval_status === 'active' || !c.approval_status);
      const matched = activeContractors.filter((c) => matchesSpecialty(workOrder?.category, c.specialty));
      const target = matched[0] || activeContractors[0];
      if (target) {
        setAssignedTechnician(target.id);
      } else {
        setAssignedTechnician('usr_contractor_01');
      }
      setContractorQuoteRef(workOrder?.contractor_quote_ref || '');
      setDirectIssueJustification(workOrder?.direct_issue_justification || '');
      setActualCostInput(workOrder?.estimated_cost ?? '');
    } else {
      setActualCostInput('');
    }
    setIsTransitionModalOpen(true);
  };

  // Inspection Mutation (Safety checklist, photos & status transition to verified or in_progress)
  const createInspectionMutation = useMutation({
    mutationFn: async () => {
      if (!inspectionObservations) throw new Error('Please enter inspection observations / findings');

      const formData = new FormData();
      formData.append('work_order_id', id);
      formData.append('result', inspectionResult);
      formData.append('observations', inspectionObservations);
      if (inspectionRecommendations) {
        formData.append('recommendations', inspectionRecommendations);
      }
      formData.append('checklist_results', JSON.stringify(inspectionChecklist));

      if (selectedInspectionPhotos && selectedInspectionPhotos.length > 0) {
        for (let i = 0; i < selectedInspectionPhotos.length; i++) {
          formData.append('photos', selectedInspectionPhotos[i]);
        }
      }

      return inspectionApi.createInspection(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      setIsInspectionModalOpen(false);
      setInspectionObservations('');
      setInspectionRecommendations('');
      setSelectedInspectionPhotos(null);
      setInspectionFormError(null);
    },
    onError: (err: any) => {
      setInspectionFormError(err.response?.data?.message || err.message || 'Failed to submit inspection sign-off');
    }
  });

  const openInspectionModal = (verdict: 'PASS' | 'FAIL' = 'PASS') => {
    setInspectionResult(verdict);
    setInspectionObservations('');
    setInspectionRecommendations('');
    setSelectedInspectionPhotos(null);
    setInspectionFormError(null);
    setIsInspectionModalOpen(true);
  };

  // Engineering Assessment Mutation (Scope, Charge Code, Assessor Estimate, Session Hours, and Automated Routing)
    // Engineering Assessment Mutation
  const assessmentMutation = useMutation({
    mutationFn: async () => {
      const effectiveRole =
        role === 'INSPECTOR'
          ? (inspectorScope === 'works_engineer' ? 'works_engineer' : 'works_inspector')
          : workOrder?.lead_assessor_role || 'works_inspector';

      if (referToEngineer) {
        return workOrderApi.requestEngineer(id, {
          reason: assessmentNotes || 'Technical engineering scoping required by Site Inspector'
        });
      }

      if (assessmentEstimate === '') throw new Error('Please enter assessor estimate amount or add work item costs');

      // Upload Onsite Photos if provided
      if (assessmentType === 'onsite' && onsiteAssessmentPhotos.length > 0) {
        const photoFormData = new FormData();
        for (let i = 0; i < onsiteAssessmentPhotos.length; i++) {
          photoFormData.append('photos', onsiteAssessmentPhotos[i]);
        }
        photoFormData.append('caption', 'Onsite Technical Assessment Photo Evidence');
        photoFormData.append('stage', 'inspection');
        await workOrderApi.uploadPhotos(id, photoFormData);
      }

      const totalTsHours = assessmentTimesheetDays.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

      return workOrderApi.submitAssessment(id, {
        assessment_type: assessmentType,
        assessor_role: effectiveRole,
        assessor_estimate: Number(assessmentEstimate),
        assessment_hours: assessmentHours !== '' ? Number(assessmentHours) : totalTsHours > 0 ? totalTsHours : undefined,
        estimated_days: estimatedDays !== '' ? Number(estimatedDays) : undefined,
        charge_code: chargeCode,
        assessment_notes: assessmentNotes || undefined,
        route_b_override: routeBOverride,
        itemized_breakdown: {
          items: assessmentItems,
          categories: assessmentWorkTypes
        },
        timesheet_data: totalTsHours > 0 ? assessmentTimesheetDays : undefined,
        timesheet_hours: totalTsHours > 0 ? totalTsHours : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsAssessmentModalOpen(false);
      setAssessmentError(null);
      setOnsiteAssessmentPhotos([]);
    },
    onError: (err: any) => {
      setAssessmentError(err.response?.data?.message || err.message || 'Failed to submit engineering assessment');
    }
  });

  const openAssessmentModal = () => {
    setAssessmentType(workOrder?.assessment_type || 'offsite');
    setReferToEngineer(false);
    setAssessmentEstimate(
      workOrder?.assessor_estimate !== null && workOrder?.assessor_estimate !== undefined
        ? workOrder.assessor_estimate
        : ''
    );
    setAssessmentHours(
      workOrder?.assessment_hours !== null && workOrder?.assessment_hours !== undefined
        ? workOrder.assessment_hours
        : ''
    );
    setEstimatedDays(
      workOrder?.estimated_days !== null && workOrder?.estimated_days !== undefined && Number(workOrder.estimated_days) > 0
        ? workOrder.estimated_days
        : workOrder?.due_date
        ? Math.max(1, Math.ceil((new Date(workOrder.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 3
    );
    setChargeCode(workOrder?.charge_code || 'PRE');
    setRouteBOverride(false);
    setAssessmentNotes(workOrder?.assessment_notes || '');
    setOnsiteAssessmentPhotos([]);
    setShowAssessmentTimesheet(false);

    // Initialize itemized breakdown if exists
    if (workOrder?.assessment_itemized_breakdown) {
      try {
        const parsed = JSON.parse(workOrder.assessment_itemized_breakdown);
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setAssessmentItems(parsed.items);
        } else {
          setAssessmentItems([{ id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: workOrder.assessor_estimate || '' }]);
        }
        if (parsed.categories && Array.isArray(parsed.categories)) {
          setAssessmentWorkTypes(parsed.categories);
        }
      } catch (_) {
        setAssessmentItems([{ id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: workOrder.assessor_estimate || '' }]);
      }
    } else {
      setAssessmentItems([{ id: 'item-1', description: 'Technical Diagnostic & Core Maintenance', cost: workOrder?.assessor_estimate || '' }]);
    }

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

    setAssessmentError(null);
    setIsAssessmentModalOpen(true);
  };


  // Multi-Contractor Quotation Mutations
  const submitContractorQuoteMutation = useMutation({
    mutationFn: async () => {
      if (contractorQuoteAmountInput === '' || Number(contractorQuoteAmountInput) <= 0) {
        throw new Error('Please enter a valid quotation amount greater than 0');
      }
      return workOrderApi.submitContractorQuotation(id, {
        amount: Number(contractorQuoteAmountInput),
        quote_ref: contractorQuoteRefInput.trim() || undefined,
        notes: contractorQuoteNotesInput.trim() || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsSubmitQuotationModalOpen(false);
      setContractorQuoteAmountInput('');
      setContractorQuoteRefInput('');
      setContractorQuoteNotesInput('');
      setContractorQuoteError(null);
    },
    onError: (err: any) => {
      setContractorQuoteError(err.response?.data?.message || err.message || 'Failed to submit quotation');
    }
  });

  const recommendQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, notes }: { quoteId: string; notes?: string }) => {
      return workOrderApi.recommendContractorQuotation(id, {
        quoteId,
        recommendationNotes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setRecommendationError(null);
      setSelectedQuoteIdToRecommend('');
      setEngineerRecommendationNotesInput('');
    },
    onError: (err: any) => {
      setRecommendationError(err.response?.data?.message || err.message || 'Failed to recommend contractor quote');
    }
  });

  const reviewContractorRecommendationMutation = useMutation({
    mutationFn: async ({ action, quoteId, notes }: { action: 'approved' | 'reevaluate' | 'reject_quote' | 'rejected'; quoteId?: string; notes?: string }) => {
      return workOrderApi.reviewContractorRecommendation(id, { action, quoteId, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsReevaluateModalOpen(false);
      setReevaluateNotesInput('');
      setReevaluateError(null);
    },
    onError: (err: any) => {
      setReevaluateError(err.response?.data?.message || err.message || 'Failed to process approver decision');
    }
  });

  // Part 1: Assign Lead Assessor Mutation
  const assignLeadMutation = useMutation({
    mutationFn: async () => {
      if (!leadAssessorIdInput) throw new Error('Please select an assessor from the list');
      return workOrderApi.assignLeadAssessor(id, {
        leadAssessorId: leadAssessorIdInput,
        leadAssessorRole: leadAssessorRoleInput
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsAssignLeadModalOpen(false);
      setAssignLeadError(null);
    },
    onError: (err: any) => {
      setAssignLeadError(err.response?.data?.message || err.message || 'Failed to assign lead assessor');
    }
  });

  const openAssignLeadModal = () => {
    const defaultRole = workOrder?.lead_assessor_role || 'works_inspector';
    setLeadAssessorRoleInput(defaultRole);
    if (defaultRole === 'works_inspector') {
      setLeadAssessorIdInput(workOrder?.lead_assessor_id || worksInspectors[0]?.id || '');
    } else {
      setLeadAssessorIdInput(workOrder?.lead_assessor_id || worksEngineers[0]?.id || '');
    }
    setAssignLeadError(null);
    setIsAssignLeadModalOpen(true);
  };

  // Part 1: Request Works Engineer Mutation (Works Inspector)
  const requestEngineerMutation = useMutation({
    mutationFn: async () => {
      if (!engineerRequestReasonInput.trim()) {
        throw new Error('Please enter a justification reason for requesting Works Engineer');
      }
      return workOrderApi.requestEngineer(id, { reason: engineerRequestReasonInput.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsRequestEngineerModalOpen(false);
      setEngineerRequestReasonInput('');
      setEngineerRequestError(null);
    },
    onError: (err: any) => {
      setEngineerRequestError(err.response?.data?.message || err.message || 'Failed to request works engineer');
    }
  });

  // Part 1: Handle Engineer Request Mutation (QB Approver/Admin Fulfill or Decline)
  const handleEngineerRequestMutation = useMutation({
    mutationFn: async ({
      action,
      engineerId,
      declineReason
    }: {
      action: 'fulfill' | 'decline';
      engineerId?: string;
      declineReason?: string;
    }) => {
      return workOrderApi.handleEngineerRequest(id, { action, engineerId, declineReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsFulfillEngineerModalOpen(false);
      setDeclineEngineerReasonInput('');
      setHandleEngineerRequestError(null);
    },
    onError: (err: any) => {
      setHandleEngineerRequestError(err.response?.data?.message || err.message || 'Failed to process engineer request');
    }
  });

  // Part 1: QB 3-Way Estimate Review Mutation
  const reviewEstimateMutation = useMutation({
    mutationFn: async ({
      action,
      adjustmentNotes
    }: {
      action: 'approve' | 'adjust' | 'reject';
      adjustmentNotes?: string;
    }) => {
      return workOrderApi.reviewEstimate(id, { action, adjustmentNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsAdjustEstimateModalOpen(false);
      setAdjustmentNotesInput('');
      setReviewEstimateError(null);
    },
    onError: (err: any) => {
      setReviewEstimateError(err.response?.data?.message || err.message || 'Failed to review estimate');
    }
  });

  // Critical Job Contractor Quote Submission Mutation
  const submitCriticalQuoteMutation = useMutation({
    mutationFn: async () => {
      if (criticalQuoteCost === '' || Number(criticalQuoteCost) <= 0) {
        throw new Error('Please enter a valid quoted cost greater than 0');
      }
      return workOrderApi.submitCriticalQuote(id, {
        cost: Number(criticalQuoteCost),
        breakdown: {
          categories: criticalQuoteWorkTypes,
          notes: criticalQuoteNotes.trim()
        },
        notes: criticalQuoteNotes.trim()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      setIsCriticalQuoteModalOpen(false);
      setCriticalQuoteCost('');
      setCriticalQuoteNotes('');
      setCriticalQuoteError(null);
    },
    onError: (err: any) => {
      setCriticalQuoteError(err.response?.data?.message || err.message || 'Failed to submit critical quote');
    }
  });

  // Critical Job Engineer Review (Adjust / Approve) Mutation
  const reviewCriticalQuoteMutation = useMutation({
    mutationFn: async ({ action, cost, notes }: { action: 'approve' | 'adjust'; cost?: number; notes?: string }) => {
      return workOrderApi.reviewCriticalQuote(id, {
        action,
        adjustedCost: cost,
        engineerNotes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] });
      setIsAdjustCriticalQuoteModalOpen(false);
      setAdjustCriticalQuoteError(null);
    },
    onError: (err: any) => {
      setAdjustCriticalQuoteError(err.response?.data?.message || err.message || 'Failed to process critical quote decision');
    }
  });

  const openCriticalQuoteModal = () => {
    let defaultCategories = ['Repair'];
    let defaultNotes = '';
    if (workOrder?.contractor_critical_quote_breakdown) {
      try {
        const parsed = JSON.parse(workOrder.contractor_critical_quote_breakdown);
        if (parsed.categories) defaultCategories = parsed.categories;
        if (parsed.notes) defaultNotes = parsed.notes;
      } catch (_) {
        defaultNotes = workOrder.contractor_critical_quote_breakdown;
      }
    }
    setCriticalQuoteWorkTypes(defaultCategories);
    setCriticalQuoteNotes(defaultNotes);
    setCriticalQuoteCost(workOrder?.contractor_critical_quote_cost || workOrder?.actual_cost || workOrder?.estimated_cost || '');
    setCriticalQuoteError(null);
    setIsCriticalQuoteModalOpen(true);
  };

  const openAdjustCriticalQuoteModal = () => {
    setAdjustedCriticalQuoteCost(workOrder?.contractor_critical_quote_cost || workOrder?.actual_cost || workOrder?.estimated_cost || '');
    setAdjustCriticalQuoteNotes(workOrder?.contractor_critical_quote_engineer_notes || '');
    setAdjustCriticalQuoteError(null);
    setIsAdjustCriticalQuoteModalOpen(true);
  };



  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading work order details...
        </div>
      </AppLayout>
    );
  }

  if (isError || !workOrder) {
    return (
      <AppLayout>
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center space-y-4">
          <p className="text-red-600 font-medium">Work order not found or failed to load.</p>
          <Link
            href="/work-orders"
            className="inline-block px-4 py-2 bg-sky-600 text-white rounded text-sm font-medium"
          >
            &larr; Back to Work Orders
          </Link>
        </div>
      </AppLayout>
    );
  }

  const pBadge = PRIORITY_BADGES[workOrder.priority] || PRIORITY_BADGES.medium;
  const sBadge = STATUS_BADGES[workOrder.status] || STATUS_BADGES.reported;

  const urgency = workOrder.urgency_category || (
    workOrder.priority === 'critical' ? 'Critical 0–24h' :
    workOrder.priority === 'high' ? 'Very urgent 2–4 days' :
    workOrder.priority === 'medium' ? 'Urgent 4–8 days' : '8+ days or statutory'
  );
  const uBadge = URGENCY_BADGES[urgency] || URGENCY_BADGES['Urgent 4–8 days'];
  const isRouteB = workOrder.funding_route === 'route_b' || urgency === 'Critical 0–24h';
  const isStatutory = urgency === '8+ days or statutory';

  // Determine current step index in 7-step pipeline
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.status === workOrder.status);

  // Check what actions the logged-in user can take with Segregation of Duties (SoD)
  const role = user?.role;
  const approverScope = user?.approver_scope || 'general';
  const inspectorScope = user?.inspector_scope || 'both';
  const status = workOrder.status;

  const isSameApproverForAssignment = !!workOrder.approved_by && workOrder.approved_by === user?.id && role !== 'ADMIN';
  const isSodViolationForInvoice = !!(workOrder.approved_by === user?.id || workOrder.assigned_by === user?.id) && role !== 'ADMIN';

  const hasWoApproveScope = role === 'ADMIN' || (role === 'APPROVER' && ['wo_approver', 'general'].includes(approverScope));
  const hasAssignScope = role === 'ADMIN' || (role === 'APPROVER' && ['contractor_approver', 'procurement', 'general'].includes(approverScope));
  const hasPaymentScope = role === 'ADMIN' || (role === 'APPROVER' && ['payment_approver', 'general'].includes(approverScope));
  const canViewInvoiceDetails = hasPaymentScope || role === 'CONTRACTOR' || role === 'AUDITOR';

  // Technical Assessment Permissions:
  // - Site Inspector handles default initial evaluation
  // - Site Engineer ONLY assesses when escalated/referred by Inspector or when editing existing assessment
  const isWorksEngineer = role === 'INSPECTOR' && inspectorScope === 'works_engineer';
  const isWorksInspector = role === 'INSPECTOR' && (inspectorScope === 'works_inspector' || inspectorScope === 'both');
  const isAssessmentDone = !!workOrder.assessment_type || !!workOrder.assessment_date;
  const isReferredToEngineer = isAssessmentDone && workOrder.assessor_role === 'works_engineer' && (workOrder.assessor_estimate === null || workOrder.assessor_estimate === undefined);

  const canAssess =
    (role === 'ADMIN' ||
      isWorksInspector ||
      (isWorksEngineer && (isReferredToEngineer || !!workOrder.assessment_type || workOrder.lead_assessor_id === user?.id || workOrder.assessor_request_engineer_id === user?.id))) &&
    status === 'reported';
  const isContractor = role === 'CONTRACTOR' || !!workOrder.is_blind_quoted;
  const mySubmittedQuote = role === 'CONTRACTOR' ? (workOrder.quotations || []).find((q: any) => q.contractor_id === user?.id) : null;

  const isCriticalJob = urgency === 'Critical 0–24h' || workOrder.priority === 'critical';

  // 3-Way Tri-Signoff Permissions (Strictly Sequential: 1. Works Inspector -> 2. Works Engineer -> 3. Facilities Manager / Staff)
  const canSignInspector =
    ((role as string) === 'ADMIN' || (role === 'INSPECTOR' && ['works_inspector', 'both'].includes(inspectorScope))) &&
    ['completed', 'verified', 'closed'].includes(status);
  const canSignEngineer =
    ((role as string) === 'ADMIN' || (role === 'INSPECTOR' && ['works_engineer', 'both'].includes(inspectorScope))) &&
    ['completed', 'verified', 'closed'].includes(status) &&
    !!workOrder.signoff_inspector_by;
  const canSignFm =
    ((role as string) === 'ADMIN' || role === 'STAFF') &&
    ['completed', 'verified', 'closed'].includes(status) &&
    !!workOrder.signoff_engineer_by;
  const isTriSignoffComplete = !!(workOrder.signoff_inspector_by && workOrder.signoff_engineer_by && workOrder.signoff_fm_by);

  // Timesheet Visibility: Inspector sees Inspector TS, Engineer sees Engineer TS, Payment Approver & Admin see BOTH
  const canViewInspectorTimesheet =
    (role as string) === 'ADMIN' ||
    hasPaymentScope ||
    (role === 'INSPECTOR' && ['works_inspector', 'both'].includes(inspectorScope));
  const canViewEngineerTimesheet =
    (role as string) === 'ADMIN' ||
    hasPaymentScope ||
    (role === 'INSPECTOR' && ['works_engineer', 'both'].includes(inspectorScope));

  // In Part 1 standard flow: Approval is done through the Quantum Built 3-Way Estimate Review stage after assessment & cost calculation.
  // Direct approval/assignment on reported status is for Critical (0–24h) Emergency Fast-Track Bypass.
  const canApprove = (hasWoApproveScope || hasAssignScope || (role as string) === 'ADMIN') && status === 'reported' && isCriticalJob;
  const canAssign =
    (hasAssignScope || (role as string) === 'ADMIN' || (role === 'APPROVER' && isCriticalJob)) &&
    !isSameApproverForAssignment &&
    (status === 'approved' || (status === 'reported' && isCriticalJob)) &&
    !workOrder.assigned_to &&
    (isRouteB || isCriticalJob || workOrder.quote_status === 'client_approved');

  // Critical Job Contractor Quote & Works Engineer Review Permissions
  const canProvideCriticalQuote =
    (role === 'CONTRACTOR' || (role as string) === 'ADMIN') &&
    isCriticalJob &&
    ['completed', 'verified', 'closed'].includes(status) &&
    workOrder.contractor_critical_quote_status !== 'approved';

  const canReviewCriticalQuote =
    ((role as string) === 'ADMIN' || (role === 'INSPECTOR' && ['works_engineer', 'both'].includes(inspectorScope))) &&
    isCriticalJob &&
    ['submitted', 'adjusted'].includes(workOrder.contractor_critical_quote_status || '');

  const canStartWork = (role === 'CONTRACTOR' || (role as string) === 'ADMIN') && status === 'assigned';
  const canComplete = (role === 'CONTRACTOR' || (role as string) === 'ADMIN') && status === 'in_progress';
  const canVerify = ((role as string) === 'ADMIN' || (role === 'INSPECTOR' && ['works_inspector', 'both'].includes(inspectorScope))) && status === 'completed' && isTriSignoffComplete;
  const canClose = (role === 'APPROVER' || (role as string) === 'ADMIN') && status === 'verified' && !workOrder.invoice_id;
  const canReject = (role === 'APPROVER' || (role as string) === 'ADMIN') && status === 'reported';
  const canGenerateInvoice = !isCriticalJob && (role === 'CONTRACTOR' || (role as string) === 'ADMIN') && ['verified', 'closed'].includes(status) && isTriSignoffComplete && !workOrder.invoice_id;
  const canRequestInvoice = hasPaymentScope && ['verified', 'closed'].includes(status) && isTriSignoffComplete && !workOrder.invoice_id;
  const canApproveOrPayInvoice = hasPaymentScope && !isSodViolationForInvoice && !!workOrder.invoice_id;
  const canViewAuditVault = (role as string) === 'ADMIN' || role === 'AUDITOR';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Link href="/work-orders" className="hover:text-gray-900 hover:underline">
            {['assigned', 'in_progress', 'completed', 'verified', 'closed'].includes(status) ? 'Work Orders' : 'Service Requests'}
          </Link>
          <span>&rsaquo;</span>
          <span className="font-mono text-gray-700">{workOrder.tracking_number}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              ['assigned', 'in_progress', 'completed', 'verified', 'closed'].includes(status)
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {['assigned', 'in_progress', 'completed', 'verified', 'closed'].includes(status)
              ? 'Official Work Order'
              : 'Service Request (Pending Contractor Assignment)'}
          </span>
        </div>

        {/* Top Header Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          {/* Row 1: Tracking Number & Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-mono font-bold text-sky-700 text-sm">
              {workOrder.tracking_number}
            </span>
            
            {/* Urgency SLA Badge */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}
            >
              {urgency}
            </span>

            {/* Funding Route Badge */}
            {isRouteB ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Advance Float Funded
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Client Funded (NC DOH)
              </span>
            )}

            {/* Statutory Notice Badge */}
            {isStatutory && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                30d/15d Pre-Notice Active
              </span>
            )}

            {/* Route A Quote Lifecycle Badge (PDF Page 4) */}
            {workOrder.quote_status && QUOTE_STATUS_CONFIG[workOrder.quote_status] && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${QUOTE_STATUS_CONFIG[workOrder.quote_status].bg} ${QUOTE_STATUS_CONFIG[workOrder.quote_status].text} ${QUOTE_STATUS_CONFIG[workOrder.quote_status].border}`}
              >
                {QUOTE_STATUS_CONFIG[workOrder.quote_status].label}
              </span>
            )}

            {/* Part 1: Lead Assessor Badge */}
            {workOrder.lead_assessor_name && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                title={`Lead Assessor explicitly assigned by Quantum Built: ${workOrder.lead_assessor_name}`}
              >
                Lead: {workOrder.lead_assessor_name} ({workOrder.lead_assessor_role === 'works_engineer' ? 'Works Engineer' : 'Works Inspector'})
              </span>
            )}

            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${sBadge.bg} ${sBadge.text} ${sBadge.border}`}
            >
              {workOrder.status === 'reported' ? 'Requested' : workOrder.status.replace('_', ' ')}
            </span>

            {/* Prominent Print Work Order Button in Top Header (Admin & Contractor) */}
            {['assigned', 'in_progress', 'completed', 'verified', 'closed'].includes(status) && (role === 'ADMIN' || role === 'CONTRACTOR') && (
              <button
                type="button"
                onClick={() =>
                  downloadWorkOrderPdf({
                    tracking_number: workOrder.tracking_number,
                    title: workOrder.title,
                    description: workOrder.description,
                    status: workOrder.status,
                    category: workOrder.category,
                    priority: workOrder.priority,
                    urgency_category: workOrder.urgency_category,
                    funding_route: workOrder.funding_route,
                    created_at: workOrder.created_at,
                    due_date: workOrder.due_date,
                    estimated_days: workOrder.estimated_days,
                    facility_name: workOrder.facility_name,
                    facility_address: workOrder.facility_address,
                    facility_city: workOrder.facility_city,
                    location_details: workOrder.location_details,
                    reported_by_name: workOrder.reported_by_name,
                    assigned_to_name: workOrder.assigned_to_name,
                    contractor_name: workOrder.contractor_name || workOrder.assigned_to_name,
                    lead_assessor_name: workOrder.lead_assessor_name,
                    lead_assessor_role: workOrder.lead_assessor_role,
                    charge_code: workOrder.charge_code,
                    assessment_mode: workOrder.assessment_type,
                    assessment_notes: workOrder.assessment_notes,
                    estimated_cost: workOrder.estimated_cost,
                    actual_cost: workOrder.actual_cost,
                    system_quote_no: workOrder.system_quote_no,
                    contractor_quote_ref: workOrder.contractor_quote_ref
                  })
                }
                title="Print and Download Official Work Order (PDF)"
                className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#008DA6] hover:bg-[#007387] active:bg-[#005c6d] rounded-lg shadow-xs hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
                </svg>
                Print Work Order (PDF)
              </button>
            )}
          </div>

          {/* Row 2: Title & Reporter (Full Width) */}
          <div className="w-full space-y-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight leading-snug break-words">
              {workOrder.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Requested on {formatDate(workOrder.created_at)} by{' '}
              <span className="font-semibold text-slate-700">{workOrder.reported_by_name || 'Staff'}</span>
            </p>
          </div>

          {/* Row 3: Action Buttons Bar */}
          <div className="pt-3 border-t border-slate-100/90 flex flex-wrap items-center gap-2 justify-start">
            {/* Part 1: QB Assign Lead Assessor Button */}
            {hasWoApproveScope && status === 'reported' && (
              <button
                type="button"
                onClick={openAssignLeadModal}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                {workOrder.lead_assessor_id ? 'Reassign Lead Assessor' : 'Assign Lead Assessor'}
              </button>
            )}

            {/* Part 1: Works Inspector Request Works Engineer Button */}
            {status === 'reported' && isWorksInspector && workOrder.lead_assessor_id === user?.id && !['pending', 'fulfilled'].includes(workOrder.assessor_request_status || '') && (
              <button
                type="button"
                onClick={() => {
                  setEngineerRequestReasonInput('');
                  setEngineerRequestError(null);
                  setIsRequestEngineerModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                Request Works Engineer
              </button>
            )}

            {canAssess && (
              <button
                type="button"
                onClick={openAssessmentModal}
                className="px-4 py-2 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                {!isAssessmentDone
                  ? 'Conduct Assessment'
                  : isWorksEngineer && (workOrder.assessor_estimate === null || workOrder.assessor_estimate === undefined)
                  ? 'Complete Engineer Scoping & Cost'
                  : isWorksInspector && isReferredToEngineer
                  ? 'Update Referral Notes'
                  : 'Edit Assessment'}
              </button>
            )}

            {canApprove && (
              <button
                type="button"
                onClick={() => openTransitionModal('approved')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                Approve Emergency Fast-Track
              </button>
            )}

            
            {/* Contractor Multi-Quotation Button (when assessed) */}
            {role === 'CONTRACTOR' && ['reported', 'approved'].includes(status) && isAssessmentDone && !workOrder.assigned_to && (
              mySubmittedQuote ? (
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Quotation Submitted ({formatCurrency(mySubmittedQuote.amount)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setContractorQuoteAmountInput(mySubmittedQuote.amount || '');
                      setContractorQuoteRefInput(mySubmittedQuote.quote_ref || '');
                      setContractorQuoteNotesInput(mySubmittedQuote.notes || '');
                      setContractorQuoteError(null);
                      setIsSubmitQuotationModalOpen(true);
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    Edit / Update Quote
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setContractorQuoteAmountInput('');
                    setContractorQuoteRefInput('');
                    setContractorQuoteNotesInput('');
                    setContractorQuoteError(null);
                    setIsSubmitQuotationModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  Submit Formal Quotation (R)
                </button>
              )
            )}





            {canAssign && (
              <button
                type="button"
                onClick={() => openTransitionModal('assigned')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>⚡</span>
                <span>Assign Specialist Contractor</span>
              </button>
            )}
            {status === 'approved' && isSameApproverForAssignment && (
              <span
                title="Segregation of Duties: You approved this work order scope/budget. To prevent single-point control, contractor assignment must be completed by Procurement or another authorized officer."
                className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-lg"
              >
                Assignment Delegated to Procurement (SoD)
              </span>
            )}

            {canStartWork && (
              <button
                type="button"
                onClick={() => openTransitionModal('in_progress')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Start Field Work
              </button>
            )}

            {canComplete && (
              <button
                type="button"
                onClick={() => openTransitionModal('completed')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Mark Work Completed
              </button>
            )}

            {status === 'completed' && !isTriSignoffComplete && (
              <span className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg select-none">
                Awaiting 3-Way Tri-Signoff ({[workOrder.signoff_engineer_by, workOrder.signoff_fm_by, workOrder.signoff_inspector_by].filter(Boolean).length}/3)
              </span>
            )}

            {canVerify && (
              <>
                <button
                  type="button"
                  onClick={() => openInspectionModal('PASS')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
                >
                  Pass Inspection & Verify
                </button>
                <button
                  type="button"
                  onClick={() => openInspectionModal('FAIL')}
                  className="px-3 py-2 bg-white border border-rose-300 hover:bg-rose-50 active:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  Fail QC (Return to In Progress)
                </button>
              </>
            )}

            {canClose && (
              <button
                type="button"
                onClick={() => openTransitionModal('closed')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Approve Work Order
              </button>
            )}

            {/* Critical Job: Contractor Provide Quote Button */}
            {canProvideCriticalQuote && (
              <button
                type="button"
                onClick={openCriticalQuoteModal}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                {workOrder.contractor_critical_quote_status ? 'Update Critical Quote' : 'Provide Quote / Cost Breakdown (R)'}
              </button>
            )}

            {/* Critical Job: Works Engineer Approve or Adjust Quote Buttons */}
            {canReviewCriticalQuote && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => reviewCriticalQuoteMutation.mutate({ action: 'approve' })}
                  disabled={reviewCriticalQuoteMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  {reviewCriticalQuoteMutation.isPending ? 'Approving...' : `Approve Quote (${formatCurrency(workOrder.contractor_critical_quote_cost || 0)})`}
                </button>
                <button
                  type="button"
                  onClick={openAdjustCriticalQuoteModal}
                  disabled={reviewCriticalQuoteMutation.isPending}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  Adjust Quote
                </button>
              </div>
            )}

            {/* When Completed: Disabled button waiting for verification (Contractor/Admin only - Non-Critical) */}
            {!isCriticalJob && role === 'CONTRACTOR' && workOrder.status === 'completed' && !workOrder.invoice_id && (
              <button
                disabled
                title="Invoice generation will be enabled after quality inspection and verification"
                className="px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold rounded-lg cursor-not-allowed select-none"
              >
                Waiting for Verification
              </button>
            )}

            {/* When Verified or Closed and No Invoice Yet: */}
            {/* Contractor sees button to Generate Invoice Claim (Non-Critical jobs) */}
            {!isCriticalJob && role === 'CONTRACTOR' && ['verified', 'closed'].includes(workOrder.status) && !workOrder.invoice_id && (
              <button
                type="button"
                onClick={openInvoiceModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Generate Invoice Claim ({formatCurrency(workOrder.actual_cost || workOrder.estimated_cost || 0)})
              </button>
            )}



            {/* When Invoice Exists: 1 Single "Approve & Pay Invoice" Button for Approver/Admin */}
            {workOrder.invoice_id && (
              <>
                {canApproveOrPayInvoice && ['pending', 'approved'].includes(workOrder.invoice_status || '') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => invoiceStatusMutation.mutate({ status: 'paid' })}
                      disabled={invoiceStatusMutation.isPending}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {invoiceStatusMutation.isPending
                        ? 'Settling Payment...'
                        : `Approve & Pay Invoice (${formatCurrency(workOrder.invoice_total_amount || workOrder.actual_cost)})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt('Enter reason for rejecting invoice claim:');
                        if (reason) invoiceStatusMutation.mutate({ status: 'rejected', notes: reason });
                      }}
                      disabled={invoiceStatusMutation.isPending}
                      className="px-3 py-2 bg-white border border-rose-300 hover:bg-rose-50 active:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg transition-all active:scale-95 cursor-pointer"
                    >
                      Reject Claim
                    </button>
                  </div>
                )}

                {isSodViolationForInvoice && ['pending', 'approved'].includes(workOrder.invoice_status || '') && (
                  <span
                    title="Segregation of Duties: You approved or assigned this work order. To prevent conflict of interest, invoice settlement must be completed by Finance / Payment Approver."
                    className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-lg"
                  >
                    Settlement Delegated to Finance (SoD)
                  </span>
                )}

                {/* If Paid: Show badge or link */}
                {workOrder.invoice_status === 'paid' && (
                  canViewInvoiceDetails ? (
                    <Link
                      href="/invoices"
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer inline-block"
                    >
                      Invoice {workOrder.invoice_number} (PAID & SETTLED) — {formatCurrency(workOrder.invoice_total_amount || workOrder.actual_cost)} &rarr;
                    </Link>
                  ) : (
                    <span className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold">
                      Payment Settled
                    </span>
                  )
                )}

                {/* If Rejected */}
                {workOrder.invoice_status === 'rejected' && canViewInvoiceDetails && (
                  <Link
                    href="/invoices"
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 border border-rose-300 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer inline-block"
                  >
                    Invoice {workOrder.invoice_number} (REJECTED) &rarr;
                  </Link>
                )}
              </>
            )}

            {/* Official Work Order Print & Download PDF Button (Only after assigned to contractor, Admin & Contractor only) */}
            {['assigned', 'in_progress', 'completed', 'verified', 'closed'].includes(status) && (role === 'ADMIN' || role === 'CONTRACTOR') && (
              <button
                type="button"
                onClick={() =>
                  downloadWorkOrderPdf({
                    tracking_number: workOrder.tracking_number,
                    title: workOrder.title,
                    description: workOrder.description,
                    status: workOrder.status,
                    category: workOrder.category,
                    priority: workOrder.priority,
                    urgency_category: workOrder.urgency_category,
                    funding_route: workOrder.funding_route,
                    created_at: workOrder.created_at,
                    due_date: workOrder.due_date,
                    estimated_days: workOrder.estimated_days,
                    facility_name: workOrder.facility_name,
                    facility_address: workOrder.facility_address,
                    facility_city: workOrder.facility_city,
                    location_details: workOrder.location_details,
                    reported_by_name: workOrder.reported_by_name,
                    assigned_to_name: workOrder.assigned_to_name,
                    contractor_name: workOrder.contractor_name || workOrder.assigned_to_name,
                    lead_assessor_name: workOrder.lead_assessor_name,
                    lead_assessor_role: workOrder.lead_assessor_role,
                    charge_code: workOrder.charge_code,
                    assessment_mode: workOrder.assessment_type,
                    assessment_notes: workOrder.assessment_notes,
                    estimated_cost: workOrder.estimated_cost,
                    actual_cost: workOrder.actual_cost,
                    system_quote_no: workOrder.system_quote_no,
                    contractor_quote_ref: workOrder.contractor_quote_ref
                  })
                }
                title="Download and Print Official Work Order Dispatch PDF"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#008DA6] hover:bg-[#007387] active:bg-[#005c6d] rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM7 9V5a2 2 0 012-2h6a2 2 0 012 2v4" />
                </svg>
                Print Work Order (PDF)
              </button>
            )}

            {/* Direct Download Quote PDF button (Route A only when quote submitted) */}
            {!isRouteB && workOrder.estimated_cost && Number(workOrder.estimated_cost) > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadQuotePdf({
                    quote_number: `QTE-${new Date().getFullYear()}-${workOrder.tracking_number?.replace(/\D/g, '').slice(-4) || '1001'}`,
                    issued_date: workOrder.assessment_date || workOrder.created_at,
                    work_order_tracking: workOrder.tracking_number,
                    work_order_title: workOrder.title,
                    client_name: workOrder.reported_by_name || 'Muzikayise Nkosi',
                    facility_name: workOrder.facility_name,
                    contractor_name: workOrder.assigned_to_name || 'Apex BioMed Solutions',
                    quote_amount: Number(workOrder.estimated_cost || 0),
                    quote_notes: workOrder.assessment_notes || workOrder.description
                  })
                }
                title="Download and Print Official Formal Quote PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Quote PDF
              </button>
            )}

            {/* Direct Download Estimate PDF button */}
            {hasPaymentScope && ((workOrder.assessor_estimate !== null && workOrder.assessor_estimate !== undefined && Number(workOrder.assessor_estimate) > 0) || isAssessmentDone) && (
              <button
                type="button"
                onClick={() =>
                  downloadEstimatePdf({
                    estimate_number: `EST-${new Date().getFullYear()}-${workOrder.tracking_number?.replace(/\D/g, '').slice(-4) || '1001'}`,
                    estimate_date: workOrder.assessment_date || workOrder.created_at,
                    work_order_tracking: workOrder.tracking_number,
                    work_order_title: workOrder.title,
                    customer_name: 'Northern Cape Department of Health',
                    facility_name: workOrder.facility_name,
                    facility_address: 'Northern Cape Provincial Campus',
                    estimate_by_name: workOrder.assessor_name || workOrder.lead_assessor_name || 'David Vance (Site Works Assessor)',
                    estimate_by_role: workOrder.assessor_role === 'works_engineer' ? 'Works Engineer (HVAC Specialist)' : 'Works Inspector (Quality Officer)',
                    estimate_by_charge_code: workOrder.charge_code || 'ONS',
                    subtotal: Number(workOrder.assessor_estimate || workOrder.estimated_cost || 0),
                    comments: workOrder.assessment_notes || `Technical assessment and scope estimation for ${workOrder.tracking_number} (${workOrder.title}). All works to adhere to SANS healthcare engineering standards.`
                  })
                }
                title="Download and Print Official Assessment Estimate PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Estimate PDF
              </button>
            )}



            {/* Direct Download Invoice PDF button (Payment Approver, Admin, Contractor, Auditor only) */}
            {canViewInvoiceDetails && workOrder.invoice_id && (
              <button
                type="button"
                onClick={() =>
                  downloadInvoicePdf({
                    id: workOrder.invoice_id || id,
                    invoice_number: workOrder.invoice_number || 'INV-REF',
                    created_at: workOrder.created_at,
                    status: workOrder.invoice_status || 'pending',
                    amount: Number(workOrder.actual_cost || workOrder.estimated_cost || 0),
                    notes: `Invoice claim for completed maintenance on ${workOrder.tracking_number} (${workOrder.title})`,
                    contractor_name: workOrder.assigned_to_name || 'Apex BioMed Solutions',
                    work_order_tracking: workOrder.tracking_number,
                    work_order_title: workOrder.title,
                    facility_name: workOrder.facility_name
                  })
                }
                title="Download and Print Official Invoice PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-200 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice PDF
              </button>
            )}

            {canReject && (
              <button
                type="button"
                onClick={() => openTransitionModal('cancelled')}
                className="px-3.5 py-2 bg-white border border-rose-300 hover:bg-rose-50 active:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                Cancel / Reject
              </button>
            )}

            {/* Admin Only: Delete Test Work Order */}
            {user?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={handleDeleteWorkOrder}
                disabled={deleteOrderMutation.isPending}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 text-xs font-semibold rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50"
                title="Admin: Permanently delete this test work order and all linked records"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleteOrderMutation.isPending ? 'Deleting...' : 'Delete Order'}
              </button>
            )}
          </div>
        </div>

        {/* Part 1: Critical SLA Emergency Bypass Notice */}
        {urgency === 'Critical 0–24h' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-200 text-rose-800 uppercase tracking-wide">
                Critical SLA Emergency Bypass
              </span>
              <span className="text-xs font-bold text-rose-900">
                0–24h Immediate Containment Active
              </span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed mt-1">
              Under the HVAC Maintenance Framework, Critical 0–24h work orders bypass standard pre-assessment gating for rapid containment. A retrospective engineering review and assessment log are automatically tracked.
            </p>
          </div>
        )}

        {/* Part 1: Works Inspector Engineer Assistance Request Banner */}
        {workOrder.assessor_request_status === 'pending' && !workOrder.assessor_estimate && workOrder.assessment_review_status !== 'pending' && workOrder.assessment_review_status !== 'approved' && (
          <div className="p-5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600 animate-pulse" />
                <h3 className="text-sm font-bold text-amber-950">
                  Lead Inspector Technical Assistance Request
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                Awaiting QB Decision
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-amber-200 text-xs space-y-2">
              <p className="text-slate-700 leading-relaxed">
                The Lead Works Inspector has requested on-site / joint engineering scoping assistance from Quantum Built:
              </p>
              <div className="p-2.5 bg-amber-50/60 rounded-md border border-amber-200 text-amber-900 font-medium italic">
                &ldquo;{workOrder.assessor_request_reason || 'Engineering scoping required for complex HVAC/Biomedical assessment.'}&rdquo;
              </div>
            </div>
            {hasWoApproveScope && (
              <div className="flex items-center gap-2 pt-1 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFulfillEngineerIdInput(worksEngineers[0]?.id || '');
                    setHandleEngineerRequestError(null);
                    setIsFulfillEngineerModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Fulfill &amp; Assign Works Engineer &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reason = window.prompt('Enter reason for declining engineering request (Inspector will continue alone):');
                    if (reason !== null) {
                      handleEngineerRequestMutation.mutate({ action: 'decline', declineReason: reason });
                    }
                  }}
                  disabled={handleEngineerRequestMutation.isPending}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer"
                >
                  Decline Request (Inspector Continues)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Part 1: Joint Session Fulfilled Notice */}
        {workOrder.assessor_request_status === 'fulfilled' && (
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-200 text-sky-800 uppercase">
                Joint Assessment Session
              </span>
              <span className="font-semibold">
                Works Engineer {workOrder.assessor_request_engineer_name ? `(${workOrder.assessor_request_engineer_name})` : ''} joined the lead inspection session.
              </span>
            </div>
          </div>
        )}

        {/* Part 1: QB 3-Way Estimate Review Stage Banner (Approve, Adjust, Reject) */}
        {workOrder.assessment_review_status === 'pending' && hasWoApproveScope && (
          <div className="p-5 bg-sky-50/90 border border-sky-300 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600 animate-pulse" />
                <h3 className="text-sm font-bold text-sky-950">
                  Step 1.3: Quantum Built 3-Way Preliminary Estimate Review
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-200 text-sky-800 uppercase">
                Review Required
              </span>
            </div>

            {reviewEstimateError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {reviewEstimateError}
              </div>
            )}
            <div className="bg-white p-4 rounded-lg border border-sky-100 text-xs space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assessor</span>
                  <span className="font-bold text-slate-900">{workOrder.assessor_name || workOrder.lead_assessor_name || 'Lead Assessor'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimate Amount</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{formatCurrency(workOrder.assessor_estimate || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Turnaround Days</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {workOrder.estimated_days
                      ? `${workOrder.estimated_days} Days`
                      : workOrder.due_date
                      ? `${Math.max(1, Math.ceil((new Date(workOrder.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days`
                      : 'Not Specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Charge Code</span>
                  <span className="font-bold text-slate-900 font-mono">{workOrder.charge_code || 'PRE'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Funding Route</span>
                  <span className="font-bold text-sky-700 font-mono">
                    {workOrder.funding_route === 'route_b' ? 'Advance Float (Route B)' : 'Client Gateway (Route A)'}
                  </span>
                </div>
              </div>
              {workOrder.assessment_notes && (
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-slate-700 text-[11px]">
                  <strong className="text-slate-900">Assessor Scope Notes:</strong> {workOrder.assessment_notes}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => reviewEstimateMutation.mutate({ action: 'approve' })}
                disabled={reviewEstimateMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {reviewEstimateMutation.isPending ? 'Approving...' : 'Approve Estimate & Advance'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustmentNotesInput('');
                  setReviewEstimateError(null);
                  setIsAdjustEstimateModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              >
                Request Adjustment
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to reject this estimate and reassign assessment?')) {
                    reviewEstimateMutation.mutate({ action: 'reject' });
                  }
                }}
                disabled={reviewEstimateMutation.isPending}
                className="px-3 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Reject &amp; Reassign
              </button>
            </div>
          </div>
        )}

        {/* Part 1: Adjustment Requested Banner */}
        {workOrder.assessment_review_status === 'adjusted' && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-950 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Quantum Built Requested Estimate Adjustment
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                Adjustment Pending
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              <strong>QB Reviewer Notes:</strong> {workOrder.assessment_adjustment_notes || 'Please revise preliminary repair scope and cost calculation.'}
            </p>
            {canAssess && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={openAssessmentModal}
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Revise Assessment &amp; Resubmit &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fast-Track Advance Float Notice (Quantum Built Direct Advance Funded) */}
        {isRouteB && hasPaymentScope && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-800">
                Advance Float Funded
              </span>
              <span className="text-xs font-semibold text-gray-900">
                Quantum Built 24h Emergency Response
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Operates under the Quantum Built fast-track facility agreement. Advance funding is provisioned directly by Quantum Built for rapid specialist dispatch without routine procurement delays.
            </p>
          </div>
        )}

        {/* Statutory Pre-Notice Alert Banner */}
        {isStatutory && (
          <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800">
                Statutory Maintenance Schedule
              </span>
              <span className="text-xs font-semibold text-sky-950">
                30-Day &amp; 15-Day Pre-Notices Active
              </span>
            </div>
            <p className="text-xs text-sky-800 leading-relaxed">
              Mandatory statutory pre-work notices are queued for dispatch to NC DOH, Facility Directors, and Quantum Built technical management prior to contractor commencement.
            </p>
          </div>
        )}

        {/* Step 2: Contractor Assignment Stage Banner */}
        {workOrder.status === 'approved' && hasPaymentScope && (
          <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <h3 className="text-sm font-bold text-indigo-950">
                  {isRouteB
                    ? 'Step 2: Specialist Contractor Direct Dispatch (Advance Float)'
                    : 'Step 2: Contractor Price Quotation &amp; Assignment (Client Gateway)'}
                </h3>
              </div>
              {!isRouteB && (
                workOrder.estimated_cost ? (
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Contractor Quoted: {formatCurrency(workOrder.estimated_cost)}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    Awaiting Contractor Price Quote
                  </span>
                )
              )}
            </div>

            <div className="bg-white/90 p-4 rounded-lg border border-indigo-100 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-slate-700 leading-relaxed">
                  {isRouteB
                    ? 'Pre-approved under Quantum Built fast-track facility agreement. Contractor Approver can directly select and assign the specialist contractor from the panel for immediate dispatch.'
                    : workOrder.estimated_cost
                    ? `Contractor has submitted an estimated quote of ${formatCurrency(workOrder.estimated_cost)}. Contractor Approver can now review the amount and assign the specialist.`
                    : 'Work Order scope is approved. Contractors can submit their price estimate before Contractor Approver assigns the job.'}
                </p>
                <div className="text-[11px] text-slate-500 mt-1">
                  Scope Status: <strong className="text-slate-800">Pre-Approved for Specialist Dispatch</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspection QC Rejection Feedback Banner */}
        {workOrder.status === 'in_progress' && workOrder.inspections && workOrder.inspections.length > 0 && workOrder.inspections[0].result === 'FAIL' && (
          <div className="p-5 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-sm font-bold text-rose-900">
                  QC Inspection Failed — Corrective Action Required
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800 uppercase">
                Returned to In Progress
              </span>
            </div>

            <div className="bg-white/90 p-3.5 rounded-lg border border-rose-200 text-xs space-y-2">
              <div>
                <span className="font-semibold text-rose-900">Inspector Feedback & Reason:</span>
                <p className="text-rose-800 mt-0.5 leading-relaxed whitespace-pre-line">
                  {workOrder.inspections[0].observations || 'Work was rejected by QC inspector. Please rectify and resubmit.'}
                </p>
              </div>

              {workOrder.inspections[0].recommendations && (
                <div className="pt-2 border-t border-rose-100">
                  <span className="font-semibold text-rose-900">Recommended Rectification:</span>
                  <p className="text-rose-700 mt-0.5">
                    {workOrder.inspections[0].recommendations}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-600">
                <span>
                  Inspector: <strong>{workOrder.inspections[0].inspector_name || 'QC Officer'}</strong>
                </span>
                <span>
                  Inspected on {formatDate(workOrder.inspections[0].inspected_at)}
                </span>
              </div>
            </div>

            {role === 'CONTRACTOR' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <span className="text-xs text-rose-700 font-medium">
                  Once repairs have been rectified, click to resubmit for verification:
                </span>
                <button
                  onClick={() => openTransitionModal('completed')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition shrink-0"
                >
                  Mark Fixed &amp; Resubmit for QC &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Workflow Pipeline Stepper */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Workflow Progress Pipeline
            </div>
            {workOrder.status === 'cancelled' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                ✕ Order Cancelled / Rejected
              </span>
            )}
          </div>
          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="grid grid-cols-7 gap-2 min-w-[540px] md:min-w-0">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isPast = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;

                return (
                  <div key={step.status} className="text-center">
                    <div
                      className={`h-2 rounded-full mb-2 transition-all ${
                        isCurrent
                          ? 'bg-sky-600 ring-2 ring-sky-300'
                          : isPast
                          ? 'bg-emerald-500'
                          : 'bg-gray-200'
                      }`}
                    />
                    <div
                      className={`text-[11px] sm:text-xs font-medium capitalize truncate ${
                        isCurrent
                          ? 'text-sky-700 font-bold'
                          : isPast
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Navigation (Details vs Unified Activity History vs SHA-256 Vault) */}
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-2.5 sm:py-3 px-3.5 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'details'
                ? 'border-sky-600 text-sky-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Work Order Details &amp; Photos
          </button>

          {canViewAuditVault && (
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`py-2.5 sm:py-3 px-3.5 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-sky-600 text-sky-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>Activity &amp; Audit History</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-700 rounded-full font-bold">
                {(workOrder.events?.length || auditChain?.chain_length || 0)} Logs
              </span>
            </button>
          )}

          {canViewAuditVault && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`py-2.5 sm:py-3 px-3.5 sm:px-6 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'audit'
                  ? 'border-sky-600 text-sky-700 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>SHA-256 Cryptographic Vault</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-100 text-sky-800 rounded-full font-bold">
                {auditChain?.chain_length || 0} Events
              </span>
            </button>
          )}
        </div>

        {/* TAB 1: WORK ORDER DETAILS */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* Multi-Contractor Quotations & Engineering Review Card (TOP PROMINENCE - Admin & Engineers only) */}
              {(isWorksEngineer || hasAssignScope || (role as string) === 'APPROVER' || (role as string) === 'ADMIN') &&
                (isAssessmentDone || workOrder.invited_contractor_ids || (workOrder.quotations && workOrder.quotations.length > 0) || workOrder.assigned_to) && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                          Contractor Quotations &amp; Commercial Review
                        </h2>
                        {workOrder.quotations && workOrder.quotations.length > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            {workOrder.quotations.length} Quote(s) Received
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Awaiting Contractor Quotes
                          </span>
                        )}
                        {workOrder.assigned_to && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Contractor Assigned
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Candidate contractor commercial bids &bull; Works Engineer recommendation &bull; Direct Approver Accept / Reject
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!workOrder.assigned_to && ['reported', 'approved'].includes(status) && (
                        <button
                          type="button"
                          onClick={() => setIsInviteContractorsModalOpen(true)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          {workOrder.invited_contractor_ids ? 'Manage Invitations' : '+ Invite Contractor(s)'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contractor Approver Recommendation Banner */}
                  {workOrder.selected_contractor_quote_id && ['reported', 'approved'].includes(status) && !workOrder.assigned_to && (
                    <div className="p-4 bg-purple-50/90 border border-purple-200 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-purple-600 animate-pulse" />
                          <span className="font-bold text-purple-950 text-sm">
                            Works Engineer Recommendation Active
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-900 uppercase tracking-wide">
                          Awaiting Approver Decision
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-1 text-slate-700">
                        <div>
                          Recommended Contractor:{' '}
                          <strong className="text-purple-950 text-sm">
                            {workOrder.quotations?.find(q => q.id === workOrder.selected_contractor_quote_id)?.contractor_name || 'Selected Contractor'}
                          </strong>{' '}
                          (Quoted:{' '}
                          <strong className="text-purple-950 font-mono text-sm">
                            {formatCurrency(workOrder.quotations?.find(q => q.id === workOrder.selected_contractor_quote_id)?.amount || 0)}
                          </strong>)
                        </div>
                        {workOrder.engineer_recommendation_notes && (
                          <div className="text-[11px] text-slate-600 pt-1 border-t border-purple-50">
                            <strong>Engineer Rationale:</strong> {workOrder.engineer_recommendation_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Re-evaluation Alert if returned by Approver */}
                  {workOrder.contractor_approver_action === 'reevaluate' && !workOrder.selected_contractor_quote_id && (
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>Quotation Re-evaluation Requested by Procurement</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 uppercase font-bold">
                          Re-evaluation Required
                        </span>
                      </div>
                      <p className="text-amber-800 text-[11px]">
                        <strong>Approver Feedback:</strong> {workOrder.contractor_approver_notes || 'Please re-evaluate candidate quotes.'}
                      </p>
                    </div>
                  )}

                  {/* Quotations List / Comparison Table */}
                  {workOrder.quotations && workOrder.quotations.length > 0 ? (
                    <div className="space-y-4">
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-3">Contractor / Entity</th>
                              <th className="p-3">Quote Ref</th>
                              <th className="p-3">Quoted Amount (R)</th>
                              <th className="p-3">Submitted Date</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {workOrder.quotations.map((q) => {
                              const isRecommended = q.id === workOrder.selected_contractor_quote_id;
                              const isAssigned = q.status === 'assigned' || q.contractor_id === workOrder.assigned_to;
                              const isSelected = selectedQuoteIdToRecommend === q.id || (!selectedQuoteIdToRecommend && isRecommended);
                              const isApproverRole = hasAssignScope || (role as string) === 'APPROVER' || (role as string) === 'ADMIN';

                              return (
                                <tr
                                  key={q.id}
                                  className={
                                    isAssigned
                                      ? 'bg-emerald-50/40'
                                      : isRecommended
                                      ? 'bg-purple-50/50'
                                      : isSelected && isWorksEngineer
                                      ? 'bg-purple-50/20'
                                      : ''
                                  }
                                >
                                  <td className="p-3">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{q.contractor_name || 'Contractor'}</span>
                                      {isAssigned && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                          Assigned
                                        </span>
                                      )}
                                      {isRecommended && !isAssigned && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    {q.notes && (
                                      <div className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">
                                        {q.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 font-mono text-slate-600">{q.quote_ref || '-'}</td>
                                  <td className="p-3 font-mono font-bold text-slate-900 text-sm">
                                    {formatCurrency(q.amount)}
                                  </td>
                                  <td className="p-3 text-slate-500 font-mono text-[11px]">
                                    {formatDate(q.created_at)}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        isAssigned
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : isRecommended
                                          ? 'bg-purple-100 text-purple-800'
                                          : q.status === 'rejected'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {isAssigned ? 'Assigned' : isRecommended ? 'Recommended' : q.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    {/* Approver / Admin Actions */}
                                    {isApproverRole && !workOrder.assigned_to && ['reported', 'approved'].includes(status) && (
                                      <div className="flex items-center justify-end gap-1.5">
                                        {q.status !== 'rejected' ? (
                                          <>
                                            <button
                                              type="button"
                                              disabled={reviewContractorRecommendationMutation.isPending}
                                              onClick={() => {
                                                reviewContractorRecommendationMutation.mutate({
                                                  action: 'approved',
                                                  quoteId: q.id,
                                                  notes: `Directly approved and assigned by ${user?.name || 'Approver'}`
                                                });
                                              }}
                                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                            >
                                              Accept &amp; Assign
                                            </button>
                                            <button
                                              type="button"
                                              disabled={reviewContractorRecommendationMutation.isPending}
                                              onClick={() => {
                                                reviewContractorRecommendationMutation.mutate({
                                                  action: 'reject_quote',
                                                  quoteId: q.id,
                                                  notes: 'Quotation rejected by Approver'
                                                });
                                              }}
                                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                                            >
                                              Reject
                                            </button>
                                          </>
                                        ) : (
                                          <span className="text-[11px] text-rose-500 font-medium italic">Rejected</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Works Engineer Selection */}
                                    {isWorksEngineer && !workOrder.assigned_to && ['reported', 'approved'].includes(status) && (
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedQuoteIdToRecommend(q.id)}
                                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                              ? 'bg-purple-700 text-white shadow-xs font-bold'
                                              : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'
                                          }`}
                                        >
                                          {isSelected ? '✓ Selected' : 'Select'}
                                        </button>
                                      </div>
                                    )}

                                    {/* If already assigned */}
                                    {workOrder.assigned_to && (
                                      <span className={`text-xs font-bold ${isAssigned ? 'text-emerald-700' : 'text-slate-400'}`}>
                                        {isAssigned ? '✓ Assigned Winner' : '—'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Works Engineer Recommendation Box */}
                      {isWorksEngineer && ['reported', 'approved'].includes(status) && !workOrder.assigned_to && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                          {recommendationError && (
                            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                              {recommendationError}
                            </div>
                          )}
                          <label className="block text-xs font-bold text-slate-800">
                            Works Engineer Recommendation Rationale:
                          </label>
                          <textarea
                            rows={2}
                            value={engineerRecommendationNotesInput}
                            onChange={(e) => setEngineerRecommendationNotesInput(e.target.value)}
                            placeholder="State technical justification, rate competitiveness, or contractor OEM specialty..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={!selectedQuoteIdToRecommend && !workOrder.selected_contractor_quote_id || recommendQuoteMutation.isPending}
                              onClick={() =>
                                recommendQuoteMutation.mutate({
                                  quoteId: selectedQuoteIdToRecommend || workOrder.selected_contractor_quote_id || '',
                                  notes: engineerRecommendationNotesInput.trim()
                                })
                              }
                              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              {recommendQuoteMutation.isPending ? 'Submitting...' : 'Recommend Selected Contractor to Approver'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                      No commercial quotations submitted by contractors yet. When contractors submit quotes, they will appear here for Works Engineer evaluation and Approver award.
                    </div>
                  )}
                </div>
              )}

              {/* Contractor Commercial Quotation Card (For Contractor View Only) */}
              {role === 'CONTRACTOR' && !workOrder.assigned_to && ['reported', 'approved'].includes(status) && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Contractor Commercial Quotation
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Submit your official itemized quote and proposed turnaround time for this work order.
                      </p>
                    </div>
                    {mySubmittedQuote ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                          ✓ Your Quote Submitted ({formatCurrency(mySubmittedQuote.amount)})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setContractorQuoteAmountInput(mySubmittedQuote.amount ? mySubmittedQuote.amount : '');
                            setContractorQuoteRefInput(mySubmittedQuote.quote_ref || '');
                            setContractorQuoteNotesInput(mySubmittedQuote.notes || '');
                            setContractorQuoteError(null);
                            setIsSubmitQuotationModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer"
                        >
                          Edit Quote
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setContractorQuoteAmountInput('');
                          setContractorQuoteRefInput('');
                          setContractorQuoteNotesInput('');
                          setContractorQuoteError(null);
                          setIsSubmitQuotationModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                      >
                        + Submit Formal Quote &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Engineering Assessor Scope & Automated Funding Split Card */}
              {hasPaymentScope && (
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Engineering Assessment &amp; Scope Estimation
                      </h2>
                      {isReferredToEngineer ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 uppercase">
                          Awaiting Engineer Scoping
                        </span>
                      ) : workOrder.assessment_type && workOrder.assessor_estimate !== null && workOrder.assessor_estimate !== undefined ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                          Completed ({workOrder.assessment_type})
                        </span>
                      ) : urgency === 'Critical 0–24h' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-300 uppercase">
                          Bypassed (Critical Emergency SLA)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Assessment Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Assessor evaluation of repair scope, charge code, and automated R50,000 threshold routing
                    </p>
                  </div>

                  {canAssess && (
                    <button
                      type="button"
                      onClick={openAssessmentModal}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-all shadow-xs hover:shadow active:scale-95 cursor-pointer shrink-0"
                    >
                      {!isAssessmentDone
                        ? 'Record Assessment'
                        : isWorksEngineer && (workOrder.assessor_estimate === null || workOrder.assessor_estimate === undefined)
                        ? 'Complete Engineer Scoping'
                        : isWorksInspector && isReferredToEngineer
                        ? 'Update Referral Notes'
                        : 'Edit Assessment'} &rarr;
                    </button>
                  )}
                </div>

                {/* Blind Quoting Notice for Contractors */}
                {isContractor ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <div className="font-semibold text-slate-800">
                      Blind Quoting Governance Active
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      In accordance with procurement compliance rules, the engineering assessor&apos;s preliminary cost estimate and internal assessment notes are strictly confidential to ensure independent contractor quoting.
                    </p>
                    {workOrder.charge_code && (
                      <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                        <span className="text-slate-500">Service Charge Code:</span>
                        <span className="font-mono font-bold text-slate-800">{workOrder.charge_code}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {workOrder.assessment_type ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Assessment Mode</div>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 capitalize">
                              {workOrder.assessment_type === 'offsite' ? 'Offsite (Evidence Photos)' : 'Onsite (Site Visit)'}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Charge Code</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="font-mono font-bold text-slate-900 text-xs">{workOrder.charge_code || 'PRE'}</span>
                              <span className="text-[10px] text-slate-500 truncate">
                                {workOrder.charge_code === 'PRE' && '(Preliminary)'}
                                {workOrder.charge_code === 'ONS' && '(Onsite)'}
                                {workOrder.charge_code === 'TRV' && '(Travel)'}
                                {workOrder.charge_code === 'EVI' && '(Evidence/Photos)'}
                                {workOrder.charge_code === 'FIN' && '(Final)'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Assessor Estimate</div>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                              {workOrder.assessor_estimate !== null && workOrder.assessor_estimate !== undefined
                                ? formatCurrency(workOrder.assessor_estimate)
                                : <span className="text-amber-700 font-sans font-medium text-[11px]">Pending Engineer Scoping</span>}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Turnaround Days</div>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                              {workOrder.estimated_days
                                ? `${workOrder.estimated_days} Days`
                                : workOrder.due_date
                                ? `${Math.max(1, Math.ceil((new Date(workOrder.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days`
                                : 'Not Specified'}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Funding Model</div>
                            <div className="mt-0.5">
                              {workOrder.funding_route === 'route_b' || urgency === 'Critical 0–24h' ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">
                                  Advance Float Funded
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                  Client Gateway (NC DOH)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Referral Notice if referred by Inspector */}
                        {isReferredToEngineer && (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                            <div className="font-bold flex items-center justify-between">
                              <span>Awaiting Works Engineer Technical Scoping</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 uppercase font-semibold">
                                Referred by Inspector
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              Technical scoping and repair cost calculation has been escalated to the Works Engineer.
                            </p>
                          </div>
                        )}

                        {/* Assessor Details & Notes */}
                        {(workOrder.assessor_name || workOrder.assessment_notes || workOrder.assessment_date) && (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2">
                            {workOrder.assessor_name && (
                              <div className="flex justify-between items-center text-gray-600">
                                <span className="flex items-center gap-2">
                                  <span>Assessed By: <strong className="text-gray-900">{workOrder.assessor_name}</strong></span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                                    {workOrder.assessor_role === 'works_inspector' ? 'Works Inspector' : 'Works Engineer'}
                                  </span>
                                </span>
                                {workOrder.assessment_date && (
                                  <span className="text-gray-500 font-mono">{formatDate(workOrder.assessment_date)}</span>
                                )}
                              </div>
                            )}
                            {workOrder.assessment_notes && (
                              <div className="pt-2 border-t border-gray-200">
                                <span className="font-semibold text-gray-800">Assessor Technical Notes:</span>
                                <p className="text-gray-700 mt-1 whitespace-pre-line leading-relaxed">
                                  {workOrder.assessment_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Estimate PDF download in Assessment Card */}
                        {(workOrder.assessor_estimate !== null && workOrder.assessor_estimate !== undefined || isAssessmentDone) && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadEstimatePdf({
                                    estimate_number: `EST-${new Date().getFullYear()}-${workOrder.tracking_number?.replace(/\D/g, '').slice(-4) || '1001'}`,
                                    estimate_date: workOrder.assessment_date || workOrder.created_at,
                                    work_order_tracking: workOrder.tracking_number,
                                    work_order_title: workOrder.title,
                                    customer_name: 'Northern Cape Department of Health',
                                    facility_name: workOrder.facility_name,
                                    facility_address: 'Northern Cape Provincial Campus',
                                    estimate_by_name: workOrder.assessor_name || workOrder.lead_assessor_name || 'David Vance (Site Works Assessor)',
                                    estimate_by_role: workOrder.assessor_role === 'works_engineer' ? 'Works Engineer (HVAC Specialist)' : 'Works Inspector (Quality Officer)',
                                    estimate_by_charge_code: workOrder.charge_code || 'ONS',
                                    subtotal: Number(workOrder.assessor_estimate || workOrder.estimated_cost || 0),
                                    comments: workOrder.assessment_notes || `Technical assessment and scope estimation for ${workOrder.tracking_number} (${workOrder.title}). All works to adhere to SANS healthcare engineering standards.`
                                  })
                                }
                                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-800 border border-sky-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Estimate Form (PDF)
                              </button>
                            )}
                      </div>
                    ) : urgency === 'Critical 0–24h' ? (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-left space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">Emergency SLA Fast-Track Active</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                            Advance Float Direct Dispatch
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Under the NC DOH SLA framework, Critical 0–24h work orders bypass preliminary offsite/onsite engineering assessment and client quoting gateway to enable immediate specialist contractor mobilization from the advance float.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                        <p className="text-xs text-gray-600">
                          {isWorksEngineer
                            ? 'No engineering scoping assigned to Works Engineer yet. The Site Inspector conducts the preliminary review and will escalate if complex scoping is required.'
                            : <>No formal engineering assessment has been recorded for this ticket yet. Click <strong className="text-slate-800">&quot;Record Assessment &rarr;&quot;</strong> to evaluate scope, charge code, and cost threshold.</>}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}


              {/* Client Quotation Approval Lifecycle Card */}
              {!isRouteB && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                          Client Quotation Approval Lifecycle
                        </h2>
                        {workOrder.quote_status && QUOTE_STATUS_CONFIG[workOrder.quote_status] ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${QUOTE_STATUS_CONFIG[workOrder.quote_status].bg} ${QUOTE_STATUS_CONFIG[workOrder.quote_status].text} ${QUOTE_STATUS_CONFIG[workOrder.quote_status].border}`}
                          >
                            {workOrder.quote_status.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Quote Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Two-tier quotation governance: Contractor Quotation &rarr; Quantum Built Review &rarr; NC DOH Client Sign-off
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {workOrder.estimated_cost && Number(workOrder.estimated_cost) > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadQuotePdf({
                              quote_number: `QTE-${new Date().getFullYear()}-${workOrder.tracking_number?.replace(/\D/g, '').slice(-4) || '1001'}`,
                              issued_date: workOrder.assessment_date || workOrder.created_at,
                              work_order_tracking: workOrder.tracking_number,
                              work_order_title: workOrder.title,
                              client_name: workOrder.reported_by_name || 'Muzikayise Nkosi',
                              facility_name: workOrder.facility_name,
                              contractor_name: workOrder.assigned_to_name || 'Apex BioMed Solutions',
                              quote_amount: Number(workOrder.estimated_cost || 0),
                              quote_notes: workOrder.assessment_notes || workOrder.description
                            })
                          }
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-700 border border-sky-200 text-xs font-semibold rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Formal Quote (PDF)
                        </button>
                      )}

                      {status === 'approved' && role === 'CONTRACTOR' && (
                        <button
                          type="button"
                          onClick={openQuoteModal}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          {workOrder.estimated_cost ? 'Update Price Quote' : 'Submit Price Quote'} &rarr;
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3-Step Live Pipeline */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* Step 1: Contractor Quote */}
                    <div
                      className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                        workOrder.estimated_cost && workOrder.estimated_cost > 0
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-gray-50/50 border-gray-200 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">1. Contractor Quote</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            workOrder.estimated_cost && workOrder.estimated_cost > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {workOrder.estimated_cost && workOrder.estimated_cost > 0 ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 font-mono">
                        {isContractor && status === 'approved'
                          ? workOrder.estimated_cost
                            ? formatCurrency(workOrder.estimated_cost)
                            : 'Quote Required'
                          : workOrder.estimated_cost
                          ? formatCurrency(workOrder.estimated_cost)
                          : 'R 0.00'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Ref: {workOrder.contractor_quote_ref || 'Standard SLA'}
                      </div>
                    </div>

                    {/* Step 2: Quantum Built Review */}
                    <div
                      className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                        ['awaiting_client', 'client_approved', 'client_declined'].includes(workOrder.quote_status || '')
                          ? 'bg-slate-50 border-slate-300'
                          : workOrder.quote_status === 'under_review'
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-gray-50/50 border-gray-200 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">2. QB Verification</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ['awaiting_client', 'client_approved'].includes(workOrder.quote_status || '')
                              ? 'bg-emerald-100 text-emerald-800'
                              : workOrder.quote_status === 'under_review'
                              ? 'bg-amber-100 text-amber-800'
                              : workOrder.quote_status === 'client_declined'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {['awaiting_client', 'client_approved'].includes(workOrder.quote_status || '')
                            ? 'Approved'
                            : workOrder.quote_status === 'under_review'
                            ? 'Reviewing'
                            : workOrder.quote_status === 'client_declined'
                            ? 'Returned'
                            : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-800">
                        {['awaiting_client', 'client_approved'].includes(workOrder.quote_status || '')
                          ? 'Submitted to Client'
                          : workOrder.quote_status === 'under_review'
                          ? 'Audit in progress'
                          : workOrder.quote_status === 'client_declined'
                          ? 'Needs Renegotiation'
                          : 'Awaiting Quote'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Rate table & scope verified
                      </div>
                    </div>

                    {/* Step 3: NC DOH Approval Gateway */}
                    <div
                      className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                        workOrder.quote_status === 'client_approved'
                          ? 'bg-emerald-50/50 border-emerald-300'
                          : workOrder.quote_status === 'client_declined'
                          ? 'bg-rose-50/50 border-rose-300'
                          : workOrder.quote_status === 'awaiting_client'
                          ? 'bg-sky-50/50 border-sky-300'
                          : 'bg-gray-50/50 border-gray-200 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">3. NC DOH Sign-off</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            workOrder.quote_status === 'client_approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : workOrder.quote_status === 'client_declined'
                              ? 'bg-rose-100 text-rose-800'
                              : workOrder.quote_status === 'awaiting_client'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {workOrder.quote_status === 'client_approved'
                            ? 'Signed Off'
                            : workOrder.quote_status === 'client_declined'
                            ? 'Declined'
                            : workOrder.quote_status === 'awaiting_client'
                            ? 'In Review'
                            : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {workOrder.quote_status === 'client_approved'
                          ? 'Client Approved'
                          : workOrder.quote_status === 'client_declined'
                          ? 'Decline Recorded'
                          : workOrder.quote_status === 'awaiting_client'
                          ? 'Awaiting Decision'
                          : 'Pending Gateway'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {workOrder.client_approved_by
                          ? `By ${workOrder.client_approved_by}`
                          : 'Official Gateway Authorizer'}
                      </div>
                    </div>
                  </div>

                  {/* Decline Reason Banner if present */}
                  {workOrder.quote_status === 'client_declined' && workOrder.client_decline_reason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      <span className="font-semibold">NC DOH Decline Feedback:</span>{' '}
                      {workOrder.client_decline_reason}
                    </div>
                  )}

                  {/* Client Approval Timestamp Card */}
                  {workOrder.quote_status === 'client_approved' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex justify-between items-center">
                      <div>
                        <span className="font-bold">Client Gateway Sign-off Completed</span>
                        {workOrder.client_approved_by && (
                          <span className="text-emerald-700 ml-1">by {workOrder.client_approved_by}</span>
                        )}
                      </div>
                      {workOrder.client_approved_at && (
                        <span className="font-mono text-[11px] text-emerald-700">
                          {formatDate(workOrder.client_approved_at)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Critical Emergency Job: Contractor Post-Completion Quote & Works Engineer Review Card */}
              {isCriticalJob && ['completed', 'verified', 'closed'].includes(status) && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                          Critical Job Contractor Quote &amp; Scoping
                        </h2>
                        {workOrder.contractor_critical_quote_status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Quote Approved &bull; Auto-Invoiced
                          </span>
                        ) : workOrder.contractor_critical_quote_status === 'adjusted' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Quote Adjusted by Engineer
                          </span>
                        ) : workOrder.contractor_critical_quote_status === 'submitted' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                            Quote Submitted &bull; Awaiting Engineer Review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            Pending Contractor Quote
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Post-completion emergency cost claim, maintenance breakdown, and Works Engineer validation.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {canProvideCriticalQuote && (
                        <button
                          type="button"
                          onClick={openCriticalQuoteModal}
                          className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          {workOrder.contractor_critical_quote_status ? 'Edit Quote' : 'Provide Quote / Cost Breakdown'}
                        </button>
                      )}
                    </div>
                  </div>

                  {workOrder.contractor_critical_quote_cost ? (
                    <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-purple-100">
                          <span className="text-[10px] font-semibold text-slate-500 block uppercase">Quoted / Claimed Amount</span>
                          <span className="text-base font-bold font-mono text-purple-900">
                            {formatCurrency(workOrder.contractor_critical_quote_cost)}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-purple-100">
                          <span className="text-[10px] font-semibold text-slate-500 block uppercase">Submitted At</span>
                          <span className="text-xs font-semibold text-slate-800">
                            {workOrder.contractor_critical_quote_submitted_at ? formatDate(workOrder.contractor_critical_quote_submitted_at) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-purple-100">
                          <span className="text-[10px] font-semibold text-slate-500 block uppercase">Engineer Review Status</span>
                          <span className="text-xs font-bold text-slate-800 capitalize">
                            {workOrder.contractor_critical_quote_status || 'Pending'}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-purple-100">
                          <span className="text-[10px] font-semibold text-slate-500 block uppercase">Approved By</span>
                          <span className="text-xs font-semibold text-slate-800">
                            {workOrder.contractor_critical_quote_approved_by ? `${workOrder.contractor_critical_quote_approved_by}` : 'Pending Sign-off'}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown Categories & Description */}
                      {(() => {
                        let cats: string[] = [];
                        let notes = '';
                        if (workOrder.contractor_critical_quote_breakdown) {
                          try {
                            const parsed = JSON.parse(workOrder.contractor_critical_quote_breakdown);
                            if (parsed.categories) cats = parsed.categories;
                            if (parsed.notes) notes = parsed.notes;
                          } catch (_) {
                            notes = workOrder.contractor_critical_quote_breakdown;
                          }
                        }
                        return (
                          <div className="space-y-2 pt-1">
                            {cats.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-600 mr-1">Work Classification:</span>
                                {cats.map((c) => (
                                  <span key={c} className="px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-full font-bold text-[11px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                            {notes && (
                              <div className="bg-white p-3 rounded-lg border border-purple-100">
                                <span className="font-semibold text-slate-700 block mb-0.5">Scope &amp; Component Replacement Details:</span>
                                <p className="text-slate-800 whitespace-pre-wrap">{notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Engineer Notes if any */}
                      {workOrder.contractor_critical_quote_engineer_notes && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                          <span className="font-bold block mb-0.5">Works Engineer Notes:</span>
                          <p>{workOrder.contractor_critical_quote_engineer_notes}</p>
                        </div>
                      )}

                      {/* Engineer Review Actions inside Card */}
                      {canReviewCriticalQuote && (
                        <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between flex-wrap gap-2">
                          <div className="text-slate-600 font-medium">
                            Action Required: Verify technical scope and approve or adjust emergency claim amount.
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={openAdjustCriticalQuoteModal}
                              disabled={reviewCriticalQuoteMutation.isPending}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              Adjust Quote
                            </button>
                            <button
                              type="button"
                              onClick={() => reviewCriticalQuoteMutation.mutate({ action: 'approve' })}
                              disabled={reviewCriticalQuoteMutation.isPending}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              {reviewCriticalQuoteMutation.isPending ? 'Approving...' : 'Approve & Auto-Invoice'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 py-6 space-y-2">
                      <p>Work is completed. The assigned contractor can now provide the itemized quote &amp; cost breakdown for Works Engineer verification.</p>
                      {canProvideCriticalQuote && (
                        <button
                          type="button"
                          onClick={openCriticalQuoteModal}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                        >
                          Provide Quote / Cost Breakdown
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3-Way Statutory Completion Sign-off Card (PDF Page 5) */}
              {['completed', 'verified', 'closed'].includes(status) && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                          3-Way Statutory Completion Sign-off
                        </h2>
                        {isTriSignoffComplete ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                            Tri-Signature Certified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Signatures Required ({[workOrder.signoff_engineer_by, workOrder.signoff_fm_by, workOrder.signoff_inspector_by].filter(Boolean).length}/3)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Mandatory sequential 3-way verification: 1. Works Inspector (Compliance &amp; QC) &rarr; 2. Works Engineer (Technical) &rarr; 3. Facilities Manager (Site Acceptance)
                      </p>
                    </div>

                    {isTriSignoffComplete && hasPaymentScope && (
                      <button
                        type="button"
                        onClick={() => downloadCompletionCertificatePdf(workOrder)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        Download Completion Certificate (PDF)
                      </button>
                    )}
                  </div>

                  {/* Tri-Signature 3-Column Grid: 1. Works Inspector -> 2. Works Engineer -> 3. Facilities Manager */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Step 1: Works Inspector */}
                    <div className={`p-4 rounded-lg border text-xs space-y-2.5 ${workOrder.signoff_inspector_by ? 'bg-slate-50 border-slate-300' : 'bg-gray-50/70 border-gray-200'}`}>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200/80">
                        <span className="font-bold text-slate-900 text-xs">1. Works Inspector</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${workOrder.signoff_inspector_by ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {workOrder.signoff_inspector_by ? 'QC Verified' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        Statutory compliance, safety checklist, and QC audit.
                      </div>
                      {workOrder.signoff_inspector_by ? (
                        <div className="pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-800 space-y-1.5">
                          <div>Signed by: <strong>{workOrder.signoff_inspector_by}</strong></div>
                          {workOrder.signoff_inspector_at && (
                            <div className="text-[10px] text-slate-500">{formatDate(workOrder.signoff_inspector_at)}</div>
                          )}
                          <div className="text-[11px] text-teal-800 font-sans font-semibold pt-0.5 flex items-center justify-between">
                            <span>Logged QC Time:</span>
                            <span className="px-1.5 py-0.5 bg-teal-50 border border-teal-200 rounded font-mono text-teal-900">
                              {workOrder.inspector_timesheet_hours ? `${Number(workOrder.inspector_timesheet_hours).toFixed(1)} hrs` : 'Logged'}
                            </span>
                          </div>
                          {canViewInspectorTimesheet && (
                            <button
                              type="button"
                              onClick={() => {
                                let entries: any[] = [];
                                try {
                                  if (workOrder.inspector_timesheet_data) entries = JSON.parse(workOrder.inspector_timesheet_data);
                                } catch (_) {}
                                downloadTimesheetPdf({
                                  employee_name: workOrder.inspector_timesheet_by || workOrder.signoff_inspector_by || 'Works Inspector',
                                  employee_role: 'Works Inspector (Compliance & QC Audit)',
                                  week_start: workOrder.inspector_timesheet_at ? formatDate(workOrder.inspector_timesheet_at) : formatDate(workOrder.created_at),
                                  work_order_tracking: workOrder.tracking_number,
                                  work_order_title: workOrder.title,
                                  facility_name: workOrder.facility_name,
                                  entries: entries,
                                  total_hours: workOrder.inspector_timesheet_hours || '0.0',
                                  signature_name: workOrder.inspector_timesheet_by || workOrder.signoff_inspector_by || 'Works Inspector',
                                  signature_date: workOrder.signoff_inspector_at ? formatDate(workOrder.signoff_inspector_at) : new Date().toLocaleDateString('en-GB')
                                });
                              }}
                              className="mt-2 w-full py-1.5 px-2 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                            >
                              Print Inspector Timesheet (PDF)
                            </button>
                          )}
                        </div>
                      ) : canSignInspector ? (
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              let initialWeekStart = new Date().toISOString().split('T')[0];
                              let initialDays = defaultTimesheetWeek.map((d, i) => {
                                const dt = new Date();
                                dt.setDate(dt.getDate() + i);
                                return { ...d, date: dt.toISOString().split('T')[0] };
                              });

                              if (workOrder.inspector_timesheet_data) {
                                try {
                                  const parsed = JSON.parse(workOrder.inspector_timesheet_data);
                                  if (Array.isArray(parsed) && parsed.length > 0) {
                                    initialDays = parsed;
                                    if (parsed[0]?.date) initialWeekStart = parsed[0].date;
                                  }
                                } catch (_) {}
                              } else {
                                initialDays[0].hours = '3.5';
                              }

                              setInspectorWeekStart(initialWeekStart);
                              setInspectorDays(initialDays);
                              setInspectorSignoffError(null);
                              setIsInspectorSignoffModalOpen(true);
                            }}
                            disabled={signoffMutation.isPending}
                            className="flex-1 py-1.5 px-2 bg-[#2B7A9B] hover:bg-[#1E5D88] active:bg-[#164464] text-white text-[11px] font-bold rounded-lg shadow-2xs active:scale-95 transition-all cursor-pointer text-center whitespace-nowrap"
                          >
                            Sign Off &amp; Timesheet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSignoffRejectionReasonInput('');
                              setSignoffError(null);
                              setIsSignoffRejectModalOpen(true);
                            }}
                            disabled={signoffMutation.isPending}
                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer text-center whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">Awaiting Works Inspector</div>
                      )}
                    </div>

                    {/* Step 2: Works Engineer */}
                    <div className={`p-4 rounded-lg border text-xs space-y-2.5 ${workOrder.signoff_engineer_by ? 'bg-slate-50 border-slate-300' : 'bg-gray-50/70 border-gray-200'}`}>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200/80">
                        <span className="font-bold text-slate-900 text-xs">2. Works Engineer</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${workOrder.signoff_engineer_by ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {workOrder.signoff_engineer_by ? 'Certified' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        Technical execution &amp; component standards sign-off.
                      </div>
                      {workOrder.signoff_engineer_by ? (
                        <div className="pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-800 space-y-1.5">
                          <div>Signed by: <strong>{workOrder.signoff_engineer_by}</strong></div>
                          {workOrder.signoff_engineer_at && (
                            <div className="text-[10px] text-slate-500">{formatDate(workOrder.signoff_engineer_at)}</div>
                          )}
                          <div className="text-[11px] text-sky-800 font-sans font-semibold pt-0.5 flex items-center justify-between">
                            <span>Logged Tech Time:</span>
                            <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-200 rounded font-mono text-sky-900">
                              {workOrder.engineer_timesheet_hours ? `${Number(workOrder.engineer_timesheet_hours).toFixed(1)} hrs` : 'Logged'}
                            </span>
                          </div>
                          {canViewEngineerTimesheet && (
                            <button
                              type="button"
                              onClick={() => {
                                let entries: any[] = [];
                                try {
                                  if (workOrder.engineer_timesheet_data) entries = JSON.parse(workOrder.engineer_timesheet_data);
                                } catch (_) {}
                                downloadTimesheetPdf({
                                  employee_name: workOrder.engineer_timesheet_by || workOrder.signoff_engineer_by || 'Works Engineer',
                                  employee_role: 'Works Engineer (Technical & Scoping)',
                                  week_start: workOrder.engineer_timesheet_at ? formatDate(workOrder.engineer_timesheet_at) : formatDate(workOrder.created_at),
                                  work_order_tracking: workOrder.tracking_number,
                                  work_order_title: workOrder.title,
                                  facility_name: workOrder.facility_name,
                                  entries: entries,
                                  total_hours: workOrder.engineer_timesheet_hours || '0.0',
                                  signature_name: workOrder.engineer_timesheet_by || workOrder.signoff_engineer_by || 'Works Engineer',
                                  signature_date: workOrder.signoff_engineer_at ? formatDate(workOrder.signoff_engineer_at) : new Date().toLocaleDateString('en-GB')
                                });
                              }}
                              className="mt-2 w-full py-1.5 px-2 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                            >
                              Print Engineer Timesheet (PDF)
                            </button>
                          )}
                        </div>
                      ) : !workOrder.signoff_inspector_by ? (
                        <div className="pt-2 text-[11px] text-amber-700 font-medium bg-amber-50/80 p-2 rounded border border-amber-200">
                          Awaiting Step 1: Works Inspector Sign-off first
                        </div>
                      ) : canSignEngineer ? (
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              let initialWeekStart = new Date().toISOString().split('T')[0];
                              let initialDays = defaultTimesheetWeek.map((d, i) => {
                                const dt = new Date();
                                dt.setDate(dt.getDate() + i);
                                return { ...d, date: dt.toISOString().split('T')[0] };
                              });

                              if (workOrder.engineer_timesheet_data) {
                                try {
                                  const parsed = JSON.parse(workOrder.engineer_timesheet_data);
                                  if (Array.isArray(parsed) && parsed.length > 0) {
                                    initialDays = parsed;
                                    if (parsed[0]?.date) initialWeekStart = parsed[0].date;
                                  }
                                } catch (_) {}
                              } else {
                                initialDays[0].hours = '4.0';
                              }

                              setEngineerWeekStart(initialWeekStart);
                              setEngineerDays(initialDays);
                              setEngineerSignoffError(null);
                              setIsEngineerSignoffModalOpen(true);
                            }}
                            disabled={signoffMutation.isPending}
                            className="flex-1 py-1.5 px-2 bg-[#2B7A9B] hover:bg-[#1E5D88] active:bg-[#164464] text-white text-[11px] font-bold rounded-lg shadow-2xs active:scale-95 transition-all cursor-pointer text-center whitespace-nowrap"
                          >
                            Sign Off &amp; Timesheet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSignoffRejectionReasonInput('');
                              setSignoffError(null);
                              setIsSignoffRejectModalOpen(true);
                            }}
                            disabled={signoffMutation.isPending}
                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer text-center whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">Awaiting Works Engineer</div>
                      )}
                    </div>

                    {/* Step 3: Facilities Manager */}
                    <div className={`p-4 rounded-lg border text-xs space-y-2.5 ${workOrder.signoff_fm_by ? 'bg-slate-50 border-slate-300' : 'bg-gray-50/70 border-gray-200'}`}>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200/80">
                        <span className="font-bold text-slate-900 text-xs">3. Facilities Manager</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${workOrder.signoff_fm_by ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {workOrder.signoff_fm_by ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        Hospital facility physical handover &amp; site acceptance.
                      </div>
                      {workOrder.signoff_fm_by ? (
                        <div className="pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-800">
                          <div>Signed by: <strong>{workOrder.signoff_fm_by}</strong></div>
                          {workOrder.signoff_fm_at && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{formatDate(workOrder.signoff_fm_at)}</div>
                          )}
                        </div>
                      ) : !workOrder.signoff_engineer_by ? (
                        <div className="pt-2 text-[11px] text-amber-700 font-medium bg-amber-50/80 p-2 rounded border border-amber-200">
                          Awaiting Step 2: Works Engineer Sign-off first
                        </div>
                      ) : canSignFm ? (
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => signoffMutation.mutate({ roleType: 'fm', action: 'sign' })}
                            disabled={signoffMutation.isPending}
                            className="flex-1 py-1.5 px-2 bg-[#2B7A9B] hover:bg-[#1E5D88] active:bg-[#164464] text-white text-[11px] font-bold rounded-lg shadow-2xs active:scale-95 transition-all cursor-pointer text-center whitespace-nowrap"
                          >
                            Sign Off
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSignoffRejectionReasonInput('');
                              setSignoffError(null);
                              setIsSignoffRejectModalOpen(true);
                            }}
                            disabled={signoffMutation.isPending}
                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer text-center whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">Awaiting Facilities Manager</div>
                      )}
                    </div>
                  </div>

                  {/* Rejection Reason Notice */}
                  {workOrder.signoff_rejection_reason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      <span className="font-semibold">Previous Rectification Notice:</span>{' '}
                      {workOrder.signoff_rejection_reason}
                    </div>
                  )}

                  {/* Tier 2 Client Recovery Invoicing Section (Admin & Payment Approver Only) */}
                  {isTriSignoffComplete && hasPaymentScope && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-emerald-950">
                            Tier 2: NC DOH Client Recovery Invoicing Stream
                          </div>
                          <div className="text-emerald-800 text-[11px] mt-0.5">
                            Certificate #{workOrder.completion_cert_no || 'CERT-ACTIVE'} &bull; Base Claim: {formatCurrency(workOrder.actual_cost || workOrder.estimated_cost || 0)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {workOrder.client_recovery_status === 'submitted' ? (
                            <span className="px-2.5 py-1 rounded bg-emerald-200 text-emerald-900 font-mono font-bold text-xs">
                              Recovery Invoice: {workOrder.client_recovery_invoice_no || 'REC-SUBMITTED'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => clientRecoveryMutation.mutate()}
                              disabled={clientRecoveryMutation.isPending}
                              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                              {clientRecoveryMutation.isPending ? 'Generating...' : 'Generate & Submit NC DOH Recovery Invoice'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                  Issue Description
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {workOrder.description}
                </p>

                {workOrder.location_details && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">Location Specifics:</span>{' '}
                    {workOrder.location_details}
                  </div>
                )}
              </div>

              {/* Photos & Documents Evidence Gallery */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Attached Evidence &amp; Documents ({workOrder.photos?.length || 0})
                  </h2>
                  <button
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium cursor-pointer"
                  >
                    + Upload Photo / Doc
                  </button>
                </div>

                {!workOrder.photos || workOrder.photos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded">
                    No inspection photos or evidence documents attached to this ticket yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {workOrder.photos.map((photo) => {
                      const photoUrl = photo.photo_url.startsWith('http')
                        ? photo.photo_url
                        : `${API_SERVER_URL}${photo.photo_url.startsWith('/') ? '' : '/'}${photo.photo_url}`;

                      const isPdf =
                        photo.photo_url.toLowerCase().endsWith('.pdf') ||
                        (photo.caption && photo.caption.toLowerCase().includes('.pdf'));

                      const isDoc =
                        photo.photo_url.toLowerCase().endsWith('.doc') ||
                        photo.photo_url.toLowerCase().endsWith('.docx') ||
                        (photo.caption &&
                          (photo.caption.toLowerCase().includes('.doc') ||
                            photo.caption.toLowerCase().includes('.docx')));

                      return (
                        <a
                          key={photo.id}
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 text-xs block group hover:shadow-md hover:border-slate-300 transition"
                          title={`Click to view / download ${isPdf ? 'PDF Document' : isDoc ? 'Document' : 'Evidence Image'}`}
                        >
                          <div className="h-36 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                            {isPdf ? (
                              <div className="w-full h-full bg-gradient-to-br from-rose-50 via-red-50 to-rose-100/60 flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-200">
                                <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 mb-2">
                                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v6a1 1 0 001 1h6" />
                                  </svg>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200/80 text-rose-900 uppercase tracking-wider">
                                  PDF Document
                                </span>
                              </div>
                            ) : isDoc ? (
                              <div className="w-full h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100/60 flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-200">
                                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 mb-2">
                                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/80 text-blue-900 uppercase tracking-wider">
                                  Word Document
                                </span>
                              </div>
                            ) : (
                              <img
                                src={photoUrl}
                                alt={photo.caption || 'Work order photo'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="p-2 rounded-full bg-white/95 text-slate-800 shadow-md">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white border-t border-slate-100">
                            <div className="font-semibold text-slate-800 truncate" title={photo.caption || 'Attachment'}>
                              {photo.caption || 'Photo attachment'}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase mt-1 font-mono">
                              <span>Stage: {photo.stage}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  isPdf
                                    ? 'bg-rose-100 text-rose-800'
                                    : isDoc
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isPdf ? 'PDF' : isDoc ? 'DOC' : 'IMG'}
                              </span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Metadata */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Facility Details
                </h2>
                <div>
                  <div className="text-xs text-gray-500">Hospital Facility</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {workOrder.facility_name || 'N/A'}
                  </div>
                  <div className="text-xs font-mono text-sky-700">
                    {workOrder.facility_code}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-xs text-gray-700">
                    {workOrder.facility_address ? `${workOrder.facility_address}, ${workOrder.facility_city}` : 'Main Campus'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="text-xs font-medium text-gray-800">
                    {workOrder.category}
                  </div>
                </div>
              </div>

              {hasPaymentScope && (
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Financials & Schedule
                  </h2>
                  <div className="py-1 border-b border-gray-100 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Approved Budget</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{formatCurrency(workOrder.estimated_cost)}</span>
                        {(user?.role === 'APPROVER' || user?.role === 'ADMIN') && !isEditingBudget && (
                          <button
                            onClick={() => {
                              setBudgetInput(workOrder.estimated_cost || '');
                              setIsEditingBudget(true);
                            }}
                            className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold underline ml-1"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Budget Editor */}
                    {isEditingBudget && (
                      <div className="mt-2 p-2.5 bg-sky-50/70 rounded-lg border border-sky-200 space-y-2">
                        <div className="text-[11px] font-semibold text-sky-900">Update Approved Budget (R)</div>
                        <input
                          type="number"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 1850"
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditingBudget(false)}
                            className="px-2 py-1 text-[10px] text-gray-600 hover:text-gray-800 font-medium bg-white border border-gray-300 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={budgetInput === '' || updateBudgetMutation.isPending}
                            onClick={() => {
                              if (budgetInput !== '') updateBudgetMutation.mutate(Number(budgetInput));
                            }}
                            className="px-2.5 py-1 text-[10px] text-white bg-sky-600 hover:bg-sky-700 font-medium rounded transition disabled:opacity-50"
                          >
                            {updateBudgetMutation.isPending ? 'Saving...' : 'Save Budget'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Urgency SLA</span>
                    <span className="font-semibold text-gray-900">{urgency}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Funding Model</span>
                    <span className={`font-bold ${isRouteB ? 'text-purple-700' : 'text-slate-800'}`}>
                      {isRouteB ? 'Advance Float Funded' : 'Client Funded (NC DOH)'}
                    </span>
                  </div>
                  {isStatutory && (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                      <span className="text-gray-500">Statutory Notice</span>
                      <span className="font-semibold text-sky-700">30d &amp; 15d Active</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Actual Cost</span>
                    <span className="font-semibold text-gray-900">
                      {workOrder.actual_cost ? formatCurrency(workOrder.actual_cost) : formatCurrency(workOrder.estimated_cost)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Target Due Date</span>
                    <span className="font-semibold text-gray-900">{workOrder.due_date ? formatDate(workOrder.due_date) : 'Flexible'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">System Quote #</span>
                    <span className="font-mono font-bold text-sky-700">
                      {workOrder.system_quote_no || `QT-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`}
                    </span>
                  </div>
                  {workOrder.contractor_quote_ref && (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                      <span className="text-gray-500">Contractor Ref #</span>
                      <span className="font-mono font-bold text-slate-800">{workOrder.contractor_quote_ref}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-gray-100 text-xs">
                    <span className="text-gray-500">Assigned Contractor</span>
                    <span className="font-semibold text-gray-900">{workOrder.assigned_to_name || 'Unassigned'}</span>
                  </div>

                  {/* Invoice Status & Action in Sidebar */}
                  <div className="pt-2 border-t border-gray-100 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Billing & Invoice</span>
                      {workOrder.invoice_id ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            workOrder.invoice_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : workOrder.invoice_status === 'approved'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {workOrder.invoice_status}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Unbilled</span>
                      )}
                    </div>

                    {isRouteB && (
                      <div className="p-2 bg-purple-50/70 border border-purple-200 rounded text-[11px] text-purple-900">
                        <div className="font-bold uppercase tracking-wider text-[9px] text-purple-700">24h Float Settlement SLA Active</div>
                        <div className="text-[10px] text-purple-800 mt-0.5">
                          Advance float pool enables 24-hour contractor invoice disbursement upon job verification.
                        </div>
                      </div>
                    )}

                    {urgency === 'Critical 0–24h' && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
                        <div className="font-bold uppercase tracking-wider text-[9px] text-slate-800">5-Day Post-Dispatch Audit Window</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          Critical bypass SLA enables retrospective review within 5 business days of emergency dispatch.
                        </div>
                      </div>
                    )}

                    {workOrder.invoice_id ? (
                      <div className="space-y-1.5">
                        {canApproveOrPayInvoice && workOrder.status === 'closed' && workOrder.invoice_status === 'pending' && (
                          <>
                            <button
                              onClick={() => invoiceStatusMutation.mutate({ status: 'approved' })}
                              disabled={invoiceStatusMutation.isPending}
                              className="w-full py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold text-xs transition text-center shadow-2xs"
                            >
                              {invoiceStatusMutation.isPending ? 'Processing...' : 'Approve Invoice Claim'}
                            </button>
                            <button
                              onClick={() => {
                                const reason = window.prompt('Enter reason for rejecting invoice claim:');
                                if (reason) invoiceStatusMutation.mutate({ status: 'rejected', notes: reason });
                              }}
                              disabled={invoiceStatusMutation.isPending}
                              className="w-full py-1 px-3 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded font-medium text-xs transition text-center"
                            >
                              Reject Claim
                            </button>
                          </>
                        )}
                        {canApproveOrPayInvoice && workOrder.status === 'closed' && workOrder.invoice_status === 'approved' && (
                          <button
                            onClick={() => invoiceStatusMutation.mutate({ status: 'paid' })}
                            disabled={invoiceStatusMutation.isPending}
                            className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs transition text-center shadow-2xs"
                          >
                            {invoiceStatusMutation.isPending ? 'Settling...' : 'Pay & Settle Invoice'}
                          </button>
                        )}
                        {canViewInvoiceDetails && (
                          <Link
                            href="/invoices"
                            className="block p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-[11px] text-sky-700 font-semibold text-center"
                          >
                            View {workOrder.invoice_number} ({formatCurrency(workOrder.invoice_total_amount || workOrder.actual_cost || 0)}) &rarr;
                          </Link>
                        )}
                      </div>
                    ) : canGenerateInvoice && workOrder.status === 'completed' ? (
                      <button
                        disabled
                        className="w-full py-1.5 px-3 bg-slate-100 text-slate-400 border border-slate-200 rounded font-medium text-xs cursor-not-allowed select-none text-center"
                      >
                        Waiting for Verification
                      </button>
                    ) : canGenerateInvoice && ['verified', 'closed'].includes(workOrder.status) ? (
                      <button
                        onClick={openInvoiceModal}
                        className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs transition shadow-2xs text-center"
                      >
                        Create Invoice Claim
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: UNIFIED ACTIVITY & AUDIT HISTORY TIMELINE (Admin & Auditor Only) */}
        {activeTab === 'timeline' && canViewAuditVault && (
          <div className="space-y-6">
            {/* Header Summary Card */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Lifecycle Audit Trail &amp; Activity Log
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Complete chronological history of approvals, contractor actions, QC inspections, feedback loops, and financial settlements for Work Order #{workOrder.tracking_number}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                  {(workOrder.events?.length || auditChain?.events?.length || 0)} Total Events
                </span>
                {workOrder.inspections && workOrder.inspections.length > 0 && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-md border border-purple-200">
                    {workOrder.inspections.length} QC Inspection(s)
                  </span>
                )}
              </div>
            </div>

            {/* Inspections History Sub-Section (if any exist) */}
            {workOrder.inspections && workOrder.inspections.length > 0 && (
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Quality Control (QC) &amp; Safety Verification Records
                </h4>
                <div className="space-y-3">
                  {workOrder.inspections.map((insp) => (
                    <div
                      key={insp.id}
                      className={`p-4 rounded-lg border text-xs ${
                        insp.result === 'PASS'
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              insp.result === 'PASS'
                                ? 'bg-emerald-200 text-emerald-800'
                                : 'bg-rose-200 text-rose-800'
                            }`}
                          >
                            QC Result: {insp.result}
                          </span>
                          <span className="font-semibold text-gray-800">
                            Inspector: {insp.inspector_name || 'QC Officer'}
                          </span>
                        </div>
                        <span className="text-gray-500 font-mono text-[11px]">
                          {formatDate(insp.inspected_at)}
                        </span>
                      </div>

                      {insp.observations && (
                        <div className="mt-2.5">
                          <span className="font-semibold text-gray-700">Observations / Feedback:</span>
                          <p className="mt-0.5 text-gray-800 leading-relaxed whitespace-pre-line bg-white/70 p-2.5 rounded border border-black/5">
                            {insp.observations}
                          </p>
                        </div>
                      )}

                      {insp.recommendations && (
                        <div className="mt-2">
                          <span className="font-semibold text-gray-700">Recommended Action:</span>
                          <p className="mt-0.5 text-gray-700">{insp.recommendations}</p>
                        </div>
                      )}

                      {(() => {
                        let parsedChecklist: Record<string, boolean> | null = null;
                        if (insp.checklist_results) {
                          try {
                            parsedChecklist = typeof insp.checklist_results === 'string' ? JSON.parse(insp.checklist_results) : insp.checklist_results;
                          } catch {
                            parsedChecklist = null;
                          }
                        }
                        if (!parsedChecklist || Object.keys(parsedChecklist).length === 0) return null;
                        return (
                          <div className="mt-2.5 pt-2 border-t border-black/5 flex flex-wrap gap-2 text-[11px]">
                            <span className="font-medium text-gray-600">Verification Checklist:</span>
                            {Object.entries(parsedChecklist).map(([k, v]) => (
                              <span
                                key={k}
                                className={`px-2 py-0.5 rounded font-mono ${
                                  v ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {k.replace(/([A-Z])/g, ' $1').toLowerCase()}: {v ? '✓ Pass' : '✕ Fail'}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Event Timeline */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-5">
                Sequential Activity Audit Trail
              </h4>

              {(!workOrder.events || workOrder.events.length === 0) && (!auditChain?.events || auditChain.events.length === 0) ? (
                <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded">
                  No status transition events logged yet.
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-6">
                  {(workOrder.events || auditChain?.events || []).map((evt, idx) => {
                    const cfg = EVENT_CONFIG[evt.status] || {
                      title: evt.status.replace('_', ' ').toUpperCase(),
                      color: 'border-gray-400 text-gray-600',
                      badge: 'bg-gray-100 text-gray-700 border-gray-200'
                    };
                    const isRejection = evt.notes && (evt.notes.toLowerCase().includes('reject') || evt.notes.toLowerCase().includes('fail') || evt.notes.toLowerCase().includes('rectif'));

                    return (
                      <div key={evt.id || idx} className="relative group">
                        {/* Dot indicator */}
                        <div className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 bg-white ${
                          isRejection ? 'border-rose-500 bg-rose-50' : cfg.color.split(' ')[0]
                        }`} />

                        <div className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-lg border border-slate-200 transition-colors space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900">
                                {cfg.title}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.badge}`}>
                                {cfg.label || evt.status.replace(/_/g, ' ')}
                              </span>
                              {isRejection && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                                  Action Required
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                              {formatDate(evt.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Actor:</span>
                            <strong className="text-gray-900">{evt.actor_name || 'System / Authorized User'}</strong>
                            <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-mono uppercase">
                              {evt.actor_role || 'Staff'}
                            </span>
                          </div>

                          {evt.notes && (
                            <div className={`p-2.5 rounded text-xs border ${
                              isRejection
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-white border-gray-200 text-gray-700'
                            }`}>
                              <span className="font-semibold block mb-0.5 text-[11px] text-gray-500">
                                Audit / Transition Notes:
                              </span>
                              <p className="whitespace-pre-line leading-relaxed">{evt.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CRYPTOGRAPHIC SHA-256 AUDIT TRAIL (Admin & Auditor Only) */}
        {activeTab === 'audit' && canViewAuditVault && (
          <div className="space-y-6">
            {/* Integrity Status Card */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-800">
                    Cryptographic Integrity Verified: Zero Tampering Detected
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Every status change is sealed with a SHA-256 hash referencing the previous event. Total {auditChain?.chain_length} blocks in chain.
                </p>
              </div>
              <button
                onClick={() => refetchAuditChain()}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 transition-colors shrink-0"
              >
                Re-Verify Proof
              </button>
            </div>

            {/* Event Chain Timeline */}
            <div className="space-y-4">
              {auditChain?.events?.map((evt, idx) => {
                const isGenesis = evt.previous_hash === '0000000000000000000000000000000000000000000000000000000000000000';
                const badge = STATUS_BADGES[evt.status] || STATUS_BADGES.reported;

                return (
                  <div
                    key={evt.id}
                    className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3 relative"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center font-mono">
                          #{idx + 1}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {evt.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-600">
                          Actor: <strong className="text-gray-900">{evt.actor_name || 'System User'}</strong> ({evt.actor_role})
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatDate(evt.created_at)}
                      </span>
                    </div>

                    {evt.notes && (
                      <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-100">
                        {evt.notes}
                      </p>
                    )}

                    {/* Cryptographic Hashes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px] font-mono">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <div className="text-gray-400 uppercase text-[10px] font-semibold">
                          Current SHA-256 Hash:
                        </div>
                        <div className="flex items-center justify-between text-slate-800 mt-0.5">
                          <span className="truncate pr-2">{evt.current_hash}</span>
                          <button
                            onClick={() => copyToClipboard(evt.current_hash)}
                            className="text-sky-600 hover:text-sky-800 shrink-0 font-sans text-xs"
                          >
                            {copiedHash === evt.current_hash ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <div className="text-gray-400 uppercase text-[10px] font-semibold">
                          Previous Hash Pointer:
                        </div>
                        <div className="text-slate-600 truncate mt-0.5">
                          {isGenesis ? 'GENESIS ROOT (0000...)' : evt.previous_hash}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Transition Modal */}
        {isTransitionModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  {targetStatus === 'cancelled'
                    ? 'Cancel / Reject Work Order'
                    : targetStatus === 'approved'
                    ? 'Approve Work Order'
                    : targetStatus === 'closed'
                    ? 'Approve Work Order'
                    : `Transition Status → ${targetStatus?.replace('_', ' ')}`}
                </h3>
                <button
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {transitionError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {transitionError}
                </div>
              )}

              {/* When Work Approver Approves: Simple minimal scope confirmation */}
              {targetStatus === 'approved' && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-800 font-medium">
                  Approve this work order scope for contractor quotation.
                </div>
              )}

              {targetStatus === 'closed' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 font-medium">
                  Final sign-off and approval for completed & verified work order.
                </div>
              )}

              {targetStatus === 'assigned' && (
                <div className="space-y-3">
                  {/* For Route A or standard non-emergency jobs with existing estimate */}
                  {!isRouteB && (workOrder?.estimated_cost || 0) > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700">
                          Approved Budget (R) (Optional)
                        </label>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Quoted: {formatCurrency(workOrder.estimated_cost)}
                        </span>
                      </div>
                      <div className="relative rounded-md shadow-xs">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-500 text-sm font-medium">R</span>
                        </div>
                        <input
                          type="number"
                          value={actualCostInput}
                          onChange={(e) => setActualCostInput(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 1200"
                          className="w-full pl-7 pr-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Fast-Track Emergency Dispatch Callout (No Upfront Payment Required) */}
                  {(isRouteB || (!workOrder?.estimated_cost && !workOrder?.assessor_estimate)) && (
                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900">
                        Emergency Fast-Track Dispatch (Advance Float)
                      </div>
                      <p className="text-purple-800 text-[11px] leading-relaxed">
                        Direct specialist contractor allocation without upfront payment delay. Actual costs and repair details will be logged by the contractor upon work completion.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Maintenance Contractor / Specialist *
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Assigned Specialist
                      </span>
                    </div>

                    {(() => {
                      const activeContractors = contractors.length > 0
                        ? contractors.filter((c) => c.approval_status === 'active' || !c.approval_status)
                        : [
                            { id: 'usr_contractor_01', name: 'Apex BioMed Solutions', specialty: 'Biomedical Equipment' },
                            { id: 'usr_contractor_02', name: 'Contactor TBS', specialty: 'Electrical' },
                            { id: 'usr_contractor_03', name: 'KZN Cooling & HVAC Specialists', specialty: 'HVAC' },
                            { id: 'usr_contractor_04', name: 'Metro Plumbing & Gas', specialty: 'Plumbing' },
                            { id: 'usr_contractor_05', name: 'Coastal Medical Gas Systems', specialty: 'Medical Gas' }
                          ];
                      const matchedList = activeContractors.filter((c) => matchesSpecialty(workOrder?.category, c.specialty));
                      const otherList = activeContractors.filter((c) => !matchesSpecialty(workOrder?.category, c.specialty));

                      return (
                        <div className="relative">
                          <select
                            value={assignedTechnician}
                            onChange={(e) => setAssignedTechnician(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none appearance-none cursor-pointer pr-10 shadow-2xs"
                          >
                            {matchedList.length > 0 && (
                              <optgroup label={`Matched Specialists (${workOrder?.category || 'Category'})`}>
                                {matchedList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} — {c.specialty || 'Specialist'} (Recommended)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {otherList.length > 0 && (
                              <optgroup label="All Registered Contractors">
                                {otherList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} — {c.specialty || 'General Contractor'}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Contractor Quote Reference Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contractor Quote Reference # (Optional)
                    </label>
                    <input
                      type="text"
                      value={contractorQuoteRef}
                      onChange={(e) => setContractorQuoteRef(e.target.value)}
                      placeholder="e.g. APX-Q-2026"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Direct Issue Justification Note (PDF Page 3 Method 3: Elect without Negotiation) */}
                  {((workOrder?.assessor_estimate && workOrder.assessor_estimate > 50000) || workOrder?.funding_route === 'route_a') && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">Direct Nomination Justification (Required &gt; R50k) *</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                          Direct Dispatch Protocol
                        </span>
                      </div>
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        Mandatory audit reason when directly nominating a specialist contractor without competitive multi-quote tender.
                      </p>
                      <textarea
                        rows={2}
                        value={directIssueJustification}
                        onChange={(e) => setDirectIssueJustification(e.target.value)}
                        placeholder="State clinical urgency, OEM specialty exclusivity, or direct emergency reason..."
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-md text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Optional Initial Site Photos & Documentation upon Starting Job */}
              {targetStatus === 'in_progress' && (
                <div className="space-y-4">
                  {/* 1. Optional Initial Site Photos */}
                  <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">
                        Initial Site / Equipment Photos (Optional)
                      </label>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-sky-100 text-sky-800 rounded">
                        {startJobPhotos.length > 0 ? `${startJobPhotos.length} photo(s) selected` : 'Optional'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Attach arrival or initial condition photos before beginning work.
                    </p>
                    <input
                      type="file"
                      id="start-job-photo-input"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const newFiles = Array.from(e.target.files);
                          setStartJobPhotos((prev) => [...prev, ...newFiles]);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700 cursor-pointer"
                    />

                    {startJobPhotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {startJobPhotos.map((file, idx) => (
                          <div key={idx} className="relative group bg-white border border-sky-300 rounded-lg p-1.5 pr-6 text-[11px] text-slate-800 flex items-center shadow-2xs">
                            <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({Math.round(file.size / 1024)} KB)</span>
                            <button
                              type="button"
                              onClick={() => setStartJobPhotos((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute right-1 text-slate-400 hover:text-rose-600 font-bold px-1"
                              title="Remove photo"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Optional Supporting Document (PDF / DOC / DOCX) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-800">
                        Initial Job Card / Permit / Safety Document (Optional)
                      </label>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700 rounded">
                        Optional (PDF / DOC)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Attach digital job card, entry permit, or initial contractor safety sheet.
                    </p>
                    <input
                      type="file"
                      id="start-job-doc-input"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setStartJobDoc(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-800 cursor-pointer"
                    />

                    {startJobDoc && (
                      <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 shadow-2xs mt-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="font-semibold truncate">{startJobDoc.name}</span>
                          <span className="text-[10px] text-slate-400">({Math.round(startJobDoc.size / 1024)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStartJobDoc(null)}
                          className="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 ml-2"
                          title="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mandatory Evidence Submission upon Completion (Price Prompt Removed) */}
              {targetStatus === 'completed' && (
                <div className="space-y-4">
                  {/* 1. Mandatory Proof of Completion Images */}
                  <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">
                        Proof of Work Completion Image(s) *
                      </label>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${completionPhotos.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {completionPhotos.length > 0 ? `✓ ${completionPhotos.length} photo(s) selected` : 'Mandatory (1+ required)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Upload clear photo(s) showing the repaired equipment, replaced parts, or completed installation.
                    </p>
                    <input
                      type="file"
                      id="completion-photo-input"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const newFiles = Array.from(e.target.files);
                          setCompletionPhotos((prev) => [...prev, ...newFiles]);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-700 cursor-pointer"
                    />

                    {completionPhotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {completionPhotos.map((file, idx) => (
                          <div key={idx} className="relative group bg-white border border-sky-300 rounded-lg p-1.5 pr-6 text-[11px] text-slate-800 flex items-center shadow-2xs">
                            <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1">({Math.round(file.size / 1024)} KB)</span>
                            <button
                              type="button"
                              onClick={() => setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx))}
                              className="absolute right-1 text-slate-400 hover:text-rose-600 font-bold px-1"
                              title="Remove photo"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Optional Supporting Document (PDF / DOC / DOCX) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-800">
                        Supporting Job Card / Service Report (Optional)
                      </label>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700 rounded">
                        Optional (PDF / DOC)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Attach contractor service report, timesheet, OEM calibration sheet, or signed job card if available.
                    </p>
                    <input
                      type="file"
                      id="completion-doc-input"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setCompletionDoc(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-800 cursor-pointer"
                    />

                    {completionDoc && (
                      <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 shadow-2xs mt-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          
                          <span className="font-semibold truncate">{completionDoc.name}</span>
                          <span className="text-[10px] text-slate-400">({Math.round(completionDoc.size / 1024)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompletionDoc(null)}
                          className="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-0.5 ml-2"
                          title="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {targetStatus === 'cancelled'
                    ? 'Reason for Cancellation / Rejection *'
                    : 'Audit Notes / Reason for Transition'}
                </label>
                <textarea
                  rows={3}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder={
                    targetStatus === 'cancelled'
                      ? 'Provide rationale for cancelling this work order...'
                      : 'Provide audit rationale, inspection observations, or dispatch notes...'
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsTransitionModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 ${
                    targetStatus === 'cancelled'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {transitionMutation.isPending
                    ? 'Processing...'
                    : targetStatus === 'cancelled'
                    ? 'Confirm Cancellation'
                    : targetStatus === 'approved'
                    ? 'Confirm Approval'
                    : targetStatus === 'closed'
                    ? 'Approve Work Order'
                    : 'Confirm Status Change'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Photo Modal */}
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  Upload Maintenance Evidence
                </h3>
                <button
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Photos *
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setPhotoFiles(e.target.files)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Maintenance Stage
                </label>
                <select
                  value={photoStage}
                  onChange={(e) => setPhotoStage(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="initial">Initial Issue Evidence</option>
                  <option value="in_progress">Work In Progress</option>
                  <option value="completed">Completed Repair</option>
                  <option value="inspection">Inspection Quality Check</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Caption / Notes
                </label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Replacement capacitor installed"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!photoFiles || uploadPhotoMutation.isPending}
                  onClick={() => uploadPhotoMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photos'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate & Submit Invoice Claim Modal */}
        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Submit Invoice Claim
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate an immutable invoice claim for completed maintenance work
                  </p>
                </div>
                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {invoiceError && (
                <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {invoiceError}
                </div>
              )}

              {/* Work Order Info Box */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-sky-700">{workOrder.tracking_number}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                    {workOrder.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="font-semibold text-slate-800">{workOrder.title}</div>
                <div className="text-slate-500 text-[11px]">
                  Facility: {workOrder.facility_name} &bull; Location: {workOrder.location_details || 'Main Facility'}
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Approved Service Base (R) *
                    </label>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Fixed Contract Price
                    </span>
                  </div>
                  <input
                    type="number"
                    readOnly
                    disabled
                    value={invoiceAmount}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-bold text-slate-900 cursor-not-allowed select-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Locked to approved quote / allocated budget</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax / VAT (R)
                  </label>
                  <input
                    type="number"
                    value={invoiceTax}
                    onChange={(e) => setInvoiceTax(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Optional statutory tax</p>
                </div>
              </div>

              {/* Total Claim Banner */}
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Total Claimable Amount
                </span>
                <span className="text-lg font-mono font-bold text-emerald-700">
                  {formatCurrency((invoiceAmount || 0) + (invoiceTax || 0))}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Due Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contractor Entity
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 truncate">
                    {workOrder.assigned_to_name || 'Apex BioMed Solutions'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Claim Notes / Work Summary
                </label>
                <textarea
                  rows={2}
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="Provide brief repair summary for accounting review..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createInvoiceMutation.isPending || !invoiceAmount}
                  onClick={() => createInvoiceMutation.mutate()}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
                >
                  {createInvoiceMutation.isPending ? 'Submitting Claim...' : 'Submit Invoice Claim'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Execute Quality & Safety Inspection Modal */}
        {isInspectionModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">
                  Execute Quality & Safety Inspection
                </h3>
                <button
                  onClick={() => setIsInspectionModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {inspectionFormError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {inspectionFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Work Order *
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-800">
                  <span className="font-mono font-bold text-sky-700">{workOrder.tracking_number}</span> &bull; {workOrder.title}
                </div>
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
                    Pass (Verify Ticket)
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
                    Fail (Re-work Required)
                  </button>
                </div>
              </div>

              {/* Safety & Calibration Checklist */}
              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2 text-xs">
                <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider mb-1">
                  Safety & Calibration Checklist:
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={inspectionChecklist.calibration}
                    onChange={(e) => setInspectionChecklist({ ...inspectionChecklist, calibration: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-gray-700">OEM Tolerance & Calibration Verified</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={inspectionChecklist.electricalSafety}
                    onChange={(e) => setInspectionChecklist({ ...inspectionChecklist, electricalSafety: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-gray-700">Dielectric & Ground Leakage Current Safe</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={inspectionChecklist.sterilization}
                    onChange={(e) => setInspectionChecklist({ ...inspectionChecklist, sterilization: e.target.checked })}
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
                  value={inspectionObservations}
                  onChange={(e) => setInspectionObservations(e.target.value)}
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
                  onChange={(e) => setSelectedInspectionPhotos(e.target.files)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsInspectionModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!inspectionObservations || createInspectionMutation.isPending}
                  onClick={() => createInspectionMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {createInspectionMutation.isPending ? 'Submitting...' : 'Submit Inspection Sign-Off'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contractor Price Quote Submission Modal */}
        {isQuoteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Submit Maintenance Price Quote
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide your estimated service cost for Work Order #{workOrder.tracking_number}
                  </p>
                </div>
                <button
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {quoteError && (
                <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {quoteError}
                </div>
              )}

              {/* Work Order & Quote Reference Info Card */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-sky-700">{workOrder.tracking_number}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                    System Quote: {workOrder.system_quote_no || `QT-${new Date().getFullYear()}-${workOrder.tracking_number.replace(/\D/g, '').slice(-4) || '1001'}`}
                  </span>
                </div>
                <div className="font-semibold text-slate-800">{workOrder.title}</div>
                <div className="text-slate-500">
                  Category: <strong className="text-slate-700">{workOrder.category}</strong> &bull; Facility: {workOrder.facility_name}
                </div>
              </div>

              {/* Contractor's Custom Quote Reference # */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Internal Quote Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={contractorQuoteRef}
                  onChange={(e) => setContractorQuoteRef(e.target.value)}
                  placeholder="e.g. APX-Q-2026"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Your official quotation reference identifier for cross-referencing.
                </p>
              </div>

              {/* Price Quote Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Estimated Price Quote (R) *
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 text-sm font-medium">R</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1500"
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Contractor Approver will review this amount before assigning the job.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitQuoteMutation.isPending || quotePrice === '' || Number(quotePrice) <= 0}
                  onClick={() => submitQuoteMutation.mutate()}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
                >
                  {submitQuoteMutation.isPending ? 'Submitting...' : 'Submit Price Quote'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Engineering Assessor Scope & Itemized Assessment Modal */}
        {isAssessmentModalOpen && (
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
                  onClick={() => setIsAssessmentModalOpen(false)}
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
                            const totalSum = updated.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
                            setAssessmentEstimate(totalSum > 0 ? totalSum : '');
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
                            const totalSum = updated.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
                            setAssessmentEstimate(totalSum > 0 ? totalSum : '');
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
                      R {assessmentItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0).toLocaleString()}
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
                      {assessmentTimesheetDays.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0)} Hours Logged
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
                            setAssessmentHours(40);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 transition"
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
                            setAssessmentHours('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 transition"
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
                                const totalHours = updated.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
                                setAssessmentHours(totalHours > 0 ? totalHours : '');
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
                  onClick={() => setIsAssessmentModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    assessmentItems.some((item) => !item.description.trim()) ||
                    assessmentItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0) <= 0 ||
                    !estimatedDays ||
                    Number(estimatedDays) <= 0 ||
                    assessmentMutation.isPending
                  }
                  onClick={() => assessmentMutation.mutate()}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                    assessmentItems.some((item) => !item.description.trim()) ||
                    assessmentItems.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0) <= 0 ||
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
        )}

        {/* Part 1: Assign Lead Assessor Modal (Quantum Built Approver / Admin) */}
        {isAssignLeadModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                      Part 1 &bull; Governance Gate
                    </span>
                    <span className="text-xs font-mono text-slate-500">{workOrder.tracking_number}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Assign Lead Assessor (Quantum Built)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select whether a Works Inspector or Works Engineer will lead preliminary assessment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignLeadModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {assignLeadError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {assignLeadError}
                </div>
              )}

              {/* Role Selection Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lead Assessor Discipline *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLeadAssessorRoleInput('works_inspector');
                      setLeadAssessorIdInput(worksInspectors[0]?.id || '');
                    }}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      leadAssessorRoleInput === 'works_inspector'
                        ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-500 text-slate-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Works Inspector</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Standard HVAC/Clinical physical inspection
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLeadAssessorRoleInput('works_engineer');
                      setLeadAssessorIdInput(worksEngineers[0]?.id || '');
                    }}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      leadAssessorRoleInput === 'works_engineer'
                        ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-500 text-slate-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Works Engineer</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Complex engineering scoping &amp; calculation
                    </div>
                  </button>
                </div>
              </div>

              {/* User Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select {leadAssessorRoleInput === 'works_inspector' ? 'Works Inspector' : 'Works Engineer'} Officer *
                </label>
                <select
                  value={leadAssessorIdInput}
                  onChange={(e) => setLeadAssessorIdInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="">-- Choose Assigned Officer --</option>
                  {(leadAssessorRoleInput === 'works_inspector' ? worksInspectors : worksEngineers).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                  {/* Fallback option if user list is empty in dev */}
                  {allUsers.length === 0 && (
                    <option value={user?.id || 'usr_inspector_01'}>
                      {user?.name || 'Default Assigned Assessor'}
                    </option>
                  )}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!leadAssessorIdInput || assignLeadMutation.isPending}
                  onClick={() => assignLeadMutation.mutate()}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {assignLeadMutation.isPending ? 'Assigning...' : 'Confirm Assignment & Notify Assessor'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Part 1: Request Works Engineer Modal (Works Inspector) */}
        {isRequestEngineerModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Request Works Engineer Assistance
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Job #{workOrder.tracking_number} &bull; Lead Assessor Escalation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestEngineerModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {engineerRequestError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {engineerRequestError}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                As the Lead Works Inspector, you can request Quantum Built to assign a Works Engineer to assist on this assessment session if specialized diagnostic or technical scoping is required.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Technical Scoping Justification *
                </label>
                <textarea
                  rows={3}
                  value={engineerRequestReasonInput}
                  onChange={(e) => setEngineerRequestReasonInput(e.target.value)}
                  placeholder="Detail why engineering assistance is required (e.g., complex HVAC airflow calculation, biomedical sensor calibration diagnostic)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestEngineerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!engineerRequestReasonInput.trim() || requestEngineerMutation.isPending}
                  onClick={() => requestEngineerMutation.mutate()}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {requestEngineerMutation.isPending ? 'Sending Request...' : 'Submit Request to QB'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Part 1: Fulfill Works Engineer Modal (Quantum Built Approver / Admin) */}
        {isFulfillEngineerModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Fulfill Works Engineer Request
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign an engineer to join the session alongside Lead Inspector
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFulfillEngineerModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {handleEngineerRequestError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {handleEngineerRequestError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Works Engineer *
                </label>
                <select
                  value={fulfillEngineerIdInput}
                  onChange={(e) => setFulfillEngineerIdInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="">-- Choose Works Engineer --</option>
                  {worksEngineers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                  {worksEngineers.length === 0 && (
                    <option value="usr_engineer_01">Default Works Engineer</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFulfillEngineerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!fulfillEngineerIdInput || handleEngineerRequestMutation.isPending}
                  onClick={() =>
                    handleEngineerRequestMutation.mutate({
                      action: 'fulfill',
                      engineerId: fulfillEngineerIdInput
                    })
                  }
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {handleEngineerRequestMutation.isPending ? 'Assigning...' : 'Assign Engineer to Session'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Part 1: Request Estimate Adjustment Modal (Quantum Built Review Gate) */}
        {isAdjustEstimateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Request Preliminary Estimate Adjustment
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Job #{workOrder.tracking_number} &bull; Quantum Built 3-Way Review Gate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustEstimateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {reviewEstimateError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {reviewEstimateError}
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <span className="text-slate-500">Current Assessor Estimate:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(workOrder.assessor_estimate || 0)}</span>
                </div>
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <span className="text-slate-500">Assigned Assessor:</span>
                  <span className="font-bold text-sky-700">{workOrder.lead_assessor_name || workOrder.assessor_name || 'Assessor'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Instructions &amp; Review Notes *
                </label>
                <textarea
                  rows={3}
                  value={adjustmentNotesInput}
                  onChange={(e) => setAdjustmentNotesInput(e.target.value)}
                  placeholder="Detail required adjustments, scope corrections, bill of quantities (BOQ) benchmarks, or rate table adjustments..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustEstimateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!adjustmentNotesInput.trim() || reviewEstimateMutation.isPending}
                  onClick={() =>
                    reviewEstimateMutation.mutate({
                      action: 'adjust',
                      adjustmentNotes: adjustmentNotesInput.trim()
                    })
                  }
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reviewEstimateMutation.isPending ? 'Sending...' : 'Send Adjustment to Assessor'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NC DOH Client Quote Decline Gateway Modal (PDF Page 4) */}
        {isDeclineQuoteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Decline Client Quote (NC DOH Gateway)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Job #{workOrder.tracking_number} &bull; Client Quotation Audit
                  </p>
                </div>
                <button
                  onClick={() => setIsDeclineQuoteModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {quoteStatusError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {quoteStatusError}
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <span className="text-slate-500">Quoted Amount:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(workOrder.estimated_cost || 0)}</span>
                </div>
                <div className="flex justify-between items-center font-mono text-[11px]">
                  <span className="text-slate-500">System Quote #:</span>
                  <span className="font-bold text-sky-700">{workOrder.system_quote_no || 'Pending'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Quote Decline *
                </label>
                <textarea
                  rows={3}
                  value={clientDeclineReasonInput}
                  onChange={(e) => setClientDeclineReasonInput(e.target.value)}
                  placeholder="Specify why the quote was declined (e.g., budget ceiling exceeded, rate discrepancy, request further breakdown)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-2xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This reason will be recorded on the SHA-256 audit ledger and returned to Quantum Built for renegotiation.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeclineQuoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!clientDeclineReasonInput.trim() || updateQuoteStatusMutation.isPending}
                  onClick={() =>
                    updateQuoteStatusMutation.mutate({
                      quoteStatus: 'client_declined',
                      clientDeclineReason: clientDeclineReasonInput.trim()
                    })
                  }
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm ${
                    !clientDeclineReasonInput.trim() || updateQuoteStatusMutation.isPending
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer'
                  }`}
                >
                  {updateQuoteStatusMutation.isPending ? 'Recording Decline...' : 'Confirm Decline & Return to QB'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3-Way Tri-Signoff Defect / Rectification Request Modal (PDF Page 5) */}
        {isSignoffRejectModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Request Physical Rectification &amp; Rework
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Job #{workOrder.tracking_number} &bull; 3-Way Completion Inspection
                  </p>
                </div>
                <button
                  onClick={() => setIsSignoffRejectModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {signoffError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {signoffError}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                Submitting this notice will return the work order status from <strong>Completed</strong> back to <strong>In Progress</strong> for the assigned specialist contractor to rectify.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Defect / Rectification Description *
                </label>
                <textarea
                  rows={3}
                  value={signoffRejectionReasonInput}
                  onChange={(e) => setSignoffRejectionReasonInput(e.target.value)}
                  placeholder="Detail the physical or technical defect observed (e.g., secondary damper leak, HVAC laminar flow calibration out of range, missing inspection plate)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSignoffRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!signoffRejectionReasonInput.trim() || signoffMutation.isPending}
                  onClick={() =>
                    signoffMutation.mutate({
                      action: 'reject',
                      reason: signoffRejectionReasonInput.trim()
                    })
                  }
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm ${
                    !signoffRejectionReasonInput.trim() || signoffMutation.isPending
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer'
                  }`}
                >
                  {signoffMutation.isPending ? 'Sending Rectification...' : 'Return to In Progress'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Works Inspector Sign-off & Timesheet Modal (Client Template) */}
        {isInspectorSignoffModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                <div className="text-center w-full">
                  <h2 className="text-2xl font-light tracking-wide text-slate-900">
                    Time Sheet
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Job #{workOrder.tracking_number} &bull; Works Inspector Statutory Sign-off &amp; QC Audit
                  </p>
                </div>
                <button
                  onClick={() => setIsInspectorSignoffModalOpen(false)}
                  className="p-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {inspectorSignoffError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {inspectorSignoffError}
                </div>
              )}

              {/* Employee's Name & Week Start Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-semibold">Employee&apos;s Name:</span>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Works Inspector'}
                    className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-semibold">Week Start:</span>
                  <input
                    type="date"
                    value={inspectorWeekStart}
                    onChange={(e) => handleWeekStartUpdate(e.target.value, setInspectorWeekStart, setInspectorDays)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-slate-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Monday to Sunday Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-200 border-b border-slate-300 text-slate-800 font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left w-36 border-r border-slate-300">Day</th>
                      <th className="py-2 px-3 text-center border-r border-slate-300">Date</th>
                      <th className="py-2 px-3 text-right w-32">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inspectorDays.map((row, idx) => (
                      <tr key={row.day} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-semibold bg-slate-50 border-r border-slate-200">
                          {row.day}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const updated = [...inspectorDays];
                              updated[idx].date = e.target.value;
                              setInspectorDays(updated);
                            }}
                            className="w-full text-center px-1.5 py-1 border border-slate-200 rounded text-xs text-slate-800 font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            placeholder="0.0"
                            value={row.hours || ''}
                            onChange={(e) => {
                              const updated = [...inspectorDays];
                              updated[idx].hours = e.target.value;
                              setInspectorDays(updated);
                            }}
                            className="w-full text-right px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Hours Box on Bottom Right */}
              <div className="flex justify-end">
                <div className="flex border border-slate-300 rounded overflow-hidden text-xs">
                  <div className="bg-slate-100 font-bold text-slate-700 px-4 py-1.5 border-r border-slate-300">
                    Total Hours
                  </div>
                  <div className="px-4 py-1.5 font-bold font-mono text-slate-900 bg-white min-w-[80px] text-right">
                    {inspectorDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0).toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Bottom Sign-off Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Employee&apos;s Name:</span>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Works Inspector'}
                    className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-800 truncate"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Signature:</span>
                  <div className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-indigo-900 truncate">
                    {user?.name || 'Works Inspector'} (Signed)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Date:</span>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleDateString('en-GB')}
                    className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] text-center text-slate-800 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    downloadTimesheetPdf({
                      employee_name: user?.name || 'Works Inspector',
                      employee_role: 'Works Inspector (Compliance & QC Audit)',
                      week_start: inspectorWeekStart || formatDate(new Date().toISOString()),
                      work_order_tracking: workOrder.tracking_number,
                      work_order_title: workOrder.title,
                      facility_name: workOrder.facility_name,
                      entries: inspectorDays,
                      total_hours: inspectorDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0).toFixed(1),
                      signature_name: user?.name || 'Works Inspector',
                      signature_date: new Date().toLocaleDateString('en-GB')
                    });
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Preview Timesheet PDF
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsInspectorSignoffModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={signoffMutation.isPending}
                    onClick={() => {
                      const total = inspectorDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
                      signoffMutation.mutate({
                        roleType: 'inspector',
                        action: 'sign',
                        timesheetData: {
                          entries: inspectorDays,
                          total_hours: total
                        }
                      });
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#2B7A9B] hover:bg-[#1E5D88] active:bg-[#164464] rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {signoffMutation.isPending ? 'Submitting...' : 'Confirm Sign-off & Submit Timesheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Works Engineer Sign-off & Timesheet Modal (Client Template) */}
        {isEngineerSignoffModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                <div className="text-center w-full">
                  <h2 className="text-2xl font-light tracking-wide text-slate-900">
                    Time Sheet
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Job #{workOrder.tracking_number} &bull; Works Engineer Technical Scoping &amp; SANS Sign-off
                  </p>
                </div>
                <button
                  onClick={() => setIsEngineerSignoffModalOpen(false)}
                  className="p-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {engineerSignoffError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {engineerSignoffError}
                </div>
              )}

              {/* Employee's Name & Week Start Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-semibold">Employee&apos;s Name:</span>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Works Engineer'}
                    className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-semibold">Week Start:</span>
                  <input
                    type="date"
                    value={engineerWeekStart}
                    onChange={(e) => handleWeekStartUpdate(e.target.value, setEngineerWeekStart, setEngineerDays)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-slate-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Monday to Sunday Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-200 border-b border-slate-300 text-slate-800 font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left w-36 border-r border-slate-300">Day</th>
                      <th className="py-2 px-3 text-center border-r border-slate-300">Date</th>
                      <th className="py-2 px-3 text-right w-32">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {engineerDays.map((row, idx) => (
                      <tr key={row.day} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-semibold bg-slate-50 border-r border-slate-200">
                          {row.day}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const updated = [...engineerDays];
                              updated[idx].date = e.target.value;
                              setEngineerDays(updated);
                            }}
                            className="w-full text-center px-1.5 py-1 border border-slate-200 rounded text-xs text-slate-800 font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            placeholder="0.0"
                            value={row.hours || ''}
                            onChange={(e) => {
                              const updated = [...engineerDays];
                              updated[idx].hours = e.target.value;
                              setEngineerDays(updated);
                            }}
                            className="w-full text-right px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Hours Box on Bottom Right */}
              <div className="flex justify-end">
                <div className="flex border border-slate-300 rounded overflow-hidden text-xs">
                  <div className="bg-slate-100 font-bold text-slate-700 px-4 py-1.5 border-r border-slate-300">
                    Total Hours
                  </div>
                  <div className="px-4 py-1.5 font-bold font-mono text-slate-900 bg-white min-w-[80px] text-right">
                    {engineerDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0).toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Bottom Sign-off Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Employee&apos;s Name:</span>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Works Engineer'}
                    className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-800 truncate"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Signature:</span>
                  <div className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-sky-900 truncate">
                    {user?.name || 'Works Engineer'} (Signed)
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap font-semibold">Date:</span>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleDateString('en-GB')}
                    className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] text-center text-slate-800 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    downloadTimesheetPdf({
                      employee_name: user?.name || 'Works Engineer',
                      employee_role: 'Works Engineer (Technical & Scoping)',
                      week_start: engineerWeekStart || formatDate(new Date().toISOString()),
                      work_order_tracking: workOrder.tracking_number,
                      work_order_title: workOrder.title,
                      facility_name: workOrder.facility_name,
                      entries: engineerDays,
                      total_hours: engineerDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0).toFixed(1),
                      signature_name: user?.name || 'Works Engineer',
                      signature_date: new Date().toLocaleDateString('en-GB')
                    });
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Preview Timesheet PDF
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEngineerSignoffModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={signoffMutation.isPending}
                    onClick={() => {
                      const total = engineerDays.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
                      signoffMutation.mutate({
                        roleType: 'engineer',
                        action: 'sign',
                        timesheetData: {
                          entries: engineerDays,
                          total_hours: total
                        }
                      });
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 active:bg-sky-900 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {signoffMutation.isPending ? 'Submitting...' : 'Confirm Sign-off & Submit Timesheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Contractor Provide Critical Emergency Job Quote */}
        {isCriticalQuoteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Provide Critical Job Quote &amp; Cost Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Work Order: <strong className="font-mono text-purple-700">{workOrder.tracking_number}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCriticalQuoteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {criticalQuoteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {criticalQuoteError}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Scope / Work Classification Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                    1. Work Classification (Select all that apply) *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Maintenance', 'Repair', 'Change', 'Replace', 'Calibration', 'Specialist Service'].map((type) => {
                      const isSelected = criticalQuoteWorkTypes.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setCriticalQuoteWorkTypes((prev) =>
                              isSelected ? prev.filter((t) => t !== type) : [...prev, type]
                            );
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'bg-purple-700 text-white' : 'border border-slate-300 bg-white'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Itemized Notes & Replaced Parts */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                    2. Scope Description &amp; Components Replaced
                  </label>
                  <textarea
                    rows={3}
                    value={criticalQuoteNotes}
                    onChange={(e) => setCriticalQuoteNotes(e.target.value)}
                    placeholder="Detail work executed, replacement part numbers, labour hours, and emergency corrective actions taken..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* 3. Quoted Cost in Rand */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                    3. Final Claimed / Quoted Cost (R) *
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <span className="text-slate-400 font-bold font-mono text-sm">R</span>
                    </div>
                    <input
                      type="number"
                      value={criticalQuoteCost}
                      onChange={(e) => setCriticalQuoteCost(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 18500"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    This quote will be submitted directly to Works Engineer for verification &amp; approval.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCriticalQuoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitCriticalQuoteMutation.isPending || criticalQuoteCost === '' || Number(criticalQuoteCost) <= 0}
                  onClick={() => submitCriticalQuoteMutation.mutate()}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 active:bg-purple-900 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitCriticalQuoteMutation.isPending ? 'Submitting...' : 'Submit Quote for Engineer Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Works Engineer Adjust Critical Quote */}
        {isAdjustCriticalQuoteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Adjust Critical Job Quote
                    </h3>
                    <p className="text-xs text-slate-500">
                      Current: <strong className="font-mono text-purple-700">{formatCurrency(workOrder.contractor_critical_quote_cost || 0)}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustCriticalQuoteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {adjustCriticalQuoteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {adjustCriticalQuoteError}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                    Adjusted Cost (R) *
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <span className="text-slate-400 font-bold font-mono text-sm">R</span>
                    </div>
                    <input
                      type="number"
                      value={adjustedCriticalQuoteCost}
                      onChange={(e) => setAdjustedCriticalQuoteCost(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 15000"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter the adjusted technical amount agreed for this emergency intervention.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                    Adjustment Rationale / Reason *
                  </label>
                  <textarea
                    rows={3}
                    value={adjustCriticalQuoteNotes}
                    onChange={(e) => setAdjustCriticalQuoteNotes(e.target.value)}
                    placeholder="Explain the technical price adjustment (e.g., standard labor rates applied, component price verification)..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustCriticalQuoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewCriticalQuoteMutation.isPending || adjustedCriticalQuoteCost === '' || Number(adjustedCriticalQuoteCost) <= 0}
                  onClick={() =>
                    reviewCriticalQuoteMutation.mutate({
                      action: 'adjust',
                      cost: Number(adjustedCriticalQuoteCost),
                      notes: adjustCriticalQuoteNotes.trim()
                    })
                  }
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reviewCriticalQuoteMutation.isPending ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Invite Contractor(s) Modal */}
        {workOrder && (
          <InviteContractorsModal
            isOpen={isInviteContractorsModalOpen}
            onClose={() => setIsInviteContractorsModalOpen(false)}
            workOrder={workOrder}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['work-order', id] });
              queryClient.invalidateQueries({ queryKey: ['work-orders'] });
            }}
          />
        )}

        {/* Phase 2: Contractor Blind Quote Submission Modal */}
        {workOrder && (
          <SubmitQuotationModal
            isOpen={isSubmitQuotationModalOpen}
            onClose={() => setIsSubmitQuotationModalOpen(false)}
            workOrder={workOrder}
            initialQuotation={mySubmittedQuote}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['work-order', id] });
              queryClient.invalidateQueries({ queryKey: ['work-orders'] });
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
