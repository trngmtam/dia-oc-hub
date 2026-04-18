import { RegisterForm } from '@/components/auth/RegisterForm';
import { isGoogleAuthConfigured } from '@/lib/google-auth';

export default function RegisterTenantPage() {
  return <RegisterForm googleAuthEnabled={isGoogleAuthConfigured()} role="TENANT" />;
}
