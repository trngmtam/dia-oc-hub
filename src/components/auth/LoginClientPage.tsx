'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, KeyRound, Mail } from 'lucide-react';
import { loginAction } from '@/features/auth/auth.actions';
import { loginSchema, type LoginInput } from '@/features/auth/auth.validation';

export function LoginClientPage({ googleAuthEnabled }: { googleAuthEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError('');
    const response = await loginAction(data);
    if (response.success && response.data?.redirectTo) {
      router.push(response.data.redirectTo);
      return;
    }
    setError(response.message || 'Không thể đăng nhập lúc này');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F5EE] font-sans antialiased flex items-center justify-center p-6">
      
      {/* This container controls the layout.
        Mobile: flex-col (stacked)
        Desktop (lg): flex-row (side-by-side) with a large gap 
      */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">

        {/* --- LEFT SIDE: Branding --- */}
        {/* On desktop, it aligns left. On mobile, it centers. */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#D98725] text-white shadow-xl shadow-[#D98725]/15 lg:h-20 lg:w-20 lg:rounded-[24px]">
            <Building2 className="h-8 w-8 lg:h-10 lg:w-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1A1A1A] lg:text-5xl">Địa Ốc Hub</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#D98725] opacity-90 lg:mt-4 lg:text-xs">
            Hệ thống quản lý bất động sản
          </p>
          
        </div>

        {/* --- RIGHT SIDE: Card & Links --- */}
        <div className="flex w-full max-w-[460px] flex-col items-center">
          
          <div className="w-full rounded-[48px] border border-[#E8E1D6] bg-white p-8 sm:p-10 shadow-[0_20px_50px_rgba(217,135,37,0.08)]">
            <header className="mb-8 text-center">
              <h2 className="text-2xl font-black text-[#1A1A1A]">Chào mừng bạn quay lại</h2>
              <p className="mt-2 text-sm font-bold text-[#757575]">Đăng nhập để tiếp tục</p>
            </header>

            {error && (
              <div className="mb-6 rounded-2xl bg-[#FCEDED] p-4 text-center text-xs font-bold text-[#D34545]">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Email Input */}
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-[#757575]" htmlFor="email">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757575]/50 transition-colors group-focus-within:text-[#D98725]" />
                  <input
                    {...register('email')}
                    className="w-full rounded-2xl border border-[#E8E1D6] bg-[#F8F5EE] py-[16px] pl-[52px] pr-4 text-[15px] font-bold text-[#1A1A1A] outline-none transition-all focus:border-[#D98725] focus:bg-white focus:ring-4 focus:ring-[#D98725]/10 placeholder:text-[#757575]/70"
                    id="email"
                    placeholder="ban@example.com"
                    type="email"
                  />
                </div>
                {errors.email && <p className="ml-1 text-[11px] font-bold text-[#D34545]">{errors.email.message}</p>}
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-[#757575]" htmlFor="password">Mật khẩu</label>
                <div className="relative group">
                  <KeyRound className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757575]/50 transition-colors group-focus-within:text-[#D98725]" />
                  <input
                    {...register('password')}
                    className="w-full rounded-2xl border border-[#E8E1D6] bg-[#F8F5EE] py-[16px] pl-[52px] pr-4 text-[15px] font-bold text-[#1A1A1A] outline-none transition-all focus:border-[#D98725] focus:bg-white focus:ring-4 focus:ring-[#D98725]/10 placeholder:text-[#757575]/70"
                    id="password"
                    placeholder="••••••••"
                    type="password"
                  />
                </div>
                {errors.password && <p className="ml-1 text-[11px] font-bold text-[#D34545]">{errors.password.message}</p>}
              </div>

              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D98725] py-[16px] text-[15px] font-black text-white transition-all hover:bg-[#C2771F] hover:shadow-lg hover:shadow-[#D98725]/20 active:scale-[0.98] disabled:opacity-50"
                disabled={loading}
                type="submit"
              >
                <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            {googleAuthEnabled && (
              <div className="mt-8">
                <div className="relative mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E8E1D6]" /></div>
                  <span className="relative bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#757575]">Hoặc</span>
                </div>
                <Link
                  className="flex w-full items-center justify-center rounded-2xl border border-[#E8E1D6] py-[14px] text-sm font-bold text-[#1A1A1A] transition-all hover:bg-[#F8F5EE]"
                  href="/auth/google/start"
                >
                  Tiếp tục với Google
                </Link>
              </div>
            )}
          </div>

          {/* Registration Link */}
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[13px] font-bold text-[#757575]">
                Chưa có tài khoản?
              </span>
              <Link className="text-[13px] font-black text-[#D98725] transition-opacity hover:opacity-80" href="/register">
                Tạo tài khoản mới
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}