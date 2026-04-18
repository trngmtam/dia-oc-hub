'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { expirePastActiveLeases } from '@/lib/lease-expiration';
import {
  createPropertySchema,
  deletePropertySchema,
  getPropertyByIdSchema,
  updatePropertySchema,
  type CreatePropertyInput,
  type DeletePropertyInput,
  type GetPropertyByIdInput,
  type UpdatePropertyInput,
} from './properties.validation';

export type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

type PropertyListItem = {
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
  occupiedUnits?: number;
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

type OwnerPropertyUnitManagementItem = {
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

type OwnerPropertyManagementDetail = PropertyListItem & {
  activeManagers: PropertyManagerSummary[];
  hasActiveManagerInviteCode: boolean;
  activeManagerInviteExpiresAt: string | null;
  canGenerateManagerInvite: boolean;
  managerInviteBlockedReason: string | null;
  units: OwnerPropertyUnitManagementItem[];
};

function toNullableString(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getSessionOrError(): Promise<
  NonNullable<Awaited<ReturnType<typeof getSession>>> | null
> {
  const session = await getSession();
  if (!session) return null;
  return session;
}

function parseBigInt(id: string): bigint {
  return BigInt(id);
}

function canManageAll(role: string): boolean {
  return role === 'ADMIN';
}

function scopeWhereForRead(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const activeFilter = { not: 'ARCHIVED' as const };

  if (canManageAll(session.role)) {
    return { status: activeFilter };
  }

  if (session.role === 'OWNER') {
    return { ownerId: parseBigInt(session.userId), status: activeFilter };
  }

  if (session.role === 'MANAGER') {
    return {
      status: activeFilter,
      assignments: {
        some: {
          managerId: parseBigInt(session.userId),
          status: 'ACTIVE',
        },
      },
    };
  }

  return { id: BigInt(-1) };
}

async function canAccessProperty(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  propertyId: bigint
): Promise<boolean> {
  if (canManageAll(session.role)) return true;

  if (session.role === 'OWNER') {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId: parseBigInt(session.userId) },
      select: { id: true },
    });
    return Boolean(property);
  }

  if (session.role === 'MANAGER') {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        assignments: {
          some: {
            managerId: parseBigInt(session.userId),
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true },
    });
    return Boolean(property);
  }

  return false;
}

export async function getProperties(): Promise<ActionResponse<PropertyListItem[]>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  try {
    await expirePastActiveLeases();
    const properties = await prisma.property.findMany({
      where: scopeWhereForRead(session),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        propertyCode: true,
        propertyName: true,
        addressLine: true,
        ward: true,
        district: true,
        city: true,
        propertyType: true,
        totalUnits: true,
        status: true,
        _count: {
          select: {
            units: {
              where: { occupancyStatus: 'OCCUPIED' }
            }
          }
        }
      },
    });

    return {
      success: true,
      data: properties.map((property) => ({
        id: property.id.toString(),
        propertyCode: property.propertyCode,
        propertyName: property.propertyName,
        addressLine: property.addressLine,
        ward: property.ward,
        district: property.district,
        city: property.city,
        propertyType: property.propertyType,
        totalUnits: property.totalUnits,
        status: property.status,
        occupiedUnits: property._count?.units ?? 0,
      })),
    };
  } catch (error) {
    console.error('getProperties error:', error);
    return { success: false, message: 'Không thể tải danh sách tài sản' };
  }
}

export async function getPropertyById(
  payload: GetPropertyByIdInput
): Promise<ActionResponse<PropertyListItem>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = getPropertyByIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);
    await expirePastActiveLeases({
      unit: {
        propertyId,
      },
    });

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        propertyCode: true,
        propertyName: true,
        addressLine: true,
        ward: true,
        district: true,
        city: true,
        propertyType: true,
        totalUnits: true,
        status: true,
      },
    });

    if (!property) {
      return { success: false, message: 'Không tìm thấy tài sản' };
    }

    return {
      success: true,
      data: {
        ...property,
        id: property.id.toString(),
      },
    };
  } catch (error) {
    console.error('getPropertyById error:', error);
    return { success: false, message: 'Không thể tải thông tin tài sản' };
  }
}

export async function getOwnerPropertyManagementDetail(
  payload: GetPropertyByIdInput
): Promise<ActionResponse<OwnerPropertyManagementDetail>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = getPropertyByIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return { success: false, message: 'Bạn không có quyền thực hiện thao tác này' };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);
    await expirePastActiveLeases({
      unit: {
        propertyId,
      },
    });

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const now = new Date();
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        propertyCode: true,
        propertyName: true,
        addressLine: true,
        ward: true,
        district: true,
        city: true,
        propertyType: true,
        totalUnits: true,
        status: true,
        assignments: {
          where: {
            status: 'ACTIVE',
          },
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            managerId: true,
            startDate: true,
            manager: {
              select: {
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        managerInviteCodes: {
          where: {
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            expiresAt: true,
          },
        },
        units: {
          where: {
            occupancyStatus: {
              not: 'ARCHIVED',
            },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            propertyId: true,
            unitCode: true,
            unitName: true,
            occupancyStatus: true,
            defaultMonthlyRent: true,
            defaultDeposit: true,
            areaSqm: true,
            inviteCodes: {
              where: {
                revokedAt: null,
                expiresAt: { gt: now },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                expiresAt: true,
              },
            },
            leases: {
              where: {
                status: 'ACTIVE',
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                tenantId: true,
                startDate: true,
                endDate: true,
                terminationRequestedAt: true,
                tenant: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            _count: {
              select: {
                leases: true,
                expenses: true,
                alerts: true,
                connectionRequests: {
                  where: {
                    status: 'PENDING',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!property) {
      return { success: false, message: 'Không tìm thấy tài sản' };
    }

    const activeManagers = property.assignments.map((assignment) => ({
      assignmentId: assignment.id.toString(),
      managerId: assignment.managerId.toString(),
      fullName: assignment.manager.fullName,
      email: assignment.manager.email,
      phone: assignment.manager.phone,
      startDate: assignment.startDate.toISOString(),
    }));

    const activeManagerInvite = property.managerInviteCodes[0] ?? null;
    const canGenerateManagerInvite = activeManagers.length === 0;

    return {
      success: true,
      data: {
        id: property.id.toString(),
        propertyCode: property.propertyCode,
        propertyName: property.propertyName,
        addressLine: property.addressLine,
        ward: property.ward,
        district: property.district,
        city: property.city,
        propertyType: property.propertyType,
        totalUnits: property.totalUnits,
        status: property.status,
        activeManagers,
        hasActiveManagerInviteCode: Boolean(activeManagerInvite),
        activeManagerInviteExpiresAt: activeManagerInvite?.expiresAt.toISOString() ?? null,
        canGenerateManagerInvite,
        managerInviteBlockedReason: canGenerateManagerInvite
          ? null
          : 'This property already has an active manager assignment.',
        units: property.units.map((unit) => {
          const activeLease = unit.leases[0] ?? null;
          const activeInvite = unit.inviteCodes[0] ?? null;
          const hasHistory =
            unit._count.leases > 0 || unit._count.expenses > 0 || unit._count.alerts > 0;
          const canGenerateTenantInvite =
            unit.occupancyStatus !== 'OCCUPIED' && activeLease === null;

          let deleteBlockedReason: string | null = null;
          if (activeLease) {
            deleteBlockedReason = 'Terminate the active lease before removing this unit.';
          }

          return {
            id: unit.id.toString(),
            propertyId: unit.propertyId.toString(),
            unitCode: unit.unitCode,
            unitName: unit.unitName,
            occupancyStatus: unit.occupancyStatus,
            defaultMonthlyRent: unit.defaultMonthlyRent?.toString() ?? null,
            defaultDeposit: unit.defaultDeposit?.toString() ?? null,
            areaSqm: unit.areaSqm?.toString() ?? null,
            hasActiveInviteCode: Boolean(activeInvite),
            activeInviteExpiresAt: activeInvite?.expiresAt.toISOString() ?? null,
            pendingRequestCount: unit._count.connectionRequests,
            activeLease: activeLease
              ? {
                  leaseId: activeLease.id.toString(),
                  tenantId: activeLease.tenantId.toString(),
                  tenantName: activeLease.tenant.fullName,
                  tenantEmail: activeLease.tenant.email,
                  startDate: activeLease.startDate.toISOString(),
                  endDate: activeLease.endDate.toISOString(),
                  terminationRequestedAt: activeLease.terminationRequestedAt?.toISOString() ?? null,
                }
              : null,
            hasOperationalHistory: hasHistory,
            canGenerateTenantInvite,
            tenantInviteBlockedReason: canGenerateTenantInvite
              ? null
              : 'Căn hộ này đang có hợp đồng thuê hiệu lực. Vui lòng kết thúc hợp đồng trước khi tạo mã mới.',
            canDelete: deleteBlockedReason === null,
            deleteBlockedReason,
          };
        }),
      },
    };
  } catch (error) {
    console.error('getOwnerPropertyManagementDetail error:', error);
    return { success: false, message: 'Không thể tải chi tiết quản lý tài sản' };
  }
}

export async function createProperty(
  payload: CreatePropertyInput
): Promise<ActionResponse<{ propertyId: string }>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = createPropertySchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return { success: false, message: 'Chỉ chủ nhà hoặc quản trị viên mới có thể tạo tài sản' };
  }

  try {
    const duplicate = await prisma.property.findFirst({
      where: { propertyCode: parsed.data.propertyCode },
      select: { id: true },
    });

    if (duplicate) {
      return {
        success: false,
        errors: { propertyCode: ['Mã tài sản đã tồn tại'] },
      };
    }

    const ownerId = parseBigInt(session.userId);

    const created = await prisma.property.create({
      data: {
        ownerId,
        propertyCode: parsed.data.propertyCode,
        propertyName: parsed.data.propertyName,
        addressLine: parsed.data.addressLine,
        ward: toNullableString(parsed.data.ward),
        district: toNullableString(parsed.data.district),
        city: toNullableString(parsed.data.city),
        propertyType: toNullableString(parsed.data.propertyType),
        totalUnits: 0,
        status: parsed.data.status,
      },
      select: { id: true },
    });

    return {
      success: true,
      message: 'Đã tạo tài sản thành công',
      data: { propertyId: created.id.toString() },
    };
  } catch (error) {
    console.error('createProperty error:', error);
    return { success: false, message: 'Không thể tạo tài sản' };
  }
}

export async function updateProperty(
  payload: UpdatePropertyInput
): Promise<ActionResponse<{ propertyId: string }>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = updatePropertySchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền cập nhật tài sản này' };
    }

    const duplicate = await prisma.property.findFirst({
      where: {
        propertyCode: parsed.data.propertyCode,
        NOT: { id: propertyId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return {
        success: false,
        errors: { propertyCode: ['Mã tài sản đã tồn tại'] },
      };
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        propertyCode: parsed.data.propertyCode,
        propertyName: parsed.data.propertyName,
        addressLine: parsed.data.addressLine,
        ward: toNullableString(parsed.data.ward),
        district: toNullableString(parsed.data.district),
        city: toNullableString(parsed.data.city),
        propertyType: toNullableString(parsed.data.propertyType),
        status: parsed.data.status,
      },
      select: { id: true },
    });

    return {
      success: true,
      message: 'Đã cập nhật tài sản thành công',
      data: { propertyId: updated.id.toString() },
    };
  } catch (error) {
    console.error('updateProperty error:', error);
    return { success: false, message: 'Không thể cập nhật tài sản' };
  }
}

export async function deleteProperty(
  payload: DeletePropertyInput
): Promise<ActionResponse> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = deletePropertySchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền xóa tài sản này' };
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            units: true,
            expenses: true,
            alerts: true,
            assignments: true,
            managerAssignmentRequests: true,
          },
        },
        units: {
          where: {
            occupancyStatus: {
              not: 'ARCHIVED',
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!property) {
      return { success: false, message: 'Không tìm thấy tài sản' };
    }

    const activeLeaseCount = await prisma.lease.count({
      where: {
        unit: {
          propertyId,
        },
        status: 'ACTIVE',
      },
    });

    if (activeLeaseCount > 0) {
      return {
        success: false,
        message: 'Vui lòng kết thúc tất cả hợp đồng đang hiệu lực trước khi xóa tài sản này.',
      };
    }

    const hasOperationalHistory =
      property._count.units > 0 ||
      property._count.expenses > 0 ||
      property._count.alerts > 0 ||
      property._count.assignments > 0 ||
      property._count.managerAssignmentRequests > 0;

    if (!hasOperationalHistory && property.status !== 'ARCHIVED') {
      await prisma.$transaction([
        prisma.propertyManagerInviteCode.deleteMany({
          where: {
            propertyId,
          },
        }),
        prisma.managerAssignmentRequest.deleteMany({
          where: {
            propertyId,
          },
        }),
        prisma.property.delete({ where: { id: propertyId } }),
      ]);
      return { success: true, message: 'Đã xóa tài sản thành công' };
    }

    const archivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.propertyManagerInviteCode.updateMany({
        where: {
          propertyId,
          revokedAt: null,
        },
        data: {
          revokedAt: archivedAt,
        },
      });

      await tx.managerAssignmentRequest.updateMany({
        where: {
          propertyId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewedAt: archivedAt,
          reviewedById: parseBigInt(session.userId),
          rejectionNote: 'Tự động đóng do tài sản đã được lưu trữ.',
        },
      });

      await tx.propertyManagerAssignment.updateMany({
        where: {
          propertyId,
          status: 'ACTIVE',
        },
        data: {
          status: 'ENDED',
          endDate: archivedAt,
        },
      });

      await tx.unitInviteCode.updateMany({
        where: {
          unit: {
            propertyId,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: archivedAt,
        },
      });

      await tx.unitConnectionRequest.updateMany({
        where: {
          unit: {
            propertyId,
          },
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewedAt: archivedAt,
          reviewedById: parseBigInt(session.userId),
          rejectionNote: 'Tự động đóng do tài sản đã được lưu trữ.',
        },
      });

      await tx.unit.updateMany({
        where: {
          propertyId,
          occupancyStatus: {
            not: 'ARCHIVED',
          },
        },
        data: {
          occupancyStatus: 'ARCHIVED',
          vacantSince: archivedAt,
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: 'ARCHIVED',
        },
      });
    });

    return { success: true, message: 'Đã lưu trữ tài sản thành công' };
  } catch (error) {
    console.error('deleteProperty error:', error);
    return { success: false, message: 'Không thể xóa tài sản' };
  }
}
