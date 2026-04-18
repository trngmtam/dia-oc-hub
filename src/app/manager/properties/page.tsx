'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { leaveManagedProperty } from '@/features/managerAssignments/managerAssignments.actions';
import { getProperties } from '@/features/properties/properties.actions';

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

export default function ManagerPropertiesPage() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyPropertyId, setBusyPropertyId] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const response = await getProperties();
      if (response.success && response.data) {
        setProperties(response.data);
        setError('');
      } else {
        setError(response.message || 'Không thể tải danh sách tài sản');
      }
      setLoading(false);
    }

    void run();
  }, []);

  const handleLeaveProperty = async (propertyId: string, propertyName: string) => {
    const confirmed = window.confirm(
      `Ngừng quản lý ${propertyName}? Lịch sử phân công vẫn sẽ được giữ lại để báo cáo.`
    );
    if (!confirmed) return;

    setBusyPropertyId(propertyId);
    setError('');
    const response = await leaveManagedProperty({ propertyId });
    if (!response.success) {
      setError(response.message || 'Không thể rời khỏi tài sản này');
      setBusyPropertyId(null);
      return;
    }

    await (async () => {
      const reload = await getProperties();
      if (reload.success && reload.data) {
        setProperties(reload.data);
        setError('');
      } else {
        setError(reload.message || 'Không thể tải danh sách tài sản');
      }
    })();
    setBusyPropertyId(null);
  };

  const filtered = properties.filter((property) => {
    const keyword = search.toLowerCase();
    return (
      property.propertyName.toLowerCase().includes(keyword) ||
      property.propertyCode.toLowerCase().includes(keyword) ||
      property.addressLine.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary-deep">Tài sản được giao</p>
        <h1 className="mt-3 font-headline text-5xl font-extrabold text-brand-ink">Danh mục quản lý</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-brand-muted">
          Xem toàn bộ bất động sản bạn đang vận hành, kiểm tra số căn đã thuê và mở nhanh màn hình xử lý yêu cầu.
        </p>
      </section>

      <section className="shell-card p-4 md:p-5">
        <div className="input-shell flex items-center gap-3 px-4 py-0">
          <Search className="h-4 w-4 text-brand-muted" />
          <input
            className="w-full border-0 bg-transparent px-0 py-3.5 outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tài sản đang phụ trách"
            type="text"
            value={search}
          />
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-brand-muted">Đang tải tài sản...</p> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="shell-card p-8 text-sm text-brand-muted">Hiện chưa có tài sản nào được phân công.</div>
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
                    <Link className="btn-primary flex-1 px-4 py-3 text-sm" href={`/manager/properties/${property.id}`}>
                      Mở chi tiết
                    </Link>
                    <Link className="btn-secondary flex-1 px-4 py-3 text-sm" href="/manager/requests">
                      Xem yêu cầu
                    </Link>
                    <button
                      className="btn-secondary flex-1 px-4 py-3 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={busyPropertyId === property.id}
                      onClick={() => void handleLeaveProperty(property.id, property.propertyName)}
                      type="button"
                    >
                      {busyPropertyId === property.id ? 'Đang xử lý...' : 'Ngừng quản lý'}
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
