import { Suspense } from 'react';
import { LoginClientPage } from '@/components/auth/LoginClientPage';
import { isGoogleAuthConfigured } from '@/lib/google-auth';

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-brand-muted">Đang tải đăng nhập...</p>}>
      <LoginClientPage googleAuthEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
