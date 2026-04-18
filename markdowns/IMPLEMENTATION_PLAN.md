# Implementation Plan

## Development Strategy
Develop the system incrementally, validating each end-to-end workflow before proceeding. Ensure strict adherence to the defined architecture and avoid introducing unnecessary tools.

### Phase 0: Project Setup
- Initialize Next.js project with TypeScript and Tailwind.
- Configure PostgreSQL database, Prisma schema, and run initial seeds.
- Set up linting, formatting, and routing foundations.

### Phase 1: Authentication & Authorization
- Implement role-based login structure (Owner, Manager, Tenant).
- Secure API endpoints and establish UI routing protections based on active sessions.

### Phase 2: Core Data Management
- Implement robust CRUD operations for **Properties** and **Units**.
- Include validations to prevent duplicate identifiers and seamlessly manage occupancy states.

### Phase 3: Lease Lifecycle
- Configure **Leases** to link Tenants accurately to specific Units.
- Enforce business logic related to rent amounts, due dates, management fees, and deposit storage.

### Phase 4: Financial Workflow (Invoices & Payments)
- **Invoices:** Enable generation and tracking of monthly utility and rent invoices.
- **Payments:** Provide the Tenant proof-of-payment upload feature.
- **Verification Loop:** Provide Managers/Owners the interface to review payment proofs, verifying or rejecting them to auto-update invoice statuses.

Implementation direction:
- Generate invoices from active leases by owner/manager-triggered monthly batch creation or one-off invoice creation.
- Use VietQR/manual bank transfer instructions for Vietnam rent payments, with VNPAY/MoMo/ZaloPay reserved for future gateway work.
- Store payment proof files in a private Supabase Storage bucket and expose them only through authorized signed URLs.
- Allow partial payments, block overpayments, and keep rejected payment attempts in history.

### Phase 5: Operations & Analytics 
- Create **Expense** logging functionality to track categorized outgoing costs against properties.
- Design **Dashboards** compiling actionable metrics (e.g., occupancy rates, total revenue, expected cash flows).
- Deploy an **Alerting** mechanism to flag critical conditions: impending lease expirations, overdue invoices, and vacant units.

Implementation direction:
- Add a protected reset-style demo seed with realistic owners, managers, tenants, properties, units, leases, invoices, payments, expenses, and alerts.
- Owners can manage expenses for owned properties; assigned managers can create expenses and void only expenses they created.
- Revenue means verified payments only; outstanding balances are invoice totals minus verified payments.
- Generate operational alerts on dashboard/revenue/notification load using idempotent alert keys instead of scheduled cron.
- Tenants only see personal invoice and lease alerts; owner/manager operational alerts stay scoped to authorized properties.

### Phase 6: Polish, Testing, & Optimization
- Refine UI interactions, enforcing consistency in empty states, loading indicators, and error messaging.
- Conduct final end-to-end traversal of all user scenarios.
- Audit the codebase to remove redundancies prior to submission.
