import api from './api';
import { ApiResponse, User, UserRole } from '@/types';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
  facility_id?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  phone?: string | null;
  facility_id?: string | null;
  status?: 'active' | 'inactive';
}

export const userApi = {
  getUsers: async (params?: { role?: string; status?: string; search?: string; page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<User[]>>('/users', { params });
    return res.data;
  },

  getUserById: async (id: string) => {
    const res = await api.get<ApiResponse<User>>(`/users/${id}`);
    return res.data.data;
  },

  createUser: async (payload: CreateUserInput) => {
    const res = await api.post<ApiResponse<User>>('/users', payload);
    return res.data.data;
  },

  updateUser: async (id: string, payload: UpdateUserInput) => {
    const res = await api.patch<ApiResponse<User>>(`/users/${id}`, payload);
    return res.data.data;
  },

  deleteUser: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/users/${id}`);
    return res.data;
  }
};
