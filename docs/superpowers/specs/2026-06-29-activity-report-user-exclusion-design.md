# Per-user exclusion from the email activity report

**Date:** 2026-06-29
**Status:** Approved — ready for implementation plan

## Problem

The daily email activity report (and the admin activity dashboard) decides who
to include by a hardcoded `@karadigital.co` email-domain filter, duplicated in
three places. Internal staff are excluded; everyone else is included. There is
no way to include or exclude an individual user without changing code.

## Goal

Replace the hardcoded domain filter with a per-user `exclude_from_activity_reports`
boolean, toggled by admins from a new tab in the existing activity admin page.
Behavior for current users is preserved via a one-time backfill.

## Decisions (resolved during brainstorming)

1. **Mechanism:** per-user boolean flag on the `User` model. Not a domain list,
   not both.
2. **Default migration:** backfill existing `@karadigital.co` users to
   `excluded = true`, then remove the hardcoded domain filter entirely. The flag
   becomes the single source of truth. Future signups are NOT auto-excluded.
3. **Control:** admin-only. No self-service opt-out.
4. **UI placement:** a new tab inside `AdminActivityPage.tsx` (which already has
   a `trends`/`daily` tab system and owns all report config) — not the user-edit
   modal, not a new route or nav entry.

## Design

### 1. Data model

- New column `users.exclude_from_activity_reports` — `BOOLEAN NOT NULL DEFAULT false`.
- Migration `20260629000000-add-exclude-from-activity-reports-to-users.js`:
  - Add the column via `safeAddColumns` (existing migration helper).
  - Backfill:
    `UPDATE users SET exclude_from_activity_reports = true WHERE LOWER(email) LIKE '%@karadigital.co'`.
    This preserves today's behavior for existing staff.
  - `down`: `removeColumn`.
- Add the field to `backend/models/user.js` alongside the other boolean flags.

### 2. Backend filter — single source of truth

Delete the hardcoded `EXCLUDED_DOMAIN` / `isExcluded` / `isExcludedEmail`
constants from both files and replace the filter with the flag in all three
`User.findAll` spots:

- `backend/services/activityReportService.js` — `getActivityDataForDate` (the
  emailed report).
- `backend/routes/activity.js` — `GET /admin/activity` summary.
- `backend/routes/activity.js` — `GET /admin/activity/trends`.

In each: add `exclude_from_activity_reports` to the `attributes` list and change
the filter to `!u.exclude_from_activity_reports` (drop the email-domain check).

### 3. Admin API — reuse existing routes, no new endpoints

- `GET /admin/users` (`backend/routes/admin.js`): add
  `exclude_from_activity_reports` to the `attributes` array and to the response
  map.
- `PUT /admin/users/:id`: read `exclude_from_activity_reports` from the body;
  if provided, coerce to boolean and save.
- `POST /admin/users`: accept it on create (optional; column default handles the
  common case).

### 4. Admin UI — new tab in `AdminActivityPage.tsx`

- Extend `TabType` to add `'report-users'`; add a third tab button next to
  Trends and Daily.
- New render block: a table of all users (name / email) with a toggle switch per
  row, reusing the existing inline toggle markup (the peer-checkbox switch
  already used for recipients). Switch ON = included in report, OFF = excluded.
- Toggling calls the API and shows a `useToast` success/error, matching the
  existing recipient handlers.
- `AddUserModal` is untouched.

New functions in `frontend/utils/activityService.ts`, mirroring the existing
recipient CRUD pattern (`getApiPath` + `handleAuthResponse`):

- `fetchAdminUsers()` → `GET admin/users`
- `setUserActivityExclusion(id, excluded)` → `PUT admin/users/${id}` with body
  `{ exclude_from_activity_reports }`

### 5. Test

One backend test covering the load-bearing logic: with two users (one flagged
`exclude_from_activity_reports = true`, one not) and activity for both, the
report data includes only the unflagged user. Reuse the existing activity test
setup.

## Out of scope (YAGNI — add later if asked)

- Self-service opt-out from a user's own settings page.
- Domain-list / bulk-rule configuration.
- Bulk toggle UI (select-all / multi-select).
- Auto-excluding future `@karadigital.co` signups (was a side effect of the old
  domain filter; intentionally dropped).
