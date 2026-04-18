# Project Structure

The repository uses a practical feature-oriented structure that matches the current codebase.

## Directory Layout

```txt
nha-dat-pro/
|-- prisma/                     # Prisma schema, config, and seed script
|-- public/                     # Static assets
|-- markdowns/                  # Project docs, phase notes, and testing guides
|-- src/
|   |-- app/                    # Next.js App Router pages, layouts, and route handlers
|   |   |-- (auth)/login        # Public login page
|   |   |-- auth/google         # Google OAuth start/callback routes
|   |   |-- onboarding/google   # First-time Google onboarding flow
|   |   |-- register/           # Role-based registration pages
|   |   |-- owner/              # Owner views
|   |   |-- manager/            # Manager views
|   |   `-- tenant/             # Tenant views
|   |-- components/             # Reusable UI and page-level components
|   |   |-- auth/               # Login, register, and onboarding UI
|   |   |-- alerts/             # Notification center UI
|   |   |-- expenses/           # Revenue and expense management UI
|   |   |-- layout/             # Shared shell, navigation, sidebar
|   |   |-- leases/             # Lease approval UI
|   |   `-- units/              # Unit edit UI
|   |-- features/               # Domain actions, validation, and types
|   |   |-- alerts/
|   |   |-- auth/
|   |   |-- dashboard/
|   |   |-- expenses/
|   |   |-- leases/
|   |   |-- managerAssignments/
|   |   |-- invoices/
|   |   |-- properties/
|   |   `-- units/
|   |-- lib/                    # Shared helpers like prisma, auth, session, invite codes
|   |-- hooks/                  # Custom hooks
|   |-- types/                  # Shared global types
|   `-- middleware.ts           # Route protection and role redirects
|-- .env.example                # Safe example environment file
|-- README.md                   # Main setup guide
`-- CONTRIBUTING.md             # Collaboration workflow for teammates
```

## Important architectural notes

1. This project relies heavily on Server Actions for mutations.
2. Business logic is grouped by domain under `src/features/*`.
3. Prisma calls currently live directly inside domain action files; the repo does not use a separate repository/service layer yet.
4. Role-based routing is enforced in `src/middleware.ts` and session helpers.
5. The UI is Vietnamese, while most implementation details are written in English.
