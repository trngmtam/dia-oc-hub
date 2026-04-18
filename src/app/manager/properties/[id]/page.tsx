'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, BedDouble, Plus, MapPin, Bath } from 'lucide-react';
import { leaveManagedProperty } from '@/features/managerAssignments/managerAssignments.actions';
import { getPropertyById } from '@/features/properties/properties.actions';
import { getUnitsByPropertyId } from '@/features/units/units.actions';

type PropertyItem = {
  id: string;
  propertyName: string;
  addressLine: string;
  city: string | null;
  totalUnits: number;
  status: string;
};

type UnitItem = {
  id: string;
  unitCode: string;
  unitName: string | null;
  occupancyStatus: string;
  defaultMonthlyRent: string | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  areaSqm: string | null;
};

function formatMoney(value: string | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="shell-card p-5">
      <p className="text-sm text-brand-muted">{label}</p>
      <p className="mt-2 font-headline text-3xl font-bold text-brand-ink">{value}</p>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams() as { id: string };
  const [property, setProperty] = useState<PropertyItem | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [propRes, unitsRes] = await Promise.all([
        getPropertyById({ propertyId: id }),
        getUnitsByPropertyId({ propertyId: id }),
      ]);

      if (propRes.success && propRes.data) {
        setProperty(propRes.data);
        setError('');
      } else {
        setProperty(null);
        setError(propRes.message || 'Không tìm thấy thông tin tài sản');
      }

      if (unitsRes.success && unitsRes.data) {
        setUnits(unitsRes.data);
      }

      setLoading(false);
    }

    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải dữ liệu tài sản...</p>;
  }

  if (!property) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'Không tìm thấy thông tin tài sản.'}</div>;
  }

  const occupiedUnits = units.filter((unit) => unit.occupancyStatus === 'OCCUPIED').length;
  const vacantUnits = Math.max((property.totalUnits || 0) - occupiedUnits, 0);

  const handleLeaveProperty = async () => {
    const confirmed = window.confirm(
      `Ngừng quản lý ${property.propertyName}? Lịch sử phân công vẫn sẽ được giữ lại để báo cáo.`
    );
    if (!confirmed) {
      return;
    }

    setLeaving(true);
    setError('');
    const response = await leaveManagedProperty({ propertyId: id });

    if (!response.success) {
      setError(response.message || 'Không thể rời khỏi tài sản này');
      setLeaving(false);
      return;
    }

    window.location.href = '/manager/dashboard';
  };

  return (
    <div className="space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Tài sản được giao</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink md:text-5xl">{property.propertyName}</h1>
            <p className="mt-3 flex items-center gap-2 text-base text-brand-muted">
              <MapPin className="h-4 w-4" />
              <span>
                {property.addressLine}
                {property.city ? `, ${property.city}` : ''}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary px-4 py-3 text-sm" href="/manager/properties">
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại danh sách</span>
            </Link>
            <Link className="btn-primary px-4 py-3 text-sm" href={`/manager/properties/${id}/units/new`}>
              <Plus className="h-4 w-4" />
              <span>Thêm căn mới</span>
            </Link>
            <button
              className="btn-secondary px-4 py-3 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={leaving}
              onClick={() => void handleLeaveProperty()}
              type="button"
            >
              <span>{leaving ? 'Đang xử lý...' : 'Ngừng quản lý'}</span>
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Tổng số căn" value={String(property.totalUnits || 0)} />
        <MetricCard label="Đã có người thuê" value={String(occupiedUnits)} />
        <MetricCard label="Còn trống" value={String(vacantUnits)} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Danh sách căn hộ</p>
            <h2 className="mt-2 font-headline text-3xl font-bold text-brand-ink">Các căn đang quản lý</h2>
          </div>
          <span className="warm-badge">{units.length} căn</span>
        </div>

        {units.length === 0 ? (
          <div className="shell-card p-8 text-sm leading-6 text-brand-muted">
            Tài sản này chưa có căn nào. Bạn có thể thêm căn đầu tiên để bắt đầu quản lý giá thuê và trạng thái thuê.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {units.map((unit) => (
              <article className="shell-card p-6" key={unit.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-headline text-2xl font-bold text-brand-ink">{unit.unitName || unit.unitCode}</h3>
                      <span className="warm-badge">{unit.occupancyStatus === 'OCCUPIED' ? 'Đã thuê' : 'Còn trống'}</span>
                    </div>
                    <p className="mt-3 text-sm text-brand-muted">Mã căn: {unit.unitCode}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="shell-muted px-4 py-4 text-sm text-brand-ink">
                    <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Giá thuê</span>
                    <span className="mt-2 block font-semibold">{formatMoney(unit.defaultMonthlyRent)}</span>
                  </div>
                  <div className="shell-muted px-4 py-4 text-sm text-brand-ink">
                    <span className="block text-xs uppercase tracking-[0.18em] text-brand-muted">Diện tích</span>
                    <span className="mt-2 block font-semibold">{unit.areaSqm ? `${unit.areaSqm} m²` : 'Chưa cập nhật'}</span>
                  </div>
                  <div className="shell-muted flex items-center gap-3 px-4 py-4 text-sm text-brand-ink">
                    <BedDouble className="h-4 w-4 text-brand-primary-deep" />
                    <span>{unit.bedroomCount ?? 0} phòng ngủ</span>
                  </div>
                  <div className="shell-muted flex items-center gap-3 px-4 py-4 text-sm text-brand-ink">
                    <Bath className="h-4 w-4 text-brand-primary-deep" />
                    <span>{unit.bathroomCount ?? 0} phòng tắm</span>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Link className="btn-secondary px-4 py-3 text-sm" href={`/manager/properties/${id}/units/${unit.id}/edit`}>
                    Chỉnh sửa căn
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
