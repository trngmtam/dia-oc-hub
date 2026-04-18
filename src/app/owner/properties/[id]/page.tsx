'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, Trash2, UserRound, XCircle } from 'lucide-react';
import {
  executeLeaseTermination,
  generateUnitInviteCode,
  revokeUnitInviteCode,
} from '@/features/leases/leases.actions';
import {
  endManagerAssignmentByOwner,
  generatePropertyManagerInviteCode,
  revokePropertyManagerInviteCode,
} from '@/features/managerAssignments/managerAssignments.actions';
import { getOwnerPropertyManagementDetail } from '@/features/properties/properties.actions';
import { deleteUnit } from '@/features/units/units.actions';

type InviteData = {
  inviteCode: string;
  expiresAt: string;
  isMasked?: boolean;
};

type PropertyManagerSummary = {
  assignmentId: string;
  managerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  startDate: string;
};

type PropertyLeaseSummary = {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null;
  startDate: string;
  endDate: string;
  terminationRequestedAt: string | null;
};

type UnitItem = {
  id: string;
  propertyId: string;
  unitCode: string;
  unitName: string | null;
  occupancyStatus: string;
  defaultMonthlyRent: string | null;
  defaultDeposit: string | null;
  areaSqm: string | null;
  hasActiveInviteCode: boolean;
  activeInviteExpiresAt: string | null;
  pendingRequestCount: number;
  activeLease: PropertyLeaseSummary | null;
  hasOperationalHistory: boolean;
  canGenerateTenantInvite: boolean;
  tenantInviteBlockedReason: string | null;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

type PropertyManagementDetail = {
  id: string;
  propertyCode: string;
  propertyName: string;
  addressLine: string;
  city: string | null;
  totalUnits: number;
  status: string;
  activeManagers: PropertyManagerSummary[];
  hasActiveManagerInviteCode: boolean;
  activeManagerInviteExpiresAt: string | null;
  canGenerateManagerInvite: boolean;
  managerInviteBlockedReason: string | null;
  units: UnitItem[];
};

function formatMoney(value: string | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

function formatInvite(
  persisted: { hasCode: boolean; expiresAt: string | null },
  generated: InviteData | null
) {
  if (generated) {
    return generated;
  }

  if (!persisted.hasCode || !persisted.expiresAt) {
    return null;
  }

  return {
    inviteCode: 'Mã chỉ hiển thị ngay sau khi tạo',
    expiresAt: persisted.expiresAt,
    isMasked: true,
  };
}

function localizeUnitMessage(message: string | null) {
  if (!message) return null;

  switch (message) {
    case 'This unit already has an active tenant lease. Terminate it before generating a new code.':
      return 'Căn này đang có hợp đồng thuê hiệu lực. Hãy kết thúc hợp đồng trước khi tạo mã mới.';
    case 'Terminate the active lease before removing this unit.':
      return 'Hãy kết thúc hợp đồng đang hiệu lực trước khi xóa căn này.';
    case 'This unit has operational history and cannot be removed.':
      return 'Căn này đã có lịch sử vận hành nên không thể xóa.';
    case 'This property already has an active manager assignment.':
      return 'Tài sản này đã có quản gia đang phụ trách nên chưa thể tạo mã mới.';
    default:
      return message;
  }
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shell-muted px-4 py-3 text-sm text-brand-ink">
      {label}: <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function OwnerPropertyDetailPage() {
  const { id } = useParams() as { id: string };
  const [property, setProperty] = useState<PropertyManagementDetail | null>(null);
  const [managerInvite, setManagerInvite] = useState<InviteData | null>(null);
  const [unitInvites, setUnitInvites] = useState<Record<string, InviteData>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProperty = async () => {
    const response = await getOwnerPropertyManagementDetail({ propertyId: id });

    if (response.success && response.data) {
      setProperty(response.data);
      setError('');
    } else {
      setProperty(null);
      setError(response.message || 'Không thể tải chi tiết tài sản');
    }

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const response = await getOwnerPropertyManagementDetail({ propertyId: id });
      if (cancelled) return;

      if (response.success && response.data) {
        setProperty(response.data);
        setError('');
      } else {
        setProperty(null);
        setError(response.message || 'Không thể tải chi tiết tài sản');
      }

      setLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleGenerateManagerCode = async () => {
    setBusyKey('manager-generate');
    setError('');
    const response = await generatePropertyManagerInviteCode({ propertyId: id });

    if (!response.success || !response.data) {
      setError(response.message || 'Không thể tạo mã mời quản gia');
      setBusyKey(null);
      return;
    }

    setManagerInvite(response.data);
    await loadProperty();
    setBusyKey(null);
  };

  const handleEndManagerAssignment = async (assignmentId: string, fullName: string) => {
    const confirmed = window.confirm(
      `Ngừng phân công ${fullName} khỏi tài sản này? Lịch sử làm việc vẫn sẽ được giữ lại để báo cáo.`
    );
    if (!confirmed) {
      return;
    }

    setBusyKey(`manager-end-${assignmentId}`);
    setError('');
    const response = await endManagerAssignmentByOwner({ assignmentId });

    if (!response.success) {
      setError(response.message || 'Không thể ngừng phân công quản gia cho tài sản này');
      setBusyKey(null);
      return;
    }

    await loadProperty();
    setBusyKey(null);
  };

  const handleRevokeManagerCode = async () => {
    setBusyKey('manager-revoke');
    setError('');
    const response = await revokePropertyManagerInviteCode({ propertyId: id });

    if (!response.success) {
      setError(response.message || 'Không thể thu hồi mã mời quản gia');
      setBusyKey(null);
      return;
    }

    setManagerInvite(null);
    await loadProperty();
    setBusyKey(null);
  };

  const handleGenerateUnitCode = async (unitId: string) => {
    setBusyKey(`unit-generate-${unitId}`);
    setError('');
    const response = await generateUnitInviteCode({ unitId });

    if (!response.success || !response.data) {
      setError(response.message || 'Không thể tạo mã mời người thuê');
      setBusyKey(null);
      return;
    }

    setUnitInvites((current) => ({
      ...current,
      [unitId]: response.data!,
    }));
    await loadProperty();
    setBusyKey(null);
  };

  const handleRevokeUnitCode = async (unitId: string) => {
    setBusyKey(`unit-revoke-${unitId}`);
    setError('');
    const response = await revokeUnitInviteCode({ unitId });

    if (!response.success) {
      setError(response.message || 'Không thể thu hồi mã mời người thuê');
      setBusyKey(null);
      return;
    }

    setUnitInvites((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
    await loadProperty();
    setBusyKey(null);
  };

  const handleDeleteUnit = async (unitId: string, label: string) => {
    const unit = property?.units.find((item) => item.id === unitId);
    const confirmed = window.confirm(
      unit?.hasOperationalHistory
        ? `Gỡ căn ${label} khỏi vận hành? Hệ thống sẽ lưu trữ lịch sử hợp đồng và tài chính để dùng cho báo cáo sau này.`
        : `Xóa vĩnh viễn căn ${label}? Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setBusyKey(`unit-delete-${unitId}`);
    setError('');
    const response = await deleteUnit({ unitId });

    if (!response.success) {
      setError(response.message || 'Không thể xóa căn này');
      setBusyKey(null);
      return;
    }

    setUnitInvites((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
    await loadProperty();
    setBusyKey(null);
  };

  const handleTerminateLease = async (leaseId: string) => {
    const confirmed = window.confirm('Bạn muốn kết thúc hợp đồng này ngay bây giờ chứ?');
    if (!confirmed) return;

    setBusyKey(`lease-terminate-${leaseId}`);
    setError('');
    const response = await executeLeaseTermination({ leaseId });

    if (!response.success) {
      setError(response.message || 'Không thể kết thúc hợp đồng');
      setBusyKey(null);
      return;
    }

    await loadProperty();
    setBusyKey(null);
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải chi tiết tài sản...</p>;
  }

  if (!property) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Không tìm thấy tài sản'}
      </div>
    );
  }

  const displayedManagerInvite = formatInvite(
    {
      hasCode: property.hasActiveManagerInviteCode,
      expiresAt: property.activeManagerInviteExpiresAt,
    },
    managerInvite
  );

  return (
    <div className="space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary-deep">{property.propertyCode}</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink md:text-5xl">{property.propertyName}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-brand-muted">
              {property.addressLine}
              {property.city ? `, ${property.city}` : ''}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <StatChip label="Tổng căn" value={String(property.totalUnits)} />
              <StatChip label="Trạng thái" value={property.status === 'ACTIVE' ? 'Đang hoạt động' : property.status} />
              <StatChip label="Quản gia đang phụ trách" value={String(property.activeManagers.length)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary px-4 py-3 text-sm" href="/owner/properties">
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại danh sách</span>
            </Link>
            <Link className="btn-primary px-4 py-3 text-sm" href={`/owner/properties/${id}/units/new`}>
              <span>Thêm căn mới</span>
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="shell-card p-6 md:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Quản gia phụ trách</p>
              <h2 className="mt-2 font-headline text-2xl font-bold text-brand-ink">Thông tin phân công</h2>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                Mỗi tài sản chỉ có một quản gia hoạt động tại cùng một thời điểm. Khi đã có người phụ trách, hệ thống sẽ chặn việc tạo mã mới.
              </p>
            </div>
          </div>

          {property.activeManagers.length === 0 ? (
            <div className="shell-muted mt-5 rounded-3xl border border-dashed border-brand-border px-5 py-5 text-sm leading-6 text-brand-muted">
              Tài sản này chưa có quản gia đang hoạt động.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {property.activeManagers.map((manager) => (
                <article className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5" key={manager.assignmentId}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Đang phụ trách</p>
                  <h3 className="mt-3 text-xl font-semibold text-brand-ink">{manager.fullName}</h3>
                  <p className="mt-2 text-sm text-brand-muted">{manager.email || 'Chưa có email'} • {manager.phone || 'Chưa có số điện thoại'}</p>
                  <p className="mt-2 text-sm text-brand-muted">Ngày bắt đầu: {formatDate(manager.startDate)}</p>
                  <button
                    className="btn-secondary mt-4 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyKey === `manager-end-${manager.assignmentId}`}
                    onClick={() => void handleEndManagerAssignment(manager.assignmentId, manager.fullName)}
                    type="button"
                  >
                    <span>Ngừng phân công</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="shell-card p-6 md:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-brand-primary-deep">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Mã mời quản gia</p>
              <h2 className="mt-2 font-headline text-2xl font-bold text-brand-ink">Kết nối người quản lý</h2>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                Chia sẻ mã cấp tài sản để quản gia gửi yêu cầu nhận quản lý. Sau khi duyệt, mã sẽ không nên tiếp tục sử dụng.
              </p>
            </div>
          </div>

          {displayedManagerInvite ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/90 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Mã đang hiệu lực</p>
              <p className="mt-3 text-2xl font-black tracking-[0.18em] text-brand-ink">{displayedManagerInvite.inviteCode}</p>
              <p className="mt-2 text-sm text-brand-muted">Hết hạn lúc {formatDateTime(displayedManagerInvite.expiresAt)}</p>
              {displayedManagerInvite.isMasked ? (
                <p className="mt-3 text-xs leading-5 text-brand-muted">
                  Vì lý do bảo mật, mã gốc chỉ hiển thị ngay sau khi tạo. Hãy tạo lại nếu bạn cần gửi một mã mới cho quản gia.
                </p>
              ) : null}
            </div>
          ) : null}

          {!property.canGenerateManagerInvite && property.managerInviteBlockedReason ? (
            <div className="shell-muted mt-5 rounded-3xl px-5 py-4 text-sm leading-6 text-brand-muted">
              {localizeUnitMessage(property.managerInviteBlockedReason)}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {property.canGenerateManagerInvite ? (
              <button
                className="btn-primary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyKey === 'manager-generate'}
                onClick={() => void handleGenerateManagerCode()}
                type="button"
              >
                <span>{displayedManagerInvite ? 'Tạo lại mã quản gia' : 'Tạo mã quản gia'}</span>
              </button>
            ) : null}

            {displayedManagerInvite ? (
              <button
                className="btn-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyKey === 'manager-revoke'}
                onClick={() => void handleRevokeManagerCode()}
                type="button"
              >
                <XCircle className="h-4 w-4" />
                <span>Thu hồi mã</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Danh sách căn</p>
            <h2 className="mt-2 font-headline text-3xl font-bold text-brand-ink">Quản lý hợp đồng và mã thuê</h2>
          </div>
          <span className="text-sm text-brand-muted">{property.units.length} căn</span>
        </div>

        {property.units.length === 0 ? (
          <div className="shell-card p-6 text-sm leading-6 text-brand-muted">
            Chưa có căn nào trong tài sản này. Hãy thêm căn trước khi tạo mã kết nối người thuê.
          </div>
        ) : (
          <div className="grid gap-5 2xl:grid-cols-2">
            {property.units.map((unit) => {
              const activeLease = unit.activeLease;
              const displayedInvite = formatInvite(
                {
                  hasCode: unit.hasActiveInviteCode,
                  expiresAt: unit.activeInviteExpiresAt,
                },
                unitInvites[unit.id] ?? null
              );

              return (
                <article className="shell-card p-6" key={unit.id}>
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-headline text-2xl font-bold text-brand-ink">{unit.unitName || unit.unitCode}</h3>
                        <span className="warm-badge">{unit.occupancyStatus === 'OCCUPIED' ? 'Đã có người thuê' : 'Còn trống'}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-brand-muted">Mã căn: {unit.unitCode}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <StatChip label="Giá thuê" value={formatMoney(unit.defaultMonthlyRent)} />
                        <StatChip label="Tiền cọc" value={formatMoney(unit.defaultDeposit)} />
                        {unit.areaSqm ? <StatChip label="Diện tích" value={`${unit.areaSqm} m²`} /> : null}
                      </div>
                      {unit.pendingRequestCount > 0 ? (
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">
                          Có {unit.pendingRequestCount} yêu cầu chờ duyệt cho căn này
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 xl:max-w-[300px] xl:justify-end">
                      <Link
                        className="btn-secondary px-4 py-3 text-sm"
                        href={`/owner/properties/${id}/units/${unit.id}/edit`}
                      >
                        <span>Chỉnh sửa căn</span>
                      </Link>
                      <button
                        className="btn-primary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!unit.canGenerateTenantInvite || busyKey === `unit-generate-${unit.id}`}
                        onClick={() => void handleGenerateUnitCode(unit.id)}
                        title={unit.tenantInviteBlockedReason || undefined}
                        type="button"
                      >
                        <span>{displayedInvite ? 'Tạo lại mã thuê' : 'Tạo mã thuê'}</span>
                      </button>

                      {displayedInvite ? (
                        <button
                          className="btn-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busyKey === `unit-revoke-${unit.id}`}
                          onClick={() => void handleRevokeUnitCode(unit.id)}
                          type="button"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Thu hồi mã</span>
                        </button>
                      ) : null}

                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!unit.canDelete || busyKey === `unit-delete-${unit.id}`}
                        onClick={() => void handleDeleteUnit(unit.id, unit.unitName || unit.unitCode)}
                        title={unit.deleteBlockedReason || undefined}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Xóa căn</span>
                      </button>
                    </div>
                  </div>

                  {!unit.canGenerateTenantInvite && unit.tenantInviteBlockedReason ? (
                    <div className="shell-muted mt-5 rounded-3xl px-5 py-4 text-sm leading-6 text-brand-muted">
                      {localizeUnitMessage(unit.tenantInviteBlockedReason)}
                    </div>
                  ) : null}

                  {!unit.canDelete && unit.deleteBlockedReason ? (
                    <div className="shell-muted mt-4 rounded-3xl px-5 py-4 text-sm leading-6 text-brand-muted">
                      {localizeUnitMessage(unit.deleteBlockedReason)}
                    </div>
                  ) : null}

                  {unit.hasOperationalHistory && unit.canDelete ? (
                    <div className="shell-muted mt-4 rounded-3xl px-5 py-4 text-sm leading-6 text-brand-muted">
                      Căn này sẽ được lưu trữ khỏi vận hành hằng ngày, nhưng lịch sử hợp đồng và tài chính vẫn được giữ lại để phục vụ báo cáo sau này.
                    </div>
                  ) : null}

                  {displayedInvite ? (
                    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/90 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Mã mời người thuê</p>
                      <p className="mt-3 text-2xl font-black tracking-[0.18em] text-brand-ink">{displayedInvite.inviteCode}</p>
                      <p className="mt-2 text-sm text-brand-muted">Hết hạn lúc {formatDateTime(displayedInvite.expiresAt)}</p>
                      {displayedInvite.isMasked ? (
                        <p className="mt-3 text-xs leading-5 text-brand-muted">
                          Mã gốc chỉ hiển thị ở thời điểm tạo. Nếu cần gửi lại cho người thuê, hãy tạo một mã mới.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {activeLease ? (
                    <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Hợp đồng đang hiệu lực</p>
                          <h4 className="mt-3 text-xl font-semibold text-brand-ink">{activeLease.tenantName}</h4>
                          <p className="mt-2 text-sm text-brand-muted">{activeLease.tenantEmail || 'Chưa có email'}</p>
                          <p className="mt-2 text-sm text-brand-muted">
                            Từ {formatDate(activeLease.startDate)} đến {formatDate(activeLease.endDate)}
                          </p>
                          {activeLease.terminationRequestedAt ? (
                            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">
                              Người thuê đã gửi yêu cầu kết thúc vào ngày {formatDate(activeLease.terminationRequestedAt)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#2f2b26] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busyKey === `lease-terminate-${activeLease.leaseId}`}
                          onClick={() => void handleTerminateLease(activeLease.leaseId)}
                          type="button"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Kết thúc hợp đồng</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
