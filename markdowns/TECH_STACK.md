# Tech Stack Specifications

## Framework and language

- Next.js 16 App Router
- React 19
- TypeScript

## Frontend

- Tailwind CSS 4
- React Hook Form
- Zod
- Lucide React
- Framer Motion

## Backend

- Next.js Server Actions for most mutations
- Route Handlers for selected endpoints such as auth callback/logout flows
- Custom JWT cookie session auth

## Database

- PostgreSQL
- Prisma 7
- `pg` driver
- `@prisma/adapter-pg`
- Supabase Storage for private payment proof uploads

## Authentication

- Manual email/password login and registration
- Optional Google OAuth
- Role-based access for owner, manager, tenant, and admin data records

## Quality tooling

- ESLint
- TypeScript strict mode
- Prisma seed script with demo users
- Protected full demo reset seed for end-to-end testing

## Deployment direction

- Vercel for app hosting
- Supabase Postgres or another PostgreSQL provider for the database
