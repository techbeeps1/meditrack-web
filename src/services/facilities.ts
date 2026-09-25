import api from './api';
import { ApiResponse } from '@/types';
import { Facility, CreateFacilityInput } from '@/types/facility';

export const facilityApi = {
  getFacilities: async (params?: { search?: string; status?: string; city?: string; page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<Facility[]>>('/facilities', { params });
    return res.data;
  },

  getFacilityById: async (id: string) => {
    const res = await api.get<ApiResponse<Facility>>(`/facilities/${id}`);
    return res.data.data;
  },

  createFacility: async (payload: CreateFacilityInput) => {
    const res = await api.post<ApiResponse<Facility>>('/facilities', payload);
    return res.data.data;
  },

  updateFacility: async (id: string, payload: Partial<CreateFacilityInput>) => {
    const res = await api.put<ApiResponse<Facility>>(`/facilities/${id}`, payload);
    return res.data.data;
  },

  deleteFacility: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/facilities/${id}`);
    return res.data;
  }
};
