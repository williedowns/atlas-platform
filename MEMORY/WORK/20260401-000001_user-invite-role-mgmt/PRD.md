---
task: Build user invite and role management for admin
slug: 20260401-000001_user-invite-role-mgmt
effort: extended
phase: complete
progress: 18/18
mode: interactive
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Context

Admin page has a Users card with a disabled "+ Invite" button and static role badges. Need to build the full invite + role management flow. Supabase `auth.admin` requires service role key (never exposed to client) so a server-side API route is required. Roles: admin, manager, sales_rep, bookkeeper, field_crew.

### Risks
- SUPABASE_SERVICE_ROLE_KEY must be env var — never in client code
- Invite only sends email if Supabase SMTP is configured in project settings
- Profile row may or may not exist when invite is sent (depends on trigger) — upsert defensively
- Role changes must be admin-only — verify role on every API call

## Criteria

### Admin Supabase Client
- [ ] ISC-1: src/lib/supabase/admin.ts created using SUPABASE_SERVICE_ROLE_KEY
- [ ] ISC-2: createAdminClient() exported and uses createClient from @supabase/supabase-js

### Invite API Route
- [ ] ISC-3: POST /api/admin/invite route created
- [ ] ISC-4: Route verifies calling user has admin role before proceeding
- [ ] ISC-5: Route calls supabase.auth.admin.inviteUserByEmail with email and metadata
- [ ] ISC-6: Route upserts profile row with full_name and role after invite
- [ ] ISC-7: Route returns 401 for non-admin, 400 for missing fields, 200 on success

### Update Role API Route
- [ ] ISC-8: PATCH /api/admin/users/[id] route created
- [ ] ISC-9: Route verifies calling user has admin role before proceeding
- [ ] ISC-10: Route updates profiles table role field for target user id
- [ ] ISC-11: Route returns 401 for non-admin, 200 on success

### InviteUserButton Component
- [ ] ISC-12: InviteUserButton renders as client component with modal/sheet UI
- [ ] ISC-13: Modal contains email field, full_name field, and role selector
- [ ] ISC-14: Role selector shows all 5 roles with human-readable labels
- [ ] ISC-15: Submit calls POST /api/admin/invite and shows success/error state

### UserRoleEditor Component
- [ ] ISC-16: UserRoleEditor renders inline role selector per user row
- [ ] ISC-17: Selecting a role calls PATCH /api/admin/users/[id] immediately
- [ ] ISC-18: Admin page wires InviteUserButton and UserRoleEditor into Users card

## Decisions

## Verification
