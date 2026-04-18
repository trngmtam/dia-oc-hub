import AppLayout from '@/components/layout/AppLayout';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout allowedRoles={['TENANT', 'ADMIN']}>{children}</AppLayout>;
}
