export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical' | 'work_order' | 'inspection' | 'invoice';
  link?: string | null;
  is_read: number | boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}
