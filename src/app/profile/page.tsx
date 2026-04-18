import React from 'react';
import { getSession } from '@/lib/session';
import { type Role } from '@/features/auth/auth.types';
import AppLayout from '@/components/layout/AppLayout';
import { Camera, KeyRound, Mail, Shield, User, MapPin, Phone } from 'lucide-react';

function roleText(role: Role) {
  if (role === 'OWNER') return 'Chủ sở hữu';
  if (role === 'MANAGER') return 'Quản gia';
  if (role === 'TENANT') return 'Người thuê';
  return 'Quản trị';
}

export default async function ProfilePage() {
  const session = await getSession();

  // If there's no session, AppLayout will handle the redirect, 
  if (!session) return null;

  // Extract the first letter of the email for the avatar placeholder
  const initial = session.email.charAt(0).toUpperCase();
  const displayName = session.name;

  return (
    <AppLayout allowedRoles={['OWNER', 'MANAGER', 'TENANT', 'ADMIN']}>
      <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-black text-brand-ink font-headline tracking-tight">Hồ sơ cá nhân</h1>
          <p className="mt-2 text-sm font-bold text-brand-muted">
            Quản lý thông tin cá nhân và bảo mật tài khoản của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
          
          {/* --- LEFT COLUMN: Avatar & Summary Card --- */}
          <div className="lg:col-span-1 space-y-6 sticky top-32">
            <div className="shell-card p-8 flex flex-col items-center text-center relative overflow-hidden">
              {/* Soft background glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl" />
              
              <div className="relative group mb-6 mt-4">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary-deep to-brand-primary text-white text-4xl font-black shadow-xl shadow-brand-primary/25 ring-4 ring-white">
                  {initial}
                </div>
                <button 
                  className="absolute bottom-0 right-0 rounded-full bg-white p-2.5 shadow-lg border border-brand-border text-brand-muted hover:text-brand-primary transition-all hover:scale-110 active:scale-95"
                  title="Thay đổi ảnh đại diện"
                  type="button"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <h2 className="text-xl font-black text-brand-ink truncate w-full px-4">{session.name}</h2>
              <p className="text-xs font-bold text-brand-muted mt-1 truncate w-full">{session.email}</p>
              
              <div className="mt-5 warm-badge">
                <Shield className="h-3.5 w-3.5" />
                {roleText(session.role)}
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: Edit Forms --- */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Personal Info Form */}
            <div className="shell-card p-8 sm:p-10">
              <h3 className="mb-8 text-xl font-black text-brand-ink flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
                  <User className="h-5 w-5" />
                </div>
                Thông tin cơ bản
              </h3>

              <form className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Họ và tên</label>
                    <input type="text" className="input-shell" placeholder="Nguyễn Văn A" defaultValue="" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Số điện thoại</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
                      <input type="tel" className="input-shell pl-11" placeholder="09xx xxx xxx" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Địa chỉ</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
                    <input type="text" className="input-shell pl-11" placeholder="Nhập địa chỉ của bạn" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Email đăng nhập</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted/50" />
                    <input type="email" className="input-shell pl-11 opacity-70 cursor-not-allowed" defaultValue={session.email} disabled />
                  </div>
                  <p className="ml-1 mt-2 text-[11px] font-bold text-brand-muted/70">
                    Email này được gắn cố định với tài khoản và không thể thay đổi.
                  </p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button type="button" className="btn-primary w-full sm:w-auto px-10 py-3.5">
                    Lưu thông tin
                  </button>
                </div>
              </form>
            </div>

            {/* Password Form */}
            <div className="shell-card p-8 sm:p-10">
              <h3 className="mb-8 text-xl font-black text-brand-ink flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                Đổi mật khẩu
              </h3>

              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Mật khẩu hiện tại</label>
                  <input type="password" className="input-shell" placeholder="••••••••" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Mật khẩu mới</label>
                    <input type="password" className="input-shell" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-brand-muted">Xác nhận mật khẩu mới</label>
                    <input type="password" className="input-shell" placeholder="••••••••" />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button type="button" className="btn-secondary w-full sm:w-auto px-10 py-3.5">
                    Cập nhật mật khẩu
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}