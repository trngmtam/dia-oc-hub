# Phase 1 Done: Authentication and Authorization

## Status
Implemented.

## What is in the repo

- custom JWT cookie authentication
- login server action in `src/features/auth/auth.actions.ts`
- session helpers in `src/lib/session.ts`
- role-based middleware in `src/middleware.ts`
- login page in `src/app/(auth)/login/page.tsx`
- manual registration for owner, manager, and tenant users
- optional Google login and onboarding flow

## Implemented routes

- `/login`
- `/register`
- `/register/owner`
- `/register/manager`
- `/register/tenant`
- `/auth/google/start`
- `/auth/google/callback`
- `/onboarding/google`

## What changed from the original plan

- Auth logic is implemented in `auth.actions.ts`, not in a separate `auth.service.ts`.
- Login is handled with a Server Action, not a dedicated `/api/auth/login` route.
- Route protection is focused on app routes plus the Google auth/onboarding public paths.
- Google auth was added later as an extension of the custom auth system.

## Security behaviors present

- users must be `ACTIVE` to sign in
- invalid credentials return safe messages
- JWT cookie is required for protected owner, manager, and tenant routes
- users are redirected back to their own dashboard if they try to open another role's area
- `JWT_SECRET` is required

## Verified behaviors

- manual login works for seeded users
- manual registration works for owner, manager, and tenant
- logout route exists and clears session
- Google auth flow is implemented, but requires Google credentials in `.env` to be usable locally
