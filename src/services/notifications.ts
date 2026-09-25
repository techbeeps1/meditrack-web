import api from './api';
import { NotificationItem } from '@/types/notification';

export const notificationService = {
  async getNotifications(params?: { is_read?: boolean; limit?: number; page?: number }) {
    const res = await api.get('/notifications', { params });
    return {
      notifications: (res.data.data || []) as NotificationItem[],
      unreadCount: Number(res.data.unreadCount || 0)
    };
  },

  async getUnreadCount() {
    const res = await api.get('/notifications/unread-count');
    return Number(res.data.data?.unreadCount || 0);
  },

  async markAsRead(id: string) {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.data as NotificationItem;
  },

  async markAllAsRead() {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  }
};
