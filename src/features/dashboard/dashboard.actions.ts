'use server';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { refreshOperationalAlerts } from '@/features/alerts/alerts.generator';
import { expirePastActiveLeases } from '@/lib/lease-expiration';
import {
  AppSession,
  isAdmin,
  isManager,
  isOwner,
  parseId,
  requireSession,
} from '@/lib/authz';

export type DashboardMetrics = {
  totalProperties: number;
  totalUnits: number;
  vacantUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  activeLeaseCount: number;
  expiringLeaseCount: number;
  overdueInvoiceCount: number;
  pendingPaymentReviewCount: number;
  currentMonthInvoiced: string;
  currentMonthPaid: string;
  currentMonthOutstanding: string;
  currentMonthExpenses: string;
  currentMonthNetIncome: string;
  oldVacantUnitCount: number;
};

export type DashboardActionResponse = {
  success: boolean;
  message?: string;
  data?: DashboardMetrics;
};

function roundedPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

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

function currentMonthRange() {
  const now = todayAtStart();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function emptyMetrics(): DashboardMetrics {
  return {
    totalProperties: 0,
    totalUnits: 0,
    vacantUnits: 0,
    occupiedUnits: 0,
    occupancyRate: 0,
    activeLeaseCount: 0,
    expiringLeaseCount: 0,
    overdueInvoiceCount: 0,
    pendingPaymentReviewCount: 0,
    currentMonthInvoiced: '0',
    currentMonthPaid: '0',
    currentMonthOutstanding: '0',
    currentMonthExpenses: '0',
    currentMonthNetIncome: '0',
    oldVacantUnitCount: 0,
  };
}

function scopeWhereForProperty(session: AppSession): Prisma.PropertyWhereInput {
  const activeFilter = { not: 'ARCHIVED' as const };

  if (isAdmin(session)) {
    return { status: activeFilter };
  }

  if (isOwner(session)) {
    return { ownerId: parseId(session.userId), status: activeFilter };
  }

  if (isManager(session)) {
    return {
      status: activeFilter,
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

function invoiceRemaining(invoice: {
  totalAmount: Prisma.Decimal;
  payments: { paidAmount: Prisma.Decimal; verificationStatus: string }[];
}) {
  const paid = invoice.payments
    .filter((payment) => payment.verificationStatus === 'VERIFIED')
    .reduce((sum, payment) => sum.plus(payment.paidAmount), decimal(0));
  const remaining = invoice.totalAmount.minus(paid);
  return {
    paid,
    remaining: remaining.lt(0) ? decimal(0) : remaining,
  };
}

export async function getDashboardMetrics(): Promise<DashboardActionResponse> {
  try {
    const session = await requireSession();
    await expirePastActiveLeases();
    await refreshOperationalAlerts(session);

    const propertyRows = await prisma.property.findMany({
      where: scopeWhereForProperty(session),
      select: { id: true },
    });
    const propertyIds = propertyRows.map((property) => property.id);

    if (propertyIds.length === 0) {
      return { success: true, data: emptyMetrics() };
    }

    const month = currentMonthRange();
    const invoiceScope: Prisma.InvoiceWhereInput = {
      lease: {
        unit: {
          propertyId: { in: propertyIds },
        },
      },
    };

    const [
      totalUnits,
      vacantUnits,
      occupiedUnits,
      oldVacantUnitCount,
      activeLeaseCount,
      expiringLeaseCount,
      pendingPaymentReviewCount,
      currentInvoices,
      scopedInvoices,
      currentExpenses,
    ] = await Promise.all([
      prisma.unit.count({ where: { propertyId: { in: propertyIds }, occupancyStatus: { not: 'ARCHIVED' } } }),
      prisma.unit.count({ where: { propertyId: { in: propertyIds }, occupancyStatus: 'VACANT' } }),
      prisma.unit.count({ where: { propertyId: { in: propertyIds }, occupancyStatus: 'OCCUPIED' } }),
      prisma.unit.count({
        where: {
          propertyId: { in: propertyIds },
          occupancyStatus: 'VACANT',
          vacantSince: { lte: addDays(-7) },
        },
      }),
      prisma.lease.count({
        where: {
          status: 'ACTIVE',
          unit: { propertyId: { in: propertyIds } },
        },
      }),
      prisma.lease.count({
        where: {
          status: 'ACTIVE',
          endDate: { gte: todayAtStart(), lte: addDays(30) },
          unit: { propertyId: { in: propertyIds } },
        },
      }),
      prisma.payment.count({
        where: {
          verificationStatus: 'PENDING',
          invoice: invoiceScope,
        },
      }),
      prisma.invoice.findMany({
        where: {
          ...invoiceScope,
          billingYear: month.year,
          billingMonth: month.month,
        },
        select: {
          totalAmount: true,
          payments: { select: { paidAmount: true, verificationStatus: true } },
        },
      }),
      prisma.invoice.findMany({
        where: invoiceScope,
        select: {
          totalAmount: true,
          dueDate: true,
          status: true,
          payments: { select: { paidAmount: true, verificationStatus: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'ACTIVE',
          expenseDate: { gte: month.start, lte: month.end },
        },
        select: { amount: true },
      }),
    ]);

    let currentMonthInvoiced = decimal(0);
    let currentMonthPaid = decimal(0);
    let currentMonthOutstanding = decimal(0);
    for (const invoice of currentInvoices) {
      const totals = invoiceRemaining(invoice);
      currentMonthInvoiced = currentMonthInvoiced.plus(invoice.totalAmount);
      currentMonthPaid = currentMonthPaid.plus(totals.paid);
      currentMonthOutstanding = currentMonthOutstanding.plus(totals.remaining);
    }

    const overdueInvoiceCount = scopedInvoices.filter((invoice) => {
      if (invoice.dueDate >= todayAtStart()) return false;
      if (!['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) return false;
      return invoiceRemaining(invoice).remaining.gt(0);
    }).length;

    const currentMonthExpenses = currentExpenses.reduce(
      (sum, expense) => sum.plus(expense.amount),
      decimal(0)
    );
    const currentMonthNetIncome = currentMonthPaid.minus(currentMonthExpenses);
    const occupancyRate = totalUnits > 0 ? roundedPercent((occupiedUnits / totalUnits) * 100) : 0;

    return {
      success: true,
      data: {
        totalProperties: propertyIds.length,
        totalUnits,
        vacantUnits,
        occupiedUnits,
        occupancyRate,
        activeLeaseCount,
        expiringLeaseCount,
        overdueInvoiceCount,
        pendingPaymentReviewCount,
        currentMonthInvoiced: currentMonthInvoiced.toString(),
        currentMonthPaid: currentMonthPaid.toString(),
        currentMonthOutstanding: currentMonthOutstanding.toString(),
        currentMonthExpenses: currentMonthExpenses.toString(),
        currentMonthNetIncome: currentMonthNetIncome.toString(),
        oldVacantUnitCount,
      },
    };
  } catch (error) {
    console.error('getDashboardMetrics error:', error);
    return { success: false, message: 'Không thể tải dữ liệu tổng quan' };
  }
}
