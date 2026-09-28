import api from './api';
import { ApiResponse } from '@/types';

export interface SystemSettings {
  currency: string;
  currency_symbol: string;
  system_name?: string;
  organization_name?: string;
  [key: string]: any;
}

export const settingsApi = {
  getSettings: async () => {
    const res = await api.get<ApiResponse<SystemSettings>>('/settings');
    return res.data.data;
  },

  updateSettings: async (settings: Partial<SystemSettings>) => {
    const res = await api.patch<ApiResponse<SystemSettings>>('/settings', settings);
    return res.data.data;
  }
};
