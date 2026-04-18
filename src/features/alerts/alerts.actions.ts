'use server';

import prisma from '@/lib/prisma';
import {
  isAdmin,
  isManager,
  isOwner,
  isTenant,
  normalizeActionError,
  parseId,
  requireSession,
} from '@/lib/authz';
import { refreshOperationalAlerts } from './alerts.generator';
import {
  listAlertsSchema,
  markAlertReadSchema,
  type ListAlertsInput,
  type MarkAlertReadInput,
} from './alerts.validation';

type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

export type AlertListItem = {
  alertRecipientId: string;
  alertId: string;
  alertType: string;
  title: string;
  description: string | null;
  alertDate: string;
  severity: string;
  status: string;
  isRead: boolean;
  readAt: string | null;
  propertyName: string | null;
  unitCode: string | null;
  invoiceCode: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function listMyAlerts(
  payload: ListAlertsInput = { status: 'OPEN' }
): Promise<ActionResponse<AlertListItem[]>> {
  const parsed = listAlertsSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    await refreshOperationalAlerts(session);

    const where = {
      userId: parseId(session.userId),
      alert: parsed.data.status === 'ALL' ? {} : { status: parsed.data.status },
    };

    const rows = await prisma.alertRecipient.findMany({
      where,
      include: {
        alert: {
          include: {
            property: { select: { propertyName: true } },
            unit: { select: { unitCode: true } },
            invoice: { select: { invoiceCode: true } },
          },
        },
      },
      orderBy: [
        { isRead: 'asc' },
        { alert: { alertDate: 'desc' } },
        { alert: { createdAt: 'desc' } },
      ],
    });

    return {
      success: true,
      data: rows.map((row) => ({
        alertRecipientId: row.id.toString(),
        alertId: row.alert.id.toString(),
        alertType: row.alert.alertType,
        title: row.alert.title,
        description: row.alert.description,
        alertDate: toDateString(row.alert.alertDate),
        severity: row.alert.severity,
        status: row.alert.status,
        isRead: row.isRead,
        readAt: row.readAt?.toISOString() ?? null,
        propertyName: row.alert.property?.propertyName ?? null,
        unitCode: row.alert.unit?.unitCode ?? null,
        invoiceCode: row.alert.invoice?.invoiceCode ?? null,
        createdAt: row.alert.createdAt.toISOString(),
        resolvedAt: row.alert.resolvedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải thông báo') };
  }
}

export async function markAlertRead(payload: MarkAlertReadInput): Promise<ActionResponse> {
  const parsed = markAlertReadSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    const row = await prisma.alertRecipient.findFirst({
      where: {
        id: parseId(parsed.data.alertRecipientId),
        userId: parseId(session.userId),
      },
      select: { id: true },
    });

    if (!row) {
      return { success: false, message: 'Không tìm thấy thông báo' };
    }

    await prisma.alertRecipient.update({
      where: { id: row.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, message: 'Đã đánh dấu thông báo là đã đọc' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể đánh dấu đã đọc thông báo') };
  }
}

export async function markAllAlertsRead(): Promise<ActionResponse> {
  try {
    const session = await requireSession();
    await prisma.alertRecipient.updateMany({
      where: {
        userId: parseId(session.userId),
        isRead: false,
        alert: { status: 'OPEN' },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể đánh dấu đã đọc các thông báo') };
  }
}

export async function getUnreadAlertCount(): Promise<ActionResponse<{ count: number }>> {
  try {
    const session = await requireSession();
    if (isAdmin(session) || isOwner(session) || isManager(session) || isTenant(session)) {
      await refreshOperationalAlerts(session);
    }

    const count = await prisma.alertRecipient.count({
      where: {
        userId: parseId(session.userId),
        isRead: false,
        alert: { status: 'OPEN' },
      },
    });

    return { success: true, data: { count } };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải số lượng thông báo chưa đọc') };
  }
}
