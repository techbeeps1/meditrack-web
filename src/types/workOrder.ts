export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkOrderStatus =
  | 'reported'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'closed'
  | 'cancelled';

export interface WorkOrderPhoto {
  id: string;
  work_order_id: string;
  photo_url: string;
  caption?: string | null;
  stage: 'initial' | 'in_progress' | 'completed' | 'inspection';
  uploaded_by: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  tracking_number: string;
  title: string;
  description: string;
  facility_id: string;
  facility_name?: string;
  facility_code?: string;
  facility_address?: string;
  facility_city?: string;
  location_details?: string | null;
  category: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  reported_by: string;
  reported_by_name?: string;
  reported_by_email?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  contractor_id?: string | null;
  estimated_cost: number;
  actual_cost: number;
  due_date?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  photo_count?: number;
  photos?: WorkOrderPhoto[];
  approved_by?: string | null;
  assigned_by?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  invoice_status?: 'pending' | 'approved' | 'rejected' | 'paid' | null;
  invoice_total_amount?: number | null;
  events?: Array<{
    id: string;
    work_order_id: string;
    status: WorkOrderStatus;
    actor_id: string;
    actor_name?: string;
    actor_role?: string;
    previous_hash: string;
    current_hash: string;
    notes?: string | null;
    metadata?: any;
    created_at: string;
  }>;
  inspections?: Array<{
    id: string;
    work_order_id: string;
    inspector_id: string;
    inspector_name?: string;
    result: 'PASS' | 'FAIL';
    checklist_results?: string | null;
    observations?: string | null;
    recommendations?: string | null;
    inspected_at: string;
  }>;
}

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  facility_id: string;
  location_details?: string;
  category?: string;
  priority?: WorkOrderPriority;
  estimated_cost?: number;
  due_date?: string;
}
