import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

if (process.env.ALLOW_DEMO_DB_RESET !== 'true') {
  throw new Error('Refusing to reset demo data. Set ALLOW_DEMO_DB_RESET=true to run this seed.');
}

const rawConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!rawConnectionString) {
  throw new Error('Missing DATABASE_URL or DIRECT_URL for demo seeding.');
}

function connectionStringWithSsl(raw: string) {
  if (raw.includes('sslmode=require')) {
    return raw.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
  }

  const joiner = raw.includes('?') ? '&' : '?';
  return `${raw}${joiner}sslmode=require&uselibpqcompat=true`;
}

const pool = new Pool({ connectionString: connectionStringWithSsl(rawConnectionString) });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const password = 'Password123!';

function money(value: number) {
  return new Prisma.Decimal(value);
}

function today() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(days: number) {
  const value = today();
  value.setDate(value.getDate() + days);
  return value;
}

function monthOffset(offset: number) {
  const base = today();
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return {
    year: target.getFullYear(),
    month: target.getMonth() + 1,
  };
}

function dueDate(offset: number, day: number) {
  const base = today();
  return new Date(base.getFullYear(), base.getMonth() + offset, day);
}

function invoiceCode(prefix: string, leaseId: bigint, offset: number) {
  const month = monthOffset(offset);
  return `DEMO-${prefix}-${month.year}${String(month.month).padStart(2, '0')}-L${leaseId.toString()}`;
}

async function clearData() {
  await prisma.alertRecipient.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.unitConnectionRequest.deleteMany();
  await prisma.unitInviteCode.deleteMany();
  await prisma.managerAssignmentRequest.deleteMany();
  await prisma.propertyManagerInviteCode.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.propertyManagerAssignment.deleteMany();
  await prisma.paymentReceivingAccount.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
}

async function seedRoles() {
  const roles = await Promise.all(
    ['OWNER', 'MANAGER', 'TENANT', 'ADMIN'].map((name) => prisma.role.create({ data: { name } }))
  );

  return Object.fromEntries(roles.map((role) => [role.name, role.id]));
}

async function seedUsers(roleIds: Record<string, bigint>) {
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = [
    ['owner', 'Nguyen Minh Chau', 'owner@pmh.com', '0909000001', 'OWNER'],
    ['owner2', 'Doan Thanh Lam', 'owner2@pmh.com', '0909000008', 'OWNER'],
    ['manager', 'Tran Gia Huy', 'manager@pmh.com', '0909000002', 'MANAGER'],
    ['manager2', 'Bui Minh Anh', 'manager2@pmh.com', '0909000009', 'MANAGER'],
    ['tenant1', 'Le Bao Han', 'tenant1@pmh.com', '0909000003', 'TENANT'],
    ['tenant2', 'Pham Quoc Viet', 'tenant2@pmh.com', '0909000004', 'TENANT'],
    ['tenant3', 'Vo Thu Trang', 'tenant3@pmh.com', '0909000005', 'TENANT'],
    ['tenant4', 'Nguyen Hoang Nam', 'tenant4@pmh.com', '0909000006', 'TENANT'],
    ['tenant5', 'Dang Thao Nhi', 'tenant5@pmh.com', '0909000010', 'TENANT'],
    ['tenant6', 'Hoang Tuan Kiet', 'tenant6@pmh.com', '0909000011', 'TENANT'],
    ['admin', 'System Admin', 'admin@pmh.com', '0909000007', 'ADMIN'],
  ] as const;

  const users: Record<string, { id: bigint; fullName: string }> = {};
  for (const [key, fullName, email, phone, role] of rows) {
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        roleId: roleIds[role],
        status: 'ACTIVE',
      },
      select: { id: true, fullName: true },
    });
    users[key] = user;
  }

  return users;
}

async function createProperty(
  ownerId: bigint,
  propertyCode: string,
  propertyName: string,
  district: string,
) {
  const property = await prisma.property.create({
    data: {
      ownerId,
      propertyCode,
      propertyName,
      addressLine: `${propertyName}, Ho Chi Minh City`,
      ward: 'Ward 1',
      district,
      city: 'Ho Chi Minh City',
      propertyType: 'APARTMENT',
      totalUnits: 4,
      status: 'ACTIVE',
    },
  });

  const units = await Promise.all(
    [1, 2, 3, 4].map((index) => prisma.unit.create({
      data: {
        propertyId: property.id,
        unitCode: String(index).padStart(2, '0'),
        unitName: `${propertyName} ${String(index).padStart(2, '0')}`,
        floorNumber: index,
        bedroomCount: index === 4 ? 3 : 2,
        bathroomCount: 2,
        areaSqm: money(index === 4 ? 92 : 72 + index),
        furnishingStatus: 'FURNISHED',
        defaultMonthlyRent: money(7200000 + index * 450000),
        defaultDeposit: money(15000000),
        occupancyStatus: index === 4 ? 'VACANT' : 'OCCUPIED',
        vacantSince: index === 4 ? addDays(-18) : null,
      },
    }))
  );

  await prisma.paymentReceivingAccount.create({
    data: {
      propertyId: property.id,
      bankCode: 'VCB',
      bankName: 'Vietcombank',
      accountNumber: `102000${property.id.toString().padStart(4, '0')}`,
      accountName: 'DIA OC HUB DEMO',
      transferNoteTemplate: 'Thanh toan {invoiceCode}',
      isActive: true,
    },
  });

  return { property, units };
}

async function createInvoiceWithPayments(args: {
  leaseId: bigint;
  tenantId: bigint;
  codePrefix: string;
  monthOffset: number;
  total: number;
  rent: number;
  managementFee: number;
  status: string;
  dueDay: number;
  payments?: {
    amount: number;
    status: string;
    reference: string;
    verifiedById?: bigint;
    note?: string;
  }[];
}) {
  const month = monthOffset(args.monthOffset);
  const invoice = await prisma.invoice.create({
    data: {
      leaseId: args.leaseId,
      invoiceCode: invoiceCode(args.codePrefix, args.leaseId, args.monthOffset),
      billingYear: month.year,
      billingMonth: month.month,
      rentAmount: money(args.rent),
      managementFeeAmount: money(args.managementFee),
      utilityAmount: money(args.total - args.rent - args.managementFee),
      penaltyAmount: money(0),
      otherFeeAmount: money(0),
      totalAmount: money(args.total),
      dueDate: dueDate(args.monthOffset, args.dueDay),
      status: args.status,
    },
  });

  for (const payment of args.payments ?? []) {
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        payerId: args.tenantId,
        paymentMethod: 'BANK_TRANSFER_QR',
        transferReference: payment.reference,
        paidAmount: money(payment.amount),
        paymentProofUrl: `demo://${payment.reference}.jpg`,
        paymentProofPath: `demo/payment-proofs/${payment.reference}.jpg`,
        paymentNote: payment.note ?? null,
        verifiedById: payment.status === 'VERIFIED' || payment.status === 'REJECTED'
          ? payment.verifiedById ?? null
          : null,
        verifiedAt: payment.status === 'VERIFIED' || payment.status === 'REJECTED'
          ? addDays(-1)
          : null,
        verificationStatus: payment.status,
        verificationNote: payment.status === 'REJECTED' ? 'Demo rejected payment proof' : null,
      },
    });
  }

  return invoice;
}

async function main() {
  console.log('Resetting database for full demo seed...');
  await clearData();

  console.log('Creating roles and users...');
  const roleIds = await seedRoles();
  const users = await seedUsers(roleIds);

  console.log('Creating properties, units, manager assignments, and leases...');
  const riverpark = await createProperty(users.owner.id, 'PMH-RIVER', 'Riverpark Premier', 'District 7');
  const garden = await createProperty(users.owner.id, 'PMH-GARDEN', 'Garden Court Residence', 'District 7');
  const skyline = await createProperty(users.owner2.id, 'PMH-SKY', 'Skyline Central', 'Binh Thanh');
  const orchard = await createProperty(users.owner2.id, 'PMH-ORCHARD', 'Orchard Heights', 'Thu Duc');

  const assignment1 = await prisma.propertyManagerAssignment.create({
    data: {
      propertyId: riverpark.property.id,
      managerId: users.manager.id,
      startDate: addDays(-90),
      salaryType: 'FIXED_MONTHLY',
      baseSalary: money(9000000),
      status: 'ACTIVE',
    },
  });
  const assignment2 = await prisma.propertyManagerAssignment.create({
    data: {
      propertyId: garden.property.id,
      managerId: users.manager.id,
      startDate: addDays(-70),
      salaryType: 'COMMISSION',
      baseSalary: money(5000000),
      commissionRate: money(0.05),
      status: 'ACTIVE',
    },
  });
  const assignment3 = await prisma.propertyManagerAssignment.create({
    data: {
      propertyId: skyline.property.id,
      managerId: users.manager2.id,
      startDate: addDays(-45),
      salaryType: 'FIXED_MONTHLY',
      baseSalary: money(8500000),
      status: 'ACTIVE',
    },
  });

  const leaseSpecs = [
    [riverpark.units[0], users.tenant1.id, addDays(-120), addDays(20), 5, 8200000, 1200000, 'ACTIVE'],
    [riverpark.units[1], users.tenant2.id, addDays(-160), addDays(210), 10, 9000000, 1000000, 'ACTIVE'],
    [riverpark.units[2], users.tenant1.id, addDays(-20), addDays(310), 15, 7600000, 900000, 'ACTIVE'],
    [garden.units[0], users.tenant3.id, addDays(-90), addDays(90), 5, 7200000, 800000, 'ACTIVE'],
    [garden.units[1], users.tenant4.id, addDays(-80), addDays(120), 12, 8100000, 900000, 'ACTIVE'],
    [skyline.units[0], users.tenant5.id, addDays(-200), addDays(-40), 8, 11000000, 1200000, 'EXPIRED'],
    [skyline.units[1], users.tenant6.id, addDays(-190), addDays(-20), 18, 9800000, 1000000, 'TERMINATED'],
  ] as const;

  const leases = [];
  for (const [unit, tenantId, startDate, endDate, dueDayOfMonth, baseRent, managementFee, status] of leaseSpecs) {
    const lease = await prisma.lease.create({
      data: {
        unitId: unit.id,
        tenantId,
        startDate,
        endDate,
        dueDayOfMonth,
        baseRent: money(baseRent),
        depositAmount: money(baseRent * 2),
        managementFee: money(managementFee),
        utilityNote: 'Demo lease utilities are billed monthly.',
        status,
        terminatedAt: status === 'TERMINATED' ? addDays(-20) : null,
      },
    });
    leases.push(lease);
  }

  await prisma.unit.updateMany({
    where: { id: { in: [skyline.units[0].id, skyline.units[1].id, skyline.units[2].id, skyline.units[3].id, orchard.units[0].id, orchard.units[1].id, orchard.units[2].id, orchard.units[3].id] } },
    data: { occupancyStatus: 'VACANT', vacantSince: addDays(-21) },
  });

  console.log('Creating invoices and payments...');
  await createInvoiceWithPayments({
    leaseId: leases[0].id,
    tenantId: users.tenant1.id,
    codePrefix: 'OVERDUE',
    monthOffset: -1,
    total: 10200000,
    rent: 8200000,
    managementFee: 1200000,
    dueDay: 5,
    status: 'OVERDUE',
  });
  await createInvoiceWithPayments({
    leaseId: leases[1].id,
    tenantId: users.tenant2.id,
    codePrefix: 'PAID',
    monthOffset: 0,
    total: 10500000,
    rent: 9000000,
    managementFee: 1000000,
    dueDay: 10,
    status: 'PAID',
    payments: [{ amount: 10500000, status: 'VERIFIED', reference: 'DEMO-PAID-001', verifiedById: users.owner.id }],
  });
  await createInvoiceWithPayments({
    leaseId: leases[2].id,
    tenantId: users.tenant1.id,
    codePrefix: 'PARTIAL',
    monthOffset: 0,
    total: 9100000,
    rent: 7600000,
    managementFee: 900000,
    dueDay: 15,
    status: 'PARTIALLY_PAID',
    payments: [{ amount: 4500000, status: 'VERIFIED', reference: 'DEMO-PARTIAL-001', verifiedById: users.manager.id }],
  });
  await createInvoiceWithPayments({
    leaseId: leases[3].id,
    tenantId: users.tenant3.id,
    codePrefix: 'PENDING',
    monthOffset: 0,
    total: 8400000,
    rent: 7200000,
    managementFee: 800000,
    dueDay: 5,
    status: 'PENDING_REVIEW',
    payments: [{ amount: 8400000, status: 'PENDING', reference: 'DEMO-PENDING-001' }],
  });
  await createInvoiceWithPayments({
    leaseId: leases[4].id,
    tenantId: users.tenant4.id,
    codePrefix: 'REJECTED',
    monthOffset: -1,
    total: 9600000,
    rent: 8100000,
    managementFee: 900000,
    dueDay: 12,
    status: 'OVERDUE',
    payments: [{ amount: 9600000, status: 'REJECTED', reference: 'DEMO-REJECTED-001', verifiedById: users.manager.id }],
  });

  console.log('Creating expenses...');
  const expenseRows = [
    [riverpark.property.id, riverpark.units[0].id, assignment1.id, 'MAINTENANCE', 1800000, 'AC Service Co'],
    [riverpark.property.id, riverpark.units[1].id, assignment1.id, 'REPAIR', 2200000, 'Saigon Repair'],
    [riverpark.property.id, null, assignment1.id, 'CLEANING', 950000, 'Clean Home'],
    [garden.property.id, garden.units[0].id, assignment2.id, 'UTILITY', 1250000, 'EVN Demo'],
    [garden.property.id, null, assignment2.id, 'MANAGEMENT', 5000000, 'Manager Payroll'],
    [skyline.property.id, null, assignment3.id, 'TAX', 3200000, 'Tax Office'],
    [skyline.property.id, skyline.units[2].id, assignment3.id, 'MARKETING', 1700000, 'Listing Ads'],
    [orchard.property.id, null, null, 'INSURANCE', 2800000, 'Bao Viet Demo'],
    [orchard.property.id, orchard.units[0].id, null, 'SUPPLIES', 650000, 'Supplies Shop'],
    [orchard.property.id, null, null, 'OTHER', 400000, 'Misc Vendor'],
  ] as const;

  for (const [propertyId, unitId, assignmentId, category, amount, vendorName] of expenseRows) {
    const createdById = assignmentId === assignment3.id
      ? users.manager2.id
      : assignmentId
        ? users.manager.id
        : users.owner2.id;

    await prisma.expense.create({
      data: {
        propertyId,
        unitId,
        assignmentId,
        category,
        amount: money(amount),
        expenseDate: addDays(-Math.floor(amount / 100000) % 28),
        vendorName,
        note: `Demo ${category.toLowerCase()} expense`,
        receiptUrl: 'https://example.com/demo-receipt',
        createdById,
        status: 'ACTIVE',
      },
    });
  }

  await prisma.expense.create({
    data: {
      propertyId: riverpark.property.id,
      unitId: null,
      assignmentId: assignment1.id,
      category: 'OTHER',
      amount: money(300000),
      expenseDate: addDays(-10),
      vendorName: 'Voided Vendor',
      note: 'Demo voided expense for history testing',
      createdById: users.manager.id,
      status: 'VOIDED',
      voidedAt: addDays(-9),
      voidedById: users.owner.id,
    },
  });

  console.log('Creating demo alerts...');
  const overdueInvoice = await prisma.invoice.findFirstOrThrow({ where: { invoiceCode: { contains: 'OVERDUE' } } });
  const pendingInvoice = await prisma.invoice.findFirstOrThrow({ where: { invoiceCode: { contains: 'PENDING' } } });
  const alertRows = [
    {
      dedupeKey: `demo-overdue-invoice-${overdueInvoice.id.toString()}`,
      alertType: 'OVERDUE_INVOICE',
      title: 'Hoa don qua han',
      description: 'Demo alert for an overdue tenant invoice.',
      propertyId: riverpark.property.id,
      unitId: riverpark.units[0].id,
      leaseId: leases[0].id,
      invoiceId: overdueInvoice.id,
      severity: 'HIGH',
      recipients: [users.owner.id, users.manager.id, users.tenant1.id],
    },
    {
      dedupeKey: `demo-expiring-lease-${leases[0].id.toString()}`,
      alertType: 'LEASE_EXPIRING',
      title: 'Hop dong sap het han',
      description: 'Demo alert for a lease ending within 30 days.',
      propertyId: riverpark.property.id,
      unitId: riverpark.units[0].id,
      leaseId: leases[0].id,
      invoiceId: null,
      severity: 'MEDIUM',
      recipients: [users.owner.id, users.manager.id, users.tenant1.id],
    },
    {
      dedupeKey: `demo-vacant-unit-${riverpark.units[3].id.toString()}`,
      alertType: 'VACANT_UNIT',
      title: 'Can ho trong qua 7 ngay',
      description: 'Demo alert for a long-vacant unit.',
      propertyId: riverpark.property.id,
      unitId: riverpark.units[3].id,
      leaseId: null,
      invoiceId: null,
      severity: 'MEDIUM',
      recipients: [users.owner.id, users.manager.id],
    },
    {
      dedupeKey: `demo-pending-payment-${pendingInvoice.id.toString()}`,
      alertType: 'PENDING_PAYMENT_REVIEW',
      title: 'Thanh toan cho duyet',
      description: 'Demo alert for a payment proof awaiting verification.',
      propertyId: garden.property.id,
      unitId: garden.units[0].id,
      leaseId: leases[3].id,
      invoiceId: pendingInvoice.id,
      severity: 'HIGH',
      recipients: [users.owner.id, users.manager.id],
    },
  ];

  for (const row of alertRows) {
    const alert = await prisma.alert.create({
      data: {
        dedupeKey: row.dedupeKey,
        alertType: row.alertType,
        title: row.title,
        description: row.description,
        propertyId: row.propertyId,
        unitId: row.unitId,
        leaseId: row.leaseId,
        invoiceId: row.invoiceId,
        alertDate: today(),
        severity: row.severity,
        status: 'OPEN',
      },
    });

    await prisma.alertRecipient.createMany({
      data: row.recipients.map((userId) => ({
        alertId: alert.id,
        userId,
        notifiedAt: new Date(),
      })),
    });
  }

  console.log('Demo seed complete.');
  console.log(`Default password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
