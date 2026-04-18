import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const rawConnectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!rawConnectionString) {
  throw new Error('Missing DIRECT_URL or DATABASE_URL for seeding.')
}

// Fix Supabase self-signed cert issue with the 'pg' driver
const connectionString = rawConnectionString.replace(
  'sslmode=require',
  'sslmode=require&uselibpqcompat=true'
)

const pool = new Pool({
  connectionString,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10)

  console.log('Seeding roles...')
  await prisma.role.createMany({
    data: [
      { name: 'OWNER' },
      { name: 'MANAGER' },
      { name: 'TENANT' },
      { name: 'ADMIN' },
    ],
    skipDuplicates: true,
  })

  console.log('Seeding users...')
  const roles = await prisma.role.findMany()
  const roleMap: Record<string, bigint> = {}
  roles.forEach((r) => {
    roleMap[r.name] = r.id
  })

  const users = [
    { fullName: 'Nguyen Minh Chau', email: 'owner@pmh.com', phone: '0909000001', passwordHash: defaultPasswordHash, roleId: roleMap['OWNER'], status: 'ACTIVE' },
    { fullName: 'Tran Gia Huy', email: 'manager@pmh.com', phone: '0909000002', passwordHash: defaultPasswordHash, roleId: roleMap['MANAGER'], status: 'ACTIVE' },
    { fullName: 'Le Bao Han', email: 'tenant1@pmh.com', phone: '0909000003', passwordHash: defaultPasswordHash, roleId: roleMap['TENANT'], status: 'ACTIVE' },
    { fullName: 'Pham Quoc Viet', email: 'tenant2@pmh.com', phone: '0909000004', passwordHash: defaultPasswordHash, roleId: roleMap['TENANT'], status: 'ACTIVE' },
    { fullName: 'Vo Thu Trang', email: 'tenant3@pmh.com', phone: '0909000005', passwordHash: defaultPasswordHash, roleId: roleMap['TENANT'], status: 'ACTIVE' },
    { fullName: 'Nguyen Hoang Nam', email: 'tenant4@pmh.com', phone: '0909000006', passwordHash: defaultPasswordHash, roleId: roleMap['TENANT'], status: 'ACTIVE' },
    { fullName: 'System Admin', email: 'admin@pmh.com', phone: '0909000007', passwordHash: defaultPasswordHash, roleId: roleMap['ADMIN'], status: 'ACTIVE' },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        phone: user.phone,
        passwordHash: user.passwordHash,
        roleId: user.roleId,
        status: user.status,
      },
      create: user,
    })
  }

  console.log('Seeding complete. Default password for demo users: Password123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
