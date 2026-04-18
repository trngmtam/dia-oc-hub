import AppLayout from '@/components/layout/AppLayout';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout allowedRoles={['MANAGER', 'ADMIN']}>{children}</AppLayout>;
}
