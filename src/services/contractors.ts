import api from './api';
import { ApiResponse } from '@/types';
import { Contractor, CreateContractorInput, ContractorDocument } from '@/types/contractor';

export const contractorApi = {
  getContractors: async (params?: {
    search?: string;
    compliance_status?: string;
    specialty?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<ApiResponse<Contractor[]>>('/contractors', { params });
    return res.data;
  },

  getContractorById: async (id: string) => {
    const res = await api.get<ApiResponse<Contractor>>(`/contractors/${id}`);
    return res.data.data;
  },

  createContractor: async (payload: CreateContractorInput) => {
    const res = await api.post<ApiResponse<Contractor>>('/contractors', payload);
    return res.data.data;
  },

  updateContractor: async (id: string, payload: Partial<CreateContractorInput>) => {
    const res = await api.put<ApiResponse<Contractor>>(`/contractors/${id}`, payload);
    return res.data.data;
  },

  uploadDocument: async (id: string, formData: FormData) => {
    const res = await api.post<ApiResponse<ContractorDocument>>(`/contractors/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.data;
  }
};
