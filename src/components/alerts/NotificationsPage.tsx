'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  listMyAlerts,
  markAlertRead,
  markAllAlertsRead,
  type AlertListItem,
} from '@/features/alerts/alerts.actions';

type AlertStatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';

function alertTypeText(type: string) {
  const labels: Record<string, string> = {
    OVERDUE_INVOICE: 'Hóa đơn quá hạn',
    LEASE_EXPIRING: 'Hợp đồng sắp hết hạn',
    VACANT_UNIT: 'Căn hộ đang trống',
    PENDING_PAYMENT_REVIEW: 'Thanh toán chờ duyệt',
  };
  return labels[type] ?? type;
}

function severityClass(severity: string) {
  if (severity === 'HIGH') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'LOW') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function NotificationsPage() {
  const [status, setStatus] = useState<AlertStatusFilter>('OPEN');
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const response = await listMyAlerts({ status });
    if (response.success && response.data) {
      setAlerts(response.data);
    } else {
      setError(response.message || 'Không thể tải thông báo');
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const handleMarkRead = async (alertRecipientId: string) => {
    setBusy(`read-${alertRecipientId}`);
    const response = await markAlertRead({ alertRecipientId });
    if (response.success) await load();
    else setError(response.message || 'Không thể đánh dấu đã đọc');
    setBusy('');
  };

  const handleMarkAllRead = async () => {
    setBusy('all');
    const response = await markAllAlertsRead();
    if (response.success) await load();
    else setError(response.message || 'Không thể đánh dấu tất cả');
    setBusy('');
  };

  return (
    <div className="space-y-8">
      <section className="shell-card p-7 md:p-8">
        <p className="warm-badge">Trung tâm thông báo</p>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-headline text-5xl font-extrabold text-brand-ink">Thông báo vận hành</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
              Theo dõi hóa đơn quá hạn, hợp đồng sắp hết hạn, căn hộ trống và thanh toán đang chờ duyệt.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary px-5 py-3.5 text-sm" disabled={busy === 'all'} onClick={handleMarkAllRead} type="button">
              <CheckCircle2 className="h-4 w-4" />
              <span>Đánh dấu tất cả đã đọc</span>
            </button>
            <button className="btn-primary px-5 py-3.5 text-sm" onClick={() => void load()} type="button">
              <RefreshCw className="h-4 w-4" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </section>

      <section className="shell-card p-5">
        <div className="flex flex-wrap gap-3">
          {(['OPEN', 'RESOLVED', 'ALL'] as AlertStatusFilter[]).map((value) => (
            <button
              className={value === status ? 'btn-primary px-4 py-2.5 text-sm' : 'btn-secondary px-4 py-2.5 text-sm'}
              key={value}
              onClick={() => setStatus(value)}
              type="button"
            >
              {value === 'OPEN' ? 'Đang mở' : value === 'RESOLVED' ? 'Đã xử lý' : 'Tất cả'}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-brand-muted">Đang tải thông báo...</p> : null}

      <section className="space-y-4">
        {alerts.length > 0 ? alerts.map((alert) => (
          <article className="shell-card p-5" key={alert.alertRecipientId}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-primary-deep">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${severityClass(alert.severity)}`}>
                      {alertTypeText(alert.alertType)}
                    </span>
                    {!alert.isRead ? <span className="rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white">Mới</span> : null}
                    {alert.status === 'RESOLVED' ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Đã xử lý</span> : null}
                  </div>
                  <h2 className="mt-3 font-headline text-2xl font-bold text-brand-ink">{alert.title}</h2>
                  {alert.description ? <p className="mt-2 text-sm leading-6 text-brand-muted">{alert.description}</p> : null}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
                    {new Date(alert.alertDate).toLocaleDateString('vi-VN')}
                    {alert.propertyName ? ` · ${alert.propertyName}` : ''}
                    {alert.unitCode ? ` · Căn ${alert.unitCode}` : ''}
                    {alert.invoiceCode ? ` · ${alert.invoiceCode}` : ''}
                  </p>
                </div>
              </div>
              {!alert.isRead ? (
                <button
                  className="btn-secondary px-4 py-2.5 text-xs"
                  disabled={busy === `read-${alert.alertRecipientId}`}
                  onClick={() => void handleMarkRead(alert.alertRecipientId)}
                  type="button"
                >
                  Đã đọc
                </button>
              ) : null}
            </div>
          </article>
        )) : (
          <div className="shell-card p-8 text-center text-sm text-brand-muted">
            Không có thông báo trong bộ lọc này.
          </div>
        )}
      </section>
    </div>
  );
}
