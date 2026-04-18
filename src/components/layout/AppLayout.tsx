import React from 'react';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { SharedSidebar } from './SharedSidebar';
import { Role } from '@/features/auth/auth.types';
import { Bell, MessageSquare, Search } from 'lucide-react';
// IMPORT THE NEW COMPONENT (Adjust path as needed)
import { ProfileDropdown } from './ProfileDropdown'; 

function roleText(role: Role) {
  if (role === 'OWNER') return 'Chủ sở hữu';
  if (role === 'MANAGER') return 'Quản gia';
  if (role === 'TENANT') return 'Người thuê';
  return 'Quản trị';
}

export default async function AppLayout({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: Role[];
}) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (!allowedRoles.includes(session.role)) redirect('/login');

  return (
    <div className="min-h-screen bg-[#F8F5EE] md:flex">
      <SharedSidebar role={session.role} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 bg-[#F8F5EE]/85 backdrop-blur-xl">
          <div className="flex h-24 items-center justify-between gap-8 px-8 md:px-12">
            <div className="relative hidden w-full max-w-md items-center md:flex">
              <Search className="absolute left-4 h-4 w-4 text-brand-muted/60" />
              <input
                aria-label="Tìm kiếm"
                className="w-full rounded-2xl border border-brand-border/70 bg-white py-3.5 pl-11 pr-4 text-sm text-brand-ink outline-none transition-all focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20 placeholder:text-brand-muted/70"
                placeholder="Tìm tài sản, hợp đồng, hóa đơn..."
                type="text"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <button aria-label="Tin nhắn" className="flex h-12 w-12 items-center justify-center rounded-2xl text-brand-muted transition-colors hover:bg-brand-soft hover:text-brand-ink" title="Tin nhắn" type="button">
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button aria-label="Thông báo" className="flex h-12 w-12 items-center justify-center rounded-2xl text-brand-muted transition-colors hover:bg-brand-soft hover:text-brand-ink" title="Thông báo" type="button">
                  <Bell className="h-5 w-5" />
                </button>
              </div>

              <div className="h-8 w-px bg-brand-border/60" />

              {/* REPLACED SPARKLES ICON WITH PROFILE DROPDOWN */}
              <ProfileDropdown 
                email={session.email} 
                roleLabel={roleText(session.role)} 
              />
              
            </div>
          </div>
        </header>

        <main className="px-8 pb-12 pt-4 md:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}