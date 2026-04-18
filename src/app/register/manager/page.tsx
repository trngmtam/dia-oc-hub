import { RegisterForm } from '@/components/auth/RegisterForm';
import { isGoogleAuthConfigured } from '@/lib/google-auth';

export default function RegisterManagerPage() {
  return <RegisterForm googleAuthEnabled={isGoogleAuthConfigured()} role="MANAGER" />;
}
