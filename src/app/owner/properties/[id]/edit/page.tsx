'use client';

import { ArrowLeft, Building2, Hash, MapPin, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { deleteProperty, getPropertyById, updateProperty } from '@/features/properties/properties.actions';
import type { UpdatePropertyInput } from '@/features/properties/properties.validation';

type EditPropertyViewModel = {
  id: string;
  propertyCode: string;
  propertyName: string;
  addressLine: string;
  ward: string | null;
  district: string | null;
  city: string | null;
  propertyType: string | null;
  totalUnits: number;
  status: string;
};

export default function EditPropertyPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [property, setProperty] = useState<EditPropertyViewModel | null>(null);

  useEffect(() => {
    async function load() {
      const response = await getPropertyById({ propertyId: id });
      if (response.success && response.data) {
        setProperty(response.data);
      } else {
        setError('Không tìm thấy tài sản cần chỉnh sửa.');
      }
      setLoading(false);
    }

    void load();
  }, [id]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFormErrors({});

    const formData = new FormData(event.currentTarget);
    const getStringValue = (key: string) => {
      const value = formData.get(key);
      return typeof value === 'string' ? value : '';
    };

    const data: UpdatePropertyInput = {
      propertyId: id,
      propertyCode: getStringValue('propertyCode'),
      propertyName: getStringValue('propertyName'),
      addressLine: getStringValue('addressLine'),
      city: getStringValue('city'),
      district: getStringValue('district'),
      ward: getStringValue('ward'),
      propertyType: getStringValue('propertyType'),
      status: getStringValue('status') as 'ACTIVE' | 'INACTIVE',
    };

    const response = await updateProperty(data);
    if (response.success) {
      router.push(`/owner/properties/${id}`);
      return;
    }

    if (response.errors) {
      setFormErrors(response.errors);
      const firstError = Object.values(response.errors).flat()[0];
      if (firstError) {
        setError(firstError);
      }
    } else {
      setError(response.message || 'Có lỗi xảy ra khi cập nhật tài sản.');
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!property) return;

    const confirmed = window.confirm(
      property.totalUnits > 0
        ? `Xóa tài sản này? Tài sản hiện còn ${property.totalUnits} căn. Hệ thống sẽ lưu trữ toàn bộ dữ liệu lịch sử thay vì xóa vĩnh viễn.`
        : 'Xóa tài sản này? Nếu chưa có dữ liệu lịch sử, bản ghi sẽ bị xóa vĩnh viễn.'
    );
    if (!confirmed) return;

    setSubmitting(true);
    const response = await deleteProperty({ propertyId: id });
    if (response.success) {
      router.push('/owner/properties');
      return;
    }

    setError(response.message || 'Không thể xóa tài sản này.');
    setSubmitting(false);
  };

  if (loading) {
    return <p className="text-sm text-brand-muted">Đang tải thông tin tài sản...</p>;
  }

  if (!property) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Tài sản không tồn tại.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="shell-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Chỉnh sửa tài sản</p>
            <h1 className="mt-3 font-headline text-4xl font-extrabold text-brand-ink">Cập nhật hồ sơ vận hành</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
              Điều chỉnh thông tin hiển thị, trạng thái hoạt động và địa chỉ để dữ liệu của tài sản luôn nhất quán trong toàn hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary px-4 py-3 text-sm" href={`/owner/properties/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại chi tiết</span>
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              onClick={handleDelete}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              <span>Xóa tài sản</span>
            </button>
          </div>
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
              <input className="input-shell w-full px-4 py-3" defaultValue={property.propertyCode} name="propertyCode" required type="text" />
              {formErrors.propertyCode ? <p className="text-xs text-red-600">{formErrors.propertyCode[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <Building2 className="h-4 w-4 text-brand-primary-deep" />
                Tên tài sản
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={property.propertyName} name="propertyName" required type="text" />
              {formErrors.propertyName ? <p className="text-xs text-red-600">{formErrors.propertyName[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Loại hình</label>
              <select className="input-shell w-full px-4 py-3" defaultValue={property.propertyType || 'APARTMENT'} name="propertyType">
                <option value="APARTMENT">Chung cư / căn hộ</option>
                <option value="HOUSE">Nhà phố</option>
                <option value="OFFICE">Văn phòng</option>
                <option value="ROOM">Khu phòng trọ</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Trạng thái</label>
              <select className="input-shell w-full px-4 py-3" defaultValue={property.status} name="status">
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm ngưng</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <MapPin className="h-4 w-4 text-brand-primary-deep" />
                Địa chỉ chi tiết
              </label>
              <input className="input-shell w-full px-4 py-3" defaultValue={property.addressLine} name="addressLine" required type="text" />
              {formErrors.addressLine ? <p className="text-xs text-red-600">{formErrors.addressLine[0]}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Phường / Xã</label>
              <input className="input-shell w-full px-4 py-3" defaultValue={property.ward || ''} name="ward" type="text" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Quận / Huyện</label>
              <input className="input-shell w-full px-4 py-3" defaultValue={property.district || ''} name="district" type="text" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Tỉnh / Thành phố</label>
              <input className="input-shell w-full px-4 py-3" defaultValue={property.city || ''} name="city" type="text" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-ink">Tổng số căn</label>
              <input className="input-shell w-full cursor-not-allowed px-4 py-3 opacity-70" defaultValue={property.totalUnits} disabled name="totalUnits" type="number" />
              <p className="text-xs text-brand-muted">Số căn được cập nhật tự động khi thêm hoặc xóa đơn vị trong tài sản.</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-brand-border pt-6">
            <Link className="btn-ghost px-4 py-3 text-sm" href={`/owner/properties/${id}`}>
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
