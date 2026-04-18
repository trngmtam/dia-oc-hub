'use client';

import { useEffect, useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { getTenantContracts, requestEarlyTermination } from '@/features/leases/leases.actions';

type TenantContract = {
  leaseId: string;
  propertyName: string;
  propertyId: string;
  unitCode: string;
  startDate: string;
  endDate: string;
  dueDayOfMonth: number;
  baseRent: string;
  depositAmount: string;
  managementFee: string;
  utilityNote: string | null;
  status: string;
  terminationRequestedAt: string | null;
  terminationRequestedNote: string | null;
  terminatedAt: string | null;
};

function money(value: string) {
  return `${Number(value).toLocaleString('vi-VN')} VNĐ`;
}

function contractStatusText(status: string) {
  if (status === 'ACTIVE') return 'Đang hiệu lực';
  if (status === 'EXPIRED') return 'Hết hạn';
  return 'Đã kết thúc';
}

export default function TenantContractsPage() {
  const [contracts, setContracts] = useState<TenantContract[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingLeaseId, setSubmittingLeaseId] = useState<string | null>(null);

  const load = async () => {
    const response = await getTenantContracts();
    if (response.success) {
      setContracts(response.data ?? []);
      setError('');
    } else {
      setError(response.message || 'Không thể tải hợp đồng');
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleRequestTermination = async (
    event: React.FormEvent<HTMLFormElement>,
    leaseId: string,
  ) => {
    event.preventDefault();

    setSubmittingLeaseId(leaseId);
    setError('');

    const response = await requestEarlyTermination({
      leaseId,
      note: notes[leaseId] ?? '',
    });

    if (!response.success) {
      setError(response.message || 'Không thể gửi yêu cầu chấm dứt');
      setSubmittingLeaseId(null);
      return;
    }

    setNotes((current) => ({ ...current, [leaseId]: '' }));
    await load();
    setSubmittingLeaseId(null);
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải hợp đồng...</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className="shell-card p-8">
        <h1 className="font-headline text-3xl font-extrabold text-brand-ink">Chưa có hợp đồng</h1>
        <p className="mt-3 text-base leading-7 text-brand-muted">Hãy kết nối với căn hộ trước để xem toàn bộ thông tin hợp đồng tại đây.</p>
        {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="shell-card p-7 md:p-8">
        <p className="warm-badge">Thông tin hợp đồng</p>
        <h1 className="mt-5 font-headline text-5xl font-extrabold text-brand-ink">Tất cả hợp đồng thuê</h1>
        <p className="mt-3 text-lg text-brand-muted">Bạn đang có {contracts.length} hợp đồng trong hệ thống.</p>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {contracts.map((contract) => (
        <section className="shell-card space-y-6 p-7" key={contract.leaseId}>
          <div>
            <p className="warm-badge">{contractStatusText(contract.status)}</p>
            <h2 className="mt-5 font-headline text-4xl font-extrabold text-brand-ink">{contract.propertyName}</h2>
            <p className="mt-3 text-lg text-brand-muted">Căn hộ {contract.unitCode}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="stat-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Tiền thuê</p>
              <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">{money(contract.baseRent)}</p>
            </div>
            <div className="stat-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Ngày đến hạn</p>
              <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">Ngày {contract.dueDayOfMonth}</p>
            </div>
            <div className="stat-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Phí quản lý</p>
              <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">{money(contract.managementFee)}</p>
            </div>
            <div className="stat-tile">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Tiền cọc</p>
              <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">{money(contract.depositAmount)}</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="shell-muted p-4">
              <p className="text-sm text-brand-muted">Ngày bắt đầu</p>
              <p className="mt-2 text-lg font-semibold text-brand-ink">{new Date(contract.startDate).toLocaleDateString('vi-VN')}</p>
            </div>
            <div className="shell-muted p-4">
              <p className="text-sm text-brand-muted">Ngày kết thúc</p>
              <p className="mt-2 text-lg font-semibold text-brand-ink">{new Date(contract.endDate).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          {contract.utilityNote ? <div className="shell-muted p-4 text-sm leading-7 text-brand-muted">{contract.utilityNote}</div> : null}

          {contract.status === 'ACTIVE' ? (
            contract.terminationRequestedAt ? (
              <div className="shell-muted p-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-primary-deep" />
                  <h3 className="font-headline text-2xl font-bold text-brand-ink">Yêu cầu chấm dứt đã được gửi</h3>
                </div>
                <p className="mt-4 text-base leading-7 text-brand-muted">
                  Yêu cầu của bạn đã được gửi vào lúc {new Date(contract.terminationRequestedAt).toLocaleString('vi-VN')}.
                </p>
                {contract.terminationRequestedNote ? <div className="mt-4 text-sm leading-7 text-brand-muted">{contract.terminationRequestedNote}</div> : null}
              </div>
            ) : (
              <form className="space-y-5" onSubmit={(event) => void handleRequestTermination(event, contract.leaseId)}>
                <div>
                  <h3 className="font-headline text-2xl font-bold text-brand-ink">Yêu cầu chấm dứt sớm</h3>
                  <p className="mt-3 text-base leading-7 text-brand-muted">
                    Yêu cầu này sẽ được gửi đến chủ nhà hoặc quản gia để xem xét. Hợp đồng sẽ chưa tự động kết thúc.
                  </p>
                </div>
                <textarea
                  className="input-shell min-h-32"
                  onChange={(event) => setNotes((current) => ({ ...current, [contract.leaseId]: event.target.value }))}
                  placeholder="Mô tả lý do chuyển đi hoặc thời điểm bạn mong muốn bàn giao"
                  value={notes[contract.leaseId] ?? ''}
                />
                <button className="btn-primary px-5 py-4 text-base" disabled={submittingLeaseId === contract.leaseId} type="submit">
                  <Send className="h-4 w-4" />
                  <span>{submittingLeaseId === contract.leaseId ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu chấm dứt'}</span>
                </button>
              </form>
            )
          ) : null}
        </section>
      ))}
    </div>
  );
}
