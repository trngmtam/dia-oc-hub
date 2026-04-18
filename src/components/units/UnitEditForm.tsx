'use client';

import { ArrowLeft, Bath, BedDouble, DoorOpen, Hash, Home, Landmark } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { getUnitById, updateUnit } from '@/features/units/units.actions';

type UnitDetail = {
  id: string;
  propertyId: string;
  unitCode: string;
  unitName: string | null;
  floorNumber: number | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  areaSqm: string | null;
  furnishingStatus: string | null;
  defaultMonthlyRent: string | null;
  defaultDeposit: string | null;
  occupancyStatus: string;
};

export function UnitEditForm({ rolePrefix }: { rolePrefix: 'owner' | 'manager' }) {
  const router = useRouter();
  const { id, unitId } = useParams() as { id: string; unitId: string };
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const backHref = `/${rolePrefix}/properties/${id}`;

  const load = useEffectEvent(async () => {
    const response = await getUnitById({ propertyId: id, unitId });
    if (response.success && response.data) {
      setUnit(response.data);
      setError('');
    } else {
      setUnit(null);
      setError(response.message || 'Không thể tải thông tin căn.');
    }
    setLoading(false);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id, unitId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!unit) return;

    setSubmitting(true);
    setError('');
    setFormErrors({});

    const formData = new FormData(event.currentTarget);
    const response = await updateUnit({
      unitId,
      propertyId: id,
      unitCode: String(formData.get('unitCode') || ''),
      unitName: String(formData.get('unitName') || ''),
      floorNumber: formData.get('floorNumber') ? Number(formData.get('floorNumber')) : undefined,
      bedroomCount: formData.get('bedroomCount') ? Number(formData.get('bedroomCount')) : undefined,
      bathroomCount: formData.get('bathroomCount') ? Number(formData.get('bathroomCount')) : undefined,
      areaSqm: formData.get('areaSqm') ? Number(formData.get('areaSqm')) : null,
      furnishingStatus: String(formData.get('furnishingStatus') || ''),
      defaultMonthlyRent: formData.get('defaultMonthlyRent') ? Number(formData.get('defaultMonthlyRent')) : null,
      defaultDeposit: formData.get('defaultDeposit') ? Number(formData.get('defaultDeposit')) : null,
    });

    if (response.success) {
      router.push(backHref);
      return;
    }

    if (response.errors) {
      setFormErrors(response.errors);
    } else {
      setError(response.message || 'Không thể cập nhật căn này.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải thông tin căn...</p>;
  }

  if (!unit) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || 'Không tìm thấy căn cần chỉnh sửa.'}</div>;
  }

  const occupancyLabel =
    unit.occupancyStatus === 'OCCUPIED'
      ? 'Đã có người thuê'
      : unit.occupancyStatus === 'MAINTENANCE'
        ? 'Đang bảo trì'
        : 'Còn trống';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Chỉnh sửa căn</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">Cập nhật thông tin căn cho thuê</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
              Điều chỉnh mã căn, cấu hình phòng, giá thuê và tiền cọc để dữ liệu vận hành luôn chính xác.
            </p>
          </div>
          <Link className="btn-secondary px-4 py-3 text-sm" href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại tài sản</span>
          </Link>
        </div>
      </section>

      <section className="shell-card p-6 md:p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="unitCode">
                <Hash className="h-4 w-4 text-brand-primary-deep" />
                Mã căn / mã phòng
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.unitCode} id="unitCode" name="unitCode" required type="text" />
              {formErrors.unitCode ? <p className="text-xs text-red-600">{formErrors.unitCode[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="unitName">
                <Home className="h-4 w-4 text-brand-primary-deep" />
                Tên hiển thị
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.unitName || ''} id="unitName" name="unitName" type="text" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="floorNumber">
                <DoorOpen className="h-4 w-4 text-brand-primary-deep" />
                Tầng
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.floorNumber ?? ''} id="floorNumber" name="floorNumber" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="areaSqm">
                <Landmark className="h-4 w-4 text-brand-primary-deep" />
                Diện tích (m²)
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.areaSqm ?? ''} id="areaSqm" name="areaSqm" step="0.01" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="bedroomCount">
                <BedDouble className="h-4 w-4 text-brand-primary-deep" />
                Số phòng ngủ
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.bedroomCount ?? ''} id="bedroomCount" name="bedroomCount" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink" htmlFor="bathroomCount">
                <Bath className="h-4 w-4 text-brand-primary-deep" />
                Số phòng tắm
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.bathroomCount ?? ''} id="bathroomCount" name="bathroomCount" type="number" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-brand-ink" htmlFor="furnishingStatus">Tình trạng nội thất</label>
              <select className="input-shell w-full px-4 py-3" defaultValue={unit.furnishingStatus || 'UNFURNISHED'} id="furnishingStatus" name="furnishingStatus">
                <option value="UNFURNISHED">Để trống</option>
                <option value="PARTIALLY_FURNISHED">Nội thất cơ bản</option>
                <option value="FULLY_FURNISHED">Đầy đủ nội thất</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink" htmlFor="defaultMonthlyRent">Giá thuê mặc định (VNĐ/tháng)</label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.defaultMonthlyRent ?? ''} id="defaultMonthlyRent" name="defaultMonthlyRent" type="number" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink" htmlFor="defaultDeposit">Tiền cọc mặc định (VNĐ)</label>
              <input className="input-shell w-full px-4 py-3" defaultValue={unit.defaultDeposit ?? ''} id="defaultDeposit" name="defaultDeposit" type="number" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-brand-ink" htmlFor="occupancyStatus">Tình trạng sử dụng</label>
              <input className="input-shell w-full cursor-not-allowed px-4 py-3 opacity-70" disabled id="occupancyStatus" readOnly value={occupancyLabel} />
              <p className="text-xs text-brand-muted">Trạng thái thuê hiện được giữ nguyên để tránh ảnh hưởng tới hợp đồng và quy trình vận hành.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-brand-border pt-6">
            <Link className="btn-ghost px-4 py-3 text-sm" href={backHref}>
              Hủy
            </Link>
            <button className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
              <span>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
