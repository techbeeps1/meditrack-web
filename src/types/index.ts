export type UserRole = 'ADMIN' | 'STAFF' | 'APPROVER' | 'CONTRACTOR' | 'INSPECTOR' | 'AUDITOR';

export type ApproverScope = 'wo_approver' | 'contractor_approver' | 'payment_approver' | 'procurement' | 'line_manager' | 'general';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approver_scope?: ApproverScope | null;
  facility_id?: string | null;
  facility_name?: string | null;
  phone?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  errors?: any;
}
