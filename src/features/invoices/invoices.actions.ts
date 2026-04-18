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
import { createPaymentProofSignedUrl } from '@/lib/payment-proof-storage';
import {
  billingMonthSchema,
  createMonthlyInvoicesSchema,
  createSingleInvoiceSchema,
  listInvoicesSchema,
  paymentReviewSchema,
  receivingAccountSchema,
  signedProofUrlSchema,
  idSchema,
  type BillingMonthInput,
  type CreateMonthlyInvoicesInput,
  type CreateSingleInvoiceInput,
  type ListInvoicesInput,
  type PaymentReviewInput,
  type ReceivingAccountInput,
  type SignedProofUrlInput,
} from './invoices.validation';

type ActionResponse<T = null> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

export type PaymentReceivingAccountData = {
  id: string;
  propertyId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferNoteTemplate: string | null;
};

export type InvoicePreviewItem = {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  unitCode: string;
  tenantName: string;
  tenantEmail: string | null;
  rentAmount: string;
  managementFeeAmount: string;
  dueDate: string;
  existingInvoiceId: string | null;
};

export type InvoiceListItem = {
  invoiceId: string;
  invoiceCode: string;
  propertyId: string;
  propertyName: string;
  unitCode: string;
  tenantName: string;
  tenantEmail: string | null;
  billingYear: number;
  billingMonth: number;
  rentAmount: string;
  utilityAmount: string;
  managementFeeAmount: string;
  penaltyAmount: string;
  otherFeeAmount: string;
  totalAmount: string;
  dueDate: string;
  status: string;
  verifiedPaidTotal: string;
  remainingBalance: string;
  pendingPaymentCount: number;
};

export type TenantPaymentHistoryItem = {
  paymentId: string;
  paymentMethod: string;
  transferReference: string | null;
  paidAmount: string;
  paymentNote: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  verificationStatus: string;
  verificationNote: string | null;
};

export type TenantInvoiceItem = InvoiceListItem & {
  canSubmitPayment: boolean;
  paymentInstruction: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferContent: string;
    qrImageUrl: string | null;
  } | null;
  payments: TenantPaymentHistoryItem[];
};

export type PaymentReviewItem = {
  paymentId: string;
  invoiceId: string;
  invoiceCode: string;
  propertyName: string;
  unitCode: string;
  payerName: string;
  payerEmail: string | null;
  paidAmount: string;
  paymentMethod: string;
  transferReference: string | null;
  paymentNote: string | null;
  submittedAt: string;
  verificationStatus: string;
};

export type InvoiceSummary = {
  totalInvoiced: string;
  totalPaid: string;
  totalRemaining: string;
  pendingReviewCount: number;
  overdueCount: number;
};

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toNullableString(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function positiveRemainder(total: Prisma.Decimal, paid: Prisma.Decimal) {
  const remaining = total.minus(paid);
  return remaining.lt(0) ? decimal(0) : remaining;
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function dueDateForMonth(year: number, month: number, dueDayOfMonth: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(dueDayOfMonth, 1), lastDay);
  return new Date(year, month - 1, day);
}

function todayAtStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function generateInvoiceCode(year: number, month: number, leaseId: bigint) {
  const paddedMonth = String(month).padStart(2, '0');
  const random = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `INV-${year}${paddedMonth}-${leaseId.toString()}-${random}`;
}

function paymentInstructionForInvoice(
  invoiceCode: string,
  totalAmount: string,
  account: PaymentReceivingAccountData | null
) {
  if (!account) return null;

  const transferContent = (account.transferNoteTemplate || '{invoiceCode}')
    .replaceAll('{invoiceCode}', invoiceCode)
    .replaceAll('{amount}', totalAmount);

  const params = new URLSearchParams({
    amount: String(Math.round(Number(totalAmount || 0))),
    addInfo: transferContent,
    accountName: account.accountName,
  });

  return {
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    transferContent,
    qrImageUrl: `https://img.vietqr.io/image/${encodeURIComponent(account.bankCode)}-${encodeURIComponent(account.accountNumber)}-compact2.png?${params.toString()}`,
  };
}

function propertyScopeForFinance(
  session: Awaited<ReturnType<typeof requireSession>>,
  propertyId?: string | null
): Prisma.PropertyWhereInput {
  const explicitProperty = propertyId ? { id: parseId(propertyId) } : {};

  if (session.role === 'ADMIN') {
    return explicitProperty;
  }

  if (session.role === 'OWNER') {
    return {
      ...explicitProperty,
      ownerId: parseId(session.userId),
    };
  }

  if (session.role === 'MANAGER') {
    return {
      ...explicitProperty,
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

function invoiceWhereForSession(
  session: Awaited<ReturnType<typeof requireSession>>,
  filters: {
    propertyId?: string | null;
    billingYear?: number;
    billingMonth?: number;
    status?: string;
  } = {}
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    lease: {
      unit: {
        property: propertyScopeForFinance(session, filters.propertyId),
      },
    },
  };

  if (filters.billingYear) where.billingYear = filters.billingYear;
  if (filters.billingMonth) where.billingMonth = filters.billingMonth;
  if (filters.status && filters.status !== 'ALL') where.status = filters.status;

  return where;
}

function leaseWhereForInvoiceGeneration(
  session: Awaited<ReturnType<typeof requireSession>>,
  year: number,
  month: number,
  propertyId?: string | null
): Prisma.LeaseWhereInput {
  const { start, end } = monthRange(year, month);

  return {
    status: 'ACTIVE',
    startDate: { lte: end },
    endDate: { gte: start },
    unit: {
      occupancyStatus: { not: 'ARCHIVED' },
      property: {
        ...propertyScopeForFinance(session, propertyId),
        status: { not: 'ARCHIVED' },
      },
    },
  };
}

function mapReceivingAccount(
  account: {
    id: bigint;
    propertyId: bigint;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferNoteTemplate: string | null;
  } | null
): PaymentReceivingAccountData | null {
  if (!account) return null;

  return {
    id: account.id.toString(),
    propertyId: account.propertyId.toString(),
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    transferNoteTemplate: account.transferNoteTemplate,
  };
}

function invoicePaymentTotals(
  payments: {
    paidAmount: Prisma.Decimal;
    verificationStatus: string;
  }[],
  totalAmount: Prisma.Decimal
) {
  const verifiedPaidTotal = payments
    .filter((payment) => payment.verificationStatus === 'VERIFIED')
    .reduce((sum, payment) => sum.plus(payment.paidAmount), decimal(0));
  const pendingPaymentCount = payments.filter(
    (payment) => payment.verificationStatus === 'PENDING'
  ).length;

  return {
    verifiedPaidTotal,
    pendingPaymentCount,
    remainingBalance: positiveRemainder(totalAmount, verifiedPaidTotal),
  };
}

async function markOverdueInvoices(where: Prisma.InvoiceWhereInput) {
  await prisma.invoice.updateMany({
    where: {
      ...where,
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: { lt: todayAtStart() },
      payments: {
        none: {
          verificationStatus: 'PENDING',
        },
      },
    },
    data: {
      status: 'OVERDUE',
    },
  });
}

export async function recalculateInvoiceStatusAfterPayment(
  invoiceId: bigint,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      totalAmount: true,
      dueDate: true,
      payments: {
        select: {
          paidAmount: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error('INVOICE_NOT_FOUND');
  }

  const { verifiedPaidTotal, pendingPaymentCount } = invoicePaymentTotals(
    invoice.payments,
    invoice.totalAmount
  );

  let status = 'UNPAID';
  if (verifiedPaidTotal.gte(invoice.totalAmount)) {
    status = 'PAID';
  } else if (pendingPaymentCount > 0) {
    status = 'PENDING_REVIEW';
  } else if (invoice.dueDate < todayAtStart()) {
    status = 'OVERDUE';
  } else if (verifiedPaidTotal.gt(0)) {
    status = 'PARTIALLY_PAID';
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { status },
  });

  return status;
}

async function createInvoiceFromLease(
  tx: Prisma.TransactionClient,
  lease: {
    id: bigint;
    dueDayOfMonth: number;
    baseRent: Prisma.Decimal;
    managementFee: Prisma.Decimal;
  },
  billingYear: number,
  billingMonth: number,
  utilityAmount: number,
  otherFeeAmount: number
) {
  const rentAmount = lease.baseRent;
  const managementFeeAmount = lease.managementFee;
  const utility = decimal(utilityAmount);
  const other = decimal(otherFeeAmount);
  const penalty = decimal(0);
  const totalAmount = rentAmount.plus(managementFeeAmount).plus(utility).plus(other).plus(penalty);

  return tx.invoice.create({
    data: {
      leaseId: lease.id,
      invoiceCode: generateInvoiceCode(billingYear, billingMonth, lease.id),
      billingYear,
      billingMonth,
      rentAmount,
      utilityAmount: utility,
      managementFeeAmount,
      penaltyAmount: penalty,
      otherFeeAmount: other,
      totalAmount,
      dueDate: dueDateForMonth(billingYear, billingMonth, lease.dueDayOfMonth),
      status: 'UNPAID',
    },
    select: { id: true },
  });
}

export async function previewMonthlyInvoices(
  payload: BillingMonthInput
): Promise<ActionResponse<InvoicePreviewItem[]>> {
  const parsed = billingMonthSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    if (parsed.data.propertyId) {
      await assertPropertyAccess(session, parseId(parsed.data.propertyId));
    }

    const leases = await prisma.lease.findMany({
      where: leaseWhereForInvoiceGeneration(
        session,
        parsed.data.billingYear,
        parsed.data.billingMonth,
        parsed.data.propertyId || null
      ),
      include: {
        tenant: { select: { fullName: true, email: true } },
        unit: {
          include: {
            property: { select: { id: true, propertyName: true } },
          },
        },
        invoices: {
          where: {
            billingYear: parsed.data.billingYear,
            billingMonth: parsed.data.billingMonth,
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ unit: { property: { propertyName: 'asc' } } }, { unit: { unitCode: 'asc' } }],
    });

    return {
      success: true,
      data: leases.map((lease) => ({
        leaseId: lease.id.toString(),
        propertyId: lease.unit.property.id.toString(),
        propertyName: lease.unit.property.propertyName,
        unitCode: lease.unit.unitCode,
        tenantName: lease.tenant.fullName,
        tenantEmail: lease.tenant.email,
        rentAmount: lease.baseRent.toString(),
        managementFeeAmount: lease.managementFee.toString(),
        dueDate: toDateString(
          dueDateForMonth(parsed.data.billingYear, parsed.data.billingMonth, lease.dueDayOfMonth)
        ),
        existingInvoiceId: lease.invoices[0]?.id.toString() ?? null,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể xem trước hóa đơn') };
  }
}

export async function createMonthlyInvoices(
  payload: CreateMonthlyInvoicesInput
): Promise<ActionResponse<{ createdCount: number; skippedCount: number }>> {
  const parsed = createMonthlyInvoicesSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const requestedLeaseIds = parsed.data.invoices.map((item) => parseId(item.leaseId));
    const leaseRows = await prisma.lease.findMany({
      where: {
        ...leaseWhereForInvoiceGeneration(
          session,
          parsed.data.billingYear,
          parsed.data.billingMonth,
          parsed.data.propertyId || null
        ),
        id: { in: requestedLeaseIds },
      },
      select: {
        id: true,
        dueDayOfMonth: true,
        baseRent: true,
        managementFee: true,
      },
    });

    const leaseMap = new Map(leaseRows.map((lease) => [lease.id.toString(), lease]));
    let createdCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.invoices) {
        const lease = leaseMap.get(item.leaseId);
        if (!lease) {
          skippedCount += 1;
          continue;
        }

        const existing = await tx.invoice.findFirst({
          where: {
            leaseId: lease.id,
            billingYear: parsed.data.billingYear,
            billingMonth: parsed.data.billingMonth,
          },
          select: { id: true },
        });

        if (existing) {
          skippedCount += 1;
          continue;
        }

        await createInvoiceFromLease(
          tx,
          lease,
          parsed.data.billingYear,
          parsed.data.billingMonth,
          item.utilityAmount,
          item.otherFeeAmount
        );
        createdCount += 1;
      }
    });

    return {
      success: true,
      message: `${createdCount} invoice(s) created, ${skippedCount} skipped`,
      data: { createdCount, skippedCount },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tạo hóa đơn theo tháng') };
  }
}

export async function createSingleInvoice(
  payload: CreateSingleInvoiceInput
): Promise<ActionResponse<{ invoiceId: string }>> {
  const parsed = createSingleInvoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const lease = await prisma.lease.findFirst({
      where: {
        ...leaseWhereForInvoiceGeneration(
          session,
          parsed.data.billingYear,
          parsed.data.billingMonth,
          null
        ),
        id: parseId(parsed.data.leaseId),
      },
      select: {
        id: true,
        dueDayOfMonth: true,
        baseRent: true,
        managementFee: true,
      },
    });

    if (!lease) {
      return { success: false, message: 'Không tìm thấy hợp đồng thuê đang hiệu lực cho kỳ hóa đơn này' };
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({
        where: {
          leaseId: lease.id,
          billingYear: parsed.data.billingYear,
          billingMonth: parsed.data.billingMonth,
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error('INVOICE_EXISTS');
      }

      return createInvoiceFromLease(
        tx,
        lease,
        parsed.data.billingYear,
        parsed.data.billingMonth,
        parsed.data.utilityAmount,
        parsed.data.otherFeeAmount
      );
    });

    return {
      success: true,
      message: 'Đã tạo hóa đơn thành công',
      data: { invoiceId: invoice.id.toString() },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'INVOICE_EXISTS') {
      return { success: false, message: 'Hóa đơn cho hợp đồng và tháng này đã tồn tại' };
    }

    return { success: false, ...normalizeActionError(error, 'Không thể tạo hóa đơn') };
  }
}

export async function listScopedInvoices(
  payload: ListInvoicesInput = { status: 'ALL' }
): Promise<ActionResponse<{ invoices: InvoiceListItem[]; summary: InvoiceSummary }>> {
  const parsed = listInvoicesSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');
    await expirePastActiveLeases();

    const where = invoiceWhereForSession(session, parsed.data);
    await markOverdueInvoices(invoiceWhereForSession(session, {
      propertyId: parsed.data.propertyId || null,
      billingYear: parsed.data.billingYear,
      billingMonth: parsed.data.billingMonth,
    }));

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        payments: { select: { paidAmount: true, verificationStatus: true } },
        lease: {
          include: {
            tenant: { select: { fullName: true, email: true } },
            unit: {
              include: {
                property: { select: { id: true, propertyName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'desc' }, { issuedAt: 'desc' }],
    });

    const mapped = invoices.map((invoice) => {
      const totals = invoicePaymentTotals(invoice.payments, invoice.totalAmount);
      return {
        invoiceId: invoice.id.toString(),
        invoiceCode: invoice.invoiceCode,
        propertyId: invoice.lease.unit.property.id.toString(),
        propertyName: invoice.lease.unit.property.propertyName,
        unitCode: invoice.lease.unit.unitCode,
        tenantName: invoice.lease.tenant.fullName,
        tenantEmail: invoice.lease.tenant.email,
        billingYear: invoice.billingYear,
        billingMonth: invoice.billingMonth,
        rentAmount: invoice.rentAmount.toString(),
        utilityAmount: invoice.utilityAmount.toString(),
        managementFeeAmount: invoice.managementFeeAmount.toString(),
        penaltyAmount: invoice.penaltyAmount.toString(),
        otherFeeAmount: invoice.otherFeeAmount.toString(),
        totalAmount: invoice.totalAmount.toString(),
        dueDate: toDateString(invoice.dueDate),
        status: invoice.status,
        verifiedPaidTotal: totals.verifiedPaidTotal.toString(),
        remainingBalance: totals.remainingBalance.toString(),
        pendingPaymentCount: totals.pendingPaymentCount,
      };
    });

    const summary = mapped.reduce(
      (current, invoice) => ({
        totalInvoiced: current.totalInvoiced.plus(invoice.totalAmount),
        totalPaid: current.totalPaid.plus(invoice.verifiedPaidTotal),
        totalRemaining: current.totalRemaining.plus(invoice.remainingBalance),
        pendingReviewCount: current.pendingReviewCount + invoice.pendingPaymentCount,
        overdueCount: current.overdueCount + (invoice.status === 'OVERDUE' ? 1 : 0),
      }),
      {
        totalInvoiced: decimal(0),
        totalPaid: decimal(0),
        totalRemaining: decimal(0),
        pendingReviewCount: 0,
        overdueCount: 0,
      }
    );

    return {
      success: true,
      data: {
        invoices: mapped,
        summary: {
          totalInvoiced: summary.totalInvoiced.toString(),
          totalPaid: summary.totalPaid.toString(),
          totalRemaining: summary.totalRemaining.toString(),
          pendingReviewCount: summary.pendingReviewCount,
          overdueCount: summary.overdueCount,
        },
      },
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải danh sách hóa đơn') };
  }
}

export async function listTenantInvoices(): Promise<ActionResponse<TenantInvoiceItem[]>> {
  try {
    const session = await requireRole(['TENANT']);
    const tenantId = parseId(session.userId);

    await markOverdueInvoices({
      lease: {
        tenantId,
      },
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        lease: {
          tenantId,
        },
      },
      include: {
        payments: {
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            paymentMethod: true,
            transferReference: true,
            paidAmount: true,
            paymentNote: true,
            submittedAt: true,
            verifiedAt: true,
            verificationStatus: true,
            verificationNote: true,
          },
        },
        lease: {
          include: {
            tenant: { select: { fullName: true, email: true } },
            unit: {
              include: {
                property: {
                  select: {
                    id: true,
                    propertyName: true,
                    paymentReceivingAccounts: {
                      where: { isActive: true },
                      orderBy: { createdAt: 'desc' },
                      take: 1,
                      select: {
                        id: true,
                        propertyId: true,
                        bankCode: true,
                        bankName: true,
                        accountNumber: true,
                        accountName: true,
                        transferNoteTemplate: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'desc' }, { issuedAt: 'desc' }],
    });

    return {
      success: true,
      data: invoices.map((invoice) => {
        const totals = invoicePaymentTotals(invoice.payments, invoice.totalAmount);
        const account = mapReceivingAccount(
          invoice.lease.unit.property.paymentReceivingAccounts[0] ?? null
        );
        return {
          invoiceId: invoice.id.toString(),
          invoiceCode: invoice.invoiceCode,
          propertyId: invoice.lease.unit.property.id.toString(),
          propertyName: invoice.lease.unit.property.propertyName,
          unitCode: invoice.lease.unit.unitCode,
          tenantName: invoice.lease.tenant.fullName,
          tenantEmail: invoice.lease.tenant.email,
          billingYear: invoice.billingYear,
          billingMonth: invoice.billingMonth,
          rentAmount: invoice.rentAmount.toString(),
          utilityAmount: invoice.utilityAmount.toString(),
          managementFeeAmount: invoice.managementFeeAmount.toString(),
          penaltyAmount: invoice.penaltyAmount.toString(),
          otherFeeAmount: invoice.otherFeeAmount.toString(),
          totalAmount: invoice.totalAmount.toString(),
          dueDate: toDateString(invoice.dueDate),
          status: invoice.status,
          verifiedPaidTotal: totals.verifiedPaidTotal.toString(),
          remainingBalance: totals.remainingBalance.toString(),
          pendingPaymentCount: totals.pendingPaymentCount,
          canSubmitPayment:
            !totals.remainingBalance.isZero() && totals.pendingPaymentCount === 0,
          paymentInstruction: paymentInstructionForInvoice(
            invoice.invoiceCode,
            totals.remainingBalance.toString(),
            account
          ),
          payments: invoice.payments.map((payment) => ({
            paymentId: payment.id.toString(),
            paymentMethod: payment.paymentMethod,
            transferReference: payment.transferReference,
            paidAmount: payment.paidAmount.toString(),
            paymentNote: payment.paymentNote,
            submittedAt: payment.submittedAt.toISOString(),
            verifiedAt: payment.verifiedAt?.toISOString() ?? null,
            verificationStatus: payment.verificationStatus,
            verificationNote: payment.verificationNote,
          })),
        };
      }),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải hóa đơn của người thuê') };
  }
}

export async function listPendingPaymentProofs(): Promise<ActionResponse<PaymentReviewItem[]>> {
  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const payments = await prisma.payment.findMany({
      where: {
        verificationStatus: 'PENDING',
        invoice: invoiceWhereForSession(session),
      },
      include: {
        payer: { select: { fullName: true, email: true } },
        invoice: {
          include: {
            lease: {
              include: {
                unit: {
                  include: {
                    property: { select: { propertyName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      success: true,
      data: payments.map((payment) => ({
        paymentId: payment.id.toString(),
        invoiceId: payment.invoice.id.toString(),
        invoiceCode: payment.invoice.invoiceCode,
        propertyName: payment.invoice.lease.unit.property.propertyName,
        unitCode: payment.invoice.lease.unit.unitCode,
        payerName: payment.payer.fullName,
        payerEmail: payment.payer.email,
        paidAmount: payment.paidAmount.toString(),
        paymentMethod: payment.paymentMethod,
        transferReference: payment.transferReference,
        paymentNote: payment.paymentNote,
        submittedAt: payment.submittedAt.toISOString(),
        verificationStatus: payment.verificationStatus,
      })),
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải chứng từ thanh toán') };
  }
}

export async function verifyPayment(payload: PaymentReviewInput): Promise<ActionResponse> {
  const parsed = paymentReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const payment = await prisma.payment.findUnique({
      where: { id: parseId(parsed.data.paymentId) },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: { select: { propertyId: true } },
              },
            },
          },
        },
      },
    });

    if (!payment || payment.verificationStatus !== 'PENDING') {
      return { success: false, message: 'Không tìm thấy chứng từ thanh toán đang chờ duyệt' };
    }

    await assertPropertyAccess(session, payment.invoice.lease.unit.propertyId);

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedById: parseId(session.userId),
          verifiedAt: new Date(),
          verificationNote: toNullableString(parsed.data.verificationNote),
        },
      });
      await recalculateInvoiceStatusAfterPayment(payment.invoiceId, tx);
    });

    return { success: true, message: 'Đã xác nhận thanh toán' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể xác nhận thanh toán') };
  }
}

export async function rejectPayment(payload: PaymentReviewInput): Promise<ActionResponse> {
  const parsed = paymentReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const payment = await prisma.payment.findUnique({
      where: { id: parseId(parsed.data.paymentId) },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: { select: { propertyId: true } },
              },
            },
          },
        },
      },
    });

    if (!payment || payment.verificationStatus !== 'PENDING') {
      return { success: false, message: 'Không tìm thấy chứng từ thanh toán đang chờ duyệt' };
    }

    await assertPropertyAccess(session, payment.invoice.lease.unit.propertyId);

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          verificationStatus: 'REJECTED',
          verifiedById: parseId(session.userId),
          verifiedAt: new Date(),
          verificationNote: toNullableString(parsed.data.verificationNote),
        },
      });
      await recalculateInvoiceStatusAfterPayment(payment.invoiceId, tx);
    });

    return { success: true, message: 'Đã từ chối thanh toán' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể từ chối thanh toán') };
  }
}

export async function getPaymentProofSignedUrl(
  payload: SignedProofUrlInput
): Promise<ActionResponse<{ signedUrl: string }>> {
  const parsed = signedProofUrlSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireSession();
    const payment = await prisma.payment.findUnique({
      where: { id: parseId(parsed.data.paymentId) },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: { select: { propertyId: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { success: false, message: 'Không tìm thấy thanh toán' };
    }

    if (isTenant(session)) {
      if (payment.payerId !== parseId(session.userId)) {
        throw new Error('FORBIDDEN');
      }
    } else {
      await assertPropertyAccess(session, payment.invoice.lease.unit.propertyId);
    }

    if (payment.paymentProofPath) {
      const signedUrl = await createPaymentProofSignedUrl(payment.paymentProofPath);
      return { success: true, data: { signedUrl } };
    }

    if (payment.paymentProofUrl) {
      return { success: true, data: { signedUrl: payment.paymentProofUrl } };
    }

    return { success: false, message: 'Thanh toán này chưa có tệp chứng từ đính kèm' };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể mở chứng từ thanh toán') };
  }
}

export async function upsertPropertyReceivingAccount(
  payload: ReceivingAccountInput
): Promise<ActionResponse<PaymentReceivingAccountData>> {
  const parsed = receivingAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await requireRole(['OWNER', 'ADMIN']);
    const propertyId = parseId(parsed.data.propertyId);
    await assertPropertyOwner(session, propertyId);

    const created = await prisma.$transaction(async (tx) => {
      await tx.paymentReceivingAccount.updateMany({
        where: { propertyId, isActive: true },
        data: { isActive: false },
      });

      return tx.paymentReceivingAccount.create({
        data: {
          propertyId,
          bankCode: parsed.data.bankCode.toUpperCase(),
          bankName: parsed.data.bankName,
          accountNumber: parsed.data.accountNumber,
          accountName: parsed.data.accountName,
          transferNoteTemplate:
            toNullableString(parsed.data.transferNoteTemplate) || 'Thanh toán {invoiceCode}',
          isActive: true,
        },
        select: {
          id: true,
          propertyId: true,
          bankCode: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
          transferNoteTemplate: true,
        },
      });
    });

    return {
      success: true,
      message: 'Đã lưu tài khoản nhận tiền',
      data: mapReceivingAccount(created)!,
    };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể lưu tài khoản nhận tiền') };
  }
}

export async function getPropertyReceivingAccount(payload: {
  propertyId: string;
}): Promise<ActionResponse<PaymentReceivingAccountData | null>> {
  const parsed = idSchema.safeParse(payload.propertyId);
  if (!parsed.success) {
    return { success: false, errors: { propertyId: ['Mã tài sản phải là chuỗi số'] } };
  }

  try {
    const session = await requireSession();
    if (isTenant(session)) throw new Error('FORBIDDEN');

    const propertyId = parseId(parsed.data);
    await assertPropertyAccess(session, propertyId);

    const account = await prisma.paymentReceivingAccount.findFirst({
      where: { propertyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        propertyId: true,
        bankCode: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        transferNoteTemplate: true,
      },
    });

    return { success: true, data: mapReceivingAccount(account) };
  } catch (error) {
    return { success: false, ...normalizeActionError(error, 'Không thể tải tài khoản nhận tiền') };
  }
}
