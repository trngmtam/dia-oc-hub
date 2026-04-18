'use server';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { expirePastActiveLeases } from '@/lib/lease-expiration';
import {
  assertPropertyAccess,
  isAdmin,
  isManager,
  isOwner,
  isTenant,
  normalizeActionError,
  parseId,
  requireSession,
} from '@/lib/authz';
import {
  createExpenseSchema,
  listExpensesSchema,
  updateExpenseSchema,
  voidExpenseSchema,
  type CreateExpenseInput,
  type ListExpensesInput,
  type UpdateExpenseInput,
  type VoidExpenseInput,
} from './expenses.validation';

type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

export type ExpenseListItem = {
  expenseId: string;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitCode: string | null;
  category: string;
  amount: string;
  expenseDate: string;
  vendorName: string | null;
  note: string | null;
  receiptUrl: string | null;
  status: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  voidedAt: string | null;
  canEdit: boolean;
};

export type ExpenseSummary = {
  totalExpenses: string;
  activeExpenseCount: number;
  voidedExpenseCount: number;
  byCategory: {
    category: string;
    totalAmount: string;
    count: number;
  }[];
};

export type RevenueAnalytics = {
  billingYear: number;
  billingMonth: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
  totalExpenses: string;
  netOperatingIncome: string;
  byCategory: {
    category: string;
    totalAmount: string;
    count: number;
  }[];
  byProperty: {
    propertyId: string;
    propertyName: string;
    invoiced: string;
    paid: string;
    outstanding: string;
    overdue: string;
    expenses: string;
    net: string;
  }[];
};

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_DATE');
  }

  return parsed;
}

function monthRange(year?: number, month?: number) {
  if (!year || !month) return {};
  return {
    gte: new Date(year, month - 1, 1),
    lte: new Date(year, month, 0),
  };
}

function currentBillingMonth() {
  const now = new Date();
  return {
    billingYear: now.getFullYear(),
    billingMonth: now.getMonth() + 1,
  };
}

function textOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function propertyScopeForExpenses(
  session: Awaited<ReturnType<typeof requireSession>>,
  propertyId?: string | null
): Prisma.PropertyWhereInput {
  const explicit = propertyId ? { id: parseId(propertyId) } : {};

  if (isAdmin(session)) return explicit;
  if (isOwner(session)) return { ...explicit, ownerId: parseId(session.userId) };
  if (isManager(session)) {
    return {
      ...explicit,
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

function expenseWhereForSession(
  session: Awaited<ReturnType<typeof requireSession>>,
  filters: ListExpensesInput
): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {
    property: propertyScopeForExpenses(session, filters.propertyId || null),
  };

  const dateRange = monthRange(filters.billingYear, filters.billingMonth);
  if (Object.keys(dateRange).length > 0) where.expenseDate = dateRange;
  if (filters.status !== 'ALL') where.status = filters.status;

  return where;
}

async function getActiveAssignmentId(propertyId: bigint, managerId: bigint) {
  const assignment = await prisma.propertyManagerAssignment.findFirst({
    where: {
      propertyId,
      managerId,
      status: 'ACTIVE',
    },
    select: { id: true },
    orderBy: { startDate: 'desc' },
  });

  return assignment?.id ?? null;
}

async function assertUnitBelongsToProperty(unitId: bigint | null, propertyId: bigint) {
  if (!unitId) return;

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      propertyId,
      occupancyStatus: { not: 'ARCHIVED' },
    },
    select: { id: true },
  });

  if (!unit) {
    throw new Error('UNIT_PROPERTY_MISMATCH');
  }
}

function canMutateExpense(
  session: Awaited<ReturnType<typeof requireSession>>,
  expense: { createdById: bigint }
) {
  return isAdmin(session) || isOwner(session) || expense.createdById === parseId(session.userId);
}

function mapExpense(
  session: Awaited<ReturnType<typeof requireSession>>,
  expense: {
    id: bigint;
    propertyId: bigint;
    unitId: bigint | null;
    category: string;
    amount: Prisma.Decimal;
    expenseDate: Date;
    vendorName: string | null;
    note: string | null;
    receiptUrl: string | null;
    status: string;
    createdById: bigint;
    createdAt: Date;
    voidedAt: Date | null;
    property: { propertyName: string };
    unit: { unitCode: string } | null;
    createdBy: { fullName: string };
  }
): ExpenseListItem {
  return {
    expenseId: expense.id.toString(),
    propertyId: expense.propertyId.toString(),
    propertyName: expense.property.propertyName,
    unitId: expense.unitId?.toString() ?? null,
    unitCode: expense.unit?.unitCode ?? null,
    category: expense.category,
    amount: expense.amount.toString(),
    expenseDate: toDateString(expense.expenseDate),
    vendorName: expense.vendorName,
    note: expense.note,
    receiptUrl: expense.receiptUrl,
    status: expense.status,
    createdById: expense.createdById.toString(),
    createdByName: expense.createdBy.fullName,
    createdAt: expense.createdAt.toISOString(),
    voidedAt: expense.voidedAt?.toISOString() ?? null,
    canEdit: expense.status === 'ACTIVE' && canMutateExpense(session, expense),
  };
}

export async function listExpenses(
  payload: ListExpensesInput = { status: 'ACTIVE' }
): Promise<ActionResponse<ExpenseListItem[]>> {
  const parsed = listExpensesSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const expenses = await prisma.expense.findMany({
      where: expenseWhereForSession(session, parsed.data),
      include: {
        property: { select: { propertyName: true } },
        unit: { select: { unitCode: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      success: true,
      data: expenses.map((expense) => mapExpense(session, expense)),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải danh sách chi phí') };
  }
}

export async function getExpenseSummary(
  payload: ListExpensesInput = { status: 'ACTIVE' }
): Promise<ActionResponse<ExpenseSummary>> {
  const parsed = listExpensesSchema.safeParse({ ...payload, status: 'ACTIVE' });
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const where = expenseWhereForSession(session, parsed.data);
    const [activeExpenses, voidedExpenseCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        select: { category: true, amount: true },
      }),
      prisma.expense.count({
        where: {
          ...expenseWhereForSession(session, { ...parsed.data, status: 'VOIDED' }),
        },
      }),
    ]);

    const totals = new Map<string, { totalAmount: Prisma.Decimal; count: number }>();
    let totalExpenses = decimal(0);

    for (const expense of activeExpenses) {
      totalExpenses = totalExpenses.plus(expense.amount);
      const current = totals.get(expense.category) ?? { totalAmount: decimal(0), count: 0 };
      totals.set(expense.category, {
        totalAmount: current.totalAmount.plus(expense.amount),
        count: current.count + 1,
      });
    }

    return {
      success: true,
      data: {
        totalExpenses: totalExpenses.toString(),
        activeExpenseCount: activeExpenses.length,
        voidedExpenseCount,
        byCategory: Array.from(totals.entries()).map(([category, value]) => ({
          category,
          totalAmount: value.totalAmount.toString(),
          count: value.count,
        })),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải tổng hợp chi phí') };
  }
}

export async function createExpense(
  payload: CreateExpenseInput
): Promise<ActionResponse<{ expenseId: string }>> {
  const parsed = createExpenseSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const propertyId = parseId(parsed.data.propertyId);
    const unitId = parsed.data.unitId ? parseId(parsed.data.unitId) : null;
    await assertPropertyAccess(session, propertyId);
    await assertUnitBelongsToProperty(unitId, propertyId);

    const assignmentId = isManager(session)
      ? await getActiveAssignmentId(propertyId, parseId(session.userId))
      : null;

    const expense = await prisma.expense.create({
      data: {
        propertyId,
        unitId,
        assignmentId,
        category: parsed.data.category,
        amount: decimal(parsed.data.amount),
        expenseDate: parseDateInput(parsed.data.expenseDate),
        vendorName: textOrNull(parsed.data.vendorName),
        note: textOrNull(parsed.data.note),
        receiptUrl: textOrNull(parsed.data.receiptUrl),
        createdById: parseId(session.userId),
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return {
      success: true,
      message: 'Đã ghi nhận chi phí thành công',
      data: { expenseId: expense.id.toString() },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNIT_PROPERTY_MISMATCH') {
      return { success: false, message: 'Căn hộ đã chọn không thuộc tài sản này' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể tạo chi phí') };
  }
}

function invoicePaymentTotals(invoice: {
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

export async function getRevenueAnalytics(
  payload: ListExpensesInput = { status: 'ACTIVE' }
): Promise<ActionResponse<RevenueAnalytics>> {
  const fallbackMonth = currentBillingMonth();
  const parsed = listExpensesSchema.safeParse({
    ...payload,
    billingYear: payload.billingYear ?? fallbackMonth.billingYear,
    billingMonth: payload.billingMonth ?? fallbackMonth.billingMonth,
    status: 'ACTIVE',
  });
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const properties = await prisma.property.findMany({
      where: propertyScopeForExpenses(session, parsed.data.propertyId || null),
      select: { id: true, propertyName: true },
      orderBy: { propertyName: 'asc' },
    });

    const propertyIds = properties.map((property) => property.id);
    const byProperty = new Map(properties.map((property) => [
      property.id.toString(),
      {
        propertyId: property.id.toString(),
        propertyName: property.propertyName,
        invoiced: decimal(0),
        paid: decimal(0),
        outstanding: decimal(0),
        overdue: decimal(0),
        expenses: decimal(0),
      },
    ]));

    if (propertyIds.length === 0) {
      return {
        success: true,
        data: {
          billingYear: parsed.data.billingYear ?? fallbackMonth.billingYear,
          billingMonth: parsed.data.billingMonth ?? fallbackMonth.billingMonth,
          totalInvoiced: '0',
          totalPaid: '0',
          totalOutstanding: '0',
          totalOverdue: '0',
          totalExpenses: '0',
          netOperatingIncome: '0',
          byCategory: [],
          byProperty: [],
        },
      };
    }

    const dateRange = monthRange(parsed.data.billingYear, parsed.data.billingMonth);
    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          billingYear: parsed.data.billingYear,
          billingMonth: parsed.data.billingMonth,
          lease: {
            unit: {
              propertyId: { in: propertyIds },
            },
          },
        },
        include: {
          payments: { select: { paidAmount: true, verificationStatus: true } },
          lease: {
            include: {
              unit: {
                include: {
                  property: { select: { id: true } },
                },
              },
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'ACTIVE',
          expenseDate: dateRange,
        },
        select: {
          propertyId: true,
          category: true,
          amount: true,
        },
      }),
    ]);

    let totalInvoiced = decimal(0);
    let totalPaid = decimal(0);
    let totalOutstanding = decimal(0);
    let totalOverdue = decimal(0);

    for (const invoice of invoices) {
      const key = invoice.lease.unit.property.id.toString();
      const row = byProperty.get(key);
      const totals = invoicePaymentTotals(invoice);
      totalInvoiced = totalInvoiced.plus(invoice.totalAmount);
      totalPaid = totalPaid.plus(totals.paid);
      totalOutstanding = totalOutstanding.plus(totals.remaining);
      if (invoice.status === 'OVERDUE') totalOverdue = totalOverdue.plus(totals.remaining);

      if (row) {
        row.invoiced = row.invoiced.plus(invoice.totalAmount);
        row.paid = row.paid.plus(totals.paid);
        row.outstanding = row.outstanding.plus(totals.remaining);
        if (invoice.status === 'OVERDUE') row.overdue = row.overdue.plus(totals.remaining);
      }
    }

    const byCategoryMap = new Map<string, { totalAmount: Prisma.Decimal; count: number }>();
    let totalExpenses = decimal(0);
    for (const expense of expenses) {
      totalExpenses = totalExpenses.plus(expense.amount);
      const propertyRow = byProperty.get(expense.propertyId.toString());
      if (propertyRow) propertyRow.expenses = propertyRow.expenses.plus(expense.amount);

      const categoryRow = byCategoryMap.get(expense.category) ?? { totalAmount: decimal(0), count: 0 };
      byCategoryMap.set(expense.category, {
        totalAmount: categoryRow.totalAmount.plus(expense.amount),
        count: categoryRow.count + 1,
      });
    }

    return {
      success: true,
      data: {
        billingYear: parsed.data.billingYear ?? fallbackMonth.billingYear,
        billingMonth: parsed.data.billingMonth ?? fallbackMonth.billingMonth,
        totalInvoiced: totalInvoiced.toString(),
        totalPaid: totalPaid.toString(),
        totalOutstanding: totalOutstanding.toString(),
        totalOverdue: totalOverdue.toString(),
        totalExpenses: totalExpenses.toString(),
        netOperatingIncome: totalPaid.minus(totalExpenses).toString(),
        byCategory: Array.from(byCategoryMap.entries()).map(([category, value]) => ({
          category,
          totalAmount: value.totalAmount.toString(),
          count: value.count,
        })),
        byProperty: Array.from(byProperty.values()).map((row) => ({
          propertyId: row.propertyId,
          propertyName: row.propertyName,
          invoiced: row.invoiced.toString(),
          paid: row.paid.toString(),
          outstanding: row.outstanding.toString(),
          overdue: row.overdue.toString(),
          expenses: row.expenses.toString(),
          net: row.paid.minus(row.expenses).toString(),
        })),
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải phân tích doanh thu') };
  }
}

export async function updateExpense(payload: UpdateExpenseInput): Promise<ActionResponse> {
  const parsed = updateExpenseSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const expenseId = parseId(parsed.data.expenseId);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, propertyId: true, createdById: true, status: true },
    });

    if (!expense || expense.status !== 'ACTIVE') {
      return { success: false, message: 'Không tìm thấy khoản chi đang hiệu lực' };
    }

    await assertPropertyAccess(session, expense.propertyId);
    if (!canMutateExpense(session, expense)) throw new Error('FORBIDDEN');

    const nextPropertyId = parseId(parsed.data.propertyId);
    const unitId = parsed.data.unitId ? parseId(parsed.data.unitId) : null;
    await assertPropertyAccess(session, nextPropertyId);
    await assertUnitBelongsToProperty(unitId, nextPropertyId);

    const assignmentId = isManager(session)
      ? await getActiveAssignmentId(nextPropertyId, parseId(session.userId))
      : null;

    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        propertyId: nextPropertyId,
        unitId,
        assignmentId,
        category: parsed.data.category,
        amount: decimal(parsed.data.amount),
        expenseDate: parseDateInput(parsed.data.expenseDate),
        vendorName: textOrNull(parsed.data.vendorName),
        note: textOrNull(parsed.data.note),
        receiptUrl: textOrNull(parsed.data.receiptUrl),
      },
    });

    return { success: true, message: 'Đã cập nhật chi phí thành công' };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNIT_PROPERTY_MISMATCH') {
      return { success: false, message: 'Căn hộ đã chọn không thuộc tài sản này' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể cập nhật chi phí') };
  }
}

export async function voidExpense(payload: VoidExpenseInput): Promise<ActionResponse> {
  const parsed = voidExpenseSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const expense = await prisma.expense.findUnique({
      where: { id: parseId(parsed.data.expenseId) },
      select: { id: true, propertyId: true, createdById: true, status: true },
    });

    if (!expense || expense.status !== 'ACTIVE') {
      return { success: false, message: 'Không tìm thấy khoản chi đang hiệu lực' };
    }

    await assertPropertyAccess(session, expense.propertyId);
    if (!canMutateExpense(session, expense)) throw new Error('FORBIDDEN');

    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedById: parseId(session.userId),
      },
    });

    return { success: true, message: 'Đã hủy ghi nhận chi phí thành công' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể hủy chi phí') };
  }
}
