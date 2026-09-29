import api from './api';
import { ApiResponse } from '@/types';

export interface WorkCategory {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const workCategoryApi = {
  getCategories: async () => {
    const res = await api.get<ApiResponse<WorkCategory[]>>('/work-categories');
    return res.data;
  },

  getCategoryById: async (id: string) => {
    const res = await api.get<ApiResponse<WorkCategory>>(`/work-categories/${id}`);
    return res.data.data;
  },

  createCategory: async (payload: { name: string; description?: string }) => {
    const res = await api.post<ApiResponse<WorkCategory>>('/work-categories', payload);
    return res.data.data;
  },

  updateCategory: async (id: string, payload: { name: string; description?: string }) => {
    const res = await api.put<ApiResponse<WorkCategory>>(`/work-categories/${id}`, payload);
    return res.data.data;
  },

  deleteCategory: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/work-categories/${id}`);
    return res.data;
  }
};
