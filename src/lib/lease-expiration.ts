import 'server-only';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

function todayAtStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function expirePastActiveLeases(where: Prisma.LeaseWhereInput = {}) {
  const today = todayAtStart();

  const expiredLeases = await prisma.lease.findMany({
    where: {
      ...where,
      status: 'ACTIVE',
      endDate: { lt: today },
    },
    select: {
      id: true,
      unitId: true,
    },
  });

  if (expiredLeases.length === 0) {
    return 0;
  }

  const leaseIds = expiredLeases.map((lease) => lease.id);
  const unitIds = [...new Set(expiredLeases.map((lease) => lease.unitId))];

  await prisma.$transaction([
    prisma.lease.updateMany({
      where: {
        id: { in: leaseIds },
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        terminationRequestedAt: null,
        terminationRequestedNote: null,
      },
    }),
    prisma.unit.updateMany({
      where: {
        id: { in: unitIds },
        occupancyStatus: 'OCCUPIED',
      },
      data: {
        occupancyStatus: 'VACANT',
        vacantSince: today,
      },
    }),
  ]);

  return expiredLeases.length;
}
