import api from './api';
import { ApiResponse } from '@/types';

export interface DashboardSummary {
  workOrders: {
    byStatus: {
      reported: number;
      approved: number;
      assigned: number;
      in_progress: number;
      completed: number;
      verified: number;
      closed: number;
      total: number;
    };
    byPriority: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  facilities: {
    total: number;
    items: Array<{
      id: string;
      name: string;
      code: string;
      type: string;
      status: string;
      totalWorkOrders: number;
      activeWorkOrders: number;
    }>;
  };
  contractors: {
    compliant: number;
    expiring_soon: number;
    non_compliant: number;
    total: number;
  };
  invoices: {
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    totalApproved: number;
    count: number;
  };
  recentEvents: Array<{
    id: string;
    workOrderId: string;
    workOrderTracking: string;
    workOrderTitle: string;
    status?: string;
    fromStatus?: string;
    toStatus: string;
    actorName: string;
    notes: string;
    createdAt: string;
    eventHash: string;
  }>;
}

export const dashboardApi = {
  getSummary: async () => {
    const res = await api.get<ApiResponse<DashboardSummary>>('/dashboard/summary');
    return res.data.data;
  }
};
