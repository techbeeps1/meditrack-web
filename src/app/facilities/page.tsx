'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { facilityApi } from '@/services/facilities';
import { Facility, CreateFacilityInput } from '@/types/facility';
import { useAuth } from '@/hooks/useAuth';

const facilityFormSchema = z.object({
  name: z.string().min(2, 'Facility name is required'),
  code: z.string().min(2, 'Facility code is required (e.g. FAC-01)').toUpperCase(),
  type: z.string().min(1, 'Type is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  total_beds: z.coerce.number().min(0),
  status: z.enum(['active', 'inactive', 'maintenance'])
});

type FacilityFormData = z.infer<typeof facilityFormSchema>;

export default function FacilitiesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch facilities
  const { data, isLoading, isError } = useQuery({
    queryKey: ['facilities', { search, status: statusFilter }],
    queryFn: () =>
      facilityApi.getFacilities({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter
      })
  });

  const facilities = data?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FacilityFormData>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: {
      name: '',
      code: '',
      type: 'Hospital',
      status: 'active',
      total_beds: 100
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: FacilityFormData) => {
      if (editingFacility) {
        return facilityApi.updateFacility(editingFacility.id, formData);
      } else {
        return facilityApi.createFacility(formData as CreateFacilityInput);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      closeModal();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to save facility');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => facilityApi.deleteFacility(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    }
  });

  const openAddModal = () => {
    setEditingFacility(null);
    setFormError(null);
    reset({
      name: '',
      code: '',
      type: 'Hospital',
      city: '',
      state: '',
      address: '',
      contact_name: '',
      contact_phone: '',
      total_beds: 100,
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (fac: Facility) => {
    setEditingFacility(fac);
    setFormError(null);
    reset({
      name: fac.name,
      code: fac.code,
      type: fac.type,
      city: fac.city || '',
      state: fac.state || '',
      address: fac.address || '',
      contact_name: fac.contact_name || '',
      contact_phone: fac.contact_phone || '',
      total_beds: fac.total_beds || 0,
      status: fac.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFacility(null);
    setFormError(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (formData: FacilityFormData) => {
    saveMutation.mutate(formData);
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'APPROVER';
  const canDelete = user?.role === 'ADMIN';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Healthcare Facilities
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage hospital campuses, diagnostic wings, and healthcare infrastructure units.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors shrink-0"
            >
              + Add Facility
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Search by name, code, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div className="flex space-x-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['all', 'active', 'maintenance', 'inactive'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-sky-50 text-sky-700 border border-sky-300 font-semibold'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Facility Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-center">Beds</th>
                  <th className="px-4 py-3">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Loading facilities...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-red-600">
                      Error loading facilities. Please check backend connection.
                    </td>
                  </tr>
                ) : facilities.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No facilities found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  facilities.map((fac) => (
                    <tr key={fac.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-sky-700 whitespace-nowrap">
                        {fac.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs md:text-sm">
                        {fac.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 capitalize whitespace-nowrap">
                        {fac.type}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {fac.city ? `${fac.city}, ${fac.state || ''}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <div>{fac.contact_name || 'N/A'}</div>
                        {fac.contact_phone && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">{fac.contact_phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900 whitespace-nowrap">
                        {fac.total_beds}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                            fac.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : fac.status === 'maintenance'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {fac.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(fac)}
                            className="text-xs font-medium text-sky-600 hover:text-sky-800"
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(fac.id, fac.name)}
                              className="text-xs font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingFacility ? 'Edit Facility' : 'Add New Facility'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Facility Name *
                  </label>
                  <input
                    {...register('name')}
                    placeholder="e.g. Metro General Hospital"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Facility Code *
                    </label>
                    <input
                      {...register('code')}
                      placeholder="e.g. FAC-MGH-01"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    {errors.code && (
                      <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Type *
                    </label>
                    <select
                      {...register('type')}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="Hospital">Hospital</option>
                      <option value="Trauma Center">Trauma Center</option>
                      <option value="Pediatric Hospital">Pediatric Hospital</option>
                      <option value="Diagnostic Lab">Diagnostic Lab</option>
                      <option value="Clinic">Clinic</option>
                      <option value="Urgent Care">Urgent Care</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      {...register('city')}
                      placeholder="e.g. Boston"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      {...register('state')}
                      placeholder="e.g. MA"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      {...register('contact_name')}
                      placeholder="e.g. Dr. Vance"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      {...register('contact_phone')}
                      placeholder="e.g. +1 555-0199"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total Beds
                    </label>
                    <input
                      {...register('total_beds')}
                      type="number"
                      placeholder="100"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Operational Status
                    </label>
                    <select
                      {...register('status')}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || saveMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting || saveMutation.isPending ? 'Saving...' : 'Save Facility'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
