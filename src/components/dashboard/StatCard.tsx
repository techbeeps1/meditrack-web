'use client';

import React from 'react';
import Link from 'next/link';

export type StatCardVariant = 'blue' | 'orange' | 'green' | 'purple' | 'teal';

interface StatCardProps {
  href: string;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  variant?: StatCardVariant;
  customIcon?: React.ReactNode;
  bgImageUrl?: string;
  className?: string;
}

export default function StatCard({
  href,
  title,
  value,
  subtitle,
  variant = 'blue',
  customIcon,
  bgImageUrl,
  className = ''
}: StatCardProps) {
  // Theme color styles matching screenshot 2
  const variantStyles: Record<
    StatCardVariant,
    {
      cardBg: string;
      iconBg: string;
      iconBorder: string;
      defaultIcon: React.ReactNode;
    }
  > = {
    blue: {
      cardBg: 'bg-gradient-to-br from-[#EAF8FC] via-[#F2FAFD] to-[#D8F3FA]',
      iconBg: 'bg-[#BFEBF7]',
      iconBorder: 'border-[#9CE1F4]',
      defaultIcon: (
        <svg className="w-7 h-7 text-sky-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
          />
        </svg>
      )
    },
    orange: {
      cardBg: 'bg-gradient-to-br from-[#FFF5EC] via-[#FFF9F3] to-[#FFE6D0]',
      iconBg: 'bg-[#FDD9B8]',
      iconBorder: 'border-[#FCC595]',
      defaultIcon: (
        <svg className="w-7 h-7 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )
    },
    green: {
      cardBg: 'bg-gradient-to-br from-[#EEFAF2] via-[#F5FCF7] to-[#D5F6E2]',
      iconBg: 'bg-[#BAF3D1]',
      iconBorder: 'border-[#9BEEC0]',
      defaultIcon: (
        <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )
    },
    purple: {
      cardBg: 'bg-gradient-to-br from-[#F5F2FE] via-[#FAF8FF] to-[#E6DEFC]',
      iconBg: 'bg-[#DFD4FD]',
      iconBorder: 'border-[#CEBCFB]',
      defaultIcon: (
        <svg className="w-7 h-7 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      )
    },
    teal: {
      cardBg: 'bg-gradient-to-br from-[#E6F8F6] via-[#F2FBFB] to-[#CFF3F0]',
      iconBg: 'bg-[#B6ECE7]',
      iconBorder: 'border-[#94E4DC]',
      defaultIcon: (
        <svg className="w-7 h-7 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      )
    }
  };

  const style = variantStyles[variant] || variantStyles.blue;

  return (
    <Link
      href={href}
      className={`relative overflow-hidden ${style.cardBg} p-4 sm:p-5 lg:p-6 rounded-[20px] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.06)] hover:shadow-[0px_6px_20px_0px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block border border-white/60 group ${className}`}
      style={
        bgImageUrl
          ? {
              backgroundImage: `url(${bgImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3.5 sm:gap-4 lg:gap-5 relative z-10">
        {/* Left Circle Icon Badge */}
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full ${style.iconBg} border ${style.iconBorder} flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 duration-200`}
        >
          {customIcon || style.defaultIcon}
        </div>

        {/* Right Content */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm lg:text-[15px] font-bold text-slate-900 tracking-tight truncate">
            {title}
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-sans truncate">
            {value}
          </div>
          <div className="text-[11px] sm:text-xs lg:text-[13px] text-slate-500 font-normal truncate">
            {subtitle}
          </div>
        </div>
      </div>
    </Link>
  );
}
