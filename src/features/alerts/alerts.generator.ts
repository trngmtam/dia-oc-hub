'use server';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { expirePastActiveLeases } from '@/lib/lease-expiration';
import { AppSession, isAdmin, isManager, isOwner, isTenant, parseId } from '@/lib/authz';

type AlertCandidate = {
  dedupeKey: string;
  alertType: string;
  title: string;
  description: string;
  alertDate: Date;
  severity: string;
  propertyId?: bigint | null;
  unitId?: bigint | null;
  leaseId?: bigint | null;
  invoiceId?: bigint | null;
  assignmentId?: bigint | null;
  recipientIds: bigint[];
};

const ALERT_TYPES = [
  'OVERDUE_INVOICE',
  'LEASE_EXPIRING',
  'VACANT_UNIT',
  'PENDING_PAYMENT_REVIEW',
];

function todayAtStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(days: number) {
  const value = todayAtStart();
  value.setDate(value.getDate() + days);
  return value;
}

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function propertyScopeForAlerts(session: AppSession): Prisma.PropertyWhereInput {
  if (isAdmin(session)) return { status: { not: 'ARCHIVED' } };
  if (isOwner(session)) {
    return {
      ownerId: parseId(session.userId),
      status: { not: 'ARCHIVED' },
    };
  }
  if (isManager(session)) {
    return {
      status: { not: 'ARCHIVED' },
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

function invoiceScopeForAlerts(session: AppSession): Prisma.InvoiceWhereInput {
  if (isTenant(session)) {
    return {
      lease: {
        tenantId: parseId(session.userId),
      },
    };
  }

  return {
    lease: {
      unit: {
        property: propertyScopeForAlerts(session),
      },
    },
  };
}

function uniqueRecipients(ids: (bigint | null | undefined)[]) {
  return Array.from(new Set(ids.filter((id): id is bigint => Boolean(id)).map((id) => id.toString())))
    .map((id) => BigInt(id));
}

async function propertyRecipients(propertyId: bigint, tenantId?: bigint | null) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      ownerId: true,
      assignments: {
        where: { status: 'ACTIVE' },
        select: { managerId: true },
      },
    },
  });

  if (!property) return tenantId ? [tenantId] : [];

  return uniqueRecipients([
    property.ownerId,
    ...property.assignments.map((assignment) => assignment.managerId),
    tenantId,
  ]);
}

function remainingBalance(
  totalAmount: Prisma.Decimal,
  payments: { paidAmount: Prisma.Decimal; verificationStatus: string }[]
) {
  const verifiedPaid = payments
    .filter((payment) => payment.verificationStatus === 'VERIFIED')
    .reduce((sum, payment) => sum.plus(payment.paidAmount), decimal(0));
  const remaining = totalAmount.minus(verifiedPaid);
  return remaining.lt(0) ? decimal(0) : remaining;
}

async function overdueInvoiceCandidates(session: AppSession): Promise<AlertCandidate[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      ...invoiceScopeForAlerts(session),
      dueDate: { lt: todayAtStart() },
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    include: {
      payments: { select: { paidAmount: true, verificationStatus: true } },
      lease: {
        include: {
          tenant: { select: { id: true, fullName: true } },
          unit: {
            include: {
              property: { select: { id: true, propertyName: true } },
            },
          },
        },
      },
    },
  });

  const candidates: AlertCandidate[] = [];
  for (const invoice of invoices) {
    if (remainingBalance(invoice.totalAmount, invoice.payments).lte(0)) continue;
    const recipients = await propertyRecipients(invoice.lease.unit.property.id, invoice.lease.tenant.id);
    candidates.push({
      dedupeKey: `overdue-invoice-${invoice.id.toString()}`,
      alertType: 'OVERDUE_INVOICE',
      title: `Hóa đơn ${invoice.invoiceCode} đã quá hạn`,
      description: `${invoice.lease.tenant.fullName} vẫn còn công nợ tại ${invoice.lease.unit.property.propertyName}, căn ${invoice.lease.unit.unitCode}.`,
      alertDate: todayAtStart(),
      severity: 'HIGH',
      propertyId: invoice.lease.unit.property.id,
      unitId: invoice.lease.unit.id,
      leaseId: invoice.lease.id,
      invoiceId: invoice.id,
      recipientIds: recipients,
    });
  }

  return candidates;
}

async function leaseExpiringCandidates(session: AppSession): Promise<AlertCandidate[]> {
  const where: Prisma.LeaseWhereInput = {
    status: 'ACTIVE',
    endDate: {
      gte: todayAtStart(),
      lte: addDays(30),
    },
  };

  if (isTenant(session)) {
    where.tenantId = parseId(session.userId);
  } else {
    where.unit = {
      property: propertyScopeForAlerts(session),
    };
  }

  const leases = await prisma.lease.findMany({
    where,
    include: {
      tenant: { select: { id: true, fullName: true } },
      unit: {
        include: {
          property: { select: { id: true, propertyName: true } },
        },
      },
    },
  });

  const candidates: AlertCandidate[] = [];
  for (const lease of leases) {
    const recipients = await propertyRecipients(lease.unit.property.id, lease.tenant.id);
    candidates.push({
      dedupeKey: `lease-expiring-${lease.id.toString()}`,
      alertType: 'LEASE_EXPIRING',
      title: 'Hợp đồng sắp hết hạn',
      description: `Hợp đồng của ${lease.tenant.fullName} tại ${lease.unit.property.propertyName}, căn ${lease.unit.unitCode} sẽ hết hạn vào ngày ${lease.endDate.toLocaleDateString('vi-VN')}.`,
      alertDate: todayAtStart(),
      severity: 'MEDIUM',
      propertyId: lease.unit.property.id,
      unitId: lease.unit.id,
      leaseId: lease.id,
      recipientIds: recipients,
    });
  }

  return candidates;
}

async function vacantUnitCandidates(session: AppSession): Promise<AlertCandidate[]> {
  if (isTenant(session)) return [];

  const units = await prisma.unit.findMany({
    where: {
      occupancyStatus: 'VACANT',
      vacantSince: { lte: addDays(-7) },
      property: propertyScopeForAlerts(session),
    },
    include: {
      property: { select: { id: true, propertyName: true } },
    },
  });

  const candidates: AlertCandidate[] = [];
  for (const unit of units) {
    const recipients = await propertyRecipients(unit.property.id);
    candidates.push({
      dedupeKey: `vacant-unit-${unit.id.toString()}`,
      alertType: 'VACANT_UNIT',
      title: `Căn ${unit.unitCode} đang trống`,
      description: `${unit.property.propertyName} - căn ${unit.unitCode} đã trống từ ${unit.vacantSince?.toLocaleDateString('vi-VN') ?? 'không rõ ngày'}.`,
      alertDate: todayAtStart(),
      severity: 'MEDIUM',
      propertyId: unit.property.id,
      unitId: unit.id,
      recipientIds: recipients,
    });
  }

  return candidates;
}

async function pendingPaymentCandidates(session: AppSession): Promise<AlertCandidate[]> {
  if (isTenant(session)) return [];

  const payments = await prisma.payment.findMany({
    where: {
      verificationStatus: 'PENDING',
      invoice: invoiceScopeForAlerts(session),
    },
    include: {
      invoice: {
        include: {
          lease: {
            include: {
              tenant: { select: { fullName: true } },
              unit: {
                include: {
                  property: { select: { id: true, propertyName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const candidates: AlertCandidate[] = [];
  for (const payment of payments) {
    const recipients = await propertyRecipients(payment.invoice.lease.unit.property.id);
    candidates.push({
      dedupeKey: `pending-payment-${payment.id.toString()}`,
      alertType: 'PENDING_PAYMENT_REVIEW',
      title: 'Thanh toán chờ duyệt',
      description: `${payment.invoice.lease.tenant.fullName} đã gửi chứng từ cho hóa đơn ${payment.invoice.invoiceCode}.`,
      alertDate: todayAtStart(),
      severity: 'HIGH',
      propertyId: payment.invoice.lease.unit.property.id,
      unitId: payment.invoice.lease.unit.id,
      leaseId: payment.invoice.lease.id,
      invoiceId: payment.invoice.id,
      recipientIds: recipients,
    });
  }

  return candidates;
}

function staleAlertWhere(session: AppSession, candidateKeys: string[]): Prisma.AlertWhereInput {
  const base: Prisma.AlertWhereInput = {
    alertType: { in: ALERT_TYPES },
    status: 'OPEN',
    dedupeKey: { notIn: candidateKeys.length > 0 ? candidateKeys : ['__none__'] },
  };

  if (isTenant(session)) {
    return {
      ...base,
      recipients: {
        some: { userId: parseId(session.userId) },
      },
    };
  }

  return {
    ...base,
    OR: [
      { property: propertyScopeForAlerts(session) },
      { propertyId: null },
    ],
  };
}

export async function refreshOperationalAlerts(session: AppSession) {
  await expirePastActiveLeases();

  const groups = await Promise.all([
    overdueInvoiceCandidates(session),
    leaseExpiringCandidates(session),
    vacantUnitCandidates(session),
    pendingPaymentCandidates(session),
  ]);
  const candidates = groups.flat();
  const candidateKeys = candidates.map((candidate) => candidate.dedupeKey);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const alert = await tx.alert.upsert({
        where: { dedupeKey: candidate.dedupeKey },
        create: {
          dedupeKey: candidate.dedupeKey,
          alertType: candidate.alertType,
          title: candidate.title,
          description: candidate.description,
          alertDate: candidate.alertDate,
          severity: candidate.severity,
          status: 'OPEN',
          propertyId: candidate.propertyId ?? null,
          unitId: candidate.unitId ?? null,
          leaseId: candidate.leaseId ?? null,
          invoiceId: candidate.invoiceId ?? null,
          assignmentId: candidate.assignmentId ?? null,
        },
        update: {
          title: candidate.title,
          description: candidate.description,
          alertDate: candidate.alertDate,
          severity: candidate.severity,
          status: 'OPEN',
          resolvedAt: null,
          propertyId: candidate.propertyId ?? null,
          unitId: candidate.unitId ?? null,
          leaseId: candidate.leaseId ?? null,
          invoiceId: candidate.invoiceId ?? null,
          assignmentId: candidate.assignmentId ?? null,
        },
        select: { id: true },
      });

      await tx.alertRecipient.createMany({
        data: candidate.recipientIds.map((userId) => ({
          alertId: alert.id,
          userId,
          notifiedAt: now,
        })),
        skipDuplicates: true,
      });
    }

    await tx.alert.updateMany({
      where: staleAlertWhere(session, candidateKeys),
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
      },
    });
  });

  return { createdOrUpdatedCount: candidates.length };
}
