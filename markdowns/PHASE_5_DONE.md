# Phase 5 Done - Operations, Analytics, Alerts, and Demo Data

## Summary

Phase 5 adds the operational reporting layer on top of the existing property, lease, invoice, and payment workflows.

Implemented:

- protected full demo database seed
- expense logging and voiding
- owner and manager revenue pages
- upgraded dashboard financial metrics
- idempotent operational alerts
- notification pages for owner, manager, and tenant roles

## Demo Seed

The normal seed remains lightweight.

The full demo seed is reset-style and must be explicitly enabled:

```bash
ALLOW_DEMO_DB_RESET=true npm run db:seed:demo
```

The demo seed creates owners, managers, tenants, properties, units, leases, invoices, payments, receiving accounts, expenses, and alerts.

## Routes

- `/owner/revenue`
- `/manager/revenue`
- `/owner/notifications`
- `/manager/notifications`
- `/tenant/notifications`

## Business Rules

- Owners can manage expenses for owned properties.
- Assigned managers can create expenses for assigned properties.
- Assigned managers can void only expenses they created.
- Expenses are voided instead of hard-deleted.
- Revenue counts verified payments only.
- Pending and rejected payments do not count as revenue.
- Alerts use dedupe keys to avoid duplicates.
- Tenant notifications are limited to tenant-owned invoice and lease alerts.

## Verification

Run:

```bash
npm run db:generate
npx prisma validate
npm run check
```

Optional demo seed verification:

```bash
ALLOW_DEMO_DB_RESET=true npm run db:seed:demo
```
