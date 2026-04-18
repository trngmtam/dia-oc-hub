# Phase 2 Done: Core Data Management for Properties and Units

## Status
Implemented.

## What is in the repo

- property validation and actions in `src/features/properties/*`
- unit validation and actions in `src/features/units/*`
- owner property list, create, edit, detail, and unit management pages
- manager property list, create, detail, and unit management pages within assigned scope
- dashboard metrics connected to live database queries
- duplicate prevention and friendly validation errors

## Main implemented routes

### Owner
- `/owner/properties`
- `/owner/properties/new`
- `/owner/properties/[id]`
- `/owner/properties/[id]/edit`
- `/owner/properties/[id]/units/new`
- `/owner/properties/[id]/units/[unitId]/edit`

### Manager
- `/manager/properties`
- `/manager/properties/new`
- `/manager/properties/[id]`
- `/manager/properties/[id]/units/new`
- `/manager/properties/[id]/units/[unitId]/edit`

## Important business rules now implemented

- property codes are protected against duplicates
- unit codes are unique per property
- unit edit flow exists
- units and properties may be archived instead of hard-deleted when historical data must be preserved
- managers can only work within their assigned property scope

## What changed from the original plan

- the app supports both owner and manager property workflows, not just manager-facing pages
- delete logic evolved into archive-preserving behavior for historical data
- manager property edit is not a dedicated `/manager/properties/[id]/edit` page in the same way the original plan described; the current flow is centered on detail pages and unit operations

## Verified behaviors

- property CRUD is connected to the database
- unit CRUD is connected to the database
- dashboard metrics use live data instead of static numbers
- validation and duplicate handling return user-friendly errors
