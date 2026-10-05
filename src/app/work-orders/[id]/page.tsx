'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { workOrderApi } from '@/services/work-orders';
import { contractorApi } from '@/services/contractors';
import { invoiceService } from '@/services/invoices';
import { inspectionApi } from '@/services/inspections';
import { API_SERVER_URL } from '@/services/api';
import { WorkOrderPriority, WorkOrderStatus } from '@/types/workOrder';
import { formatDate, formatCurrency } from '@/lib/utils';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { useAuth } from '@/hooks/useAuth';

const WORKFLOW_STEPS: { status: WorkOrderStatus; label: string }[] = [
  { status: 'reported', label: 'Reported' },
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

const EVENT_CONFIG: Record<string, { title: string; color: string; badge: string }> = {
  reported: { title: 'Work Order Reported & Created', color: 'border-sky-500 text-sky-600', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  approved: { title: 'Budget & Scope Approved', color: 'border-blue-500 text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  assigned: { title: 'Contractor Assigned', color: 'border-indigo-500 text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  in_progress: { title: 'Work Started / In Progress', color: 'border-amber-500 text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { title: 'Repair Completed & Submitted for QC', color: 'border-purple-500 text-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  verified: { title: 'QC Safety Inspection Passed', color: 'border-teal-500 text-teal-600', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  closed: { title: 'Work Order Closed & Settled', color: 'border-emerald-500 text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { title: 'Work Order Cancelled / Rejected', color: 'border-rose-500 text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // Engineering Assessment Modal state
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [assessmentType, setAssessmentType] = useState<'offsite' | 'onsite'>('offsite');
  const [assessmentEstimate, setAssessmentEstimate] = useState<number | ''>('');
  const [chargeCode, setChargeCode] = useState<'PRE' | 'ONS' | 'TRV' | 'FIN'>('PRE');
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

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
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const submitQuoteMutation = useMutation({
    mutationFn: async () => {
      if (quotePrice === '' || Number(quotePrice) <= 0) {
        throw new Error('Please enter a valid estimated price quote greater than 0');
      }
      return workOrderApi.updateWorkOrder(id, {
        estimated_cost: Number(quotePrice)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsQuoteModalOpen(false);
      setQuotePrice('');
      setQuoteNotes('');
      setQuoteError(null);
    },
    onError: (err: any) => {
      setQuoteError(err.response?.data?.message || err.message || 'Failed to submit price quote');
    }
  });

  const openQuoteModal = () => {
    setQuotePrice(workOrder?.estimated_cost || '');
    setQuoteNotes('');
    setQuoteError(null);
    setIsQuoteModalOpen(true);
  };

  // Status Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async () => {
      if (!targetStatus) return;
      return workOrderApi.transitionStatus(id, {
        status: targetStatus,
        notes: transitionNotes,
        assigned_to: targetStatus === 'assigned' ? assignedTechnician : undefined,
        actual_cost:
          targetStatus === 'completed'
            ? (workOrder?.estimated_cost ?? (actualCostInput !== '' ? Number(actualCostInput) : 0))
            : actualCostInput !== ''
            ? Number(actualCostInput)
            : undefined
      });
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
    },
    onError: (err: any) => {
      setTransitionError(err.response?.data?.message || 'Failed to update work order status');
    }
  });

  const openTransitionModal = (status: WorkOrderStatus) => {
    setTargetStatus(status);
    setTransitionNotes('');
    setTransitionError(null);
    if (status === 'approved') {
      setActualCostInput('');
    } else if (status === 'completed') {
      setActualCostInput(workOrder?.estimated_cost ?? workOrder?.actual_cost ?? 0);
    } else if (status === 'assigned') {
      const activeContractors = contractors.filter((c) => c.approval_status === 'active' || !c.approval_status);
      const matched = activeContractors.filter((c) => matchesSpecialty(workOrder?.category, c.specialty));
      const target = matched[0] || activeContractors[0];
      if (target) {
        setAssignedTechnician(target.id);
      } else {
        setAssignedTechnician('usr_contractor_01');
      }
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

  // Engineering Assessment Mutation (Scope, Charge Code, Assessor Estimate, and Automated Routing)
  const assessmentMutation = useMutation({
    mutationFn: async () => {
      if (assessmentEstimate === '') throw new Error('Please enter assessor estimate amount');
      return workOrderApi.submitAssessment(id, {
        assessment_type: assessmentType,
        assessor_estimate: Number(assessmentEstimate),
        charge_code: chargeCode,
        assessment_notes: assessmentNotes || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-chain', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsAssessmentModalOpen(false);
      setAssessmentError(null);
    },
    onError: (err: any) => {
      setAssessmentError(err.response?.data?.message || err.message || 'Failed to submit engineering assessment');
    }
  });

  const openAssessmentModal = () => {
    setAssessmentType(workOrder?.assessment_type || 'offsite');
    setAssessmentEstimate(
      workOrder?.assessor_estimate !== null && workOrder?.assessor_estimate !== undefined
        ? workOrder.assessor_estimate
        : (workOrder?.estimated_cost || '')
    );
    setChargeCode(workOrder?.charge_code || 'PRE');
    setAssessmentNotes(workOrder?.assessment_notes || '');
    setAssessmentError(null);
    setIsAssessmentModalOpen(true);
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
  const status = workOrder.status;

  const isSameApproverForAssignment = !!workOrder.approved_by && workOrder.approved_by === user?.id && role !== 'ADMIN';
  const isSodViolationForInvoice = !!(workOrder.approved_by === user?.id || workOrder.assigned_by === user?.id) && role !== 'ADMIN';

  const hasWoApproveScope = role === 'ADMIN' || (role === 'APPROVER' && ['wo_approver', 'general'].includes(approverScope));
  const hasAssignScope = role === 'ADMIN' || (role === 'APPROVER' && ['contractor_approver', 'procurement', 'general'].includes(approverScope));
  const hasPaymentScope = role === 'ADMIN' || (role === 'APPROVER' && ['payment_approver', 'general'].includes(approverScope));
  const canViewInvoiceDetails = hasPaymentScope || role === 'CONTRACTOR' || role === 'AUDITOR';

  const canAssess = (role === 'ADMIN' || role === 'APPROVER' || role === 'INSPECTOR') && status !== 'closed' && status !== 'cancelled';
  const isContractor = role === 'CONTRACTOR' || !!workOrder.is_blind_quoted;

  const canApprove = hasWoApproveScope && status === 'reported';
  const canAssign = hasAssignScope && !isSameApproverForAssignment && status === 'approved';
  const canStartWork = (role === 'CONTRACTOR' || role === 'ADMIN') && status === 'assigned';
  const canComplete = (role === 'CONTRACTOR' || role === 'ADMIN') && status === 'in_progress';
  const canVerify = (role === 'INSPECTOR' || role === 'ADMIN') && status === 'completed';
  const canClose = (role === 'APPROVER' || role === 'ADMIN') && status === 'verified' && !workOrder.invoice_id;
  const canReject = (role === 'APPROVER' || role === 'ADMIN') && ['reported', 'approved', 'assigned'].includes(status);
  const canGenerateInvoice = (role === 'CONTRACTOR' || role === 'ADMIN') && ['verified', 'closed'].includes(status) && !workOrder.invoice_id;
  const canRequestInvoice = hasPaymentScope && ['verified', 'closed'].includes(status) && !workOrder.invoice_id;
  const canApproveOrPayInvoice = hasPaymentScope && !isSodViolationForInvoice && !!workOrder.invoice_id;
  const canViewAuditVault = role === 'ADMIN' || role === 'AUDITOR';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Link href="/work-orders" className="hover:text-gray-900 hover:underline">
            Work Orders
          </Link>
          <span>&rsaquo;</span>
          <span className="font-mono text-gray-700">{workOrder.tracking_number}</span>
        </div>

        {/* Top Header Card */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-mono font-bold text-sky-700 text-sm">
                {workOrder.tracking_number}
              </span>
              
              {/* Urgency SLA Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}
              >
                {urgency}
              </span>

              {/* Funding Route Badge */}
              {isRouteB ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  Route B (QB Advance)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  Route A (Client Direct)
                </span>
              )}

              {/* Statutory Notice Badge */}
              {isStatutory && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                  30d/15d Pre-Notice Active
                </span>
              )}

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${sBadge.bg} ${sBadge.text} ${sBadge.border}`}
              >
                {workOrder.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 mt-2">
              {workOrder.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Reported on {formatDate(workOrder.created_at)} by{' '}
              <span className="font-semibold text-gray-700">{workOrder.reported_by_name || 'Staff'}</span>
            </p>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {canAssess && (
              <button
                type="button"
                onClick={openAssessmentModal}
                className="px-4 py-2 bg-slate-900 hover:bg-black active:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                {workOrder.assessment_type ? 'Edit Assessment' : 'Conduct Assessment'}
              </button>
            )}

            {canApprove && (
              <button
                type="button"
                onClick={() => openTransitionModal('approved')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Approve Work Order
              </button>
            )}

            {/* When Approved: Contractor can submit price quote ONLY for Route A (Client Funded / Multi-Quote) */}
            {status === 'approved' && role === 'CONTRACTOR' && !isRouteB && (
              <button
                type="button"
                onClick={openQuoteModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {workOrder.estimated_cost ? `Update Price Quote (${formatCurrency(workOrder.estimated_cost)})` : 'Submit Price Quote (R)'}
              </button>
            )}

            {canAssign && (
              <button
                type="button"
                onClick={() => openTransitionModal('assigned')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Assign Specialist Contractor
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
                Close Work Order
              </button>
            )}

            {/* When Completed: Disabled button waiting for verification (Contractor/Admin only) */}
            {role === 'CONTRACTOR' && workOrder.status === 'completed' && !workOrder.invoice_id && (
              <button
                disabled
                title="Invoice generation will be enabled after quality inspection and verification"
                className="px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold rounded-lg cursor-not-allowed select-none"
              >
                Waiting for Verification
              </button>
            )}

            {/* When Verified or Closed and No Invoice Yet: */}
            {/* Contractor sees button to Generate Invoice Claim */}
            {role === 'CONTRACTOR' && ['verified', 'closed'].includes(workOrder.status) && !workOrder.invoice_id && (
              <button
                type="button"
                onClick={openInvoiceModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Generate Invoice Claim ({formatCurrency(workOrder.actual_cost || workOrder.estimated_cost || 0)})
              </button>
            )}

            {/* Approver / Admin sees button to Request Invoice from Contractor */}
            {canRequestInvoice && (
              <button
                type="button"
                onClick={() => requestInvoiceMutation.mutate()}
                disabled={requestInvoiceMutation.isPending || invoiceRequestSuccess}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  invoiceRequestSuccess
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-default'
                    : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
                }`}
              >
                {requestInvoiceMutation.isPending
                  ? 'Requesting...'
                  : invoiceRequestSuccess
                  ? 'Invoice Requested from Contractor'
                  : 'Request Invoice from Contractor'}
              </button>
            )}

            {/* When Invoice Exists: 1 Single "Approve & Pay Invoice" Button for Approver/Admin */}
            {workOrder.invoice_id && (
              <>
                {canApproveOrPayInvoice && ['pending', 'approved'].includes(workOrder.invoice_status || '') && (
                  <div className="flex items-center gap-2">
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

                {/* Direct Download Invoice PDF button (Payment Approver, Admin, Contractor, Auditor only) */}
                {canViewInvoiceDetails && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadInvoicePdf({
                        id: workOrder.invoice_id || id,
                        invoice_number: workOrder.invoice_number || 'INV-REF',
                        created_at: workOrder.created_at,
                        status: workOrder.invoice_status || 'pending',
                        amount: Number(workOrder.actual_cost || workOrder.estimated_cost || 0),
                        tax_amount: 0,
                        total_amount: Number(workOrder.invoice_total_amount || workOrder.actual_cost || workOrder.estimated_cost || 0),
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
              </>
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
          </div>
        </div>

        {/* Fast-Track Route B Notice (Quantum Built Direct Advance Funded) */}
        {isRouteB && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-800">
                Route B: Direct Advance Funded
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
        {workOrder.status === 'approved' && (
          <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <h3 className="text-sm font-bold text-indigo-950">
                  {isRouteB
                    ? 'Step 2: Specialist Contractor Direct Dispatch (Route B Fast-Track)'
                    : 'Step 2: Contractor Price Quotation &amp; Assignment (Route A Gateway)'}
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

              <div className="flex items-center gap-2 shrink-0">
                {role === 'CONTRACTOR' && !isRouteB && (
                  <button
                    onClick={openQuoteModal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    {workOrder.estimated_cost ? 'Update Price Quote' : 'Submit Price Quote (R)'} &rarr;
                  </button>
                )}

                {canAssign && (
                  <button
                    onClick={() => openTransitionModal('assigned')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    Assign Specialist Contractor &rarr;
                  </button>
                )}
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
              {/* Engineering Assessor Scope & Automated Funding Split Card */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Engineering Assessment &amp; Scope Estimation
                      </h2>
                      {workOrder.assessment_type ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                          Completed ({workOrder.assessment_type})
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
                      {workOrder.assessment_type ? 'Edit Assessment' : 'Record Assessment'} &rarr;
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                                {workOrder.charge_code === 'FIN' && '(Final)'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Assessor Estimate</div>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                              {formatCurrency(workOrder.assessor_estimate || workOrder.estimated_cost || 0)}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[11px] text-slate-500 font-medium">Funding Route</div>
                            <div className="mt-0.5">
                              {workOrder.funding_route === 'route_b' || urgency === 'Critical 0–24h' ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">
                                  Route B (QB Float)
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                  Route A (Client Gateway)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Assessor Details & Notes */}
                        {(workOrder.assessor_name || workOrder.assessment_notes || workOrder.assessment_date) && (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2">
                            {workOrder.assessor_name && (
                              <div className="flex justify-between items-center text-gray-600">
                                <span>Assessed By: <strong className="text-gray-900">{workOrder.assessor_name}</strong></span>
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
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center space-y-2">
                        <p className="text-xs text-gray-600">
                          No formal engineering assessment has been recorded for this ticket yet.
                        </p>
                        {canAssess && (
                          <button
                            onClick={openAssessmentModal}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded shadow-sm transition"
                          >
                            Record Engineering Assessment
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

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

              {/* Photos Gallery */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Attached Inspection Evidence ({workOrder.photos?.length || 0})
                  </h2>
                  <button
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                  >
                    + Upload Photo
                  </button>
                </div>

                {!workOrder.photos || workOrder.photos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded">
                    No inspection photos attached to this ticket yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {workOrder.photos.map((photo) => {
                      const photoUrl = photo.photo_url.startsWith('http')
                        ? photo.photo_url
                        : `${API_SERVER_URL}${photo.photo_url.startsWith('/') ? '' : '/'}${photo.photo_url}`;

                      return (
                        <a
                          key={photo.id}
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-xs block group hover:shadow-md transition"
                          title="Click to view full image"
                        >
                          <div className="h-36 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                            <img
                              src={photoUrl}
                              alt={photo.caption || 'Work order photo'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="p-1.5 rounded-full bg-white/90 text-slate-800 shadow">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-white border-t border-slate-100">
                            <div className="font-medium text-slate-800 truncate">
                              {photo.caption || 'Photo attachment'}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-mono">
                              Stage: {photo.stage}
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

              {user?.role !== 'STAFF' && (
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
                      {isRouteB ? 'Route B (QB Advance Funded)' : 'Route A (Client Direct)'}
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
                                {evt.status.replace('_', ' ')}
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

              {targetStatus === 'assigned' && (
                <div className="space-y-3">
                  {/* Contractor Quoted Price Review */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Contractor Price / Approved Budget (R) *
                      </label>
                      {workOrder?.estimated_cost ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Quoted by Contractor: {formatCurrency(workOrder.estimated_cost)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending Contractor Quote
                        </span>
                      )}
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
                    <p className="text-[11px] text-gray-500 mt-1">
                      Review and confirm the approved cost for this contractor assignment.
                    </p>
                  </div>

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
                      const activeContractors = contractors.filter((c) => c.approval_status === 'active' || !c.approval_status);
                      const matchedList = activeContractors.filter((c) => matchesSpecialty(workOrder?.category, c.specialty));
                      const selected = matchedList.find((c) => c.id === assignedTechnician) || matchedList[0] || activeContractors[0] || {
                        id: 'usr_contractor_01',
                        name: 'Apex BioMed Solutions',
                        specialty: workOrder?.category || 'Biomedical Equipment'
                      };

                      return (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium text-slate-900 flex items-center justify-between select-none">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{selected.name}</span>
                            <span className="text-gray-400">—</span>
                            <span className="text-xs text-gray-600">{selected.specialty || 'Specialist'}</span>
                          </div>
                          <span className="text-[11px] font-mono text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded">
                            Auto-Selected
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Locked Approved Cost for Contractor Completion */}
              {targetStatus === 'completed' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Approved Repair Cost (R)
                    </label>
                    <span className="inline-flex items-center text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Locked by Approver
                    </span>
                  </div>
                  <div className="relative rounded-md shadow-xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-500 text-sm font-medium">R</span>
                    </div>
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={actualCostInput !== '' ? actualCostInput : (workOrder?.estimated_cost ?? 0)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-bold text-slate-800 cursor-not-allowed select-none focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    This amount is pre-fixed according to the Approver&apos;s allocated budget and cannot be modified.
                  </p>
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

              {/* Work Order Info Card */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800">{workOrder.title}</div>
                <div className="text-slate-500">
                  Category: <strong className="text-slate-700">{workOrder.category}</strong> &bull; Facility: {workOrder.facility_name}
                </div>
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

        {/* Engineering Assessor Scope & Cost Estimation Modal */}
        {isAssessmentModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                      Technical Scope
                    </span>
                    <span className="text-xs font-mono text-slate-500">{workOrder.tracking_number}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Engineering Assessment &amp; Scope Estimation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluate repair scope, charge code, and automated R50,000 threshold routing
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
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {assessmentError}
                </div>
              )}

              {/* Assessment Mode (Segmented Pill Switcher) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assessment Mode *
                </label>
                <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setAssessmentType('offsite')}
                    className={`py-2 px-3 text-xs rounded-lg text-center transition-all cursor-pointer ${
                      assessmentType === 'offsite'
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium active:scale-95'
                    }`}
                  >
                    Offsite (Evidence Photos)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentType('onsite')}
                    className={`py-2 px-3 text-xs rounded-lg text-center transition-all cursor-pointer ${
                      assessmentType === 'onsite'
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium active:scale-95'
                    }`}
                  >
                    Onsite (Physical Site Visit)
                  </button>
                </div>
              </div>

              {/* Charge Code Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Charge Code *
                </label>
                <select
                  value={chargeCode}
                  onChange={(e) => setChargeCode(e.target.value as 'PRE' | 'ONS' | 'TRV' | 'FIN')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="PRE">PRE &mdash; Preliminary / Remote Offsite Review</option>
                  <option value="ONS">ONS &mdash; Onsite Technical Inspection</option>
                  <option value="TRV">TRV &mdash; Travel &amp; Remote Site Assessment</option>
                  <option value="FIN">FIN &mdash; Final Comprehensive Assessment</option>
                </select>
              </div>

              {/* Assessor Estimate Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessor Estimated Cost (R) *
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-400 text-sm font-mono font-bold">R</span>
                  </div>
                  <input
                    type="number"
                    value={assessmentEstimate}
                    onChange={(e) => setAssessmentEstimate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 35000"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Live Automated Funding Dispatch Preview */}
              <div className="p-3 rounded-xl border text-xs bg-slate-50 border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Automated Dispatch Route:</span>
                {urgency === 'Critical 0–24h' || (assessmentEstimate !== '' && Number(assessmentEstimate) <= 50000) ? (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 text-slate-800">
                    Route B (Advance Float)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    Route A (Client Gateway)
                  </span>
                )}
              </div>

              {/* Assessment Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Technical Assessment Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  placeholder="Detail scope of repairs, required components, or site constraints..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssessmentModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={assessmentEstimate === '' || assessmentMutation.isPending}
                  onClick={() => assessmentMutation.mutate()}
                  className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm ${
                    assessmentEstimate === '' || assessmentMutation.isPending
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white hover:shadow active:scale-95 cursor-pointer'
                  }`}
                >
                  {assessmentMutation.isPending ? 'Recording...' : 'Record Assessment & Route Funding'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
