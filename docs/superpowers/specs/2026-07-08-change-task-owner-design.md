# Change Task Owner — Design

**Date:** 2026-07-08
**Status:** Approved (pending spec review)

## Summary

Allow reassigning the **owner** of an already-created task. Owner is the
`Task.user_id` field (`Owner` association) — the permission anchor, distinct
from the existing **assignee** (`assigned_to_user_id`). Today `user_id` is set
at creation and never changeable. This feature adds a guarded "transfer
ownership" action, surfaced as a dropdown in the task edit form, mirroring the
existing assignee picker.

Owner drives cross-department visibility (the ASID-5 model), so transfer is a
guarded action with server-side authorization and candidate validation — not a
free-form field edit through the generic task PATCH.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | What is "owner"? | Task creator/owner = `Task.user_id` (the `Owner` association). Separate from assignee. |
| 2 | Who can transfer? | Current owner **or** a department (Area) admin of the task's department. |
| 3 | Who can be the new owner? | Members of the task's department only. |
| 4 | Old owner after transfer? | Loses ownership, nothing retained. Keeps only whatever access dept membership/admin grants. |
| 5 | UI location? | New collapsible "Owner" section in the task edit form. |

## Department Resolution Rule

Department = Area. A task reaches an Area via its Project (`project.area_id`).

- Task **has** a project → department = that project's Area. Candidates =
  members of that Area.
- Task has **no** project (`project_id` null) → department = the **current
  owner's** Area membership(s). Candidates = members of those Area(s).

This same rule is used both to (a) build the candidate list and (b) validate
the new owner server-side.

## Backend

### New endpoint: transfer owner

`POST /api/v1/task/:uid/transfer-owner`
Body: `{ new_owner_user_id: <int> }`

Modeled on the existing `POST /task/:uid/assign`
(`backend/routes/tasks/index.js:1008`) and its service
(`backend/services/taskAssignmentService.js`).

Flow:
1. Load task by `uid`. 404 if not found.
2. **Authorize requester (Decision 2):** allow if requester is the task's
   current owner (`task.user_id === req.currentUser.id`) OR requester is an
   admin of the task's department. Reuse the dept-admin check that
   `permissionsService`/`areaMembershipService` already expose. 403 otherwise.
3. **Resolve department** using the resolution rule above.
4. **Validate new owner (Decision 3):** `new_owner_user_id` must be a member
   of the resolved department. 403/422 otherwise.
5. Set `task.user_id = new_owner_user_id`; save.
6. **Old owner (Decision 4):** create no Permission row, remove nothing —
   owner access was implicit and simply ends.
7. Notify the new owner (reuse the assignment notification path in
   `taskAssignmentService`).
8. Return the updated task in the standard success shape.

Keep this as a dedicated endpoint (not via the generic `PATCH task/:uid`) so
`user_id` stays non-editable through the ordinary update path and the
guard/validation is explicit and testable.

### New endpoint: owner candidates

`GET /api/v1/task/:uid/owner-candidates`

Returns the users eligible to become owner (the resolved department's members),
in the same shape as `GET /users`
(`{ id, uid, email, name, surname, avatar_image, role }`) so
`SearchableUserDropdown` consumes it without changes. Requester must have
read access to the task.

### Files touched (backend)

- `backend/routes/tasks/index.js` — register both routes; guard with existing
  task-access middleware where applicable.
- `backend/services/taskAssignmentService.js` — add `transferOwner(...)` (or a
  sibling service) alongside `assignTask`/`unassignTask`.
- `backend/services/permissionsService.js` / `areaMembershipService.js` —
  reuse existing dept-admin and area-member lookups; add a small helper only
  if none fits.

## Frontend

- New `TaskOwnerSection.tsx` under `frontend/components/Task/TaskForm/`,
  mirroring `TaskAssigneeSection.tsx`. Reuses `SearchableUserDropdown`, but its
  candidate list comes from the `owner-candidates` endpoint (dept-scoped), not
  the full `GET /users`.
- Wire into `TaskMetadataSection.tsx` (pass `user_id` / current owner) and
  register a toggle in `TaskSectionToggle.tsx`
  (key `'owner'`, `hasValue: !!formData.user_id`).
- `frontend/utils/tasksService.ts` — add `transferOwner(taskUid, newOwnerId)`
  hitting `POST task/:uid/transfer-owner`, and a fetch for owner candidates.
  Kept separate from the generic `updateTask` PATCH.
- On selection change, call `transferOwner`; on success, refresh the task in
  the store.

### Interaction

The Owner section shows the current owner and a searchable dropdown of
candidates. Changing the selection immediately transfers ownership (like the
assignee section's behavior), not deferred to a form-wide save — matching the
dedicated-endpoint model. If the requester lacks transfer permission, the
section is read-only (dropdown disabled).

## Edge Cases

- **New owner === current owner:** no-op; return success without a redundant
  write/notification.
- **Task with no project and owner in no Area:** department resolves to empty →
  no candidates → dropdown shows only the current owner; transfer effectively
  disabled. Acceptable.
- **Critical-priority tasks** require an assignee (existing rule,
  `critical-validation.js`). Owner transfer does not touch the assignee, so the
  rule is unaffected.
- **`user_id` is `allowNull: false`** — always set a valid user; never clear it.

## Testing

**Backend**
- Owner can transfer to a dept member → `user_id` changes.
- Dept admin (non-owner) can transfer → succeeds.
- Non-owner, non-admin → 403.
- Candidate outside the department → 403/422, no change.
- New owner === current owner → success, no-op.
- Old owner loses access after transfer (assert via `getAccess`).
- `owner-candidates` returns only dept members.

**Frontend**
- Owner section renders with current owner.
- Dropdown lists only candidates from the endpoint.
- Selecting a candidate calls `transferOwner` with correct args.
- Section disabled when requester lacks permission.

## Out of Scope

- Inline owner control on the task card (form section only, Decision 5).
- Bulk owner reassignment.
- Merging owner and assignee concepts.
- Changing how assignment works.
