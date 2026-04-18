'use client';

import { ArrowLeft, Building2, Hash, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { createProperty } from '@/features/properties/properties.actions';

export default function NewPropertyPage() {
  const router = useRouter();
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
      propertyCode: formData.get('propertyCode') as string,
      propertyName: formData.get('propertyName') as string,
      addressLine: formData.get('addressLine') as string,
      city: formData.get('city') as string,
      district: formData.get('district') as string,
      ward: formData.get('ward') as string,
      propertyType: formData.get('propertyType') as string,
      totalUnits: 0,
      status: 'ACTIVE' as const,
    };

    const response = await createProperty(data);
    if (response.success) {
      router.push('/owner/properties');
      return;
    }

    if (response.errors) {
      setFormErrors(response.errors);
    } else {
      setError(response.message || 'Có lỗi xảy ra khi tạo tài sản.');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Tạo tài sản mới</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">Thiết lập hồ sơ bất động sản</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
              Khai báo thông tin cơ bản để hệ thống bắt đầu quản lý căn hộ, nhà phố hoặc khu phòng trọ của bạn theo cùng một chuẩn vận hành.
            </p>
          </div>
          <Link className="btn-secondary px-4 py-3 text-sm" href="/owner/properties">
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách</span>
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
                Mã tài sản
              </label>
              <input className="input-shell w-full px-4 py-3" name="propertyCode" placeholder="Ví dụ: LM81, Q7-01" required type="text" />
              {formErrors.propertyCode ? <p className="text-xs text-red-600">{formErrors.propertyCode[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Building2 className="h-4 w-4 text-brand-primary-deep" />
                Tên tài sản
              </label>
              <input className="input-shell w-full px-4 py-3" name="propertyName" placeholder="Ví dụ: Căn hộ Landmark 81" required type="text" />
              {formErrors.propertyName ? <p className="text-xs text-red-600">{formErrors.propertyName[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Loại hình</label>
              <select className="input-shell w-full px-4 py-3" name="propertyType">
                <option value="APARTMENT">Chung cư / căn hộ</option>
                <option value="HOUSE">Nhà phố</option>
                <option value="OFFICE">Văn phòng</option>
                <option value="ROOM">Khu phòng trọ</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <MapPin className="h-4 w-4 text-brand-primary-deep" />
                Địa chỉ chi tiết
              </label>
              <input className="input-shell w-full px-4 py-3" name="addressLine" placeholder="Số nhà, tên đường..." required type="text" />
              {formErrors.addressLine ? <p className="text-xs text-red-600">{formErrors.addressLine[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Phường / Xã</label>
              <input className="input-shell w-full px-4 py-3" name="ward" placeholder="Ví dụ: Phường 22" type="text" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Quận / Huyện</label>
              <input className="input-shell w-full px-4 py-3" name="district" placeholder="Ví dụ: Bình Thạnh" type="text" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-brand-ink">Tỉnh / Thành phố</label>
              <input className="input-shell w-full px-4 py-3" name="city" placeholder="Ví dụ: TP. Hồ Chí Minh" type="text" />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-brand-border pt-6">
            <Link className="btn-ghost px-4 py-3 text-sm" href="/owner/properties">
              Hủy
            </Link>
            <button className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
              <span>{loading ? 'Đang lưu...' : 'Lưu tài sản'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
