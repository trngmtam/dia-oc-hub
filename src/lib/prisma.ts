import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Global Prisma singleton instance to prevent multiple connections in dev 
// during hot reloading

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString() {
  const rawConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!rawConnectionString) {
    throw new Error('Missing DATABASE_URL or DIRECT_URL.');
  }

  if (rawConnectionString.includes('sslmode=require')) {
    return rawConnectionString.replace(
      'sslmode=require',
      'sslmode=require&uselibpqcompat=true'
    );
  }

  const joiner = rawConnectionString.includes('?') ? '&' : '?';
  return `${rawConnectionString}${joiner}sslmode=require&uselibpqcompat=true`;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool({ connectionString: getConnectionString() });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const pool = new Pool({ connectionString: getConnectionString() });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
