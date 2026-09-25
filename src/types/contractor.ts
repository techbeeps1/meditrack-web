export type ComplianceStatus = 'compliant' | 'warning' | 'non_compliant';

export interface ContractorDocument {
  id: string;
  contractor_id: string;
  title: string;
  document_type: string;
  file_url: string;
  expiry_date: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  created_at: string;
}

export interface Contractor {
  id: string;
  name: string;
  registration_number: string;
  specialty: string;
  contact_person?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  compliance_status: ComplianceStatus;
  rating: number;
  document_count?: number;
  active_jobs_count?: number;
  documents?: ContractorDocument[];
  work_orders?: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateContractorInput {
  name: string;
  registration_number: string;
  specialty: string;
  contact_person?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  compliance_status?: ComplianceStatus;
  rating?: number;
}
