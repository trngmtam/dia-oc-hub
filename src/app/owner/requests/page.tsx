'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  executeLeaseTermination,
  listLeaseTerminationRequests,
  listUnitConnectionRequests,
  rejectUnitConnectionRequest,
} from '@/features/leases/leases.actions';
import {
  approveManagerAssignmentRequest,
  listManagerAssignmentRequests,
  rejectManagerAssignmentRequest,
} from '@/features/managerAssignments/managerAssignments.actions';

type UnitConnectionRequestRow = {
  requestId: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitCode: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  requestedAt: string;
  defaultMonthlyRent: string | null;
  defaultDeposit: string | null;
};

type ManagerAssignmentRequestRow = {
  requestId: string;
  propertyId: string;
  propertyName: string;
  managerName: string;
  managerEmail: string | null;
  managerPhone: string | null;
  requestedAt: string;
};

type LeaseTerminationRequestRow = {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  unitCode: string;
  tenantName: string;
  requestedAt: string;
  note: string | null;
};

function SectionCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-headline text-2xl font-bold text-brand-ink">{title}</h2>
      </div>
      {empty ? <div className="shell-card p-6 text-sm text-brand-muted">Chưa có mục nào cần xử lý.</div> : <div className="space-y-4">{children}</div>}
    </section>
  );
}

export default function OwnerRequestsPage() {
  const [tenantRequests, setTenantRequests] = useState<UnitConnectionRequestRow[]>([]);
  const [managerRequests, setManagerRequests] = useState<ManagerAssignmentRequestRow[]>([]);
  const [terminationRequests, setTerminationRequests] = useState<LeaseTerminationRequestRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [tenantResponse, managerResponse, terminationResponse] = await Promise.all([
      listUnitConnectionRequests(),
      listManagerAssignmentRequests(),
      listLeaseTerminationRequests(),
    ]);

    if (tenantResponse.success && tenantResponse.data) setTenantRequests(tenantResponse.data);
    if (managerResponse.success && managerResponse.data) setManagerRequests(managerResponse.data);
    if (terminationResponse.success && terminationResponse.data) setTerminationRequests(terminationResponse.data);

    setError(tenantResponse.message || managerResponse.message || terminationResponse.message || '');
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const rejectTenantRequest = async (requestId: string) => {
    const response = await rejectUnitConnectionRequest({ requestId, rejectionNote: '' });
    if (!response.success) {
      setError(response.message || 'Không thể từ chối yêu cầu kết nối');
      return;
    }
    await load();
  };

  const approveManagerRequest = async (requestId: string) => {
    const response = await approveManagerAssignmentRequest({ requestId, rejectionNote: '' });
    if (!response.success) {
      setError(response.message || 'Không thể duyệt yêu cầu quản gia');
      return;
    }
    await load();
  };

  const rejectManagerRequest = async (requestId: string) => {
    const response = await rejectManagerAssignmentRequest({ requestId, rejectionNote: '' });
    if (!response.success) {
      setError(response.message || 'Không thể từ chối yêu cầu quản gia');
      return;
    }
    await load();
  };

  const terminateLease = async (leaseId: string) => {
    const response = await executeLeaseTermination({ leaseId });
    if (!response.success) {
      setError(response.message || 'Không thể chấm dứt hợp đồng');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-8">
      <section className="shell-card p-7 md:p-8">
        <p className="warm-badge">Trung tâm xử lý</p>
        <h1 className="mt-5 font-headline text-5xl font-extrabold text-brand-ink">Trung tâm yêu cầu</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-brand-muted">
          Duyệt kết nối người thuê, phê duyệt quản gia và xử lý các yêu cầu chấm dứt hợp đồng từ một nơi duy nhất.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-brand-muted">Đang tải yêu cầu...</p> : null}

      <SectionCard empty={tenantRequests.length === 0} title="Yêu cầu kết nối người thuê">
        {tenantRequests.map((request) => (
          <article className="shell-card p-6" key={request.requestId}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="warm-badge">{request.propertyName} · {request.unitCode}</p>
                <h3 className="mt-4 text-2xl font-bold text-brand-ink">{request.tenantName}</h3>
                <p className="mt-2 text-sm text-brand-muted">{request.tenantEmail || 'Chưa có email'} · {request.tenantPhone || 'Chưa có số điện thoại'}</p>
                <p className="mt-2 text-sm text-brand-muted">Gửi lúc {new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
              </div>
              <div className="flex flex-wrap gap-3 lg:w-[280px] lg:flex-col">
                <Link className="btn-primary flex-1 px-4 py-3 text-sm" href={`/owner/requests/${request.requestId}/lease`}>
                  Tạo hợp đồng
                </Link>
                <button className="btn-secondary flex-1 px-4 py-3 text-sm" onClick={() => void rejectTenantRequest(request.requestId)} type="button">
                  Từ chối yêu cầu
                </button>
              </div>
            </div>
          </article>
        ))}
      </SectionCard>

      <SectionCard empty={managerRequests.length === 0} title="Yêu cầu nhận quản lý tài sản">
        {managerRequests.map((request) => (
          <article className="shell-card p-6" key={request.requestId}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="warm-badge">{request.propertyName}</p>
                <h3 className="mt-4 text-2xl font-bold text-brand-ink">{request.managerName}</h3>
                <p className="mt-2 text-sm text-brand-muted">{request.managerEmail || 'Chưa có email'} · {request.managerPhone || 'Chưa có số điện thoại'}</p>
                <p className="mt-2 text-sm text-brand-muted">Gửi lúc {new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
              </div>
              <div className="flex flex-wrap gap-3 lg:w-[280px] lg:flex-col">
                <button className="btn-primary flex-1 px-4 py-3 text-sm" onClick={() => void approveManagerRequest(request.requestId)} type="button">
                  Duyệt phân công
                </button>
                <button className="btn-secondary flex-1 px-4 py-3 text-sm" onClick={() => void rejectManagerRequest(request.requestId)} type="button">
                  Từ chối yêu cầu
                </button>
              </div>
            </div>
          </article>
        ))}
      </SectionCard>

      <SectionCard empty={terminationRequests.length === 0} title="Yêu cầu chấm dứt hợp đồng">
        {terminationRequests.map((request) => (
          <article className="shell-card p-6" key={request.leaseId}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="warm-badge">{request.propertyName} · {request.unitCode}</p>
                <h3 className="mt-4 text-2xl font-bold text-brand-ink">{request.tenantName}</h3>
                <p className="mt-2 text-sm text-brand-muted">Yêu cầu lúc {new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
                {request.note ? <div className="mt-4 shell-muted p-4 text-sm leading-6 text-brand-muted">{request.note}</div> : null}
              </div>
              <button className="btn-primary px-5 py-3 text-sm lg:min-w-[220px]" onClick={() => void terminateLease(request.leaseId)} type="button">
                Chấm dứt hợp đồng
              </button>
            </div>
          </article>
        ))}
      </SectionCard>
    </div>
  );
}
