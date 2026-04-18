import React from 'react';
import { getSession } from '@/lib/session';
import { type Role } from '@/features/auth/auth.types';
import AppLayout from '@/components/layout/AppLayout';
import { Camera, KeyRound, Shield, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import PersonalInfoForm from '@/features/profile/components/PersonalInfoForm';
import PasswordForm from '@/features/profile/components/PasswordForm';

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

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { fullName: true, email: true, phone: true }
  });

  if (!user) return null;

  // Extract the first letter of the email for the avatar placeholder
  const initial = session.email.charAt(0).toUpperCase();

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

              <h2 className="text-xl font-black text-brand-ink truncate w-full px-4">{user.fullName}</h2>
              <p className="text-xs font-bold text-brand-muted mt-1 truncate w-full">{user.email || session.email}</p>
              
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

              <PersonalInfoForm initialData={{
                fullName: user.fullName,
                phone: user.phone || '',
                email: user.email || session.email,
              }} />
            </div>

            {/* Password Form */}
            <div className="shell-card p-8 sm:p-10">
              <h3 className="mb-8 text-xl font-black text-brand-ink flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                Đổi mật khẩu
              </h3>

              <PasswordForm />
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}