import api from './api';
import { ApiResponse } from '@/types';
import { LedgerAnchor, MerkleInclusionProof, LedgerAuditReport } from '@/types/ledger';

export const ledgerService = {
  async getAnchors(params?: { page?: number; limit?: number }) {
    const res = await api.get<ApiResponse<LedgerAnchor[]>>('/ledger', { params });
    return {
      anchors: res.data.data || [],
      meta: res.data.meta
    };
  },

  async getAnchorById(id: string) {
    const res = await api.get<ApiResponse<LedgerAnchor>>(`/ledger/${id}`);
    return res.data.data;
  },

  async createBatch() {
    const res = await api.post<ApiResponse<{ anchor: LedgerAnchor; merkleTreeDepth: number; eventCount: number }>>('/ledger/batch');
    return res.data.data;
  },

  async getProofForEvent(eventId: string) {
    const res = await api.get<ApiResponse<MerkleInclusionProof>>(`/ledger/proof/${eventId}`);
    return res.data.data;
  },

  async runFullAudit() {
    const res = await api.get<ApiResponse<LedgerAuditReport>>('/ledger/audit-ledger');
    return res.data.data;
  }
};
