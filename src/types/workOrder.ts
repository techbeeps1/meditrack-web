export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
export type UrgencyCategory =
  | 'Critical 0–24h'
  | 'Very urgent 2–4 days'
  | 'Urgent 4–8 days'
  | '8+ days or statutory';
export type FundingRoute = 'route_a' | 'route_b';
export type WorkOrderStatus =
  | 'reported'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'closed'
  | 'cancelled';

export type AssessmentType = 'offsite' | 'onsite';
export type ChargeCode = 'PRE' | 'ONS' | 'TRV' | 'EVI' | 'FIN';

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
  urgency_category?: UrgencyCategory;
  funding_route?: FundingRoute;
  status: WorkOrderStatus;
  reported_by: string;
  reported_by_name?: string;
  reported_by_email?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  contractor_id?: string | null;
  contractor_name?: string | null;
  assessment_type?: AssessmentType | null;
  assessor_role?: 'works_engineer' | 'works_inspector' | null;
  assessor_id?: string | null;
  assessor_name?: string | null;
  assessor_email?: string | null;
  lead_assessor_id?: string | null;
  lead_assessor_name?: string | null;
  lead_assessor_role?: 'works_engineer' | 'works_inspector' | null;
  assessor_request_engineer?: number | boolean | null;
  assessor_request_reason?: string | null;
  assessor_request_status?: 'pending' | 'fulfilled' | 'declined' | null;
  assessor_request_engineer_id?: string | null;
  assessor_request_engineer_name?: string | null;
  assessment_hours?: number | null;
  assessment_review_status?: 'pending' | 'approved' | 'adjusted' | 'rejected' | null;
  assessment_adjustment_notes?: string | null;
  assessor_estimate?: number | null;
  charge_code?: ChargeCode | null;
  assessment_notes?: string | null;
  assessment_date?: string | null;
  system_quote_no?: string | null;
  contractor_quote_ref?: string | null;
  direct_issue_justification?: string | null;
  quote_status?: 'under_review' | 'awaiting_client' | 'client_approved' | 'client_declined' | null;
  client_approved_by?: string | null;
  client_approved_at?: string | null;
  client_decline_reason?: string | null;
  signoff_engineer_by?: string | null;
  signoff_engineer_at?: string | null;
  signoff_fm_by?: string | null;
  signoff_fm_at?: string | null;
  signoff_inspector_by?: string | null;
  signoff_inspector_at?: string | null;
  completion_cert_no?: string | null;
  timesheet_data?: string | null;
  timesheet_total_hours?: number | string | null;
  timesheet_submitted_by?: string | null;
  timesheet_submitted_at?: string | null;
  client_recovery_invoice_no?: string | null;
  client_recovery_status?: 'pending' | 'submitted' | 'recovered' | null;
  signoff_rejection_reason?: string | null;
  is_blind_quoted?: boolean;
  estimated_cost: number;
  actual_cost: number;
  estimated_days?: number | null;
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
  urgency_category?: UrgencyCategory;
  funding_route?: FundingRoute;
  estimated_cost?: number;
  due_date?: string;
}

export interface SubmitAssessmentInput {
  assessment_type: AssessmentType;
  assessor_role?: 'works_engineer' | 'works_inspector';
  assessor_estimate?: number;
  charge_code: ChargeCode;
  assessment_notes?: string;
  route_b_override?: boolean;
  refer_to_engineer?: boolean;
  assessment_hours?: number;
  estimated_days?: number;
  due_date?: string;
}

