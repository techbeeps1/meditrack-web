import api from './api';
import { ApiResponse } from '@/types';
import { WorkOrder, WorkOrderPhoto, WorkOrderStatus, SubmitAssessmentInput, ContractorQuotation } from '@/types/workOrder';
import { AuditChainResponse } from '@/types/audit';

export const workOrderApi = {
  getWorkOrders: async (params?: {
    facility_id?: string;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<ApiResponse<WorkOrder[]>>('/work-orders', { params });
    return res.data;
  },

  getWorkOrderById: async (id: string) => {
    const res = await api.get<ApiResponse<WorkOrder>>(`/work-orders/${id}`);
    return res.data.data;
  },

  createWorkOrder: async (formData: FormData) => {
    const res = await api.post<ApiResponse<WorkOrder>>('/work-orders', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.data;
  },

  updateWorkOrder: async (id: string, payload: any) => {
    const res = await api.patch<ApiResponse<WorkOrder>>(`/work-orders/${id}`, payload);
    return res.data.data;
  },

  transitionStatus: async (
    id: string,
    payload: {
      status: WorkOrderStatus;
      notes?: string;
      assigned_to?: string;
      contractor_id?: string;
      actual_cost?: number;
      contractor_quote_ref?: string;
      direct_issue_justification?: string;
    }
  ) => {
    const res = await api.patch<ApiResponse<{ workOrder: WorkOrder; event: any }>>(
      `/work-orders/${id}/status`,
      payload
    );
    return res.data.data;
  },

  getAuditChain: async (id: string) => {
    const res = await api.get<ApiResponse<AuditChainResponse>>(`/work-orders/${id}/audit-chain`);
    return res.data.data;
  },

  verifyIntegrity: async (id: string) => {
    const res = await api.post<ApiResponse<any>>(`/work-orders/${id}/verify-integrity`);
    return res.data;
  },

  uploadPhotos: async (id: string, formData: FormData) => {
    const res = await api.post<ApiResponse<WorkOrderPhoto[]>>(`/work-orders/${id}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.data;
  },

  submitAssessment: async (id: string, payload: SubmitAssessmentInput) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/assessment`, payload);
    return res.data.data;
  },

  assignLeadAssessor: async (
    id: string,
    payload: { leadAssessorId: string; leadAssessorRole: 'works_inspector' | 'works_engineer' }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/assign-lead-assessor`, payload);
    return res.data.data;
  },

  requestEngineer: async (id: string, payload: { reason: string }) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/request-engineer`, payload);
    return res.data.data;
  },

  handleEngineerRequest: async (
    id: string,
    payload: { action: 'fulfill' | 'decline'; engineerId?: string; declineReason?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/handle-engineer-request`, payload);
    return res.data.data;
  },

  reviewEstimate: async (
    id: string,
    payload: { action: 'approve' | 'adjust' | 'reject'; adjustmentNotes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/review-estimate`, payload);
    return res.data.data;
  },

  submitCriticalQuote: async (
    id: string,
    payload: { cost: number; breakdown?: any; notes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/critical-quote`, payload);
    return res.data.data;
  },

  reviewCriticalQuote: async (
    id: string,
    payload: { action: 'approve' | 'adjust'; adjustedCost?: number; engineerNotes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/critical-quote-review`, payload);
    return res.data.data;
  },

  getContractorQuotations: async (id: string) => {
    const res = await api.get<ApiResponse<ContractorQuotation[]>>(`/work-orders/${id}/quotations`);
    return res.data.data;
  },

  inviteContractors: async (
    id: string,
    payload: { invitationMode: 'single' | 'multi'; contractorIds: string[]; invitationNotes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/invite-contractors`, payload);
    return res.data.data;
  },

  submitContractorQuotation: async (
    id: string,
    payload: { amount: number; quote_ref?: string; breakdown?: any; notes?: string }
  ) => {
    const res = await api.post<ApiResponse<ContractorQuotation>>(`/work-orders/${id}/quotations`, payload);
    return res.data.data;
  },

  recommendContractorQuotation: async (
    id: string,
    payload: { quoteId: string; recommendationNotes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/recommend-quotation`, payload);
    return res.data.data;
  },

  reviewContractorRecommendation: async (
    id: string,
    payload: { action: 'approved' | 'reevaluate' | 'reject_quote' | 'rejected'; quoteId?: string; notes?: string }
  ) => {
    const res = await api.post<ApiResponse<WorkOrder>>(`/work-orders/${id}/review-quotation-recommendation`, payload);
    return res.data.data;
  },

  deleteWorkOrder: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean; message: string }>>(`/work-orders/${id}`);
    return res.data;
  },

  clearAllWorkOrders: async () => {
    const res = await api.delete<ApiResponse<{ success: boolean; message: string }>>('/work-orders/clear-all');
    return res.data;
  }
};

export const workOrderService = workOrderApi;

