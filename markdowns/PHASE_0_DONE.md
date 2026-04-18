# Phase 0 Done: Project Setup and Foundation

## Status
Implemented.

## What is in the repo

- Next.js App Router project under `src/app`
- TypeScript enabled in strict mode
- Tailwind CSS configured
- Prisma configured for PostgreSQL
- `.env.example` committed and `.env` ignored
- seed script in `prisma/seed.ts`
- checked-in Prisma migrations in `prisma/migrations`
- ESLint configured
- `.nvmrc` present for Node version consistency

## What changed from the original plan

- The root page now redirects to `/login` instead of showing the default Next.js landing page.
- The schema is implemented in Prisma, but status-like fields are mostly strings rather than Prisma enums.
- The Prisma seed command uses `tsx` rather than the older `ts-node` example.

## Verified project foundation

- `npm run dev` works
- `npm run lint` works
- `npm run typecheck` works
- Prisma client generation works
- Prisma schema sync works with the configured database

## Important notes for teammates

- `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` are required.
- Google OAuth is optional and only needed if the team wants Google login locally.
- The project currently uses a real shared database connection, so teammates should be careful when running destructive data changes.
