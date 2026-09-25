'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/services/notifications';
import { NotificationItem } from '@/types/notification';

interface NavItem {
  label: string;
  href: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['ADMIN', 'STAFF', 'APPROVER', 'CONTRACTOR', 'INSPECTOR', 'AUDITOR'] },
  { label: 'Facilities', href: '/facilities', roles: ['ADMIN', 'STAFF', 'APPROVER'] },
  { label: 'Work Orders', href: '/work-orders', roles: ['ADMIN', 'STAFF', 'APPROVER', 'CONTRACTOR', 'INSPECTOR', 'AUDITOR'] },
  { label: 'Contractors', href: '/contractors', roles: ['ADMIN', 'APPROVER'] },
  { label: 'Inspections', href: '/inspections', roles: ['ADMIN', 'INSPECTOR'] },
  { label: 'Invoices', href: '/invoices', roles: ['ADMIN', 'APPROVER', 'CONTRACTOR'] },
  { label: 'Audit Vault', href: '/audit', roles: ['ADMIN', 'AUDITOR'] }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, mounted, router]);

  // Notifications Query
  const { data: notifData } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.getNotifications({ limit: 15 }),
    enabled: !!user && mounted,
    refetchInterval: 15000
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  if (!mounted || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" suppressHydrationWarning>
        <div className="text-sm text-gray-500 font-medium" suppressHydrationWarning>
          Loading MediTrack Portal...
        </div>
      </div>
    );
  }

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.is_read) {
      markReadMutation.mutate(n.id);
    }
    if (n.link) {
      setIsNotifOpen(false);
      router.push(n.link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans" suppressHydrationWarning>
      {/* Fixed Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Brand Section */}
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <span className="h-8 w-8 rounded-lg bg-sky-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                M+
              </span>
              <div>
                <span className="font-bold text-sm text-slate-900 tracking-tight block leading-tight">
                  MediTrack
                </span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                  Healthcare Ops
                </span>
              </div>
            </Link>
          </div>

          {/* Vertical Menu Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(`${item.href}`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-xs font-medium rounded-lg transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 font-bold border-l-2 border-sky-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Info & Sign Out */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-[10px] font-semibold text-sky-700 uppercase">{user.role}</div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-700 bg-white border border-slate-200 rounded hover:bg-rose-50 transition shrink-0"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        {/* Top Minimal Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-8">
          <div className="flex items-center space-x-3">
            <h2 className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
              Hospital Infrastructure Operations Command
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition focus:outline-none"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-rose-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Tray Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">Alerts & Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 hover:bg-slate-50/80 cursor-pointer transition flex items-start space-x-3 ${
                            !n.is_read ? 'bg-sky-50/30' : ''
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              !n.is_read ? 'bg-sky-500 ring-2 ring-sky-200' : 'bg-slate-300'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                              {n.message}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              System Online
            </span>
            <span className="text-xs text-slate-500 font-mono">{user.email}</span>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
