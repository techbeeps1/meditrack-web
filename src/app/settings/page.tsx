'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { userApi, CreateUserInput, UpdateUserInput } from '@/services/users';
import { facilityApi } from '@/services/facilities';
import { workCategoryApi, WorkCategory } from '@/services/work-categories';
import { User, UserRole, ApproverScope } from '@/types';
import { formatDate } from '@/lib/utils';

const ROLES_LIST: { role: UserRole; label: string; desc: string; color: string }[] = [
  { role: 'ADMIN', label: 'Admin', desc: 'Full platform control, user management, audit verification', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { role: 'APPROVER', label: 'Approver', desc: 'Approves work orders, assigns contractors, closes tickets, settles invoices', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { role: 'CONTRACTOR', label: 'Contractor', desc: 'Executes repair work, updates status, generates invoice claims', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { role: 'INSPECTOR', label: 'Inspector', desc: 'Conducts quality inspections, verifies or rejects completed work', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { role: 'STAFF', label: 'Staff / Nurse', desc: 'Reports medical equipment issues, tracks resolution milestones', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { role: 'AUDITOR', label: 'Auditor', desc: 'Inspects SHA-256 cryptographic logs, verifies hash proofs', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

const APPROVER_SCOPES_LIST: { scope: ApproverScope; label: string; desc: string; color: string }[] = [
  { scope: 'wo_approver', label: 'Work Order Approver', desc: 'Reviews issue details and approves work order budgets', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { scope: 'contractor_approver', label: 'Contractor Approver', desc: 'Assigns contractors to approved work orders and manages contractor reviews', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { scope: 'payment_approver', label: 'Payment Approver', desc: 'Reviews invoice claims and authorizes payment settlements', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

export default function SettingsPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'users' | 'categories'>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Category state
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<WorkCategory | null>(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<WorkCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [categorySuccessMsg, setCategorySuccessMsg] = useState<string | null>(null);

  // User form states
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
    approver_scope: ApproverScope;
    phone: string;
    facility_id: string;
    status: 'active' | 'inactive';
  }>({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
    approver_scope: 'wo_approver',
    phone: '',
    facility_id: '',
    status: 'active'
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter, status: statusFilter }],
    queryFn: () => userApi.getUsers({ search, role: roleFilter, status: statusFilter, limit: 100 })
  });

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => facilityApi.getFacilities({ limit: 100 })
  });

  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['work-categories'],
    queryFn: () => workCategoryApi.getCategories()
  });

  // User Mutations
  const createUserMutation = useMutation({
    mutationFn: (payload: CreateUserInput) => userApi.createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateModalOpen(false);
      resetUserForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create user');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserInput }) => userApi.updateUser(id, payload),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (currentUser && updatedUser && currentUser.id === updatedUser.id) {
        refreshUser();
      }
      setEditingUser(null);
      resetUserForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to update user');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteConfirmUser(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  });

  // Category Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => workCategoryApi.createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-categories'] });
      setIsCategoryModalOpen(false);
      resetCategoryForm();
      setCategorySuccessMsg('Work Category created successfully');
      setTimeout(() => setCategorySuccessMsg(null), 3500);
    },
    onError: (err: any) => {
      setCategoryFormError(err.response?.data?.message || 'Failed to create work category');
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description?: string } }) =>
      workCategoryApi.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-categories'] });
      setEditingCategory(null);
      setIsCategoryModalOpen(false);
      resetCategoryForm();
      setCategorySuccessMsg('Work Category updated successfully');
      setTimeout(() => setCategorySuccessMsg(null), 3500);
    },
    onError: (err: any) => {
      setCategoryFormError(err.response?.data?.message || 'Failed to update work category');
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => workCategoryApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-categories'] });
      setDeleteConfirmCategory(null);
      setCategorySuccessMsg('Work Category removed successfully');
      setTimeout(() => setCategorySuccessMsg(null), 3500);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete work category');
    }
  });

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', description: '' });
    setCategoryFormError(null);
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: WorkCategory) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || ''
    });
    setCategoryFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryFormError(null);
    if (!categoryFormData.name.trim()) {
      setCategoryFormError('Category name is required');
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        payload: {
          name: categoryFormData.name.trim(),
          description: categoryFormData.description.trim() || undefined
        }
      });
    } else {
      createCategoryMutation.mutate({
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim() || undefined
      });
    }
  };

  const resetUserForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'STAFF',
      approver_scope: 'wo_approver',
      phone: '',
      facility_id: '',
      status: 'active'
    });
    setFormError(null);
  };

  const openCreateModal = () => {
    resetUserForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      approver_scope: u.approver_scope || 'general',
      phone: u.phone || '',
      facility_id: u.facility_id || '',
      status: u.status
    });
    setFormError(null);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email is required');
      return;
    }

    if (editingUser) {
      const payload: UpdateUserInput = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        approver_scope: formData.role === 'APPROVER' ? formData.approver_scope : null,
        phone: formData.phone.trim() || null,
        facility_id: formData.facility_id || null,
        status: formData.status
      };
      if (formData.password.trim()) {
        if (formData.password.trim().length < 6) {
          setFormError('New password must be at least 6 characters');
          return;
        }
        payload.password = formData.password.trim();
      }
      updateUserMutation.mutate({ id: editingUser.id, payload });
    } else {
      if (!formData.password || formData.password.length < 6) {
        setFormError('Password is required and must be at least 6 characters');
        return;
      }
      createUserMutation.mutate({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        approver_scope: formData.role === 'APPROVER' ? formData.approver_scope : null,
        phone: formData.phone.trim() || null,
        facility_id: formData.facility_id || null
      });
    }
  };

  const users = usersData?.data || [];
  const facilities = facilitiesData?.data || [];
  const categories: WorkCategory[] = categoriesData?.data || [];

  const filteredCategories = categories.filter((cat) => {
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase();
    return (
      cat.name.toLowerCase().includes(q) ||
      (cat.description && cat.description.toLowerCase().includes(q))
    );
  });

  if (currentUser?.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">
            System administration and user management is restricted to Administrators only.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System &amp; User Administration</h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage user accounts, roles, and work categories &amp; engineering specialties
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New User
              </button>
            )}

            {activeTab === 'categories' && (
              <button
                onClick={openCreateCategoryModal}
                className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Work Category
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-lg overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>User Accounts &amp; Roles</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-100 text-sky-800 rounded-full font-bold">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'categories'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Work Categories &amp; Specialties</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-100 text-indigo-800 rounded-full font-bold">
              {categories.length}
            </span>
          </button>
        </div>

        {/* TAB 1: USERS LIST & MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search user by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Roles</option>
                {ROLES_LIST.map((r) => (
                  <option key={r.role} value={r.role}>{r.label} ({r.role})</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">User Details</th>
                      <th className="py-3 px-4">System Role</th>
                      <th className="py-3 px-4">Facility / Location</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isUsersLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Loading system users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No users found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const roleObj = ROLES_LIST.find((r) => r.role === u.role) || {
                          label: u.role,
                          color: 'bg-slate-50 text-slate-700 border-slate-200'
                        };
                        const facName = facilities.find((f) => f.id === u.facility_id)?.name || u.facility_name || 'All Facilities';
                        const isSelf = u.id === currentUser.id;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{u.name}</span>
                                    {isSelf && (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded font-medium">You</span>
                                    )}
                                  </div>
                                  <div className="text-slate-500 text-[11px] font-mono">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${roleObj.color}`}>
                                  {roleObj.label}
                                </span>
                                {u.role === 'APPROVER' && (
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                                    APPROVER_SCOPES_LIST.find((s) => s.scope === u.approver_scope)?.color || 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}>
                                    {APPROVER_SCOPES_LIST.find((s) => s.scope === u.approver_scope)?.label || 'General Approver'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {facName}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {u.phone || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                u.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              {formatDate(u.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="px-2.5 py-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition"
                                  title="Edit user details or name"
                                >
                                  Edit
                                </button>
                                {!isSelf && (
                                  <button
                                    onClick={() => setDeleteConfirmUser(u)}
                                    className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition"
                                    title="Delete user"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WORK CATEGORIES & ENGINEERING SPECIALTIES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {categorySuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{categorySuccessMsg}</span>
                </div>
              </div>
            )}

            {/* Filter & Action Bar */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex-1 w-full relative">
                <input
                  type="text"
                  placeholder="Search work category or engineering specialty..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Total Categories: <span className="font-bold text-slate-800">{categories.length}</span>
              </div>
            </div>

            {/* Categories Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Category / Specialty Name</th>
                      <th className="py-3 px-4">Engineering Scope &amp; Description</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isCategoriesLoading ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600 mb-2"></div>
                          <p>Loading work categories...</p>
                        </td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          <p className="font-semibold text-slate-600">No work categories found</p>
                          <p className="text-[11px] mt-0.5 text-slate-400">
                            {categorySearch ? 'No category matches your search filter' : 'Click "Add Work Category" to define a new category'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs border border-sky-200 shrink-0">
                              {cat.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{cat.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {cat.id}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-md">
                            {cat.description || (
                              <span className="text-slate-400 italic">No description provided</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {cat.created_at ? formatDate(cat.created_at) : 'System Default'}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => openEditCategoryModal(cat)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:bg-sky-50 border border-sky-200 rounded transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmCategory(cat)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT USER */}
        {(isCreateModalOpen || editingUser) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingUser ? `Edit User: ${editingUser.name}` : 'Create New System User'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingUser ? 'Update user profile, name, assigned role, or password' : 'Add a new member to the MediTrack platform'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Dr. John Doe / Nurse Sarah"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="user@meditrack.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Platform Role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500 font-semibold"
                    >
                      {ROLES_LIST.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label} ({r.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.role === 'APPROVER' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approver Functional Scope <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.approver_scope}
                        onChange={(e) => setFormData({ ...formData, approver_scope: e.target.value as ApproverScope })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500 text-slate-900"
                      >
                        {APPROVER_SCOPES_LIST.map((s) => (
                          <option key={s.scope} value={s.scope}>
                            {s.label} — {s.desc}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Facility / Hospital
                    </label>
                    <select
                      value={formData.facility_id}
                      onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">All Facilities / Unrestricted</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.city || 'Facility'})</option>
                      ))}
                    </select>
                  </div>

                  {editingUser && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive / Suspended</option>
                      </select>
                    </div>
                  )}

                  <div className={editingUser ? 'sm:col-span-1' : 'sm:col-span-2'}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingUser ? 'Reset Password (optional)' : 'Account Password *'}
                    </label>
                    <input
                      type="password"
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 6 characters'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Selected Role Permission:</span>{' '}
                  {ROLES_LIST.find((r) => r.role === formData.role)?.desc}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending
                      ? 'Saving...'
                      : editingUser
                      ? 'Update User'
                      : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DELETE CONFIRMATION */}
        {deleteConfirmUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteConfirmUser.name}</span> ({deleteConfirmUser.email})? This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteUserMutation.mutate(deleteConfirmUser.id)}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  {deleteUserMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT WORK CATEGORY */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Work Category'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define engineering specialty, medical equipment scope, and contractor matching category
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
                {categoryFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-medium">
                    {categoryFormError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category / Specialty Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Biomedical Equipment, HVAC, Dental Systems"
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This name will appear across Work Orders and Contractor Specialty dropdowns.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Engineering Scope &amp; Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Diagnostic life support, MRI, X-ray calibration, ventilator checks..."
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategory(null);
                    }}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    {createCategoryMutation.isPending || updateCategoryMutation.isPending
                      ? 'Saving...'
                      : editingCategory
                      ? 'Update Category'
                      : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DELETE WORK CATEGORY CONFIRMATION */}
        {deleteConfirmCategory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-900">Delete Work Category</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete the category <span className="font-semibold text-slate-800">&quot;{deleteConfirmCategory.name}&quot;</span>? This will remove it from future Work Order &amp; Contractor dropdowns.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCategory(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteCategoryMutation.mutate(deleteConfirmCategory.id)}
                  disabled={deleteCategoryMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  {deleteCategoryMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
