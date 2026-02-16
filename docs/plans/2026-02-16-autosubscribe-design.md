# Autosubscribe Feature Design

**Date:** 2026-02-16
**Branch:** feature/add-autosubscribe

## Overview

Replace the hardcoded department-admin auto-subscribe logic with a configurable subscribers list per department. Department admins and superusers can manage who gets auto-subscribed to new tasks. Department admins are automatically added/removed from this list when their role changes.

## Definition of Done

- Department admin and superuser can add "subscribers" to a department
- All users on the subscribers list are automatically subscribed when a new task is created
- Department admins are automatically added/removed from the list on role changes
- Warning shown when removing a department admin that they will also be removed as subscriber
- Retroactive: all current department admins populated into the subscribers list via migration

## Data Model

### New table: `areas_subscribers`

| Column       | Type    | Notes                                      |
|--------------|---------|--------------------------------------------|
| `id`         | INTEGER | PK, auto-increment                         |
| `area_id`    | INTEGER | FK → areas.id, NOT NULL                    |
| `user_id`    | INTEGER | FK → users.id, NOT NULL                    |
| `added_by`   | INTEGER | FK → users.id, NOT NULL                    |
| `source`     | STRING  | 'manual' or 'admin_role'                   |
| `created_at` | DATETIME|                                            |
| `updated_at` | DATETIME|                                            |

- Unique constraint on `(area_id, user_id)`
- `source` tracks why the user is on the list: `'admin_role'` for auto-added dept admins, `'manual'` for explicitly added users
- No department membership restriction — any user in the system can be a subscriber

### Sequelize associations

- `Area.belongsToMany(User, { through: AreasSubscriber, as: 'Subscribers' })`
- `User.belongsToMany(Area, { through: AreasSubscriber, as: 'SubscribedAreas' })`

## Backend Logic Changes

### 1. Replace `subscribeDepartmentAdmins()`

Current behavior: queries `areas_members` for admins → subscribes each to the task.

New behavior: queries `areas_subscribers` for the task creator's department → subscribes each to the task.

Same non-blocking pattern, same skip-owner logic, different source table.

### 2. Auto-manage subscribers on admin role changes

In `areaMembershipService.js`:

- **`addAreaMember()` / `updateMemberRole()` → role becomes 'admin':** Insert into `areas_subscribers` with `source = 'admin_role'` (idempotent, skip if exists)
- **`updateMemberRole()` → role changes from 'admin' to 'member':** Remove from `areas_subscribers` where `source = 'admin_role'` only
- **`removeAreaMember()` → removing an admin:** Remove from `areas_subscribers` where `source = 'admin_role'`

Manually-added subscribers (`source = 'manual'`) are unaffected by admin role changes.

### 3. New API endpoints

| Method   | Path                                    | Auth               | Description                                                |
|----------|-----------------------------------------|---------------------|------------------------------------------------------------|
| `GET`    | `/departments/:uid/subscribers`         | dept admin, superuser | List subscribers (includes `source` field)                |
| `POST`   | `/departments/:uid/subscribers`         | dept admin, superuser | Add subscriber. Body: `{ user_id, retroactive: boolean }` |
| `DELETE` | `/departments/:uid/subscribers/:userId` | dept admin, superuser | Remove subscriber                                         |

- `POST` with `retroactive: true` subscribes the user to all existing tasks in the department
- Authorization reuses `canManageAreaMembers()`

### 4. One-time migration

Migration inserts all current department admins into `areas_subscribers` with `source = 'admin_role'`. Transaction-based, idempotent.

## Frontend UI Changes

### Location

Inside the existing `AreaMembers.tsx` component (department members modal).

### New "Subscribers" section

Added below existing members management, separated by a divider:

1. **Header:** "Subscribers" with subtitle "These users are automatically subscribed to new tasks in this department"

2. **Subscriber list:** Each row shows:
   - Avatar + name/email
   - Badge: "Admin" (for `source = 'admin_role'`, non-removable) or "Manual" (removable)
   - Remove button (only for `source = 'manual'`)

3. **Add subscriber:** User picker (same pattern as member list) with:
   - "Add" button per user
   - Dropdown on click: "Future tasks only" or "All existing + future tasks"
   - Calls `POST /departments/:uid/subscribers` with `{ user_id, retroactive }`

4. **Admin removal warning:** When changing admin role to member or removing admin, show confirmation:
   - "Removing [Name] as department admin will also remove them from the auto-subscribers list. They will keep existing task subscriptions but won't be auto-subscribed to new tasks. Continue?"
   - Only shown if user exists in `areas_subscribers` with `source = 'admin_role'`

### New service functions in `areasService.ts`

- `getAreaSubscribers(areaUid)` → GET
- `addAreaSubscriber(areaUid, userId, retroactive)` → POST
- `removeAreaSubscriber(areaUid, userId)` → DELETE

### Read-only mode

Subscribers section visible but add/remove controls hidden.

## Testing Strategy

### Backend unit tests (`taskSubscriptionService.test.js`)

- Update existing `subscribeDepartmentAdmins` tests to use `areas_subscribers` table
- Subscribers from list get subscribed to new tasks
- Task owner skipped even if on subscribers list
- Empty subscribers list = no errors

### Backend integration tests (`areas-subscribers.test.js`)

**Positive:**
- `GET /departments/:uid/subscribers` returns list with source field
- `POST /departments/:uid/subscribers` adds subscriber, validates authorization
- `POST` with `retroactive: true` subscribes to all existing tasks
- `DELETE /departments/:uid/subscribers/:userId` removes manual subscriber
- Only dept admin and superuser can manage subscribers

**Negative:**
- `POST` subscriber already on list → 409 conflict
- `DELETE` subscriber not on list → 404
- `POST`/`DELETE` by regular member → 403
- `POST` with invalid/nonexistent user_id → 404
- `POST`/`GET`/`DELETE` on nonexistent department → 404
- `POST` with missing user_id → 400

### Admin role lifecycle integration tests

**Positive:**
- Promote to admin → added to `areas_subscribers` with `source = 'admin_role'`
- Demote to member → removed from `areas_subscribers` (admin_role only)
- Remove admin from department → removed from `areas_subscribers`
- Manually-added subscriber survives admin demotion

**Negative:**
- Demote admin who was also manually added → manual entry persists
- Remove non-admin member → no effect on subscribers list

### Frontend tests

**Positive:**
- Subscribers list renders correctly
- Add/remove subscriber calls correct API
- Retroactive dropdown appears on add
- Admin-sourced subscribers show non-removable badge
- Warning dialog shown when demoting/removing admin subscriber

**Negative:**
- Admin-sourced subscriber has no remove button
- Read-only user cannot see add/remove controls

### Migration test

- Verify migration populates `areas_subscribers` for all existing dept admins
- Idempotent: running twice doesn't create duplicates
