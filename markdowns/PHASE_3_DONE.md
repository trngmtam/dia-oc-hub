# Phase 3 Done: Lease Lifecycle, Tenant Connection, and Manager Assignment

## Status
Implemented.

## What is in the repo

- tenant connection to a unit through invite codes
- manager assignment to a property through invite codes
- request review inboxes for owner and manager roles
- lease creation from approved tenant requests
- tenant contract view and early termination request flow
- direct lease termination support for owner and assigned manager
- manager offboarding and owner-side manager removal flow

## Main implemented data additions

- `auth_accounts`
- `unit_invite_codes`
- `unit_connection_requests`
- `property_manager_invite_codes`
- `manager_assignment_requests`
- extra lease termination fields on `leases`

## Main implemented routes

### Public
- `/login`
- `/register`
- `/register/owner`
- `/register/manager`
- `/register/tenant`
- `/auth/google/start`
- `/auth/google/callback`
- `/onboarding/google`

### Tenant
- `/tenant/dashboard`
- `/tenant/contracts`

### Owner
- `/owner/dashboard`
- `/owner/properties`
- `/owner/properties/[id]`
- `/owner/requests`
- `/owner/requests/[requestId]/lease`

### Manager
- `/manager/dashboard`
- `/manager/properties`
- `/manager/requests`
- `/manager/requests/[requestId]/lease`

## Important implemented rules

- owners can approve manager assignment requests
- owners and assigned managers can approve tenant connection requests
- occupied units cannot issue a fresh tenant invite code until the active lease is ended
- archived history is preserved for reporting instead of being erased
- managers and tenants can have multiple pending requests across different targets, while final active ownership rules are still enforced server-side

## What changed from the original plan

- Phase 3 also includes Google auth onboarding work that supports the self-serve registration model
- property and unit removal behavior now favors archive/history preservation over strict blocking
- owner and manager offboarding controls were added after the initial Phase 3 plan

## Verified behaviors

- Prisma schema and migrations include the Phase 3 structures
- lease and request actions are implemented in server-side feature modules
- owner, manager, and tenant screens exist for the core Phase 3 flows
