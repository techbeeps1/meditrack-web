'use client';

import React, { useState, useEffect } from 'react';

interface DashboardBannerProps {
  title?: string;
  name?: string;
  subtitle?: string;
  roleBadge?: string;
  actions?: React.ReactNode;
  showDateTime?: boolean;
}

export default function DashboardBanner({
  title,
  name,
  subtitle = "Here's what's happening at the hospital today",
  roleBadge,
  actions,
  showDateTime = true
}: DashboardBannerProps) {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [greetingPrefix, setGreetingPrefix] = useState<string>('Good morning');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour >= 12 && hour < 17) {
        setGreetingPrefix('Good afternoon');
      } else if (hour >= 17 || hour < 4) {
        setGreetingPrefix('Good evening');
      } else {
        setGreetingPrefix('Good morning');
      }

      // Format date: "Mon, 6 Oct 2026"
      const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = now.getDate();
      const monthName = now.toLocaleDateString('en-US', { month: 'short' });
      const year = now.getFullYear();
      setCurrentDate(`${dayName}, ${dayNum} ${monthName} ${year}`);

      // Format time: "11:46 AM"
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(timeStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const displayTitle = title || `${greetingPrefix}, ${name || 'Administrator'}`;

  return (
    <div className="bg-[#F4FBFC] p-6 sm:p-8 lg:py-[40px] lg:px-[30px] rounded-[18px] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 transition-all shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
      {/* Left side: Greeting (Row 1), Name & Badge (Row 2), Subtitle (Row 3) */}
      <div className="space-y-1.5 min-w-0 flex-1">
        {/* Row 1: Time-based Greeting */}
        <div className="text-base sm:text-lg lg:text-xl font-medium text-slate-700 tracking-tight">
          {greetingPrefix},
        </div>

        {/* Row 2: User Name & Role Badge */}
        <div className="flex items-center flex-wrap gap-2.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[36px] xl:text-[40px] font-semibold text-slate-900 tracking-tight leading-[115%] break-words">
            {name || title || 'Administrator'}
          </h1>
          {roleBadge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/90 text-sky-800 border border-sky-200 uppercase shadow-2xs">
              {roleBadge}
            </span>
          )}
        </div>

        {/* Row 3: Subtitle */}
        <p className="text-sm sm:text-base lg:text-[18px] text-[#545454] font-normal leading-normal">
          {subtitle}
        </p>
      </div>

      {/* Right side: Date/Time & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between xl:justify-end gap-4 sm:gap-6 shrink-0 w-full xl:w-auto pt-4 xl:pt-0 border-t border-slate-200/60 xl:border-0">
        {showDateTime && (
          <div className="text-left sm:text-right flex flex-col justify-center">
            <div className="flex items-center sm:justify-end gap-1.5 text-sm sm:text-base lg:text-[18px] font-normal text-[#545454]">
              <svg
                className="w-[18px] h-[18px] text-[#545454] shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{currentDate || 'Loading date...'}</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-[35px] font-normal text-slate-800 tracking-tight leading-tight mt-0.5">
              {currentTime || '--:-- --'}
            </div>
          </div>
        )}

        {actions && (
          <div className="flex flex-col sm:flex-row xl:flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto min-w-[150px]">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
