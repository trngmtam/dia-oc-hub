'use server';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  assertPropertyOwner,
  getAssignedPropertyCount,
  normalizeActionError,
  parseId,
  requireRole,
} from '@/lib/authz';
import { generateInviteCode, getInviteExpiryDate, hashInviteCode } from '@/lib/invite-codes';
import {
  managerAssignmentRequestDecisionSchema,
  managerLeavePropertySchema,
  ownerEndManagerAssignmentSchema,
  propertyInviteSchema,
  requestPropertyManagerAssignmentSchema,
  type ManagerAssignmentRequestDecisionInput,
  type ManagerLeavePropertyInput,
  type OwnerEndManagerAssignmentInput,
  type PropertyInviteInput,
  type RequestPropertyManagerAssignmentInput,
} from './managerAssignments.validation';

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

type ManagerAssignmentState = {
  assignedPropertyCount: number;
  assignedProperties: {
    propertyId: string;
    propertyName: string;
  }[];
  pendingRequests: {
    requestId: string;
    propertyId: string;
    propertyName: string;
    requestedAt: string;
  }[];
};

type ManagerAssignmentRequestRow = {
  requestId: string;
  propertyId: string;
  propertyName: string;
  managerName: string;
  managerEmail: string | null;
  managerPhone: string | null;
  requestedAt: string;
};

async function lockManagerAssignmentApprovalResources(
  tx: Prisma.TransactionClient,
  requestId: bigint,
  propertyId: bigint,
) {
  await tx.$queryRaw`SELECT manager_assignment_request_id FROM manager_assignment_requests WHERE manager_assignment_request_id = ${requestId} FOR UPDATE`;
  await tx.$queryRaw`SELECT property_id FROM properties WHERE property_id = ${propertyId} FOR UPDATE`;
}

export async function generatePropertyManagerInviteCode(
  payload: PropertyInviteInput
): Promise<ActionResponse<InviteCodeData>> {
  const parsed = propertyInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const propertyId = parseId(parsed.data.propertyId);
    await assertPropertyOwner(session, propertyId);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { propertyCode: true },
    });

    if (!property) {
      return { success: false, message: 'Không tìm thấy tài sản' };
    }

    const activeAssignment = await prisma.propertyManagerAssignment.findFirst({
      where: {
        propertyId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (activeAssignment) {
      return { success: false, message: 'Tài sản này đã có quản lý đang hoạt động' };
    }

    const inviteCode = generateInviteCode(`MGR${property.propertyCode.toUpperCase()}`);
    const expiresAt = getInviteExpiryDate();

    await prisma.$transaction([
      prisma.propertyManagerInviteCode.updateMany({
        where: {
          propertyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      prisma.propertyManagerInviteCode.create({
        data: {
          propertyId,
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
    return { success: false, ...normalizeActionError(error, 'Không thể tạo mã mời quản lý') };
  }
}

export async function revokePropertyManagerInviteCode(
  payload: PropertyInviteInput
): Promise<ActionResponse> {
  const parsed = propertyInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const propertyId = parseId(parsed.data.propertyId);
    await assertPropertyOwner(session, propertyId);

    await prisma.propertyManagerInviteCode.updateMany({
      where: {
        propertyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true, message: 'Đã thu hồi mã mời quản lý' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể thu hồi mã mời quản lý') };
  }
}

export async function requestPropertyManagerAssignment(
  payload: RequestPropertyManagerAssignmentInput
): Promise<ActionResponse> {
  const parsed = requestPropertyManagerAssignmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['MANAGER']);
    const managerId = parseId(session.userId);
    const invite = await prisma.propertyManagerInviteCode.findFirst({
      where: {
        codeHash: hashInviteCode(parsed.data.inviteCode),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        property: {
          select: {
            id: true,
            propertyName: true,
          },
        },
      },
    });

    if (!invite) {
      return { success: false, message: 'Mã mời không hợp lệ hoặc đã hết hạn' };
    }

    const [activePropertyAssignment, activeAssignment, pendingRequest] = await Promise.all([
      prisma.propertyManagerAssignment.findFirst({
        where: {
          propertyId: invite.propertyId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
      prisma.propertyManagerAssignment.findFirst({
        where: {
          propertyId: invite.propertyId,
          managerId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
      prisma.managerAssignmentRequest.findFirst({
        where: {
          propertyId: invite.propertyId,
          managerId,
          status: 'PENDING',
        },
        select: { id: true },
      }),
    ]);

    if (activePropertyAssignment) {
      return { success: false, message: 'Tài sản này đã có quản lý đang hoạt động' };
    }

    if (activeAssignment) {
      return { success: false, message: 'Bạn đã được phân công cho tài sản này' };
    }

    if (pendingRequest) {
      return { success: false, message: 'Bạn đã có một yêu cầu đang chờ duyệt cho tài sản này' };
    }

    await prisma.managerAssignmentRequest.create({
      data: {
        propertyId: invite.propertyId,
        managerId,
        inviteId: invite.id,
        status: 'PENDING',
      },
    });

    return { success: true, message: 'Đã gửi yêu cầu nhận quản lý' };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return { success: false, message: 'Đã tồn tại yêu cầu phân công quản lý đang chờ duyệt' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể gửi yêu cầu phân công quản lý') };
  }
}

export async function getManagerAssignmentState(): Promise<
  ActionResponse<ManagerAssignmentState>
> {
  try {
    const session = await requireRole(['MANAGER']);
    const [assignedPropertyCount, assignedProperties, pendingRequests] = await Promise.all([
      getAssignedPropertyCount(session),
      prisma.propertyManagerAssignment.findMany({
        where: {
          managerId: parseId(session.userId),
          status: 'ACTIVE',
        },
        orderBy: {
          startDate: 'asc',
        },
        select: {
          propertyId: true,
          property: {
            select: {
              propertyName: true,
            },
          },
        },
      }),
      prisma.managerAssignmentRequest.findMany({
        where: {
          managerId: parseId(session.userId),
          status: 'PENDING',
        },
        include: {
          property: {
            select: {
              id: true,
              propertyName: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        assignedPropertyCount,
        assignedProperties: assignedProperties.map((assignment) => ({
          propertyId: assignment.propertyId.toString(),
          propertyName: assignment.property.propertyName,
        })),
        pendingRequests: pendingRequests.map((request) => ({
          requestId: request.id.toString(),
          propertyId: request.property.id.toString(),
          propertyName: request.property.propertyName,
          requestedAt: request.requestedAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải trạng thái phân công quản lý') };
  }
}

export async function listManagerAssignmentRequests(): Promise<
  ActionResponse<ManagerAssignmentRequestRow[]>
> {
  try {
    const session = await requireRole(['OWNER', 'ADMIN']);

    const requests = await prisma.managerAssignmentRequest.findMany({
      where: {
        status: 'PENDING',
        property: session.role === 'OWNER'
          ? { ownerId: parseId(session.userId) }
          : undefined,
      },
      include: {
        property: {
          select: {
            id: true,
            propertyName: true,
          },
        },
        manager: {
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
        propertyId: request.property.id.toString(),
        propertyName: request.property.propertyName,
        managerName: request.manager.fullName,
        managerEmail: request.manager.email,
        managerPhone: request.manager.phone,
        requestedAt: request.requestedAt.toISOString(),
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải danh sách yêu cầu phân công quản lý') };
  }
}

export async function approveManagerAssignmentRequest(
  payload: ManagerAssignmentRequestDecisionInput
): Promise<ActionResponse> {
  const parsed = managerAssignmentRequestDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER']);
    const request = await prisma.managerAssignmentRequest.findUnique({
      where: { id: parseId(parsed.data.requestId) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Không tìm thấy yêu cầu phân công quản lý' };
    }

    if (request.property.ownerId !== parseId(session.userId)) {
      return { success: false, message: 'Bạn không có quyền thực hiện thao tác này' };
    }

    const today = new Date();

    await prisma.$transaction(async (tx) => {
      await lockManagerAssignmentApprovalResources(tx, request.id, request.propertyId);

      const freshRequest = await tx.managerAssignmentRequest.findUnique({
        where: { id: request.id },
        select: {
          id: true,
          status: true,
          propertyId: true,
          managerId: true,
        },
      });

      if (!freshRequest || freshRequest.status !== 'PENDING') {
        throw new Error('REQUEST_NOT_PENDING');
      }

      const existingPropertyAssignment = await tx.propertyManagerAssignment.findFirst({
        where: {
          propertyId: freshRequest.propertyId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (existingPropertyAssignment) {
        throw new Error('PROPERTY_ALREADY_ASSIGNED');
      }

      const existingAssignment = await tx.propertyManagerAssignment.findFirst({
        where: {
          propertyId: freshRequest.propertyId,
          managerId: freshRequest.managerId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (existingAssignment) {
        throw new Error('MANAGER_ALREADY_ASSIGNED');
      }

      await tx.propertyManagerAssignment.create({
        data: {
          propertyId: freshRequest.propertyId,
          managerId: freshRequest.managerId,
          startDate: today,
          salaryType: 'FIXED_MONTHLY',
          baseSalary: 0,
          commissionRate: 0,
          status: 'ACTIVE',
        },
      });

      const reviewTime = new Date();

      await tx.managerAssignmentRequest.update({
        where: { id: freshRequest.id },
        data: {
          status: 'APPROVED',
          reviewedAt: reviewTime,
          reviewedById: parseId(session.userId),
          rejectionNote: null,
        },
      });

      await tx.managerAssignmentRequest.updateMany({
        where: {
          propertyId: freshRequest.propertyId,
          status: 'PENDING',
          NOT: {
            id: freshRequest.id,
          },
        },
        data: {
          status: 'REJECTED',
          reviewedAt: reviewTime,
          reviewedById: parseId(session.userId),
          rejectionNote: 'Tự động đóng vì một quản lý khác đã được phân công.',
        },
      });

      await tx.propertyManagerInviteCode.updateMany({
        where: {
          propertyId: freshRequest.propertyId,
          revokedAt: null,
        },
        data: {
          revokedAt: reviewTime,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { success: true, message: 'Đã phân công quản lý thành công' };
  } catch (error) {
    if (error instanceof Error && error.message === 'PROPERTY_ALREADY_ASSIGNED') {
      return { success: false, message: 'Tài sản này đã có quản lý đang hoạt động' };
    }

    if (error instanceof Error && error.message === 'MANAGER_ALREADY_ASSIGNED') {
      return { success: false, message: 'Quản lý này đã được phân công cho tài sản này' };
    }

    if (error instanceof Error && error.message === 'REQUEST_NOT_PENDING') {
      return { success: false, message: 'Yêu cầu phân công quản lý không còn hiệu lực' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể duyệt yêu cầu phân công quản lý') };
  }
}

export async function rejectManagerAssignmentRequest(
  payload: ManagerAssignmentRequestDecisionInput
): Promise<ActionResponse> {
  const parsed = managerAssignmentRequestDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER']);
    const request = await prisma.managerAssignmentRequest.findUnique({
      where: { id: parseId(parsed.data.requestId) },
      include: {
        property: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!request || request.status !== 'PENDING') {
      return { success: false, message: 'Không tìm thấy yêu cầu phân công quản lý' };
    }

    if (request.property.ownerId !== parseId(session.userId)) {
      return { success: false, message: 'Bạn không có quyền thực hiện thao tác này' };
    }

    await prisma.managerAssignmentRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: parseId(session.userId),
        rejectionNote: parsed.data.rejectionNote || null,
      },
    });

    return { success: true, message: 'Đã từ chối yêu cầu phân công quản lý' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể từ chối yêu cầu phân công quản lý') };
  }
}

export async function endManagerAssignmentByOwner(
  payload: OwnerEndManagerAssignmentInput
): Promise<ActionResponse> {
  const parsed = ownerEndManagerAssignmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const assignmentId = parseId(parsed.data.assignmentId);

    const assignment = await prisma.propertyManagerAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        property: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!assignment || assignment.status !== 'ACTIVE') {
      return { success: false, message: 'Không tìm thấy phân công quản lý đang hiệu lực' };
    }

    if (session.role === 'OWNER' && assignment.property.ownerId !== parseId(session.userId)) {
      return { success: false, message: 'Bạn không có quyền thực hiện thao tác này' };
    }

    const endedAt = new Date();

    await prisma.propertyManagerAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ENDED',
        endDate: endedAt,
      },
    });

    return { success: true, message: 'Đã kết thúc phân công quản lý' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể kết thúc phân công quản lý') };
  }
}

export async function leaveManagedProperty(
  payload: ManagerLeavePropertyInput
): Promise<ActionResponse> {
  const parsed = managerLeavePropertySchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['MANAGER']);
    const propertyId = parseId(parsed.data.propertyId);
    const managerId = parseId(session.userId);

    const assignment = await prisma.propertyManagerAssignment.findFirst({
      where: {
        propertyId,
        managerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      return { success: false, message: 'Bạn không có phân công quản lý đang hiệu lực tại tài sản này' };
    }

    await prisma.propertyManagerAssignment.update({
      where: { id: assignment.id },
      data: {
        status: 'ENDED',
        endDate: new Date(),
      },
    });

    return { success: true, message: 'Bạn đã rời khỏi tài sản này' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể rời tài sản đang quản lý') };
  }
}




