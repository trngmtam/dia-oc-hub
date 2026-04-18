'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileDropdownProps {
  email: string;
  roleLabel: string;
}

export function ProfileDropdown({ email, roleLabel }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 rounded-2xl p-1 pr-2 transition-all hover:bg-brand-soft focus:outline-none"
        type="button"
        aria-expanded={isOpen}
      >
        <div className="hidden text-right md:block">
          <p className="text-sm font-bold text-brand-ink">{email}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary-deep">
            {roleLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary-deep to-brand-primary text-white shadow-lg shadow-brand-primary/25 transition-transform hover:scale-105">
            <User className="h-5 w-5" />
          </div>
          <ChevronDown className={`h-4 w-4 text-brand-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 origin-top-right rounded-2xl border border-brand-border/90 bg-white p-2 shadow-[0_20px_50px_rgba(217,135,37,0.12)] animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Mobile Info (shows only on small screens where text is hidden) */}
          <div className="mb-2 block border-b border-brand-border/60 p-3 md:hidden">
            <p className="text-sm font-bold text-brand-ink truncate">{email}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary-deep">
              {roleLabel}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-brand-ink transition-colors hover:bg-brand-soft"
            >
              <User className="h-4 w-4 text-brand-primary" />
              Xem hồ sơ
            </Link>
            
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-brand-ink transition-colors hover:bg-brand-soft"
            >
              <Settings className="h-4 w-4 text-brand-muted" />
              Cài đặt
            </Link>

            <div className="my-1 h-px w-full bg-brand-border/60" />

            <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-brand-danger transition-colors hover:bg-red-50"
            >
                <LogOut className="h-4 w-4" />
                Đăng xuất
            </button>

          </div>
        </div>
      )}
    </div>
  );
}