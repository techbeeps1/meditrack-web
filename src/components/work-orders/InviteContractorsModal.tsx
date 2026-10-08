'use client';

import React, { useState, useEffect } from 'react';
import { WorkOrder } from '@/types/workOrder';
import { User } from '@/types';
import { workOrderService } from '@/services/work-orders';
import { userApi } from '@/services/users';
import {
  Users,
  UserCheck,
  Send,
  X,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  ShieldCheck,
  Building2,
  Mail,
  Info
} from 'lucide-react';

interface InviteContractorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  onSuccess: (updatedWorkOrder: WorkOrder) => void;
}

export const InviteContractorsModal: React.FC<InviteContractorsModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  onSuccess
}) => {
  const [invitationMode, setInvitationMode] = useState<'single' | 'multi'>('multi');
  const [contractors, setContractors] = useState<User[]>([]);
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);
  const [invitationNotes, setInvitationNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingContractors, setFetchingContractors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available contractors when opened
  useEffect(() => {
    if (!isOpen) return;

    const fetchContractorsList = async () => {
      try {
        setFetchingContractors(true);
        setError(null);
        const res = await userApi.getUsers();
        const usersList: User[] = Array.isArray(res) ? res : (res.data || []);
        const contractorUsers = usersList.filter(
          (u: User) => u.role?.toUpperCase() === 'CONTRACTOR'
        );
        setContractors(contractorUsers);

        // Pre-select already invited contractors if any
        if (workOrder.invited_contractor_ids) {
          try {
            const parsed = JSON.parse(workOrder.invited_contractor_ids);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedContractorIds(parsed);
              setInvitationMode(parsed.length > 1 ? 'multi' : 'single');
              return;
            }
          } catch (e) {}
        }

        // Default initial selection
        if (contractorUsers.length > 0) {
          if (contractorUsers.length >= 2) {
            setSelectedContractorIds([contractorUsers[0].id, contractorUsers[1].id]);
          } else {
            setSelectedContractorIds([contractorUsers[0].id]);
            setInvitationMode('single');
          }
        }
      } catch (err: any) {
        console.error('Failed to load contractor users:', err);
        setError('Failed to retrieve registered contractors list.');
      } finally {
        setFetchingContractors(false);
      }
    };

    fetchContractorsList();
  }, [isOpen, workOrder]);

  if (!isOpen) return null;

  const toggleContractorSelection = (contractorId: string) => {
    if (invitationMode === 'single') {
      setSelectedContractorIds([contractorId]);
    } else {
      if (selectedContractorIds.includes(contractorId)) {
        setSelectedContractorIds(selectedContractorIds.filter((id) => id !== contractorId));
      } else {
        if (selectedContractorIds.length >= 3) {
          setError('Multi-contractor competitive bidding allows a maximum of 3 contractors.');
          return;
        }
        setError(null);
        setSelectedContractorIds([...selectedContractorIds, contractorId]);
      }
    }
  };

  const handleModeChange = (mode: 'single' | 'multi') => {
    setInvitationMode(mode);
    setError(null);
    if (mode === 'single') {
      if (selectedContractorIds.length > 1) {
        setSelectedContractorIds([selectedContractorIds[0]]);
      }
    } else {
      if (selectedContractorIds.length === 1 && contractors.length > 1) {
        const nextCandidate = contractors.find((c) => c.id !== selectedContractorIds[0]);
        if (nextCandidate) {
          setSelectedContractorIds([selectedContractorIds[0], nextCandidate.id]);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedContractorIds.length === 0) {
      setError('Please select at least one contractor to invite.');
      return;
    }

    if (invitationMode === 'single' && selectedContractorIds.length !== 1) {
      setError('Single contractor mode requires exactly 1 contractor.');
      return;
    }

    if (invitationMode === 'multi' && (selectedContractorIds.length < 2 || selectedContractorIds.length > 3)) {
      setError('Multi-contractor mode requires selecting between 2 and 3 contractors.');
      return;
    }

    try {
      setLoading(true);
      const updated = await workOrderService.inviteContractors(workOrder.id, {
        invitationMode,
        contractorIds: selectedContractorIds,
        invitationNotes: invitationNotes.trim() || undefined
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to send contractor invitations:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Invite Contractor(s) for Quoting
              </h3>
              <p className="text-xs text-slate-400">
                Work Order {workOrder.tracking_number} • Direct assignment or multi-party competitive blind bidding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Invitation Mode Selection Toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quoting Procurement Model
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleModeChange('single')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  invitationMode === 'single'
                    ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">Single Contractor</span>
                  <UserCheck className={`w-4 h-4 ${invitationMode === 'single' ? 'text-cyan-400' : 'text-slate-500'}`} />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Invite 1 designated specialist contractor directly for quote submission.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('multi')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  invitationMode === 'multi'
                    ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">Multi-Contractor (Competitive)</span>
                  <Users className={`w-4 h-4 ${invitationMode === 'multi' ? 'text-cyan-400' : 'text-slate-500'}`} />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Invite 2 to 3 candidate contractors for competitive blind quoting.
                </p>
              </button>
            </div>
          </div>

          {/* Contractors Selection List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Candidate Contractor{invitationMode === 'multi' ? 's (2 to 3)' : ''}
              </label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-cyan-400">
                {selectedContractorIds.length} {invitationMode === 'multi' ? '/ 3' : 'selected'}
              </span>
            </div>

            {fetchingContractors ? (
              <div className="p-8 text-center text-slate-400 bg-slate-800/30 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="text-sm">Loading registered contractors...</span>
              </div>
            ) : contractors.length === 0 ? (
              <div className="p-6 text-center text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/30 text-sm">
                No active contractors found in the database.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {contractors.map((contractor) => {
                  const isSelected = selectedContractorIds.includes(contractor.id);
                  return (
                    <div
                      key={contractor.id}
                      onClick={() => toggleContractorSelection(contractor.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white ring-1 ring-cyan-500/20'
                          : 'bg-slate-800/30 border-slate-800 text-slate-300 hover:bg-slate-800/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-cyan-400">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-cyan-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>{contractor.name}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>{contractor.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                          Registered Contractor
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Special Instructions / Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Procurement Instructions / Scope Notes (Optional)
            </label>
            <textarea
              value={invitationNotes}
              onChange={(e) => setInvitationNotes(e.target.value)}
              placeholder="e.g. Please provide itemized component pricing, lead times, and standard 12-month warranty terms."
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
            />
          </div>

          {/* Blind Quoting Protocol Notice */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Blind Quoting Governance Active:</span>
              <p className="text-slate-400 mt-0.5">
                Invited contractors will only see task descriptions and site photos. Internal engineering estimates, line-item budgets, and competitor bids remain strictly confidential.
              </p>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || selectedContractorIds.length === 0}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Invitations...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {invitationMode === 'single'
                    ? 'Invite Selected Contractor'
                    : `Invite ${selectedContractorIds.length} Contractors for Bidding`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
