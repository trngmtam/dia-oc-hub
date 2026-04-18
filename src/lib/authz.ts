import 'server-only';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { Role, SessionPayload } from '@/features/auth/auth.types';

export type AppSession = SessionPayload;

export function parseId(value: string | bigint) {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

export async function requireRole(roles: Role[]): Promise<AppSession> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }

  return session;
}

export function isAdmin(session: AppSession) {
  return session.role === 'ADMIN';
}

export function isOwner(session: AppSession) {
  return session.role === 'OWNER';
}

export function isManager(session: AppSession) {
  return session.role === 'MANAGER';
}

export function isTenant(session: AppSession) {
  return session.role === 'TENANT';
}

export function propertyScopeWhere(session: AppSession) {
  if (isAdmin(session)) {
    return {};
  }

  if (isOwner(session)) {
    return { ownerId: parseId(session.userId) };
  }

  if (isManager(session)) {
    return {
      assignments: {
        some: {
          managerId: parseId(session.userId),
          status: 'ACTIVE',
        },
      },
    };
  }

  return { id: BigInt(-1) };
}

export async function canAccessProperty(session: AppSession, propertyId: bigint) {
  if (isAdmin(session)) {
    return true;
  }

  if (isOwner(session)) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId: parseId(session.userId) },
      select: { id: true },
    });
    return Boolean(property);
  }

  if (isManager(session)) {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        assignments: {
          some: {
            managerId: parseId(session.userId),
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

export async function assertPropertyAccess(session: AppSession, propertyId: bigint) {
  const allowed = await canAccessProperty(session, propertyId);
  if (!allowed) {
    throw new Error('FORBIDDEN');
  }
}

export async function assertPropertyOwner(session: AppSession, propertyId: bigint) {
  if (!isOwner(session) && !isAdmin(session)) {
    throw new Error('FORBIDDEN');
  }

  if (isAdmin(session)) {
    return;
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: parseId(session.userId) },
    select: { id: true },
  });

  if (!property) {
    throw new Error('FORBIDDEN');
  }
}

export async function getAssignedPropertyCount(session: AppSession) {
  if (!isManager(session)) {
    return 0;
  }

  return prisma.propertyManagerAssignment.count({
    where: {
      managerId: parseId(session.userId),
      status: 'ACTIVE',
    },
  });
}

export function normalizeActionError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') {
      return { message: 'Phiên đăng nhập không hợp lệ' };
    }

    if (error.message === 'FORBIDDEN') {
      return { message: 'Bạn không có quyền thực hiện thao tác này' };
    }
  }

  console.error(fallbackMessage, error);
  return { message: fallbackMessage };
}
