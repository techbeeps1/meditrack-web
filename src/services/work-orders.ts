import api from './api';
import { ApiResponse } from '@/types';
import { WorkOrder, WorkOrderPhoto, WorkOrderStatus } from '@/types/workOrder';
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
  }
};
