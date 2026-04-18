import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GoogleOnboardingForm } from '@/components/auth/GoogleOnboardingForm';
import { getGoogleOnboardingPayload } from '@/lib/google-auth';

export default async function GoogleOnboardingPage() {
  const onboarding = await getGoogleOnboardingPayload();

  if (!onboarding) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_left_top,rgba(245,158,11,0.16),transparent_24rem),linear-gradient(180deg,#fffdfa_0%,#f6efe7_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl shell-card p-6 md:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary-deep">Đăng nhập Google</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">
              {onboarding.mode === 'link' ? 'Xác nhận liên kết tài khoản' : 'Hoàn tất hồ sơ đăng ký'}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-brand-muted">
              {onboarding.mode === 'link'
                ? 'Chúng tôi đã tìm thấy một tài khoản dùng cùng email. Hãy xác nhận trước khi liên kết Google với tài khoản hiện có.'
                : 'Bạn đang đăng nhập bằng Google lần đầu. Hãy chọn vai trò, bổ sung số điện thoại và xác nhận trước khi tạo tài khoản.'}
            </p>
          </div>
          <Link className="btn-secondary h-12 w-12 p-0" href="/login">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {onboarding.mode === 'link' ? (
          <GoogleOnboardingForm
            state={{
              mode: 'link',
              providerEmail: onboarding.providerEmail,
              fullName: onboarding.fullName,
              existingFullName: onboarding.existingFullName,
              existingRole: onboarding.existingRole,
            }}
          />
        ) : (
          <GoogleOnboardingForm
            state={{
              mode: 'create',
              providerEmail: onboarding.providerEmail,
              fullName: onboarding.fullName,
            }}
          />
        )}
      </div>
    </div>
  );
}
