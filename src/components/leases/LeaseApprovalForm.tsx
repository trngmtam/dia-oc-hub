'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  approveUnitConnectionAndCreateLease,
  getUnitConnectionRequestById,
} from '@/features/leases/leases.actions';

type LeaseApprovalFormProps = {
  rolePrefix: 'owner' | 'manager';
};

type RequestDetail = {
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
  inviteId: string;
};

export function LeaseApprovalForm({ rolePrefix }: LeaseApprovalFormProps) {
  const { requestId } = useParams() as { requestId: string };
  const router = useRouter();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function load() {
      const response = await getUnitConnectionRequestById({ requestId });
      if (response.success && response.data) {
        setRequest(response.data);
      } else {
        setError(response.message || 'Không thể tải chi tiết yêu cầu');
      }

      setLoading(false);
    }

    void load();
  }, [requestId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const response = await approveUnitConnectionAndCreateLease({
      requestId,
      startDate: String(formData.get('startDate') || ''),
      endDate: String(formData.get('endDate') || ''),
      dueDayOfMonth: Number(formData.get('dueDayOfMonth') || 1),
      baseRent: Number(formData.get('baseRent') || 0),
      depositAmount: Number(formData.get('depositAmount') || 0),
      managementFee: Number(formData.get('managementFee') || 0),
      utilityNote: String(formData.get('utilityNote') || ''),
    });

    if (response.success) {
      router.push(`/${rolePrefix}/requests`);
      return;
    }

    setError(response.message || 'Không thể tạo hợp đồng');
    setSubmitting(false);
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải chi tiết yêu cầu...</p>;
  }

  if (!request) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'Không tìm thấy yêu cầu'}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Duyệt kết nối</p>
          <h1 className="mt-3 font-headline text-5xl font-extrabold text-brand-ink">Tạo hợp đồng thuê</h1>
          <p className="mt-3 text-base leading-7 text-brand-muted">Xác nhận yêu cầu kết nối của người thuê và tạo hợp đồng có hiệu lực.</p>
        </div>
        <Link className="btn-secondary px-4 py-3 text-sm" href={`/${rolePrefix}/requests`}>
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
      </div>

      <section className="shell-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="shell-muted p-4">
            <p className="text-sm text-brand-muted">Tài sản</p>
            <p className="mt-2 font-semibold text-brand-ink">{request.propertyName}</p>
          </div>
          <div className="shell-muted p-4">
            <p className="text-sm text-brand-muted">Căn hộ</p>
            <p className="mt-2 font-semibold text-brand-ink">{request.unitCode}</p>
          </div>
          <div className="shell-muted p-4">
            <p className="text-sm text-brand-muted">Người thuê</p>
            <p className="mt-2 font-semibold text-brand-ink">{request.tenantName}</p>
          </div>
          <div className="shell-muted p-4">
            <p className="text-sm text-brand-muted">Thời điểm gửi</p>
            <p className="mt-2 font-semibold text-brand-ink">{new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <form className="shell-card space-y-5 p-6" onSubmit={handleSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="startDate">Ngày bắt đầu</label>
            <input className="input-shell" defaultValue={today} id="startDate" name="startDate" type="date" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="endDate">Ngày kết thúc</label>
            <input className="input-shell" id="endDate" name="endDate" type="date" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="dueDayOfMonth">Ngày đến hạn thanh toán hằng tháng</label>
            <input className="input-shell" defaultValue={5} id="dueDayOfMonth" max={28} min={1} name="dueDayOfMonth" type="number" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="baseRent">Tiền thuê cơ bản</label>
            <input className="input-shell" defaultValue={request.defaultMonthlyRent ?? '0'} id="baseRent" min={0} name="baseRent" type="number" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="depositAmount">Tiền cọc</label>
            <input className="input-shell" defaultValue={request.defaultDeposit ?? '0'} id="depositAmount" min={0} name="depositAmount" type="number" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="managementFee">Phí quản lý</label>
            <input className="input-shell" defaultValue={0} id="managementFee" min={0} name="managementFee" type="number" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor="utilityNote">Ghi chú tiện ích</label>
          <textarea className="input-shell min-h-32" id="utilityNote" name="utilityNote" placeholder="Ví dụ: chỉ số điện, nước ban đầu; cách tính tiện ích; ghi chú bàn giao..." />
        </div>

        <button className="btn-primary px-5 py-4 text-base" disabled={submitting} type="submit">
          <span>{submitting ? 'Đang tạo hợp đồng...' : 'Duyệt yêu cầu và tạo hợp đồng'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
