export interface Facility {
  id: string;
  name: string;
  code: string;
  type: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  total_beds: number;
  status: 'active' | 'inactive' | 'maintenance';
  staff_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFacilityInput {
  name: string;
  code: string;
  type: string;
  address?: string;
  city?: string;
  state?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  total_beds?: number;
  status?: 'active' | 'inactive' | 'maintenance';
}
