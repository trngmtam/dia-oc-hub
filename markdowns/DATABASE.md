# Database Design

## Strategy overview

The schema uses PostgreSQL through Prisma and is designed around strong relational integrity for property, lease, billing, and assignment workflows.

## Main entity groups

- `roles`, `users`
- `properties`, `units`
- `property_manager_assignments`
- `property_manager_invite_codes`, `manager_assignment_requests`
- `leases`
- `unit_invite_codes`, `unit_connection_requests`
- `invoices`, `payments`
- `payment_receiving_accounts`
- `expenses`
- `alerts`, `alert_recipients`
- `auth_accounts`

## Important business rules reflected in code

1. Role-based ownership and visibility are enforced server-side.
2. A lease is the real tenant-to-unit contract record.
3. Pending tenant and manager onboarding flows are stored as request records, not as draft assignments in the final tables.
4. Historical operational data should be preserved for reporting, even when a property or unit is archived from active use.
5. Financial values use Prisma `Decimal` mappings for accuracy.
6. Payment proof files are stored outside the database in private Supabase Storage; the database stores the object path and review metadata.
7. Property-level receiving accounts provide VietQR/manual bank transfer instructions for tenant invoice payments.
8. Expenses are voided instead of deleted so operational history remains auditable.
9. Alerts use unique dedupe keys so repeated dashboard loads update existing alerts instead of creating duplicates.

## Environment note

For local development and CLI work:

- `DATABASE_URL` can point to the pooled connection.
- `DIRECT_URL` should point to the direct PostgreSQL connection.

This matters for Prisma commands such as `db push`, `migrate`, `studio`, and `seed`.

## Demo data note

The normal seed keeps setup light by creating roles and demo users only.

For full end-to-end testing, run the protected demo reset seed against a test database:

```bash
ALLOW_DEMO_DB_RESET=true npm run db:seed:demo
```

This deletes app data and recreates a rich dataset for owners, managers, tenants, properties, units, leases, invoices, payments, expenses, and alerts.

## Storage note

Phase 4 requires a private Supabase Storage bucket for payment proofs.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PAYMENT_PROOFS_BUCKET`
- `PAYMENT_PROOF_MAX_MB`

The service role key must only be used server-side.
