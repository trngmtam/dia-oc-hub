import { RegisterForm } from '@/components/auth/RegisterForm';
import { isGoogleAuthConfigured } from '@/lib/google-auth';

export default function RegisterOwnerPage() {
  return <RegisterForm googleAuthEnabled={isGoogleAuthConfigured()} role="OWNER" />;
}
