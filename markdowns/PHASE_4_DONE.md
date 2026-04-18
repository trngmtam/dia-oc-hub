# Phase 4 Done: Financial Workflow, Invoices, and Payments

## Status
Implemented.

## What is in the repo

- invoice validation and actions in `src/features/invoices/*`
- private Supabase payment proof storage helper in `src/lib/payment-proof-storage.ts`
- payment proof upload Route Handler at `POST /api/payments/proofs`
- owner invoice page at `/owner/invoices`
- manager invoice page at `/manager/invoices`
- tenant payment page at `/tenant/payments`
- tenant payment navigation in the shared sidebar
- Prisma migration for payment proof metadata and property receiving accounts

## Main implemented data additions

- `payment_receiving_accounts`
- `payments.payment_proof_path`
- `payments.verification_note`

## Important implemented rules

- invoices are generated from active leases for a selected billing month
- owner and manager invoice access is scoped server-side
- tenants can only see and pay their own invoices
- payment receiving accounts are property-level records
- owners configure receiving accounts; managers can view assigned-property payment instructions
- tenants upload proof files to a private Supabase Storage bucket
- proof files are opened through authorized signed URLs only
- partial payments are allowed
- overpayments are blocked
- only verified payments count toward invoice paid totals
- rejected payments remain in history and do not count toward totals
- invoices can move through `UNPAID`, `PENDING_REVIEW`, `PARTIALLY_PAID`, `PAID`, and `OVERDUE`

## What changed from the original plan

- Phase 4 uses VietQR/manual bank transfer plus proof review instead of live VNPAY/MoMo/ZaloPay checkout.
- Full payment gateway callbacks and automatic bank reconciliation are intentionally left for a future extension.
- Overdue invoice status is included, but alert records remain part of Phase 5.

## Required environment additions

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PAYMENT_PROOFS_BUCKET
PAYMENT_PROOF_MAX_MB
```

The `payment-proofs` bucket should be private.

## Verified behaviors

- Prisma client generation works after the schema change.
- `npm run lint` passes.
- `npm run typecheck` passes.
