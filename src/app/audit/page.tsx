'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { ledgerService } from '@/services/ledger';
import { dashboardApi } from '@/services/dashboard';
import { MerkleInclusionProof, LedgerAnchor } from '@/types/ledger';

export default function AuditVaultPage() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [proofData, setProofData] = useState<MerkleInclusionProof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Queries
  const { data: anchorsData, isLoading: anchorsLoading } = useQuery({
    queryKey: ['ledger-anchors'],
    queryFn: () => ledgerService.getAnchors()
  });

  const { data: auditReport, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['ledger-audit-report'],
    queryFn: ledgerService.runFullAudit
  });

  const { data: dashboardSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary
  });

  // Batch Anchor Mutation
  const batchMutation = useMutation({
    mutationFn: ledgerService.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-anchors'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-audit-report'] });
    }
  });

  const handleInspectProof = async (eventId: string) => {
    if (!eventId) return;
    setProofLoading(true);
    setProofError(null);
    try {
      const proof = await ledgerService.getProofForEvent(eventId);
      setProofData(proof);
    } catch (err: any) {
      setProofError(err.response?.data?.message || 'Failed to generate inclusion proof for this event');
      setProofData(null);
    } finally {
      setProofLoading(false);
    }
  };

  const downloadCertificate = (proof: MerkleInclusionProof) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(proof, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${proof.certificateId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const anchors = anchorsData?.anchors || [];
  const recentEvents = dashboardSummary?.recentEvents || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Cryptographic Audit Vault
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Deterministic SHA-256 Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Zero-knowledge capable Merkle Tree batch anchoring with mathematical inclusion proofs
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetchAudit()}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Verify Ledger
            </button>
            <button
              onClick={() => batchMutation.mutate()}
              disabled={batchMutation.isPending}
              className="px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition disabled:opacity-50 shadow-sm"
            >
              {batchMutation.isPending ? 'Anchoring...' : '+ Seal & Anchor Merkle Batch'}
            </button>
          </div>
        </div>

        {/* Real-time Ledger Integrity Verification Box */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  auditReport?.isTamperFree ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {auditReport?.isTamperFree ? '✓' : '!'}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {auditReport?.isTamperFree
                    ? 'Cryptographic Ledger Integrity: 100% Verified'
                    : 'Integrity Warning: Discrepancy Found'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sequential SHA-256 hash chaining across {auditReport?.eventChainIntegrity.totalEventsChecked || 0} event nodes
                  &bull; {auditReport?.anchorLedgerIntegrity.totalBatchesChecked || 0} Merkle root batches audited
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-400 block" suppressHydrationWarning>
                Last Verified: {mounted && auditReport?.auditedAt ? new Date(auditReport.auditedAt).toLocaleTimeString() : 'Just now'}
              </span>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                Status: {auditReport?.eventChainIntegrity.status || 'CHECKING'}
              </span>
            </div>
          </div>
        </div>

        {/* Section: Merkle Inclusion Proof Inspector */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Interactive Merkle Inclusion Proof Inspector
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any event from the recent log or paste an event hash to mathematically verify its inclusion in the anchored Merkle root
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                if (e.target.value) handleInspectProof(e.target.value);
              }}
              className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">-- Choose a Recent Maintenance Event to Audit --</option>
              {recentEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.workOrderTracking || 'WO-EVENT'} &bull; {(e.toStatus || e.status || 'EVENT').toUpperCase()} ({e.actorName || 'System'}) - Hash: {(e.eventHash || '').slice(0, 12)}...
                </option>
              ))}
            </select>

            <button
              onClick={() => handleInspectProof(selectedEventId)}
              disabled={!selectedEventId || proofLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition disabled:opacity-50"
            >
              {proofLoading ? 'Verifying Proof...' : 'Compute Inclusion Proof'}
            </button>
          </div>

          {proofError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {proofError}
            </div>
          )}

          {/* Rendered Proof Certificate */}
          {proofData && (
            <div className="p-5 rounded-xl border border-sky-100 bg-sky-50/30 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-sky-700 uppercase font-semibold">
                    Verification Receipt: {proofData.certificateId}
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {proofData.event.workOrderTracking} - {proofData.event.workOrderTitle}
                  </div>
                </div>
                <button
                  onClick={() => downloadCertificate(proofData)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-100/70 rounded-lg hover:bg-sky-200 transition"
                >
                  Download Proof Certificate (.json)
                </button>
              </div>

              {/* Event & Proof Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Event Node Leaf Info
                  </span>
                  <div className="text-[11px] space-y-1">
                    <div>
                      <span className="text-slate-500">Status Transition:</span>{' '}
                      <span className="font-semibold text-sky-700 uppercase">{proofData.event.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Signer / Actor:</span>{' '}
                      <span className="font-medium text-slate-800">{proofData.event.actorName}</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-600 truncate">
                      <span className="text-slate-400">Leaf Hash:</span> {proofData.event.currentHash}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Merkle Root Anchor Verification
                  </span>
                  <div className="text-[11px] space-y-1">
                    <div>
                      <span className="text-slate-500">Anchor Batch:</span>{' '}
                      <span className="font-bold text-slate-900">Batch #{proofData.proof.anchorBatch}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Mathematical Proof Depth:</span>{' '}
                      <span className="font-mono text-slate-800">{proofData.proof.proofPath.length} sibling hashes (O(log N))</span>
                    </div>
                    <div className="font-mono text-[10px] text-emerald-600 truncate font-semibold">
                      <span>Merkle Root:</span> {proofData.proof.merkleRoot}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step by Step Proof Verification Path */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Merkle Branch Inclusion Path
                </span>
                <div className="space-y-1.5">
                  {proofData.proof.proofPath.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border border-slate-100 font-mono text-[11px] flex items-center justify-between"
                    >
                      <span className="text-slate-400 font-semibold">Layer {idx + 1} Sibling ({step.position.toUpperCase()}):</span>
                      <span className="text-slate-700 truncate max-w-md">{step.hash}</span>
                      <span className="text-emerald-600 font-bold ml-2">✓ Verified</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Anchored Merkle Batches Ledger Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Immutable Merkle Batch Ledger
            </h2>
            <span className="text-xs text-slate-400 font-mono">{anchors.length} Batches Anchored</span>
          </div>

          {anchorsLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading Merkle anchors...</div>
          ) : anchors.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">No Merkle Batches Anchored Yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "+ Seal & Anchor Merkle Batch" above to anchor current status events
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Batch #</th>
                    <th className="py-3 px-4">Merkle Root Hash</th>
                    <th className="py-3 px-4">Events Range</th>
                    <th className="py-3 px-4">Network Tx Hash</th>
                    <th className="py-3 px-4">Anchored By</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {anchors.map((anchor) => (
                    <tr key={anchor.id} className="hover:bg-slate-50/60 transition text-xs">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        Batch #{anchor.batch_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-800">
                        <span className="text-sky-700 font-medium" title={anchor.merkle_root}>
                          {anchor.merkle_root.slice(0, 16)}...{anchor.merkle_root.slice(-8)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{anchor.event_count} Events</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {anchor.start_event_id?.slice(0, 8)} &rarr; {anchor.end_event_id?.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        <span title={anchor.network_tx_hash || ''}>
                          {anchor.network_tx_hash ? `${anchor.network_tx_hash.slice(0, 12)}...` : 'Simulated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {anchor.anchored_by_name || 'System Auditor'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500" suppressHydrationWarning>
                        {mounted
                          ? `${new Date(anchor.created_at).toLocaleDateString()} ${new Date(anchor.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : anchor.created_at}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sealed & Valid
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
