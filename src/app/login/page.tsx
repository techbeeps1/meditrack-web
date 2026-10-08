'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import {
  User,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  UserCheck,
  Building2,
  CreditCard,
  FileSpreadsheet,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Plus,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';

const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type LoginFormData = z.infer<typeof loginFormSchema>;

interface DemoRole {
  role: string;
  email: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const DEMO_ROLES: DemoRole[] = [
  {
    role: 'Staff',
    email: 'staff@meditrack.com',
    icon: User
  },
  {
    role: 'Work Approver',
    email: 'approver1@meditrack.com',
    icon: ClipboardCheck
  },
  {
    role: 'Site Inspector',
    email: 'inspector@meditrack.com',
    icon: ClipboardList
  },
  {
    role: 'Site Engineer',
    email: 'engineer@meditrack.com',
    icon: HardHat
  },
  {
    role: 'Contractor Approver',
    email: 'approver2@meditrack.com',
    icon: UserCheck
  },
  {
    role: 'Contractor',
    email: 'contractor@meditrack.com',
    icon: Building2
  },
  {
    role: 'Payment Approver',
    email: 'approver3@meditrack.com',
    icon: CreditCard
  },
  {
    role: 'Auditor',
    email: 'auditor@meditrack.com',
    icon: FileSpreadsheet
  },
  {
    role: 'Admin',
    email: 'admin@meditrack.com',
    icon: ShieldCheck
  }
];

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: 'admin@meditrack.com',
      password: 'Password@123'
    }
  });

  const selectedEmail = watch('email');

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login(data);
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Invalid email or password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectRole = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password@123', { shouldValidate: true });
    setServerError(null);
  };

  return (
    <>
      <style jsx global>{`
        /* Compact Height Mode for Laptops & Zoomed Desktops (Width >= 768px and Height <= 850px) */
        @media (min-width: 768px) and (max-height: 850px) {
          .login-screen-wrapper {
            height: 100vh !important;
            max-height: 100vh !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            overflow: hidden !important;
          }
          .login-header-logo {
            height: 52px !important;
          }
          .login-main-section {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            margin-top: auto !important;
            margin-bottom: auto !important;
          }
          .login-main-card {
            max-width: 900px !important;
            min-height: auto !important;
          }
          .login-left-panel {
            padding: 16px 20px !important;
          }
          .login-demo-grid {
            margin-top: 10px !important;
            margin-bottom: 10px !important;
            gap: 8px !important;
          }
          .login-demo-card {
            padding: 6px 8px !important;
            border-radius: 12px !important;
          }
          .login-demo-icon {
            width: 24px !important;
            height: 24px !important;
          }
          .login-demo-label {
            font-size: 10.5px !important;
          }
          .login-right-panel {
            padding: 20px 28px !important;
          }
          .login-form-title {
            font-size: 24px !important;
            margin-bottom: 4px !important;
          }
          .login-input-box {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .login-submit-btn {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
        }

        /* Super Compact Height Mode for 150%-175% Zoom on Laptops (Width >= 768px and Height <= 660px) */
        @media (min-width: 768px) and (max-height: 660px) {
          .login-screen-wrapper {
            height: 100vh !important;
            max-height: 100vh !important;
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            overflow: hidden !important;
          }
          .login-header-logo {
            height: 38px !important;
          }
          .login-main-card {
            max-width: 820px !important;
          }
          .login-left-panel {
            padding: 10px 14px !important;
          }
          .login-demo-grid {
            margin-top: 6px !important;
            margin-bottom: 6px !important;
            gap: 6px !important;
          }
          .login-demo-card {
            padding: 4px 6px !important;
            border-radius: 10px !important;
          }
          .login-demo-icon {
            width: 20px !important;
            height: 20px !important;
          }
          .login-demo-label {
            font-size: 9.5px !important;
          }
          .login-right-panel {
            padding: 12px 20px !important;
          }
          .login-form-title {
            font-size: 20px !important;
            margin-bottom: 2px !important;
          }
          .login-input-box {
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }
          .login-submit-btn {
            padding-top: 7px !important;
            padding-bottom: 7px !important;
          }
        }
      `}</style>

      <div className="login-screen-wrapper min-h-screen w-full relative flex flex-col justify-between bg-[url('/images/login-bg.jpg')] bg-[#ebf6fc] bg-cover bg-center bg-no-repeat px-4 py-6 sm:px-8 sm:py-8 md:px-12 md:py-8 selection:bg-cyan-200 selection:text-cyan-900">
        {/* Top Header Bar */}
        <header className="w-full max-w-[1280px] mx-auto flex items-center justify-between z-10 flex-shrink-0">
          {/* Top Left Slogan */}
          <div className="hidden sm:block text-slate-500 font-medium text-xs sm:text-sm tracking-wide leading-snug w-48">
            <p>Better Care.</p>
            <p>Faster Response.</p>
          </div>

          {/* Center Logo */}
          <div className="flex-1 flex justify-center py-1">
            <img
              src="/images/login-logo.png"
              alt="QHES App - Quant Hospital Emergency Services"
              className="login-header-logo h-14 sm:h-20 md:h-24 w-auto object-contain mix-blend-multiply transition-transform hover:scale-105"
            />
          </div>

          {/* Top Right Slogan */}
          <div className="hidden sm:block text-right text-slate-500 font-medium text-xs sm:text-sm tracking-wide leading-snug w-48">
            <p>Healthcare</p>
            <p>at Your Fingertips</p>
          </div>
        </header>

        {/* Main Center Content / Login Card */}
        <main className="login-main-section w-full flex-1 flex items-center justify-center py-6 sm:py-8 z-10 min-h-0">
          <div className="login-main-card w-full max-w-[980px] bg-white rounded-[28px] sm:rounded-[36px] shadow-[0px_4px_4px_0px_#00000040] border border-white/90 overflow-hidden flex flex-col lg:flex-row min-h-[540px]">
            
            {/* Left Side: Select Demo User Panel */}
            <div className="login-left-panel lg:w-[54%] p-6 sm:p-7 md:p-8 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-cyan-100/60 bg-[url('/images/login-bg.jpg')] bg-[#ebf6fc] bg-cover bg-left-top bg-no-repeat">
              {/* Top Header */}
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-white/70">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#027D92]/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#027D92]" />
                  </div>
                </div>
                <span className="text-xs sm:text-[13px] font-bold tracking-wider text-[#027D92] uppercase">
                  Select Demo User
                </span>
              </div>

              {/* 3x3 Demo Roles Grid */}
              <div className="login-demo-grid relative z-10 grid grid-cols-3 gap-2.5 sm:gap-3 my-4 sm:my-5">
                {DEMO_ROLES.map((item) => {
                  const Icon = item.icon;
                  const isActive = selectedEmail === item.email;

                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleSelectRole(item.email)}
                      className={`login-demo-card group relative aspect-[1.14/1] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer shadow-[0px_4px_4px_0px_#00000040] ${
                        isActive
                          ? 'bg-white border-2 border-[#027D92] scale-[1.02]'
                          : 'bg-white border border-white/80 hover:border-cyan-100 hover:scale-[1.02]'
                      }`}
                    >
                      <div
                        className={`mb-1 p-1 sm:p-1.5 rounded-xl transition-colors ${
                          isActive
                            ? 'text-[#027D92] bg-[#027D92]/10'
                            : 'text-[#1c3f48] group-hover:text-[#027D92] group-hover:bg-[#027D92]/5'
                        }`}
                      >
                        <Icon className="login-demo-icon w-[26px] h-[26px] sm:w-[35px] sm:h-[35px]" strokeWidth={1.8} />
                      </div>
                      <span
                        className={`login-demo-label text-[10.5px] sm:text-[11.5px] font-semibold leading-tight line-clamp-2 ${
                          isActive ? 'text-[#027D92]' : 'text-[#24454f]'
                        }`}
                      >
                        {item.role}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Banner */}
              <div className="relative z-10 flex items-center gap-3 pt-1">
                <div className="w-10 h-10 rounded-2xl bg-[#027D92] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(2,125,146,0.3)] flex-shrink-0">
                  <Plus className="w-5 h-5" strokeWidth={2.6} />
                </div>
                <div>
                  <div className="font-bold text-[#027D92] text-xs sm:text-sm leading-snug">
                    Secure Access
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-[#027D92]/80 leading-tight mt-0.5">
                    Manage Hospital Operations with ease and efficiency.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Welcome Back Sign In Panel */}
            <div className="login-right-panel lg:w-[46%] bg-[#F5FEFF] p-6 sm:p-8 md:p-10 flex flex-col justify-center">
              <div className="max-w-md w-full mx-auto">
                {/* Header Titles */}
                <div className="mb-6 sm:mb-7">
                  <h1 className="login-form-title text-2xl sm:text-[30px] font-bold text-[#083540] tracking-tight">
                    Welcome Back
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-[#027D92] mt-1">
                    Sign in to your account to continue
                  </p>
                </div>

                {/* Error Message */}
                {serverError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm font-medium">
                    {serverError}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email Field */}
                  <div>
                    <div className="login-input-box relative flex items-center rounded-2xl border-2 border-[#027D92] focus-within:border-[#027D92] focus-within:ring-2 focus-within:ring-[#027D92]/15 transition-all bg-[#F5FEFF] px-4 py-3 sm:py-3.5">
                      <Mail
                        className="w-5 h-5 text-[#083540] flex-shrink-0 mr-3"
                        strokeWidth={1.8}
                      />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="name@hospital.org"
                        className="w-full bg-transparent text-sm sm:text-base text-[#083540] placeholder-[#083540]/40 outline-none font-medium"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1 pl-2 font-medium">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="login-input-box relative flex items-center rounded-2xl border-2 border-[#027D92] focus-within:border-[#027D92] focus-within:ring-2 focus-within:ring-[#027D92]/15 transition-all bg-[#F5FEFF] px-4 py-3 sm:py-3.5">
                      <Lock
                        className="w-5 h-5 text-[#083540] flex-shrink-0 mr-3"
                        strokeWidth={1.8}
                      />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        className="w-full bg-transparent text-sm sm:text-base text-[#083540] placeholder-[#083540]/40 outline-none font-medium tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#083540]/60 hover:text-[#027D92] transition-colors p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-500 mt-1 pl-2 font-medium">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Remember Me & Forgot Password Row */}
                  <div className="flex items-center justify-between pt-1 text-xs sm:text-sm">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={rememberMe}
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          rememberMe
                            ? 'bg-[#027D92] text-white'
                            : 'border-2 border-[#027D92] bg-white'
                        }`}
                      >
                        {rememberMe && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </button>
                      <span className="text-[#027D92] font-medium">Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="text-[#027D92] font-medium hover:underline transition-all"
                    >
                      Forget password?
                    </button>
                  </div>

                  {/* Sign In Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="login-submit-btn w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-[#027D92] hover:bg-[#026c7e] active:scale-[0.99] text-white font-semibold text-base sm:text-[17px] flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(2,125,146,0.3)] hover:shadow-[0_10px_25px_rgba(2,125,146,0.4)] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                    >
                      <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                      <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </main>

        {/* Mobile visible slogans */}
        <div className="sm:hidden flex items-center justify-between text-slate-500 font-medium text-[11px] px-2 py-1 text-center">
          <span>Better Care. Faster Response.</span>
          <span>Healthcare at Your Fingertips</span>
        </div>
      </div>
    </>
  );
}
