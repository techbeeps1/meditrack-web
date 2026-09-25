import { WorkOrderStatus } from './workOrder';

export interface StatusEvent {
  id: string;
  work_order_id: string;
  status: WorkOrderStatus;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  actor_role?: string;
  previous_hash: string;
  current_hash: string;
  notes?: string | null;
  metadata?: string | null;
  created_at: string;
}

export interface AuditChainIntegrity {
  is_tamper_free: boolean;
  verified_events_count: number;
  error?: string | null;
  verified_at: string;
}

export interface AuditChainResponse {
  work_order_id: string;
  tracking_number: string;
  current_status: WorkOrderStatus;
  chain_length: number;
  integrity: AuditChainIntegrity;
  events: StatusEvent[];
}
