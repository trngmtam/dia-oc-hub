'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, CheckCircle2, Link2, Phone, ShieldCheck, UserRound, Building2 } from 'lucide-react';
import { completeGoogleOnboarding, confirmGoogleAccountLink } from '@/features/auth/auth.actions';
import { Role } from '@/features/auth/auth.types';

type GoogleOnboardingFormProps = {
  state:
    | {
        mode: 'create';
        providerEmail: string;
        fullName: string;
      }
    | {
        mode: 'link';
        providerEmail: string;
        fullName: string;
        existingFullName: string;
        existingRole: Role;
      };
};

const roleOptions: {
  value: Extract<Role, 'OWNER' | 'MANAGER' | 'TENANT'>;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'OWNER', label: 'Chủ sở hữu', icon: Building2 },
  { value: 'MANAGER', label: 'Quản gia', icon: ShieldCheck },
  { value: 'TENANT', label: 'Người thuê', icon: UserRound },
];

function roleLabel(role: Role) {
  if (role === 'OWNER') return 'Chủ sở hữu';
  if (role === 'MANAGER') return 'Quản gia';
  if (role === 'TENANT') return 'Người thuê';
  return 'Quản trị';
}

export function GoogleOnboardingForm({ state }: GoogleOnboardingFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<Extract<Role, 'OWNER' | 'MANAGER' | 'TENANT'>>('TENANT');
  const [phone, setPhone] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleCreateContinue = () => {
    setError('');
    setFieldErrors({});
    setConfirming(true);
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setError('');
    setFieldErrors({});

    const response = await completeGoogleOnboarding({ role, phone });
    if (response.success && response.data?.redirectTo) {
      router.push(response.data.redirectTo);
      return;
    }

    setFieldErrors(response.errors || {});
    setError(response.message || 'Không thể hoàn tất tài khoản Google vào lúc này');
    setLoading(false);
  };

  const handleConfirmLink = async () => {
    setLoading(true);
    setError('');

    const response = await confirmGoogleAccountLink({ confirmed: true });
    if (response.success && response.data?.redirectTo) {
      router.push(response.data.redirectTo);
      return;
    }

    setError(response.message || 'Không thể liên kết tài khoản Google vào lúc này');
    setLoading(false);
  };

  if (state.mode === 'link') {
    return (
      <div className="space-y-6">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="rounded-3xl border border-brand-border bg-brand-soft/60 p-5">
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-brand-primary-deep" />
            <p className="font-semibold text-brand-ink">Đã tìm thấy tài khoản hiện có</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="shell-muted p-4 text-sm text-brand-ink">
              <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Email Google</span>
              <span className="mt-2 block font-semibold">{state.providerEmail}</span>
            </div>
            <div className="shell-muted p-4 text-sm text-brand-ink">
              <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Tài khoản hiện có</span>
              <span className="mt-2 block font-semibold">{state.existingFullName}</span>
            </div>
            <div className="shell-muted p-4 text-sm text-brand-ink md:col-span-2">
              <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Vai trò</span>
              <span className="mt-2 block font-semibold">{roleLabel(state.existingRole)}</span>
            </div>
          </div>
        </div>

        <button className="btn-primary px-5 py-4 text-base" disabled={loading} onClick={() => void handleConfirmLink()} type="button">
          <span>{loading ? 'Đang liên kết...' : 'Liên kết và đăng nhập'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {confirming ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-brand-border bg-brand-soft/60 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-brand-primary-deep" />
              <p className="font-semibold text-brand-ink">Xác nhận thông tin trước khi tạo tài khoản Google</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="shell-muted p-4 text-sm text-brand-ink">
                <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Họ và tên</span>
                <span className="mt-2 block font-semibold">{state.fullName}</span>
              </div>
              <div className="shell-muted p-4 text-sm text-brand-ink">
                <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Email Google</span>
                <span className="mt-2 block font-semibold">{state.providerEmail}</span>
              </div>
              <div className="shell-muted p-4 text-sm text-brand-ink">
                <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Vai trò</span>
                <span className="mt-2 block font-semibold">{roleLabel(role)}</span>
              </div>
              <div className="shell-muted p-4 text-sm text-brand-ink">
                <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Số điện thoại</span>
                <span className="mt-2 block font-semibold">{phone}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary px-5 py-4 text-base" onClick={() => setConfirming(false)} type="button">
              Chỉnh sửa thông tin
            </button>
            <button className="btn-primary px-5 py-4 text-base" disabled={loading} onClick={() => void handleCreateAccount()} type="button">
              <span>{loading ? 'Đang tạo tài khoản...' : 'Xác nhận và tiếp tục'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {roleOptions.map((option) => (
              <button
                className={`rounded-3xl border p-5 text-left transition ${
                  role === option.value
                    ? 'border-amber-300 bg-amber-50 shadow-sm'
                    : 'border-brand-border bg-white/70 hover:bg-brand-soft/50'
                }`}
                key={option.value}
                onClick={() => setRole(option.value)}
                type="button"
              >
                <option.icon className="h-5 w-5 text-brand-primary-deep" />
                <p className="mt-4 font-semibold text-brand-ink">{option.label}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted" htmlFor="google-phone">
              Số điện thoại
            </label>
            <div className="input-shell flex items-center gap-3 px-4 py-0">
              <Phone className="h-4 w-4 text-brand-muted" />
              <input
                className="w-full border-0 bg-transparent px-0 py-3.5 outline-none"
                id="google-phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0909 000 000"
                type="tel"
                value={phone}
              />
            </div>
            {fieldErrors.phone ? <p className="text-xs text-red-600">{fieldErrors.phone[0]}</p> : null}
          </div>

          <button className="btn-primary px-5 py-4 text-base" onClick={handleCreateContinue} type="button">
            <span>Tiếp tục</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
