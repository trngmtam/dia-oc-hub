import AppLayout from '@/components/layout/AppLayout';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout allowedRoles={['OWNER', 'ADMIN']}>{children}</AppLayout>;
}