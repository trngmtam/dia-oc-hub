'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { deleteProperty, getProperties } from '@/features/properties/properties.actions';

type PropertyItem = {
  id: string;
  propertyCode: string;
  propertyName: string;
  addressLine: string;
  city: string | null;
  totalUnits: number;
  occupiedUnits?: number;
  status: string;
};

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await getProperties();
    if (response.success && response.data) {
      setProperties(response.data);
      setError('');
    } else {
      setError(response.message || 'Không thể tải danh sách tài sản');
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filtered = properties.filter((property) => {
    const keyword = search.toLowerCase();
    return (
      property.propertyName.toLowerCase().includes(keyword) ||
      property.propertyCode.toLowerCase().includes(keyword) ||
      property.addressLine.toLowerCase().includes(keyword)
    );
  });

  const handleDelete = async (propertyId: string, propertyName: string, unitCount: number) => {
    const confirmed = window.confirm(
      unitCount > 0
        ? `Xóa tài sản ${propertyName}? Tài sản này đang có ${unitCount} căn. Hệ thống sẽ lưu trữ toàn bộ dữ liệu lịch sử thay vì xóa vĩnh viễn.`
        : `Xóa tài sản ${propertyName}? Nếu chưa có dữ liệu lịch sử, bản ghi này sẽ bị xóa vĩnh viễn.`
    );
    if (!confirmed) return;

    const response = await deleteProperty({ propertyId });
    if (!response.success) {
      setError(response.message || 'Không thể xóa tài sản');
      return;
    }

    await load();
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Danh mục đầu tư</p>
          <h1 className="mt-3 font-headline text-5xl font-extrabold text-brand-ink">Quản lý bất động sản</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-brand-muted">
            Theo dõi danh sách tài sản, quản lý số căn hộ và truy cập nhanh vào màn hình vận hành từng tòa nhà.
          </p>
        </div>
        <Link className="btn-primary px-5 py-3.5 text-sm" href="/owner/properties/new">
          <Plus className="h-4 w-4" />
          <span>Thêm tài sản mới</span>
        </Link>
      </section>

      <section className="shell-card p-4 md:p-5">
        <div className="input-shell flex items-center gap-3 px-4 py-0">
          <Search className="h-4 w-4 text-brand-muted" />
          <input
            className="w-full border-0 bg-transparent px-0 py-3.5 outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên tài sản, mã hoặc địa chỉ"
            type="text"
            value={search}
          />
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-brand-muted">Đang tải danh sách tài sản...</p> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="shell-card p-8 text-sm text-brand-muted">Chưa có tài sản phù hợp với điều kiện tìm kiếm.</div>
        ) : (
          filtered.map((property) => {
            const occupiedUnits = property.occupiedUnits ?? 0;
            const vacantUnits = Math.max(property.totalUnits - occupiedUnits, 0);

            return (
              <article className="shell-card p-6" key={property.id}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="warm-badge">{property.propertyCode}</p>
                      <h2 className="mt-4 font-headline text-3xl font-bold text-brand-ink">{property.propertyName}</h2>
                      <p className="mt-3 flex items-center gap-2 text-sm text-brand-muted">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {property.addressLine}
                          {property.city ? `, ${property.city}` : ''}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <div className="shell-muted px-4 py-3 text-sm text-brand-ink">Tổng căn: <span className="font-semibold">{property.totalUnits}</span></div>
                      <div className="shell-muted px-4 py-3 text-sm text-brand-ink">Đã thuê: <span className="font-semibold">{occupiedUnits}</span></div>
                      <div className="shell-muted px-4 py-3 text-sm text-brand-ink">Còn trống: <span className="font-semibold">{vacantUnits}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:w-[240px] lg:flex-col">
                    <Link className="btn-primary flex-1 px-4 py-3 text-sm" href={`/owner/properties/${property.id}`}>
                      Mở chi tiết
                    </Link>
                    <Link className="btn-secondary flex-1 px-4 py-3 text-sm" href={`/owner/properties/${property.id}/edit`}>
                      Chỉnh sửa
                    </Link>
                    <button className="btn-secondary flex-1 px-4 py-3 text-sm text-red-700" onClick={() => void handleDelete(property.id, property.propertyName, property.totalUnits)} type="button">
                      <Trash2 className="h-4 w-4" />
                      <span>Xóa tài sản</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
