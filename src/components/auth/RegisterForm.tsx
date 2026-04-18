'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail, Phone, UserRound } from 'lucide-react';
import { registerManager, registerOwner, registerTenant } from '@/features/auth/auth.actions';
import type { RegisterInput } from '@/features/auth/auth.validation';

type RegisterFormProps = {
  role: 'OWNER' | 'TENANT' | 'MANAGER';
  googleAuthEnabled?: boolean;
};

export function RegisterForm({ role, googleAuthEnabled = true }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<RegisterInput | null>(null);

  const submitAction =
    role === 'TENANT' ? registerTenant : role === 'MANAGER' ? registerManager : registerOwner;
  const title =
    role === 'TENANT'
      ? 'Tạo tài khoản người thuê'
      : role === 'MANAGER'
        ? 'Tạo tài khoản quản gia'
        : 'Tạo tài khoản chủ sở hữu';
  const subtitle =
    role === 'TENANT'
      ? 'Sau khi đăng ký, bạn có thể nhập mã kết nối căn hộ do chủ nhà hoặc quản gia cung cấp.'
      : role === 'MANAGER'
        ? 'Sau khi đăng ký, bạn có thể nhập mã quản lý tài sản do chủ sở hữu gửi.'
        : 'Sau khi đăng ký, bạn có thể bắt đầu tạo tài sản, phân công quản gia và theo dõi danh mục đầu tư.';

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    setPendingPayload({
      fullName: String(formData.get('fullName') || ''),
      email: String(formData.get('email') || ''),
      phone: String(formData.get('phone') || ''),
      password: String(formData.get('password') || ''),
    });
    setConfirming(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!pendingPayload) return;

    setLoading(true);
    setError('');
    setFieldErrors({});

    const response = await submitAction(pendingPayload);

    if (response.success && response.data?.redirectTo) {
      router.push(response.data.redirectTo);
      return;
    }

    setFieldErrors(response.errors || {});
    setError(response.message || 'Không thể tạo tài khoản lúc này');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_left_top,rgba(245,158,11,0.16),transparent_24rem),linear-gradient(180deg,#fffdfa_0%,#f6efe7_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-2xl shell-card p-6 md:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary-deep">Địa Ốc Hub</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">{title}</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-brand-muted">{subtitle}</p>
          </div>
          <Link className="btn-secondary h-12 w-12 p-0" href="/register">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {confirming && pendingPayload ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-brand-border bg-brand-soft/65 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-brand-primary-deep" />
                <p className="font-semibold text-brand-ink">Xác nhận thông tin trước khi tạo tài khoản</p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="shell-muted p-4 text-sm text-brand-ink">
                  <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Vai trò</span>
                  <span className="mt-2 block font-semibold">{title}</span>
                </div>
                <div className="shell-muted p-4 text-sm text-brand-ink">
                  <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Họ và tên</span>
                  <span className="mt-2 block font-semibold">{pendingPayload.fullName}</span>
                </div>
                <div className="shell-muted p-4 text-sm text-brand-ink">
                  <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Email</span>
                  <span className="mt-2 block font-semibold">{pendingPayload.email}</span>
                </div>
                <div className="shell-muted p-4 text-sm text-brand-ink">
                  <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Số điện thoại</span>
                  <span className="mt-2 block font-semibold">{pendingPayload.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary px-5 py-4 text-base" onClick={() => setConfirming(false)} type="button">
                Chỉnh sửa thông tin
              </button>
              <button className="btn-primary px-5 py-4 text-base" disabled={loading} onClick={() => void handleConfirmedSubmit()} type="button">
                <span>{loading ? 'Đang tạo tài khoản...' : 'Xác nhận và tạo tài khoản'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <form className="grid gap-5" onSubmit={onSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted" htmlFor="fullName">
                  Họ và tên
                </label>
                <div className="input-shell flex items-center gap-3 px-4 py-0">
                  <UserRound className="h-4 w-4 text-brand-muted" />
                  <input className="w-full border-0 bg-transparent px-0 py-3.5 outline-none" id="fullName" name="fullName" placeholder="Nguyễn Văn A" type="text" />
                </div>
                {fieldErrors.fullName ? <p className="text-xs text-red-600">{fieldErrors.fullName[0]}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted" htmlFor="email">
                  Email
                </label>
                <div className="input-shell flex items-center gap-3 px-4 py-0">
                  <Mail className="h-4 w-4 text-brand-muted" />
                  <input className="w-full border-0 bg-transparent px-0 py-3.5 outline-none" id="email" name="email" placeholder="ban@example.com" type="email" />
                </div>
                {fieldErrors.email ? <p className="text-xs text-red-600">{fieldErrors.email[0]}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted" htmlFor="phone">
                  Số điện thoại
                </label>
                <div className="input-shell flex items-center gap-3 px-4 py-0">
                  <Phone className="h-4 w-4 text-brand-muted" />
                  <input className="w-full border-0 bg-transparent px-0 py-3.5 outline-none" id="phone" name="phone" placeholder="0909 000 000" type="tel" />
                </div>
                {fieldErrors.phone ? <p className="text-xs text-red-600">{fieldErrors.phone[0]}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="input-shell flex items-center gap-3 px-4 py-0">
                  <KeyRound className="h-4 w-4 text-brand-muted" />
                  <input className="w-full border-0 bg-transparent px-0 py-3.5 outline-none" id="password" name="password" placeholder="Tối thiểu 8 ký tự" type="password" />
                </div>
                {fieldErrors.password ? <p className="text-xs text-red-600">{fieldErrors.password[0]}</p> : null}
              </div>
            </div>

            <button className="btn-primary mt-2 w-full px-5 py-4 text-base" disabled={loading} type="submit">
              <span>Tiếp tục</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col gap-3 text-sm text-brand-muted md:flex-row md:items-center md:justify-between">
          <Link className="font-semibold text-brand-primary-deep hover:opacity-80" href="/login">
            Quay lại đăng nhập
          </Link>
          <div className="flex flex-wrap gap-3">
            <Link className="font-semibold text-brand-ink hover:text-brand-primary-deep" href="/register">
              Chọn vai trò khác
            </Link>
            {googleAuthEnabled ? (
              <Link className="font-semibold text-brand-primary-deep hover:opacity-80" href="/auth/google/start">
                Tiếp tục với Google
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-border bg-white/70 px-4 py-4 text-sm leading-7 text-brand-muted">
          {googleAuthEnabled
            ? 'Nếu đăng nhập Google lần đầu, hệ thống sẽ yêu cầu bạn chọn vai trò và xác nhận thông tin trước khi tạo hoặc liên kết tài khoản.'
            : 'Đăng nhập Google hiện chưa được cấu hình trong môi trường này. Bạn vẫn có thể đăng ký bằng email và mật khẩu.'}
        </div>
      </div>
    </div>
  );
}
