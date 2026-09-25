export type InspectionResult = 'PASS' | 'FAIL';

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  photo_url: string;
  caption?: string | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  work_order_id: string;
  work_order_tracking?: string;
  work_order_title?: string;
  work_order_status?: string;
  facility_name?: string;
  facility_code?: string;
  inspector_id: string;
  inspector_name?: string;
  inspector_email?: string;
  result: InspectionResult;
  checklist_results?: string | null;
  observations: string;
  recommendations?: string | null;
  photo_count?: number;
  photos?: InspectionPhoto[];
  inspected_at: string;
  created_at: string;
}

export interface CreateInspectionInput {
  work_order_id: string;
  result: InspectionResult;
  checklist_results?: string;
  observations: string;
  recommendations?: string;
}
