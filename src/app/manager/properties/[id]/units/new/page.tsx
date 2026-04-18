'use client';

import { ArrowLeft, BedDouble, DoorOpen, Hash, Home, Landmark, Bath } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { createUnit } from '@/features/units/units.actions';

export default function NewUnitPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setFormErrors({});

    const formData = new FormData(event.currentTarget);
    const data = {
      propertyId: id,
      unitCode: formData.get('unitCode') as string,
      unitName: (formData.get('unitName') as string) || undefined,
      floorNumber: formData.get('floorNumber') ? Number(formData.get('floorNumber')) : undefined,
      bedroomCount: formData.get('bedroomCount') ? Number(formData.get('bedroomCount')) : undefined,
      bathroomCount: formData.get('bathroomCount') ? Number(formData.get('bathroomCount')) : undefined,
      areaSqm: formData.get('areaSqm') ? Number(formData.get('areaSqm')) : null,
      furnishingStatus: (formData.get('furnishingStatus') as string) || undefined,
      defaultMonthlyRent: formData.get('defaultMonthlyRent') ? Number(formData.get('defaultMonthlyRent')) : null,
      defaultDeposit: formData.get('defaultDeposit') ? Number(formData.get('defaultDeposit')) : null,
    };

    const response = await createUnit(data);
    if (response.success) {
      router.push(`/manager/properties/${id}`);
      return;
    }

    if (response.errors) {
      setFormErrors(response.errors);
    } else {
      setError(response.message || 'Có lỗi xảy ra khi tạo căn mới.');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Thêm căn mới</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">Thiết lập thông tin căn hộ</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
              Tạo hồ sơ chi tiết cho từng căn để quản gia theo dõi giá thuê, nội thất và trạng thái thuê trong tài sản đang phụ trách.
            </p>
          </div>
          <Link className="btn-secondary px-4 py-3 text-sm" href={`/manager/properties/${id}`}>
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
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Hash className="h-4 w-4 text-brand-primary-deep" />
                Mã căn / mã phòng
              </label>
              <input className="input-shell w-full px-4 py-3" name="unitCode" placeholder="Ví dụ: B-1203" required type="text" />
              {formErrors.unitCode ? <p className="text-xs text-red-600">{formErrors.unitCode[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Home className="h-4 w-4 text-brand-primary-deep" />
                Tên hiển thị
              </label>
              <input className="input-shell w-full px-4 py-3" name="unitName" placeholder="Ví dụ: Căn góc cửa sổ lớn" type="text" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <DoorOpen className="h-4 w-4 text-brand-primary-deep" />
                Tầng
              </label>
              <input className="input-shell w-full px-4 py-3" name="floorNumber" placeholder="Ví dụ: 12" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Landmark className="h-4 w-4 text-brand-primary-deep" />
                Diện tích (m²)
              </label>
              <input className="input-shell w-full px-4 py-3" name="areaSqm" placeholder="Ví dụ: 68" step="0.01" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <BedDouble className="h-4 w-4 text-brand-primary-deep" />
                Số phòng ngủ
              </label>
              <input className="input-shell w-full px-4 py-3" name="bedroomCount" placeholder="Ví dụ: 2" type="number" />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Bath className="h-4 w-4 text-brand-primary-deep" />
                Số phòng tắm
              </label>
              <input className="input-shell w-full px-4 py-3" name="bathroomCount" placeholder="Ví dụ: 2" type="number" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-brand-ink">Tình trạng nội thất</label>
              <select aria-label="Tình trạng nội thất" className="input-shell w-full px-4 py-3" name="furnishingStatus" title="Tình trạng nội thất">
                <option value="UNFURNISHED">Để trống</option>
                <option value="PARTIALLY_FURNISHED">Nội thất cơ bản</option>
                <option value="FULLY_FURNISHED">Đầy đủ nội thất</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Giá thuê mặc định (VNĐ/tháng)</label>
              <input className="input-shell w-full px-4 py-3" name="defaultMonthlyRent" placeholder="Ví dụ: 12500000" type="number" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Tiền cọc mặc định (VNĐ)</label>
              <input className="input-shell w-full px-4 py-3" name="defaultDeposit" placeholder="Ví dụ: 25000000" type="number" />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-brand-border pt-6">
            <Link className="btn-ghost px-4 py-3 text-sm" href={`/manager/properties/${id}`}>
              Hủy
            </Link>
            <button className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
              <span>{loading ? 'Đang tạo...' : 'Lưu căn mới'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
