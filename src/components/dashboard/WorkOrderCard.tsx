'use client';

import React from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export interface WorkOrderCardData {
  id: string;
  tracking_number: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  facility_name?: string | null;
  location_details?: string | null;
  created_at: string;
}

interface WorkOrderCardProps {
  workOrder: WorkOrderCardData;
}

export default function WorkOrderCard({ workOrder }: WorkOrderCardProps) {
  const priority = (workOrder.priority || 'medium').toLowerCase();

  // Priority badge styling matching screenshot 2
  const priorityStyles: Record<
    string,
    { badge: string; leftBorder: string }
  > = {
    critical: {
      badge: 'bg-[#FFC6C6] text-[#A31616] border border-[#FFA5A5]',
      leftBorder: 'from-[#F87171] to-[#EF4444]'
    },
    high: {
      badge: 'bg-[#FFE4C4] text-[#B05B07] border border-[#FDC88D]',
      leftBorder: 'from-[#FB923C] to-[#F97316]'
    },
    medium: {
      badge: 'bg-[#F9C381] text-[#904C05] border border-[#EAA757]',
      leftBorder: 'from-[#4FD1C5] to-[#319795]'
    },
    low: {
      badge: 'bg-[#C6F2D6] text-[#0D723B] border border-[#9DE7B7]',
      leftBorder: 'from-[#34D399] to-[#10B981]'
    }
  };

  const style = priorityStyles[priority] || priorityStyles.medium;

  // Format date: "Mon, 6 Oct 2026"
  const formattedDate = (() => {
    try {
      const d = new Date(workOrder.created_at);
      if (isNaN(d.getTime())) return formatDate(workOrder.created_at);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const year = d.getFullYear();
      return `${dayName}, ${dayNum} ${monthName} ${year}`;
    } catch {
      return formatDate(workOrder.created_at);
    }
  })();

  const locationText =
    workOrder.facility_name && workOrder.location_details
      ? `${workOrder.facility_name} - ${workOrder.location_details}`
      : workOrder.facility_name || workOrder.location_details || 'Main Campus';

  return (
    <Link
      href={`/work-orders/${workOrder.id}`}
      className="bg-white rounded-[18px] border border-slate-200/80 shadow-[0px_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-sky-300 transition-all duration-200 flex overflow-hidden group cursor-pointer"
    >
      {/* Left accent gradient bar */}
      <div
        className={`w-1.5 sm:w-2 bg-gradient-to-b ${style.leftBorder} shrink-0`}
      />

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 flex-1 space-y-2.5 min-w-0">
        {/* Row 1: Tracking Number & Title */}
        <div className="flex items-center flex-wrap gap-x-6 gap-y-1 min-w-0">
          <span className="font-mono font-bold text-base sm:text-lg text-slate-900 shrink-0">
            {workOrder.tracking_number}
          </span>
          <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight truncate group-hover:text-sky-700 transition-colors">
            {workOrder.title}
          </span>
        </div>

        {/* Row 2: Priority Pill */}
        <div>
          <span
            className={`px-4 py-0.5 rounded-full text-xs font-semibold capitalize inline-flex items-center shadow-2xs ${style.badge}`}
          >
            {workOrder.priority}
          </span>
        </div>

        {/* Row 3: Facility Location & Date */}
        <div className="flex items-center flex-wrap gap-x-6 gap-y-1.5 text-xs sm:text-[13px] text-slate-500 font-normal pt-0.5">
          {/* Location Pin */}
          <div className="flex items-center gap-1.5 truncate max-w-md">
            <svg
              className="w-4 h-4 text-slate-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">{locationText}</span>
          </div>

          {/* Calendar Date */}
          <div className="flex items-center gap-1.5 shrink-0">
            <svg
              className="w-4 h-4 text-slate-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
