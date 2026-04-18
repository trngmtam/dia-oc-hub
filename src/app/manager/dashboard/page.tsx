'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Building2, ClipboardList, DoorOpen, Percent, TrendingUp, Wallet } from 'lucide-react';
import { getDashboardMetrics, type DashboardMetrics } from '@/features/dashboard/dashboard.actions';
import {
  getManagerAssignmentState,
  leaveManagedProperty,
  requestPropertyManagerAssignment,
} from '@/features/managerAssignments/managerAssignments.actions';

type AssignmentState = {
  assignedPropertyCount: number;
  assignedProperties: {
    propertyId: string;
    propertyName: string;
  }[];
  pendingRequests: {
    requestId: string;
    propertyId: string;
    propertyName: string;
    requestedAt: string;
  }[];
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="stat-tile">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">{label}</p>
          <p className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-brand-primary-deep">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function money(value: string) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
}

export default function ManagerDashboardPage() {
  const [assignmentState, setAssignmentState] = useState<AssignmentState | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const stateResponse = await getManagerAssignmentState();
    if (stateResponse.success && stateResponse.data) {
      setAssignmentState(stateResponse.data);

      if (stateResponse.data.assignedPropertyCount > 0) {
        const metricsResponse = await getDashboardMetrics();
        if (metricsResponse.success && metricsResponse.data) {
          setMetrics(metricsResponse.data);
        } else {
          setError(metricsResponse.message || 'Không thể tải số liệu bảng điều khiển');
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const response = await requestPropertyManagerAssignment({ inviteCode });
    if (!response.success) {
      setError(response.message || 'Không thể gửi yêu cầu nhận quản lý');
      setSubmitting(false);
      return;
    }

    setInviteCode('');
    await load();
    setSubmitting(false);
  };

  const handleLeaveProperty = async (propertyId: string, propertyName: string) => {
    const confirmed = window.confirm(
      `Ngừng quản lý ${propertyName}? Lịch sử phân công vẫn sẽ được giữ lại để báo cáo.`
    );
    if (!confirmed) {
      return;
    }

    setError('');
    const response = await leaveManagedProperty({ propertyId });
    if (!response.success) {
      setError(response.message || 'Không thể rời khỏi tài sản này');
      return;
    }

    await load();
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải bảng điều khiển...</p>;
  }

  if ((assignmentState?.assignedPropertyCount ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <div className="shell-card mx-auto max-w-3xl p-8 md:p-10">
          <p className="warm-badge">Kết nối tài sản</p>
          <h1 className="mt-5 font-headline text-4xl font-extrabold text-brand-ink">Nhập mã quản lý tài sản</h1>
          <p className="mt-4 text-base leading-7 text-brand-muted">
            Bạn có thể gửi yêu cầu đến nhiều chủ sở hữu khác nhau. Mỗi tài sản chỉ có một quản gia đang hoạt động tại một thời điểm.
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="input-shell"
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Nhập mã dạng MGR-XXXX-XXXX"
              type="text"
              value={inviteCode}
            />
            <button className="btn-primary px-5 py-4 text-base" disabled={submitting} type="submit">
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu nhận quản lý'}
            </button>
          </form>
        </div>

        {assignmentState && assignmentState.pendingRequests.length > 0 ? (
          <div className="mx-auto max-w-3xl shell-card p-8">
            <h2 className="font-headline text-2xl font-bold text-brand-ink">Yêu cầu đang chờ</h2>
            <div className="mt-5 space-y-3">
              {assignmentState.pendingRequests.map((request) => (
                <div className="shell-muted p-4" key={request.requestId}>
                  <p className="font-semibold text-brand-ink">{request.propertyName}</p>
                  <p className="mt-2 text-sm text-brand-muted">Gửi lúc {new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const activeAssignmentState = assignmentState!;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="shell-card p-7 md:p-8">
          <p className="warm-badge">Bảng điều hành</p>
          <h1 className="mt-5 font-headline text-5xl font-extrabold text-brand-ink">Quản lý tài sản được giao</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-brand-muted">
            Theo dõi các bất động sản bạn đang phụ trách, xử lý yêu cầu kết nối người thuê và tiếp nhận thêm tài sản mới khi cần.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-primary px-5 py-3.5 text-sm" href="/manager/properties">
              Xem danh sách tài sản
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="btn-secondary px-5 py-3.5 text-sm" href="/manager/requests">
              Mở trung tâm yêu cầu
            </Link>
          </div>
        </div>

        <div className="shell-panel p-7">
          <h2 className="font-headline text-2xl font-bold text-brand-ink">Yêu cầu thêm tài sản</h2>
          <p className="mt-3 text-sm leading-7 text-brand-muted">
            Bạn có thể tiếp tục nhập mã quản lý để mở rộng danh mục được phân công của mình.
          </p>

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <input
              className="input-shell"
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Nhập mã dạng MGR-XXXX-XXXX"
              type="text"
              value={inviteCode}
            />
            <button className="btn-primary w-full px-5 py-3.5 text-sm" disabled={submitting} type="submit">
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu mới'}
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Tài sản phụ trách" value={String(metrics?.totalProperties ?? 0)} />
        <StatCard icon={DoorOpen} label="Tổng căn hộ" value={String(metrics?.totalUnits ?? 0)} />
        <StatCard icon={ClipboardList} label="Căn còn trống" value={String(metrics?.vacantUnits ?? 0)} />
        <StatCard icon={Percent} label="Tỷ lệ có người thuê" value={`${metrics?.occupancyRate ?? 0}%`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Đã thu tháng này" value={money(metrics?.currentMonthPaid ?? '0')} />
        <StatCard icon={TrendingUp} label="Lợi nhuận ròng" value={money(metrics?.currentMonthNetIncome ?? '0')} />
        <StatCard icon={AlertTriangle} label="Hóa đơn quá hạn" value={String(metrics?.overdueInvoiceCount ?? 0)} />
        <StatCard icon={ClipboardList} label="Thanh toán chờ duyệt" value={String(metrics?.pendingPaymentReviewCount ?? 0)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="shell-card p-6">
          <h2 className="font-headline text-2xl font-bold text-brand-ink">Tài sản đang quản lý</h2>
          <div className="mt-5 space-y-3">
            {activeAssignmentState.assignedProperties.map((property) => (
              <div className="shell-muted p-4" key={property.propertyId}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-brand-ink">{property.propertyName}</p>
                  <button
                    className="btn-secondary px-4 py-2 text-xs"
                    onClick={() => void handleLeaveProperty(property.propertyId, property.propertyName)}
                    type="button"
                  >
                    Ngừng quản lý
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shell-card p-6">
          <h2 className="font-headline text-2xl font-bold text-brand-ink">Yêu cầu đang chờ</h2>
          {activeAssignmentState.pendingRequests.length > 0 ? (
            <div className="mt-5 space-y-3">
              {activeAssignmentState.pendingRequests.map((request) => (
                <div className="shell-muted p-4" key={request.requestId}>
                  <p className="font-semibold text-brand-ink">{request.propertyName}</p>
                  <p className="mt-2 text-sm text-brand-muted">Gửi lúc {new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-brand-muted">Hiện chưa có yêu cầu nào đang chờ duyệt.</p>
          )}
        </div>
      </section>
    </div>
  );
}
