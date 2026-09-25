export type UserRole = 'ADMIN' | 'STAFF' | 'APPROVER' | 'CONTRACTOR' | 'INSPECTOR' | 'AUDITOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
