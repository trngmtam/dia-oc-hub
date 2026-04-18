'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  createUnitSchema,
  deleteUnitSchema,
  getUnitByIdSchema,
  getUnitsByPropertyIdSchema,
  updateUnitSchema,
  type CreateUnitInput,
  type DeleteUnitInput,
  type GetUnitByIdInput,
  type GetUnitsByPropertyIdInput,
  type UpdateUnitInput,
} from './units.validation';

export type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

type UnitListItem = {
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

type UnitDetailItem = UnitListItem;

function toNullableString(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value;
}

function parseBigInt(id: string): bigint {
  return BigInt(id);
}

async function getSessionOrError(): Promise<
  NonNullable<Awaited<ReturnType<typeof getSession>>> | null
> {
  const session = await getSession();
  if (!session) return null;
  return session;
}

async function canAccessProperty(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  propertyId: bigint
): Promise<boolean> {
  if (session.role === 'ADMIN') return true;

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

export async function getUnitsByPropertyId(
  payload: GetUnitsByPropertyIdInput
): Promise<ActionResponse<UnitListItem[]>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = getUnitsByPropertyIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const units = await prisma.unit.findMany({
      where: {
        propertyId,
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
        floorNumber: true,
        bedroomCount: true,
        bathroomCount: true,
        areaSqm: true,
        furnishingStatus: true,
        defaultMonthlyRent: true,
        defaultDeposit: true,
        occupancyStatus: true,
      },
    });

    return {
      success: true,
      data: units.map((unit) => ({
        id: unit.id.toString(),
        propertyId: unit.propertyId.toString(),
        unitCode: unit.unitCode,
        unitName: unit.unitName,
        floorNumber: unit.floorNumber,
        bedroomCount: unit.bedroomCount,
        bathroomCount: unit.bathroomCount,
        areaSqm: unit.areaSqm?.toString() ?? null,
        furnishingStatus: unit.furnishingStatus,
        defaultMonthlyRent: unit.defaultMonthlyRent?.toString() ?? null,
        defaultDeposit: unit.defaultDeposit?.toString() ?? null,
        occupancyStatus: unit.occupancyStatus,
      })),
    };
  } catch (error) {
    console.error('getUnitsByPropertyId error:', error);
    return { success: false, message: 'Không thể tải danh sách căn hộ' };
  }
}

export async function getUnitById(
  payload: GetUnitByIdInput
): Promise<ActionResponse<UnitDetailItem>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = getUnitByIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);
    const unitId = parseBigInt(parsed.data.unitId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const unit = await prisma.unit.findFirst({
      where: { id: unitId, propertyId },
      select: {
        id: true,
        propertyId: true,
        unitCode: true,
        unitName: true,
        floorNumber: true,
        bedroomCount: true,
        bathroomCount: true,
        areaSqm: true,
        furnishingStatus: true,
        defaultMonthlyRent: true,
        defaultDeposit: true,
        occupancyStatus: true,
      },
    });

    if (!unit) {
      return { success: false, message: 'Không tìm thấy căn hộ' };
    }

    return {
      success: true,
      data: {
        id: unit.id.toString(),
        propertyId: unit.propertyId.toString(),
        unitCode: unit.unitCode,
        unitName: unit.unitName,
        floorNumber: unit.floorNumber,
        bedroomCount: unit.bedroomCount,
        bathroomCount: unit.bathroomCount,
        areaSqm: unit.areaSqm?.toString() ?? null,
        furnishingStatus: unit.furnishingStatus,
        defaultMonthlyRent: unit.defaultMonthlyRent?.toString() ?? null,
        defaultDeposit: unit.defaultDeposit?.toString() ?? null,
        occupancyStatus: unit.occupancyStatus,
      },
    };
  } catch (error) {
    console.error('getUnitById error:', error);
    return { success: false, message: 'Không thể tải thông tin căn hộ' };
  }
}

export async function createUnit(
  payload: CreateUnitInput
): Promise<ActionResponse<{ unitId: string }>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = createUnitSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const propertyId = parseBigInt(parsed.data.propertyId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const propertyExists = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!propertyExists) {
      return { success: false, message: 'Không tìm thấy tài sản' };
    }

    const duplicate = await prisma.unit.findFirst({
      where: {
        propertyId,
        unitCode: parsed.data.unitCode,
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        errors: { unitCode: ['Mã căn hộ đã tồn tại trong tài sản này'] },
      };
    }

    const created = await prisma.unit.create({
      data: {
        propertyId,
        unitCode: parsed.data.unitCode,
        unitName: toNullableString(parsed.data.unitName),
        floorNumber: toNullableNumber(parsed.data.floorNumber),
        bedroomCount: toNullableNumber(parsed.data.bedroomCount),
        bathroomCount: toNullableNumber(parsed.data.bathroomCount),
        areaSqm: toNullableNumber(parsed.data.areaSqm),
        furnishingStatus: toNullableString(parsed.data.furnishingStatus),
        defaultMonthlyRent: toNullableNumber(parsed.data.defaultMonthlyRent),
        defaultDeposit: toNullableNumber(parsed.data.defaultDeposit),
        occupancyStatus: 'VACANT',
      },
      select: { id: true },
    });

    await prisma.property.update({
      where: { id: propertyId },
      data: { totalUnits: { increment: 1 } },
    });

    return {
      success: true,
      message: 'Đã tạo căn hộ thành công',
      data: { unitId: created.id.toString() },
    };
  } catch (error) {
    console.error('createUnit error:', error);
    return { success: false, message: 'Không thể tạo căn hộ' };
  }
}

export async function updateUnit(
  payload: UpdateUnitInput
): Promise<ActionResponse<{ unitId: string }>> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = updateUnitSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const unitId = parseBigInt(parsed.data.unitId);
    const propertyId = parseBigInt(parsed.data.propertyId);

    const hasAccess = await canAccessProperty(session, propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập tài sản này' };
    }

    const existingUnit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, propertyId: true },
    });

    if (!existingUnit) {
      return { success: false, message: 'Không tìm thấy căn hộ' };
    }

    if (existingUnit.propertyId !== propertyId) {
      return { success: false, message: 'Quan hệ tài sản/căn hộ không hợp lệ' };
    }

    const duplicate = await prisma.unit.findFirst({
      where: {
        propertyId,
        unitCode: parsed.data.unitCode,
        NOT: { id: unitId },
      },
      select: { id: true },
    });

    if (duplicate) {
      return {
        success: false,
        errors: { unitCode: ['Mã căn hộ đã tồn tại trong tài sản này'] },
      };
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: {
        unitCode: parsed.data.unitCode,
        unitName: toNullableString(parsed.data.unitName),
        floorNumber: toNullableNumber(parsed.data.floorNumber),
        bedroomCount: toNullableNumber(parsed.data.bedroomCount),
        bathroomCount: toNullableNumber(parsed.data.bathroomCount),
        areaSqm: toNullableNumber(parsed.data.areaSqm),
        furnishingStatus: toNullableString(parsed.data.furnishingStatus),
        defaultMonthlyRent: toNullableNumber(parsed.data.defaultMonthlyRent),
        defaultDeposit: toNullableNumber(parsed.data.defaultDeposit),
      },
      select: { id: true },
    });

    return {
      success: true,
      message: 'Đã cập nhật căn hộ thành công',
      data: { unitId: updated.id.toString() },
    };
  } catch (error) {
    console.error('updateUnit error:', error);
    return { success: false, message: 'Không thể cập nhật căn hộ' };
  }
}

export async function deleteUnit(payload: DeleteUnitInput): Promise<ActionResponse> {
  const session = await getSessionOrError();
  if (!session) return { success: false, message: 'Phiên đăng nhập không hợp lệ' };

  const parsed = deleteUnitSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const unitId = parseBigInt(parsed.data.unitId);

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, propertyId: true },
    });

    if (!unit) {
      return { success: false, message: 'Không tìm thấy căn hộ' };
    }

    const hasAccess = await canAccessProperty(session, unit.propertyId);
    if (!hasAccess) {
      return { success: false, message: 'Bạn không có quyền truy cập căn hộ này' };
    }

    const [activeLeaseCount, leaseCount, expenseCount, alertCount] = await Promise.all([
      prisma.lease.count({
        where: {
          unitId,
          status: 'ACTIVE',
        },
      }),
      prisma.lease.count({
        where: {
          unitId,
        },
      }),
      prisma.expense.count({
        where: {
          unitId,
        },
      }),
      prisma.alert.count({
        where: {
          unitId,
        },
      }),
    ]);

    if (activeLeaseCount > 0) {
      return {
        success: false,
        message: 'Vui lòng kết thúc hợp đồng thuê đang hiệu lực trước khi xóa căn hộ này',
      };
    }

    if (leaseCount > 0 || expenseCount > 0 || alertCount > 0) {
      const archivedAt = new Date();

      await prisma.$transaction([
        prisma.unitInviteCode.updateMany({
          where: {
            unitId,
            revokedAt: null,
          },
          data: {
            revokedAt: archivedAt,
          },
        }),
        prisma.unitConnectionRequest.updateMany({
          where: {
            unitId,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            reviewedAt: archivedAt,
            reviewedById: parseBigInt(session.userId),
            rejectionNote: 'Tự động đóng vì căn hộ đã được lưu trữ.',
          },
        }),
        prisma.unit.update({
          where: { id: unitId },
          data: {
            occupancyStatus: 'ARCHIVED',
            vacantSince: archivedAt,
          },
        }),
        prisma.property.update({
          where: { id: unit.propertyId },
          data: { totalUnits: { decrement: 1 } },
        }),
      ]);

      return {
        success: true,
        message: 'Đã lưu trữ căn hộ thành công',
      };
    }

    await prisma.$transaction([
      prisma.unitConnectionRequest.deleteMany({
        where: { unitId },
      }),
      prisma.unitInviteCode.deleteMany({
        where: { unitId },
      }),
      prisma.unit.delete({ where: { id: unitId } }),
      prisma.property.update({
        where: { id: unit.propertyId },
        data: { totalUnits: { decrement: 1 } },
      }),
    ]);

    return { success: true, message: 'Đã xóa căn hộ thành công' };
  } catch (error) {
    console.error('deleteUnit error:', error);
    return { success: false, message: 'Không thể xóa căn hộ' };
  }
}
