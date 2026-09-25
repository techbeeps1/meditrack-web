'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoices';
import { workOrderApi } from '@/services/work-orders';
import { contractorApi } from '@/services/contractors';
import { Invoice, InvoiceStatus, CreateInvoiceInput } from '@/types/invoice';
import AppLayout from '@/components/layout/AppLayout';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateInvoiceInput>({
    work_order_id: '',
    contractor_id: '',
    amount: 0,
    tax_amount: 0,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ''
  });

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', selectedStatus, searchQuery],
    queryFn: () =>
      invoiceService.getInvoices({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        search: searchQuery || undefined
      })
  });

  const { data: eligibleWorkOrders } = useQuery({
    queryKey: ['eligible-work-orders'],
    queryFn: () => workOrderApi.getWorkOrders({ limit: 100 }),
    enabled: isCreateModalOpen
  });

  const { data: contractorsData } = useQuery({
    queryKey: ['contractors-list'],
    queryFn: () => contractorApi.getContractors({ limit: 100 }),
    enabled: isCreateModalOpen
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: invoiceService.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsCreateModalOpen(false);
      setFormData({
        work_order_id: '',
        contractor_id: '',
        amount: 0,
        tax_amount: 0,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
      });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to generate invoice');
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: InvoiceStatus; notes?: string }) =>
      invoiceService.updateInvoiceStatus(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(null);
    }
  });

  const invoices = data?.invoices || [];
  const summary = data?.summary || { totalBilled: 0, totalPaid: 0, totalPending: 0, totalApproved: 0 };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Pending Review
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Billing & Invoices</h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify completion, inspect contractor claims, and approve disbursement settlements
            </p>
          </div>
          <button
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition shadow-sm"
          >
            + Create Invoice
          </button>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Billed</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              ${summary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">Cumulative invoices generated</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              ${summary.totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">Awaiting finance approval</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-sky-600 uppercase tracking-wider">Approved for Payment</p>
            <p className="text-2xl font-bold text-sky-600 mt-2">
              ${summary.totalApproved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">Ready for settlement payout</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Settled & Paid</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              ${summary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">Cleared transactions</p>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex space-x-1 overflow-x-auto w-full sm:w-auto">
            {['all', 'pending', 'approved', 'paid', 'rejected'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                  selectedStatus === st
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search invoice #, WO, contractor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading invoice claims...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">No invoices found</p>
              <p className="text-xs text-slate-400 mt-1">Create an invoice for verified or closed work orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Work Order</th>
                    <th className="py-2.5 px-3">Contractor</th>
                    <th className="py-2.5 px-3">Base / Tax</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 text-xs">{inv.work_order_tracking || 'N/A'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">{inv.work_order_title}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 text-xs">{inv.contractor_name || 'N/A'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">{inv.facility_name}</div>
                      </td>
                      <td className="py-3 px-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                        <div>Base: ${Number(inv.amount).toFixed(2)}</div>
                        <div>Tax: ${Number(inv.tax_amount).toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 font-mono whitespace-nowrap">
                        ${Number(inv.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">{getStatusBadge(inv.status)}</td>
                      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(inv.due_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Full Invoice Breakdown"
                            className="inline-flex items-center justify-center p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 rounded-md border border-sky-200 transition-colors shadow-2xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: inv.id, status: 'approved' })}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition"
                            >
                              Approve
                            </button>
                          )}
                          {inv.status === 'approved' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: inv.id, status: 'paid' })}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Generate New Contractor Invoice</h2>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              {actionError && (
                <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {actionError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(formData);
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Work Order (Must be Verified / Completed) *
                  </label>
                  <select
                    required
                    value={formData.work_order_id}
                    onChange={(e) => {
                      const selectedWo = eligibleWorkOrders?.data?.find((w: any) => w.id === e.target.value);
                      setFormData({
                        ...formData,
                        work_order_id: e.target.value,
                        contractor_id: selectedWo?.contractor_id || formData.contractor_id,
                        amount: selectedWo?.estimated_cost ? Number(selectedWo.estimated_cost) : formData.amount
                      });
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Choose Work Order --</option>
                    {eligibleWorkOrders?.data?.map((wo: any) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.tracking_number} - {wo.title} ({wo.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contractor Entity *
                  </label>
                  <select
                    required
                    value={formData.contractor_id}
                    onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Choose Contractor --</option>
                    {contractorsData?.data?.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Base Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tax / VAT ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.tax_amount}
                      onChange={(e) => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-600">Calculated Total Payout:</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    ${((formData.amount || 0) + (formData.tax_amount || 0)).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Notes / Line Items</label>
                  <textarea
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Labor 12 hrs @ $150/hr + Replacement HVAC filters"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Generating...' : 'Submit Invoice Claim'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invoice Detail Modal */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Invoice {selectedInvoice.invoice_number}</h2>
                  <p className="text-xs text-slate-400">Created {new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider block">Contractor</span>
                    <span className="font-semibold text-slate-800">{selectedInvoice.contractor_name}</span>
                    <span className="text-slate-500 block text-[11px]">{selectedInvoice.contractor_email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider block">Work Order</span>
                    <span className="font-semibold text-slate-800">{selectedInvoice.work_order_tracking}</span>
                    <span className="text-slate-500 block text-[11px] truncate">{selectedInvoice.work_order_title}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-b border-slate-100 py-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base Services Fee:</span>
                    <span className="font-mono font-medium">${Number(selectedInvoice.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Taxes & Surcharges:</span>
                    <span className="font-mono font-medium">${Number(selectedInvoice.tax_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Disbursed:</span>
                    <span className="font-mono text-sky-700">${Number(selectedInvoice.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {selectedInvoice.notes && (
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">Notes / Breakdown</span>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-100 text-slate-700">
                      {selectedInvoice.notes}
                    </div>
                  </div>
                )}

                <div className="pt-3 flex justify-between items-center">
                  <div>{getStatusBadge(selectedInvoice.status)}</div>
                  <div className="space-x-2">
                    {selectedInvoice.status === 'pending' && (
                      <>
                        <button
                          onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'rejected' })}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100"
                        >
                          Reject Claim
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'approved' })}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {selectedInvoice.status === 'approved' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: selectedInvoice.id, status: 'paid' })}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700"
                      >
                        Mark as Paid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
