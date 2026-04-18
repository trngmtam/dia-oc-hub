# Project Handover

This file is the main handover document for any teammate joining the project. Read this first before making code changes.

## 1. Project summary

**Nha Dat Pro** is a property management web app for:

- owners
- managers
- tenants

The project is built with:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 7
- PostgreSQL
- custom JWT cookie authentication
- optional Google OAuth
- Supabase Storage for private payment proof uploads

The UI is in Vietnamese. Most code and technical docs are in English.

## 2. Current project status

The repo is beyond the initial setup stage. The main working areas already implemented are:

- Phase 0: project foundation
- Phase 1: authentication and authorization
- Phase 2: property and unit management
- Phase 3: lease flow, tenant connection, and manager assignment
- Phase 4: invoices, VietQR/manual transfer instructions, and payment proof review
- Phase 5: full demo seed, expenses, revenue analytics, dashboard metrics, and notifications

This is active development code, not a blank starter template.

## 3. What is implemented

### Authentication

- manual login with email and password
- manual registration for owner, manager, and tenant users
- custom JWT cookie session
- role-based route protection
- optional Google login/signup flow with onboarding and confirmation

### Owner features

- owner dashboard
- property CRUD
- unit CRUD
- generate tenant invite codes
- generate manager invite codes
- review tenant connection requests
- review manager assignment requests
- create leases from approved tenant requests
- terminate leases
- remove/archive properties and units using history-preserving rules
- remove active manager assignments
- configure property receiving accounts
- generate rent invoices
- review and verify payment proofs
- view revenue analytics
- create, edit, and void property expenses
- view operational notifications

### Manager features

- manager dashboard
- request assignment to a property using invite code
- view assigned properties
- manage units within assigned scope
- review tenant requests in assigned properties
- create leases from approved tenant requests
- leave a property assignment
- generate invoices for assigned properties
- review payment proofs for assigned properties
- view revenue analytics for assigned properties
- create expenses for assigned properties
- void expenses they created
- view assigned-property notifications

### Tenant features

- tenant dashboard
- submit unit connection code
- view pending connection state
- view contract
- request early lease termination
- view invoices and upload payment proofs
- view personal notifications for overdue invoices and expiring leases

## 4. Important business logic already in place

- unit connection and manager assignment use invite-code + request tables, not fake draft leases
- occupied units cannot issue a fresh tenant invite code until the active lease is ended
- owners approve manager assignment requests
- owners and assigned managers can approve tenant connection requests
- historical data should be preserved instead of blindly deleted
- some removal flows archive records rather than permanently removing operational history
- only verified payments count toward invoice totals
- payment proof files are stored privately and opened through signed URLs
- revenue analytics count verified payments only
- expenses are voided rather than hard-deleted
- alerts use dedupe keys so repeated dashboard loads do not create duplicates

## 5. Main folders

- `src/app`: routes, layouts, route handlers
- `src/components`: reusable UI
- `src/features`: domain logic and validation
- `src/lib`: shared helpers like Prisma, auth, session, invite codes
- `prisma`: schema, migrations, and seed script
- `markdowns`: project docs

## 6. Environment setup for a new developer

### Required software

- Node.js 20
- npm
- Git
- PostgreSQL database access

### Required environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PAYMENT_PROOFS_BUCKET`
- `PAYMENT_PROOF_MAX_MB`

Optional for Google login:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

### Commands to run after cloning

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

For a full end-to-end test database, run this only against a test database:

```bash
ALLOW_DEMO_DB_RESET=true npm run db:seed:demo
```

### Demo login accounts

Seeded password:

```text
Password123!
```

Seeded accounts:

- `owner@pmh.com`
- `manager@pmh.com`
- `tenant1@pmh.com`
- `tenant2@pmh.com`
- `tenant3@pmh.com`
- `tenant4@pmh.com`
- `tenant5@pmh.com` when using the full demo seed
- `tenant6@pmh.com` when using the full demo seed
- `owner2@pmh.com` when using the full demo seed
- `manager2@pmh.com` when using the full demo seed
- `admin@pmh.com`

## 7. Commands developers should know

```bash
npm run dev
npm run lint
npm run typecheck
npm run check
npm run db:generate
npm run db:push
npm run db:seed
npm run db:seed:demo
npm run db:studio
```

## 8. Collaboration workflow

### Before starting work

1. Pull latest `main`
2. Create a feature branch
3. Make sure the app runs locally
4. Make sure `npm run check` passes

### Before pushing work

1. Run `npm run check`
2. If Prisma schema changed, also run:
   - `npm run db:generate`
   - `npm run db:push`
3. Update related markdown docs if behavior changed

### Do not commit

- `.env`
- secrets
- `.next`
- local-only test data

## 9. Database and Prisma notes

- Prisma is already configured and working
- checked-in migrations exist
- the repo currently uses `db push` in the setup guide for simplicity
- `DIRECT_URL` is important for Prisma CLI commands
- the normal seed script creates roles and demo users
- the full demo seed resets app data and creates realistic test records

Important caution:

- the team should avoid pointing local development at a production database
- if multiple students share one dev database, they should communicate before destructive data changes

## 10. Google auth notes

Google auth is optional.

If the env vars are missing:

- the app still works with manual auth
- the Google path is hidden or disabled in the UI

If the team wants Google auth locally, use a shared dev Google Cloud project and register:

- `http://localhost:3000/auth/google/callback`

## 11. Known caveats

- there are no automated tests yet, so manual testing is still important
- `npm run build` may fail if `.next` is locked by another running process
- some older docs were planning documents and do not describe the final implementation exactly

## 12. Docs teammates should read

Read these in this order:

1. `README.md`
2. `CONTRIBUTING.md`
3. `markdowns/HANDOVER.md`
4. `markdowns/PROJECT_OVERVIEW.md`
5. `markdowns/PROJECT_STRUCTURE.md`
6. `markdowns/PHASE_0_DONE.md`
7. `markdowns/PHASE_1_DONE.md`
8. `markdowns/PHASE_2_DONE.md`
9. `markdowns/PHASE_3_DONE.md`
10. `markdowns/PHASE_4_DONE.md`
11. `markdowns/PHASE_5_DONE.md`
12. `markdowns/MANUAL_TESTING_CHECKLIST.md`

## 13. Recommended first check for a new teammate

After setup, a new teammate should confirm all of these:

- `/login` loads
- they can log in with `owner@pmh.com`
- owner dashboard loads
- `npm run check` passes
- they understand which feature branch they are working on

If these pass, they are ready to start coding.
