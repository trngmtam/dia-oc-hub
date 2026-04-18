'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, FilePlus2, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { getProperties } from '@/features/properties/properties.actions';
import {
  createMonthlyInvoices,
  createSingleInvoice,
  getPaymentProofSignedUrl,
  getPropertyReceivingAccount,
  listPendingPaymentProofs,
  listScopedInvoices,
  previewMonthlyInvoices,
  rejectPayment,
  upsertPropertyReceivingAccount,
  verifyPayment,
  type InvoiceListItem,
  type InvoicePreviewItem,
  type InvoiceSummary,
  type PaymentReceivingAccountData,
  type PaymentReviewItem,
} from '@/features/invoices/invoices.actions';

type PropertyOption = {
  id: string;
  propertyName: string;
};

type InvoiceStatusFilter = 'ALL' | 'UNPAID' | 'PENDING_REVIEW' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

function money(value: string) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
}

function statusText(status: string) {
  switch (status) {
    case 'PAID':
      return 'Đã thanh toán';
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'PARTIALLY_PAID':
      return 'Thanh toán một phần';
    case 'OVERDUE':
      return 'Quá hạn';
    default:
      return 'Chưa thanh toán';
  }
}

function currentBillingMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">{label}</p>
      <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">{value}</p>
    </div>
  );
}

export default function InvoiceManagementPage({ roleBase }: { roleBase: 'owner' | 'manager' }) {
  const initial = useMemo(() => currentBillingMonth(), []);
  const [billingYear, setBillingYear] = useState(String(initial.year));
  const [billingMonth, setBillingMonth] = useState(String(initial.month));
  const [status, setStatus] = useState<InvoiceStatusFilter>('ALL');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [previews, setPreviews] = useState<InvoicePreviewItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentReviewItem[]>([]);
  const [utilityAmounts, setUtilityAmounts] = useState<Record<string, string>>({});
  const [otherAmounts, setOtherAmounts] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<PaymentReceivingAccountData | null>(null);
  const [accountForm, setAccountForm] = useState({
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    transferNoteTemplate: 'Thanh toán {invoiceCode}',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadInvoices = useCallback(async () => {
    const response = await listScopedInvoices({
      billingYear: Number(billingYear),
      billingMonth: Number(billingMonth),
      propertyId,
      status,
    });

    if (response.success && response.data) {
      setInvoices(response.data.invoices);
      setSummary(response.data.summary);
    } else {
      setError(response.message || 'Không thể tải hóa đơn');
    }
  }, [billingMonth, billingYear, propertyId, status]);

  const loadAccount = useCallback(async (selectedPropertyId: string) => {
    if (!selectedPropertyId) {
      setAccount(null);
      return;
    }

    const response = await getPropertyReceivingAccount({ propertyId: selectedPropertyId });
    if (response.success) {
      setAccount(response.data || null);
      if (response.data) {
        setAccountForm({
          bankCode: response.data.bankCode,
          bankName: response.data.bankName,
          accountNumber: response.data.accountNumber,
          accountName: response.data.accountName,
          transferNoteTemplate: response.data.transferNoteTemplate || 'Thanh toán {invoiceCode}',
        });
      }
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    const [propertyResponse, pendingResponse] = await Promise.all([
      getProperties(),
      listPendingPaymentProofs(),
    ]);

    if (propertyResponse.success && propertyResponse.data) {
      setProperties(propertyResponse.data.map((property) => ({
        id: property.id,
        propertyName: property.propertyName,
      })));
    }

    if (pendingResponse.success && pendingResponse.data) {
      setPendingPayments(pendingResponse.data);
    }

    await loadInvoices();
    setLoading(false);
  }, [loadInvoices]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccount(propertyId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAccount, propertyId]);

  const handleRefresh = async () => {
    setBusy('refresh');
    await load();
    setBusy('');
  };

  const handlePreview = async () => {
    setBusy('preview');
    setError('');
    setMessage('');
    const response = await previewMonthlyInvoices({
      billingYear: Number(billingYear),
      billingMonth: Number(billingMonth),
      propertyId,
    });

    if (response.success && response.data) {
      setPreviews(response.data);
      setMessage(`Tìm thấy ${response.data.length} hợp đồng đang hiệu lực cho tháng này.`);
    } else {
      setError(response.message || 'Không thể xem trước hóa đơn');
    }

    setBusy('');
  };

  const handleCreateMonthly = async () => {
    const rows = previews.filter((preview) => !preview.existingInvoiceId);
    if (rows.length === 0) {
      setError('Không có hóa đơn mới để tạo cho tháng này.');
      return;
    }

    setBusy('create-monthly');
    setError('');
    setMessage('');

    const response = await createMonthlyInvoices({
      billingYear: Number(billingYear),
      billingMonth: Number(billingMonth),
      propertyId,
      invoices: rows.map((row) => ({
        leaseId: row.leaseId,
        utilityAmount: Number(utilityAmounts[row.leaseId] || 0),
        otherFeeAmount: Number(otherAmounts[row.leaseId] || 0),
      })),
    });

    if (response.success) {
      setMessage(response.message || 'Đã tạo hóa đơn');
      await loadInvoices();
      await handlePreview();
    } else {
      setError(response.message || 'Không thể tạo hóa đơn tháng');
    }

    setBusy('');
  };

  const handleCreateSingle = async (row: InvoicePreviewItem) => {
    setBusy(`single-${row.leaseId}`);
    setError('');
    const response = await createSingleInvoice({
      leaseId: row.leaseId,
      billingYear: Number(billingYear),
      billingMonth: Number(billingMonth),
      utilityAmount: Number(utilityAmounts[row.leaseId] || 0),
      otherFeeAmount: Number(otherAmounts[row.leaseId] || 0),
    });

    if (response.success) {
      setMessage('Đã tạo hóa đơn riêng');
      await loadInvoices();
      await handlePreview();
    } else {
      setError(response.message || 'Không thể tạo hóa đơn riêng');
    }

    setBusy('');
  };

  const handleSaveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyId) {
      setError('Hãy chọn tài sản trước khi lưu tài khoản nhận tiền.');
      return;
    }

    setBusy('account');
    setError('');
    const response = await upsertPropertyReceivingAccount({
      propertyId,
      ...accountForm,
    });

    if (response.success && response.data) {
      setAccount(response.data);
      setMessage('Đã lưu tài khoản nhận tiền');
    } else {
      setError(response.message || 'Không thể lưu tài khoản nhận tiền');
    }
    setBusy('');
  };

  const handleOpenProof = async (paymentId: string) => {
    const response = await getPaymentProofSignedUrl({ paymentId });
    if (response.success && response.data) {
      window.open(response.data.signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      setError(response.message || 'Không thể mở chứng từ thanh toán');
    }
  };

  const handleVerify = async (paymentId: string) => {
    setBusy(`verify-${paymentId}`);
    const response = await verifyPayment({ paymentId, verificationNote: '' });
    if (!response.success) {
      setError(response.message || 'Không thể xác nhận thanh toán');
    } else {
      setMessage('Đã xác nhận thanh toán');
      await load();
    }
    setBusy('');
  };

  const handleReject = async (paymentId: string) => {
    const verificationNote = window.prompt('Lý do từ chối chứng từ thanh toán') || '';
    setBusy(`reject-${paymentId}`);
    const response = await rejectPayment({ paymentId, verificationNote });
    if (!response.success) {
      setError(response.message || 'Không thể từ chối thanh toán');
    } else {
      setMessage('Đã từ chối thanh toán');
      await load();
    }
    setBusy('');
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải dữ liệu thu tiền...</p>;
  }

  const canEditAccount = roleBase === 'owner';

  return (
    <div className="space-y-8">
      <section className="shell-card p-7 md:p-8">
        <p className="warm-badge">Thu tiền nhà</p>
        <h1 className="mt-5 font-headline text-5xl font-extrabold text-brand-ink">Hóa đơn và thanh toán</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-brand-muted">
          Tạo hóa đơn từ hợp đồng đang hiệu lực, hướng dẫn người thuê chuyển khoản VietQR và duyệt chứng từ thanh toán.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tổng hóa đơn" value={money(summary?.totalInvoiced || '0')} />
        <StatTile label="Đã xác nhận" value={money(summary?.totalPaid || '0')} />
        <StatTile label="Còn phải thu" value={money(summary?.totalRemaining || '0')} />
        <StatTile label="Chờ duyệt / Quá hạn" value={`${summary?.pendingReviewCount || 0} / ${summary?.overdueCount || 0}`} />
      </section>

      <section className="shell-card space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-5">
          <input className="input-shell" onChange={(event) => setBillingYear(event.target.value)} type="number" value={billingYear} />
          <select className="input-shell" onChange={(event) => setBillingMonth(event.target.value)} value={billingMonth}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>Tháng {month}</option>
            ))}
          </select>
          <select className="input-shell" onChange={(event) => setPropertyId(event.target.value)} value={propertyId}>
            <option value="">Tất cả tài sản</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.propertyName}</option>
            ))}
          </select>
          <select className="input-shell" onChange={(event) => setStatus(event.target.value as InvoiceStatusFilter)} value={status}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PENDING_REVIEW">Chờ duyệt</option>
            <option value="PARTIALLY_PAID">Thanh toán một phần</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="OVERDUE">Quá hạn</option>
          </select>
          <button className="btn-primary px-4 py-3 text-sm" disabled={busy === 'refresh'} onClick={() => void handleRefresh()} type="button">
            <RefreshCw className="h-4 w-4" />
            Lọc dữ liệu
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="shell-card space-y-4 p-6" onSubmit={handleSaveAccount}>
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-brand-primary-deep" />
            <h2 className="font-headline text-2xl font-bold text-brand-ink">Tài khoản nhận tiền</h2>
          </div>
          {!propertyId ? <p className="text-sm text-brand-muted">Chọn một tài sản cụ thể ở bộ lọc để xem hoặc cấu hình tài khoản nhận tiền.</p> : null}
          {propertyId && !canEditAccount ? (
            account ? (
              <div className="shell-muted space-y-2 p-4 text-sm text-brand-ink">
                <p>{account.bankName} ({account.bankCode})</p>
                <p>{account.accountNumber} · {account.accountName}</p>
                <p className="text-brand-muted">{account.transferNoteTemplate || 'Thanh toán {invoiceCode}'}</p>
              </div>
            ) : (
              <p className="text-sm text-brand-muted">Chủ nhà chưa cấu hình tài khoản nhận tiền cho tài sản này.</p>
            )
          ) : null}
          {propertyId && canEditAccount ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="input-shell" onChange={(event) => setAccountForm((current) => ({ ...current, bankCode: event.target.value.toUpperCase() }))} placeholder="Mã ngân hàng, ví dụ VCB" value={accountForm.bankCode} />
                <input className="input-shell" onChange={(event) => setAccountForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="Tên ngân hàng" value={accountForm.bankName} />
                <input className="input-shell" onChange={(event) => setAccountForm((current) => ({ ...current, accountNumber: event.target.value }))} placeholder="Số tài khoản" value={accountForm.accountNumber} />
                <input className="input-shell" onChange={(event) => setAccountForm((current) => ({ ...current, accountName: event.target.value }))} placeholder="Tên chủ tài khoản" value={accountForm.accountName} />
              </div>
              <input className="input-shell" onChange={(event) => setAccountForm((current) => ({ ...current, transferNoteTemplate: event.target.value }))} placeholder="Nội dung chuyển khoản" value={accountForm.transferNoteTemplate} />
              <button className="btn-primary px-5 py-3 text-sm" disabled={busy === 'account'} type="submit">Lưu tài khoản</button>
            </>
          ) : null}
        </form>

        <section className="shell-card space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-headline text-2xl font-bold text-brand-ink">Tạo hóa đơn tháng</h2>
            <button className="btn-secondary px-4 py-3 text-sm" disabled={busy === 'preview'} onClick={() => void handlePreview()} type="button">
              Xem trước hợp đồng
            </button>
          </div>
          {previews.length === 0 ? (
            <p className="text-sm text-brand-muted">Chọn tháng rồi xem trước để tạo hóa đơn từ các hợp đồng đang hiệu lực.</p>
          ) : (
            <div className="space-y-3">
              {previews.map((row) => (
                <div className="shell-muted grid gap-3 p-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] xl:items-center" key={row.leaseId}>
                  <div>
                    <p className="font-semibold text-brand-ink">{row.propertyName} · {row.unitCode}</p>
                    <p className="mt-1 text-sm text-brand-muted">{row.tenantName} · Hạn {new Date(row.dueDate).toLocaleDateString('vi-VN')}</p>
                    <p className="mt-1 text-sm text-brand-muted">Tiền thuê {money(row.rentAmount)} · Phí quản lý {money(row.managementFeeAmount)}</p>
                    {row.existingInvoiceId ? <p className="mt-2 text-xs font-semibold text-brand-primary-deep">Đã có hóa đơn tháng này</p> : null}
                  </div>
                  <input className="input-shell bg-white" disabled={Boolean(row.existingInvoiceId)} onChange={(event) => setUtilityAmounts((current) => ({ ...current, [row.leaseId]: event.target.value }))} placeholder="Tiện ích" type="number" value={utilityAmounts[row.leaseId] || ''} />
                  <input className="input-shell bg-white" disabled={Boolean(row.existingInvoiceId)} onChange={(event) => setOtherAmounts((current) => ({ ...current, [row.leaseId]: event.target.value }))} placeholder="Phí khác" type="number" value={otherAmounts[row.leaseId] || ''} />
                  <button className="btn-secondary px-4 py-3 text-sm" disabled={Boolean(row.existingInvoiceId) || busy === `single-${row.leaseId}`} onClick={() => void handleCreateSingle(row)} type="button">
                    Tạo riêng
                  </button>
                </div>
              ))}
              <button className="btn-primary px-5 py-3 text-sm" disabled={busy === 'create-monthly'} onClick={() => void handleCreateMonthly()} type="button">
                <FilePlus2 className="h-4 w-4" />
                Tạo tất cả hóa đơn mới
              </button>
            </div>
          )}
        </section>
      </section>

      <section className="shell-card space-y-4 p-6">
        <h2 className="font-headline text-2xl font-bold text-brand-ink">Chứng từ chờ duyệt</h2>
        {pendingPayments.length === 0 ? (
          <p className="text-sm text-brand-muted">Hiện chưa có chứng từ thanh toán nào đang chờ duyệt.</p>
        ) : (
          <div className="space-y-3">
            {pendingPayments.map((payment) => (
              <article className="shell-muted p-4" key={payment.paymentId}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="font-semibold text-brand-ink">{payment.invoiceCode} · {payment.propertyName} · {payment.unitCode}</p>
                    <p className="mt-1 text-sm text-brand-muted">{payment.payerName} · {money(payment.paidAmount)} · {new Date(payment.submittedAt).toLocaleString('vi-VN')}</p>
                    <p className="mt-1 text-sm text-brand-muted">{payment.transferReference || 'Chưa có mã giao dịch'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary px-4 py-2 text-sm" onClick={() => void handleOpenProof(payment.paymentId)} type="button">
                      <Eye className="h-4 w-4" />
                      Xem chứng từ
                    </button>
                    <button className="btn-primary px-4 py-2 text-sm" disabled={busy === `verify-${payment.paymentId}`} onClick={() => void handleVerify(payment.paymentId)} type="button">
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận
                    </button>
                    <button className="btn-secondary px-4 py-2 text-sm text-red-700" disabled={busy === `reject-${payment.paymentId}`} onClick={() => void handleReject(payment.paymentId)} type="button">
                      <XCircle className="h-4 w-4" />
                      Từ chối
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="shell-card space-y-4 p-6">
        <h2 className="font-headline text-2xl font-bold text-brand-ink">Danh sách hóa đơn</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-brand-muted">Chưa có hóa đơn nào trong bộ lọc hiện tại.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <article className="shell-muted p-4" key={invoice.invoiceId}>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] xl:items-center">
                  <div>
                    <p className="font-semibold text-brand-ink">{invoice.invoiceCode}</p>
                    <p className="mt-1 text-sm text-brand-muted">{invoice.propertyName} · {invoice.unitCode} · {invoice.tenantName}</p>
                  </div>
                  <div className="text-sm text-brand-muted">
                    <p>Tháng {invoice.billingMonth}/{invoice.billingYear}</p>
                    <p>Hạn {new Date(invoice.dueDate).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="text-sm text-brand-muted">
                    <p>Tổng {money(invoice.totalAmount)}</p>
                    <p>Đã xác nhận {money(invoice.verifiedPaidTotal)}</p>
                  </div>
                  <div>
                    <span className="warm-badge">{statusText(invoice.status)}</span>
                    <p className="mt-2 text-sm text-brand-muted">Còn lại {money(invoice.remainingBalance)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
