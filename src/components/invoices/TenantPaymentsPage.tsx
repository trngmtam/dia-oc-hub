'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { listTenantInvoices, type TenantInvoiceItem } from '@/features/invoices/invoices.actions';

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
    case 'REJECTED':
      return 'Bị từ chối';
    default:
      return 'Chưa thanh toán';
  }
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">{label}</p>
      <p className="mt-3 font-headline text-3xl font-extrabold text-brand-ink">{value}</p>
    </div>
  );
}

export default function TenantPaymentsPage() {
  const [invoices, setInvoices] = useState<TenantInvoiceItem[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const response = await listTenantInvoices();
    if (response.success && response.data) {
      setInvoices(response.data);
    } else {
      setError(response.message || 'Không thể tải hóa đơn thanh toán');
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(() => {
    return invoices.reduce(
      (current, invoice) => ({
        totalDue: current.totalDue + Number(invoice.remainingBalance || 0),
        pendingReview: current.pendingReview + invoice.pendingPaymentCount,
        paid: current.paid + Number(invoice.verifiedPaidTotal || 0),
      }),
      { totalDue: 0, pendingReview: 0, paid: 0 }
    );
  }, [invoices]);

  const handleSubmitPayment = async (invoice: TenantInvoiceItem, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const proofFile = files[invoice.invoiceId];
    if (!proofFile) {
      setError('Hãy chọn file chứng từ thanh toán.');
      return;
    }

    setBusy(invoice.invoiceId);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.set('invoiceId', invoice.invoiceId);
    formData.set('paidAmount', amounts[invoice.invoiceId] || invoice.remainingBalance);
    formData.set('paymentMethod', methods[invoice.invoiceId] || 'BANK_TRANSFER_QR');
    formData.set('transferReference', references[invoice.invoiceId] || '');
    formData.set('paymentNote', notes[invoice.invoiceId] || '');
    formData.set('proofFile', proofFile);

    const response = await fetch('/api/payments/proofs', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      setError(result.message || 'Không thể gửi chứng từ thanh toán');
      setBusy('');
      return;
    }

    setMessage('Đã gửi chứng từ thanh toán. Chủ nhà hoặc quản gia sẽ kiểm tra.');
    setAmounts((current) => ({ ...current, [invoice.invoiceId]: '' }));
    setReferences((current) => ({ ...current, [invoice.invoiceId]: '' }));
    setNotes((current) => ({ ...current, [invoice.invoiceId]: '' }));
    setFiles((current) => ({ ...current, [invoice.invoiceId]: null }));
    await load();
    setBusy('');
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải thanh toán...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="shell-card p-7 md:p-8">
        <p className="warm-badge">Thanh toán</p>
        <h1 className="mt-5 font-headline text-5xl font-extrabold text-brand-ink">Hóa đơn tiền thuê</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-brand-muted">
          Theo dõi hóa đơn, chuyển khoản theo hướng dẫn VietQR và gửi chứng từ để được xác nhận thanh toán.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Còn phải thanh toán" value={money(String(summary.totalDue))} />
        <StatTile label="Chứng từ chờ duyệt" value={String(summary.pendingReview)} />
        <StatTile label="Đã xác nhận" value={money(String(summary.paid))} />
      </section>

      {invoices.length === 0 ? (
        <section className="shell-card p-8 text-sm text-brand-muted">
          Bạn chưa có hóa đơn nào. Khi chủ nhà hoặc quản gia tạo hóa đơn tháng, thông tin sẽ hiển thị tại đây.
        </section>
      ) : (
        <section className="space-y-5">
          {invoices.map((invoice) => (
            <article className="shell-card p-6" key={invoice.invoiceId}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <span className="warm-badge">{statusText(invoice.status)}</span>
                  <h2 className="mt-4 font-headline text-3xl font-bold text-brand-ink">{invoice.invoiceCode}</h2>
                  <p className="mt-2 text-sm text-brand-muted">{invoice.propertyName} · Căn {invoice.unitCode}</p>
                  <p className="mt-2 text-sm text-brand-muted">
                    Tháng {invoice.billingMonth}/{invoice.billingYear} · Hạn {new Date(invoice.dueDate).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="grid min-w-[280px] gap-3 text-sm text-brand-muted">
                  <div className="shell-muted p-4">
                    <p>Tổng hóa đơn</p>
                    <p className="mt-1 text-xl font-bold text-brand-ink">{money(invoice.totalAmount)}</p>
                  </div>
                  <div className="shell-muted p-4">
                    <p>Còn lại</p>
                    <p className="mt-1 text-xl font-bold text-brand-ink">{money(invoice.remainingBalance)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="shell-muted p-5">
                  <h3 className="font-semibold text-brand-ink">Thông tin chuyển khoản</h3>
                  {invoice.paymentInstruction ? (
                    <div className="mt-4 space-y-2 text-sm text-brand-muted">
                      {invoice.paymentInstruction.qrImageUrl ? (
                        <Image
                          alt="Mã QR chuyển khoản"
                          className="h-48 w-48 rounded-2xl bg-white object-contain p-2"
                          height={192}
                          src={invoice.paymentInstruction.qrImageUrl}
                          width={192}
                        />
                      ) : null}
                      <p>Ngân hàng: <span className="font-semibold text-brand-ink">{invoice.paymentInstruction.bankName}</span></p>
                      <p>Số tài khoản: <span className="font-semibold text-brand-ink">{invoice.paymentInstruction.accountNumber}</span></p>
                      <p>Chủ tài khoản: <span className="font-semibold text-brand-ink">{invoice.paymentInstruction.accountName}</span></p>
                      <p>Nội dung: <span className="font-semibold text-brand-ink">{invoice.paymentInstruction.transferContent}</span></p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-brand-muted">Chủ nhà chưa cấu hình tài khoản nhận tiền cho tài sản này.</p>
                  )}
                </div>

                <div>
                  {invoice.canSubmitPayment ? (
                    <form className="space-y-3" onSubmit={(event) => void handleSubmitPayment(invoice, event)}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className="input-shell"
                          max={invoice.remainingBalance}
                          min="1"
                          onChange={(event) => setAmounts((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))}
                          placeholder="Số tiền đã chuyển (VNĐ)"
                          type="number"
                          value={amounts[invoice.invoiceId] || invoice.remainingBalance}
                        />
                        <select
                          aria-label="Phương thức thanh toán"
                          className="input-shell"
                          onChange={(event) => setMethods((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))}
                          title="Phương thức thanh toán"
                          value={methods[invoice.invoiceId] || 'BANK_TRANSFER_QR'}
                        >
                          <option value="BANK_TRANSFER_QR">Chuyển khoản VietQR</option>
                          <option value="BANK_TRANSFER_MANUAL">Chuyển khoản thủ công</option>
                          <option value="CASH">Tiền mặt</option>
                        </select>
                      </div>
                      <input
                        className="input-shell"
                        onChange={(event) => setReferences((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))}
                        placeholder="Mã giao dịch hoặc nội dung ngân hàng"
                        value={references[invoice.invoiceId] || ''}
                      />
                      <textarea
                        className="input-shell min-h-24"
                        onChange={(event) => setNotes((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))}
                        placeholder="Ghi chú thêm (nếu có)"
                        value={notes[invoice.invoiceId] || ''}
                      />
                      <input
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        aria-label="Tải lên chứng từ"
                        className="input-shell"
                        onChange={(event) => setFiles((current) => ({ ...current, [invoice.invoiceId]: event.target.files?.[0] || null }))}
                        title="Tải lên chứng từ"
                        type="file"
                      />
                      <button className="btn-primary px-5 py-3 text-sm" disabled={busy === invoice.invoiceId} type="submit">
                        <UploadCloud className="h-4 w-4" />
                        {busy === invoice.invoiceId ? 'Đang gửi...' : 'Gửi chứng từ'}
                      </button>
                    </form>
                  ) : (
                    <div className="shell-muted p-5 text-sm text-brand-muted">
                      {invoice.status === 'PAID'
                        ? 'Hóa đơn này đã được xác nhận thanh toán đầy đủ.'
                        : 'Hóa đơn đang có chứng từ chờ duyệt hoặc hiện chưa thể gửi thêm thanh toán.'}
                    </div>
                  )}
                </div>
              </div>

              {invoice.payments.length > 0 ? (
                <div className="mt-5">
                  <h3 className="font-semibold text-brand-ink">Lịch sử thanh toán</h3>
                  <div className="mt-3 space-y-2">
                    {invoice.payments.map((payment) => (
                      <div className="shell-muted p-3 text-sm text-brand-muted" key={payment.paymentId}>
                        <p className="font-semibold text-brand-ink">{money(payment.paidAmount)} · {statusText(payment.verificationStatus === 'VERIFIED' ? 'PAID' : payment.verificationStatus === 'PENDING' ? 'PENDING_REVIEW' : 'REJECTED')}</p>
                        <p className="mt-1">Gửi lúc {new Date(payment.submittedAt).toLocaleString('vi-VN')}</p>
                        {payment.verificationNote ? <p className="mt-1 text-red-700">{payment.verificationNote}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
