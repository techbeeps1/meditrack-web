export interface LedgerAnchor {
  id: string;
  batch_number: number;
  start_event_id: string;
  end_event_id: string;
  event_count: number;
  merkle_root: string;
  previous_anchor_root: string;
  anchor_hash: string;
  network_tx_hash?: string | null;
  anchored_by: string;
  anchored_by_name?: string;
  anchored_by_email?: string;
  created_at: string;
}

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export interface MerkleInclusionProof {
  certificateId: string;
  event: {
    id: string;
    workOrderId: string;
    workOrderTracking: string;
    workOrderTitle: string;
    status: string;
    actorName: string;
    timestamp: string;
    currentHash: string;
    previousHash: string;
  };
  proof: {
    leafIndex: number;
    totalLeaves: number;
    merkleRoot: string;
    proofPath: MerkleProofStep[];
    isVerified: boolean;
    anchorBatch: number;
    anchorTx: string;
  };
}

export interface LedgerAuditReport {
  isTamperFree: boolean;
  eventChainIntegrity: {
    totalEventsChecked: number;
    status: string;
    failedEventId?: string | null;
  };
  anchorLedgerIntegrity: {
    totalBatchesChecked: number;
    status: string;
  };
  auditedAt: string;
}
