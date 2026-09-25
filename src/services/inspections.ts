import api from './api';
import { ApiResponse } from '@/types';
import { Inspection } from '@/types/inspection';

export const inspectionApi = {
  getInspections: async (params?: {
    result?: string;
    inspector_id?: string;
    facility_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get<ApiResponse<Inspection[]>>('/inspections', { params });
    return res.data;
  },

  getInspectionById: async (id: string) => {
    const res = await api.get<ApiResponse<Inspection>>(`/inspections/${id}`);
    return res.data.data;
  },

  createInspection: async (formData: FormData) => {
    const res = await api.post<ApiResponse<Inspection>>('/inspections', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.data;
  }
};
