'use server';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { expirePastActiveLeases } from '@/lib/lease-expiration';
import {
  assertPropertyAccess,
  assertPropertyOwner,
  isTenant,
  normalizeActionError,
  parseId,
  requireRole,
  requireSession,
} from '@/lib/authz';
import { generateInviteCode, getInviteExpiryDate, hashInviteCode } from '@/lib/invite-codes';
import {
  approveUnitConnectionAndCreateLeaseSchema,
  executeLeaseTerminationSchema,
  getConnectionRequestSchema,
  rejectConnectionRequestSchema,
  requestEarlyTerminationSchema,
  requestUnitConnectionSchema,
  unitInviteSchema,
  type ApproveUnitConnectionAndCreateLeaseInput,
  type ExecuteLeaseTerminationInput,
  type GetConnectionRequestInput,
  type RejectConnectionRequestInput,
  type RequestEarlyTerminationInput,
  type RequestUnitConnectionInput,
  type UnitInviteInput,
} from './leases.validation';

type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

type InviteCodeData = {
  inviteCode: string;
  expiresAt: string;
};

type TenantConnectionState = {
  activeLeases: {
    leaseId: string;
    propertyName: string;
    propertyId: string;
    unitCode: string;
    endDate?: string;
  }[];
  pendingRequests: {
    requestId: string;
    propertyName: string;
    propertyId: string;
    unitCode: string;
    requestedAt: string;
  }[];
};

type TenantContractData = {
  leaseId: string;
  propertyName: string;
  propertyId: string;
  unitCode: string;
  startDate: string;
  endDate: string;
  dueDayOfMonth: number;
  baseRent: string;
  depositAmount: string;
  managementFee: string;
  utilityNote: string | null;
  status: string;
  terminationRequestedAt: string | null;
  terminationRequestedNote: string | null;
  terminatedAt: string | null;
};

type UnitConnectionRequestRow = {
  requestId: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitCode: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  requestedAt: string;
  defaultMonthlyRent: string | null;
  defaultDeposit: string | null;
};

type UnitConnectionRequestDetail = UnitConnectionRequestRow & {
  inviteId: string;
};

type LeaseTerminationRequestRow = {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  unitCode: string;
  tenantName: string;
  requestedAt: string;
  note: string | null;
};

function toDateString(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_DATE');
  }

  return parsed;
}

async function getUnitWithProperty(unitId: bigint) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      propertyId: true,
      unitCode: true,
      defaultMonthlyRent: true,
      defaultDeposit: true,
      property: {
        select: {
          id: true,
          propertyName: true,
        },
      },
    },
  });
}

async function lockUnitConnectionApprovalResources(
  tx: Prisma.TransactionClient,
  requestId: bigint,
  unitId: bigint,
  tenantId: bigint,
) {
  await tx.$queryRaw`SELECT unit_connection_request_id FROM unit_connection_requests WHERE unit_connection_request_id = ${requestId} FOR UPDATE`;
  await tx.$queryRaw`SELECT unit_id FROM units WHERE unit_id = ${unitId} FOR UPDATE`;
  await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${tenantId} FOR UPDATE`;
}

export async function generateUnitInviteCode(
  payload: UnitInviteInput
): Promise<ActionResponse<InviteCodeData>> {
  const parsed = unitInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const unitId = parseId(parsed.data.unitId);
    const unit = await getUnitWithProperty(unitId);

    if (!unit) {
      return { success: false, message: 'Không tìm thấy căn hộ' };
    }

    await assertPropertyOwner(session, unit.propertyId);

    const inviteCode = generateInviteCode(`UNIT${unit.unitCode.toUpperCase()}`);
    const expiresAt = getInviteExpiryDate();

    await prisma.$transaction([
      prisma.unitInviteCode.updateMany({
        where: {
          unitId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      prisma.unitInviteCode.create({
        data: {
          unitId,
          codeHash: hashInviteCode(inviteCode),
          expiresAt,
          createdById: parseId(session.userId),
        },
      }),
    ]);

    return {
      success: true,
      data: {
        inviteCode,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tạo mã mời căn hộ') };
  }
}

export async function revokeUnitInviteCode(payload: UnitInviteInput): Promise<ActionResponse> {
  const parsed = unitInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const unitId = parseId(parsed.data.unitId);
    const unit = await getUnitWithProperty(unitId);

    if (!unit) {
      return { success: false, message: 'Không tìm thấy căn hộ' };
    }

    await assertPropertyOwner(session, unit.propertyId);

    await prisma.unitInviteCode.updateMany({
      where: {
        unitId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true, message: 'Đã thu hồi mã mời kết nối căn hộ' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể thu hồi mã mời căn hộ') };
  }
}

export async function requestUnitConnection(
  payload: RequestUnitConnectionInput
): Promise<ActionResponse> {
  const parsed = requestUnitConnectionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['TENANT']);
    const tenantId = parseId(session.userId);
    await expirePastActiveLeases({ tenantId });
    const invite = await prisma.unitInviteCode.findFirst({
      where: {
        codeHash: hashInviteCode(parsed.data.inviteCode),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      return { success: false, message: 'Mã mời không hợp lệ hoặc đã hết hạn' };
    }

    await expirePastActiveLeases({
      OR: [
        { tenantId },
        { unitId: invite.unitId },
      ],
    });

    const [activeUnitLease, existingPending] = await Promise.all([
      prisma.lease.findFirst({
        where: {
          unitId: invite.unitId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
      prisma.unitConnectionRequest.findFirst({
        where: {
          unitId: invite.unitId,
          tenantId,
          status: 'PENDING',
        },
        select: { id: true },
      }),
    ]);

    if (activeUnitLease) {
      return { success: false, message: 'Căn hộ này đã có hợp đồng thuê đang hiệu lực' };
    }

    if (existingPending) {
      return { success: false, message: 'Bạn đã có một yêu cầu kết nối đang chờ duyệt cho căn hộ này' };
    }

    await prisma.unitConnectionRequest.create({
      data: {
        unitId: invite.unitId,
        tenantId,
        inviteId: invite.id,
        status: 'PENDING',
      },
    });

    return { success: true, message: 'Đã gửi yêu cầu kết nối' };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return { success: false, message: 'Đã có yêu cầu kết nối đang chờ duyệt cho căn hộ này' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể gửi yêu cầu kết nối') };
  }
}

export async function getTenantConnectionState(): Promise<ActionResponse<TenantConnectionState>> {
  try {
    const session = await requireRole(['TENANT']);
    const tenantId = parseId(session.userId);
    await expirePastActiveLeases({ tenantId });

    const activeLeases = await prisma.lease.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingRequests = await prisma.unitConnectionRequest.findMany({
      where: {
        tenantId,
        status: 'PENDING',
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return {
      success: true,
      data: {
        activeLeases: activeLeases.map((lease) => ({
          leaseId: lease.id.toString(),
          propertyId: lease.unit.property.id.toString(),
          propertyName: lease.unit.property.propertyName,
          unitCode: lease.unit.unitCode,
          endDate: toDateString(lease.endDate) || undefined,
        })),
        pendingRequests: pendingRequests.map((request) => ({
          requestId: request.id.toString(),
          propertyId: request.unit.property.id.toString(),
          propertyName: request.unit.property.propertyName,
          unitCode: request.unit.unitCode,
          requestedAt: request.requestedAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải trạng thái kết nối của người thuê') };
  }
}

export async function listUnitConnectionRequests(): Promise<ActionResponse<UnitConnectionRequestRow[]>> {
  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }

    const requests = await prisma.unitConnectionRequest.findMany({
      where: {
        status: 'PENDING',
        unit: {
          property: session.role === 'OWNER'
            ? { ownerId: parseId(session.userId) }
            : session.role === 'MANAGER'
              ? {
                  assignments: {
                    some: {
                      managerId: parseId(session.userId),
                      status: 'ACTIVE',
                    },
                  },
                }
              : undefined,
        },
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
        tenant: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return {
      success: true,
      data: requests.map((request) => ({
        requestId: request.id.toString(),
        propertyId: request.unit.property.id.toString(),
        propertyName: request.unit.property.propertyName,
        unitId: request.unit.id.toString(),
        unitCode: request.unit.unitCode,
        tenantName: request.tenant.fullName,
        tenantEmail: request.tenant.email,
        tenantPhone: request.tenant.phone,
        requestedAt: request.requestedAt.toISOString(),
        defaultMonthlyRent: request.unit.defaultMonthlyRent?.toString() ?? null,
        defaultDeposit: request.unit.defaultDeposit?.toString() ?? null,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải danh sách yêu cầu kết nối căn hộ') };
  }
}

export async function getUnitConnectionRequestById(
  payload: GetConnectionRequestInput
): Promise<ActionResponse<UnitConnectionRequestDetail>> {
  const parsed = getConnectionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }

    const request = await prisma.unitConnectionRequest.findUnique({
      where: { id: parseId(parsed.data.requestId) },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
        tenant: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Không tìm thấy yêu cầu kết nối' };
    }

    await assertPropertyAccess(session, request.unit.property.id);

    return {
      success: true,
      data: {
        requestId: request.id.toString(),
        propertyId: request.unit.property.id.toString(),
        propertyName: request.unit.property.propertyName,
        unitId: request.unit.id.toString(),
        unitCode: request.unit.unitCode,
        tenantName: request.tenant.fullName,
        tenantEmail: request.tenant.email,
        tenantPhone: request.tenant.phone,
        requestedAt: request.requestedAt.toISOString(),
        defaultMonthlyRent: request.unit.defaultMonthlyRent?.toString() ?? null,
        defaultDeposit: request.unit.defaultDeposit?.toString() ?? null,
        inviteId: request.inviteId.toString(),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải chi tiết yêu cầu kết nối') };
  }
}

export async function approveUnitConnectionAndCreateLease(
  payload: ApproveUnitConnectionAndCreateLeaseInput
): Promise<ActionResponse<{ leaseId: string }>> {
  const parsed = approveUnitConnectionAndCreateLeaseSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }

    const request = await prisma.unitConnectionRequest.findUnique({
      where: { id: parseId(parsed.data.requestId) },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Yêu cầu kết nối không còn hiệu lực' };
    }

    await assertPropertyAccess(session, request.unit.property.id);
    await expirePastActiveLeases({
      OR: [
        { unitId: request.unitId },
        { tenantId: request.tenantId },
      ],
    });

    const startDate = parseDateInput(parsed.data.startDate);
    const endDate = parseDateInput(parsed.data.endDate);

    const result = await prisma.$transaction(async (tx) => {
      await lockUnitConnectionApprovalResources(tx, request.id, request.unitId, request.tenantId);

      const freshRequest = await tx.unitConnectionRequest.findUnique({
        where: { id: request.id },
        select: {
          id: true,
          status: true,
          unitId: true,
          tenantId: true,
        },
      });

      if (!freshRequest || freshRequest.status !== 'PENDING') {
        throw new Error('REQUEST_NOT_PENDING');
      }

      const activeUnitLease = await tx.lease.findFirst({
        where: {
          unitId: freshRequest.unitId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (activeUnitLease) {
        throw new Error('UNIT_ALREADY_LEASED');
      }

      const lease = await tx.lease.create({
        data: {
          unitId: freshRequest.unitId,
          tenantId: freshRequest.tenantId,
          startDate,
          endDate,
          dueDayOfMonth: parsed.data.dueDayOfMonth,
          baseRent: parsed.data.baseRent,
          depositAmount: parsed.data.depositAmount,
          managementFee: parsed.data.managementFee,
          utilityNote: parsed.data.utilityNote || null,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      await tx.unit.update({
        where: { id: freshRequest.unitId },
        data: {
          occupancyStatus: 'OCCUPIED',
          vacantSince: null,
        },
      });

      await tx.unitConnectionRequest.update({
        where: { id: freshRequest.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: parseId(session.userId),
          rejectionNote: null,
        },
      });

      const reviewTime = new Date();

      await tx.unitConnectionRequest.updateMany({
        where: {
          status: 'PENDING',
          unitId: freshRequest.unitId,
          NOT: {
            id: freshRequest.id,
          },
        },
        data: {
          status: 'REJECTED',
          reviewedAt: reviewTime,
          reviewedById: parseId(session.userId),
          rejectionNote: 'Tự động đóng vì một hợp đồng thuê khác đã được duyệt cho căn hộ này.',
        },
      });

      await tx.unitInviteCode.updateMany({
        where: {
          unitId: freshRequest.unitId,
          revokedAt: null,
        },
        data: {
          revokedAt: reviewTime,
        },
      });

      return lease;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      message: 'Đã tạo hợp đồng thuê thành công',
      data: { leaseId: result.id.toString() },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNIT_ALREADY_LEASED') {
      return { success: false, message: 'Căn hộ này đã có hợp đồng thuê đang hiệu lực' };
    }

    if (error instanceof Error && error.message === 'REQUEST_NOT_PENDING') {
      return { success: false, message: 'Yêu cầu kết nối không còn hiệu lực' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể duyệt yêu cầu và tạo hợp đồng thuê') };
  }
}

export async function rejectUnitConnectionRequest(
  payload: RejectConnectionRequestInput
): Promise<ActionResponse> {
  const parsed = rejectConnectionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }

    const request = await prisma.unitConnectionRequest.findUnique({
      where: { id: parseId(parsed.data.requestId) },
      include: {
        unit: {
          include: {
            property: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Yêu cầu kết nối không còn hiệu lực' };
    }

    await assertPropertyAccess(session, request.unit.property.id);

    await prisma.unitConnectionRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: parseId(session.userId),
        rejectionNote: parsed.data.rejectionNote || null,
      },
    });

    return { success: true, message: 'Đã từ chối yêu cầu kết nối' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể từ chối yêu cầu kết nối') };
  }
}

export async function getTenantContracts(): Promise<ActionResponse<TenantContractData[]>> {
  try {
    const session = await requireRole(['TENANT']);
    const tenantId = parseId(session.userId);
    await expirePastActiveLeases({ tenantId });

    const leases = await prisma.lease.findMany({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'TERMINATED', 'EXPIRED'],
        },
      },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      success: true,
      data: leases.map((lease) => ({
        leaseId: lease.id.toString(),
        propertyName: lease.unit.property.propertyName,
        propertyId: lease.unit.property.id.toString(),
        unitCode: lease.unit.unitCode,
        startDate: toDateString(lease.startDate) || '',
        endDate: toDateString(lease.endDate) || '',
        dueDayOfMonth: lease.dueDayOfMonth,
        baseRent: lease.baseRent.toString(),
        depositAmount: lease.depositAmount.toString(),
        managementFee: lease.managementFee.toString(),
        utilityNote: lease.utilityNote,
        status: lease.status,
        terminationRequestedAt: lease.terminationRequestedAt?.toISOString() ?? null,
        terminationRequestedNote: lease.terminationRequestedNote,
        terminatedAt: lease.terminatedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải hợp đồng của người thuê') };
  }
}

export async function getTenantContract(): Promise<ActionResponse<TenantContractData>> {
  const response = await getTenantContracts();
  if (!response.success) {
    return { success: false, message: response.message, errors: response.errors };
  }

  const contract = response.data?.[0];
  if (!contract) {
    return { success: false, message: 'Không tìm thấy hợp đồng thuê của người thuê này' };
  }

  return { success: true, data: contract };
}

export async function requestEarlyTermination(
  payload: RequestEarlyTerminationInput
): Promise<ActionResponse> {
  const parsed = requestEarlyTerminationSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['TENANT']);
    const leaseId = parseId(parsed.data.leaseId);
    const tenantId = parseId(session.userId);
    await expirePastActiveLeases({ tenantId });

    const lease = await prisma.lease.findFirst({
      where: {
        id: leaseId,
        tenantId,
        status: 'ACTIVE',
      },
      select: { id: true, terminationRequestedAt: true },
    });

    if (!lease) {
      return { success: false, message: 'Không tìm thấy hợp đồng thuê đang hiệu lực' };
    }

    if (lease.terminationRequestedAt) {
      return { success: false, message: 'Đã có yêu cầu chấm dứt hợp đồng được gửi trước đó' };
    }

    await prisma.lease.update({
      where: { id: leaseId },
      data: {
        terminationRequestedAt: new Date(),
        terminationRequestedNote: parsed.data.note || null,
      },
    });

    return { success: true, message: 'Đã gửi yêu cầu chấm dứt hợp đồng' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể gửi yêu cầu chấm dứt hợp đồng sớm') };
  }
}

export async function listLeaseTerminationRequests(): Promise<
  ActionResponse<LeaseTerminationRequestRow[]>
> {
  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }
    await expirePastActiveLeases();

    const leases = await prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        terminationRequestedAt: { not: null },
        unit: {
          property: session.role === 'OWNER'
            ? { ownerId: parseId(session.userId) }
            : session.role === 'MANAGER'
              ? {
                  assignments: {
                    some: {
                      managerId: parseId(session.userId),
                      status: 'ACTIVE',
                    },
                  },
                }
              : undefined,
        },
      },
      include: {
        tenant: {
          select: {
            fullName: true,
          },
        },
        unit: {
          include: {
            property: {
              select: {
                id: true,
                propertyName: true,
              },
            },
          },
        },
      },
      orderBy: { terminationRequestedAt: 'desc' },
    });

    return {
      success: true,
      data: leases.map((lease) => ({
        leaseId: lease.id.toString(),
        propertyId: lease.unit.property.id.toString(),
        propertyName: lease.unit.property.propertyName,
        unitCode: lease.unit.unitCode,
        tenantName: lease.tenant.fullName,
        requestedAt: lease.terminationRequestedAt?.toISOString() || '',
        note: lease.terminationRequestedNote,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải danh sách yêu cầu chấm dứt hợp đồng') };
  }
}

export async function executeLeaseTermination(
  payload: ExecuteLeaseTerminationInput
): Promise<ActionResponse> {
  const parsed = executeLeaseTerminationSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) {
      throw new Error('FORBIDDEN');
    }

    const lease = await prisma.lease.findUnique({
      where: { id: parseId(parsed.data.leaseId) },
      include: {
        unit: {
          include: {
            property: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!lease || lease.status !== 'ACTIVE') {
      return { success: false, message: 'Không tìm thấy hợp đồng thuê đang hiệu lực' };
    }

    await assertPropertyAccess(session, lease.unit.property.id);

    await prisma.$transaction([
      prisma.lease.update({
        where: { id: lease.id },
        data: {
          status: 'TERMINATED',
          terminatedAt: new Date(),
          terminationRequestedAt: null,
          terminationRequestedNote: null,
        },
      }),
      prisma.unit.update({
        where: { id: lease.unitId },
        data: {
          occupancyStatus: 'VACANT',
          vacantSince: new Date(),
        },
      }),
    ]);

    return { success: true, message: 'Đã kết thúc hợp đồng thuê thành công' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể kết thúc hợp đồng thuê') };
  }
}
