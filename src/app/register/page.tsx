import Link from 'next/link';
import { ArrowRight, Building2, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { isGoogleAuthConfigured } from '@/lib/google-auth';

const roleCards = [
  {
    href: '/register/owner',
    title: 'Chủ sở hữu',
    description: 'Tạo tài khoản để quản lý tài sản, phân công quản gia và theo dõi doanh thu.',
    icon: Building2,
  },
  {
    href: '/register/manager',
    title: 'Quản gia',
    description: 'Tạo tài khoản để vận hành tài sản được giao và xử lý yêu cầu hằng ngày.',
    icon: ShieldCheck,
  },
  {
    href: '/register/tenant',
    title: 'Người thuê',
    description: 'Tạo tài khoản để kết nối căn hộ, xem hợp đồng và theo dõi các yêu cầu.',
    icon: UserRound,
  },
];

export default function RegisterRolePage() {
  const googleAuthEnabled = isGoogleAuthConfigured();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_left_top,rgba(245,158,11,0.16),transparent_24rem),linear-gradient(180deg,#fffdfa_0%,#f6efe7_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl shell-card p-6 md:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary-deep">Bắt đầu tài khoản mới</p>
          <h1 className="mt-3 font-headline text-5xl font-extrabold text-brand-ink">Chọn vai trò của bạn</h1>
          <p className="mt-4 text-lg leading-8 text-brand-muted">
            Trước khi đăng ký hoặc dùng Google, hãy chọn đúng vai trò để hệ thống đưa bạn đến đúng luồng sử dụng ngay từ đầu.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {roleCards.map((card) => (
            <Link className="shell-panel p-6 transition hover:-translate-y-0.5 hover:shadow-lg" href={card.href} key={card.href}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-brand-primary-deep">
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 font-headline text-2xl font-bold text-brand-ink">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-brand-muted">{card.description}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary-deep">
                <span>Tiếp tục đăng ký</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-brand-border bg-brand-soft/70 p-5 text-sm text-brand-muted md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <UsersRound className="h-5 w-5 text-brand-primary-deep" />
            <span>Đã có tài khoản hoặc muốn dùng đăng nhập Google?</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary px-4 py-3 text-sm" href="/login">
              Quay lại đăng nhập
            </Link>
            {googleAuthEnabled ? (
              <Link className="btn-primary px-4 py-3 text-sm" href="/auth/google/start">
                Tiếp tục với Google
              </Link>
            ) : null}
          </div>
        </div>

        {!googleAuthEnabled ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
            Đăng nhập Google chưa được cấu hình trong môi trường hiện tại. Hãy thêm <span className="font-semibold">GOOGLE_CLIENT_ID</span> và{' '}
            <span className="font-semibold">GOOGLE_CLIENT_SECRET</span>, rồi khởi động lại máy chủ phát triển.
          </div>
        ) : null}
      </div>
    </div>
  );
}
