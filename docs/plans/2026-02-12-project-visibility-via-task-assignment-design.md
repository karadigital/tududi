# ASID-867: Project Visibility via Task Assignment

## Overview

Implement role-based project visibility so users see projects based on their role, department membership, and task involvement.

## Access Rules

### System Admin (`is_admin = true`)
- Sees ALL projects in project listing
- Sees ALL tasks in ALL views (today, upcoming, task lists, project detail)
- Full read-write access everywhere

### Department Admin (area owner or `role='admin'` in `areas_members`)
- **Project listing** sees:
  - Projects they own (created)
  - Projects assigned to their department (`area_id`)
  - Projects where any department member has tasks (owned or assigned)
  - Projects explicitly shared with them
- **Project detail page**: ALL tasks in the project (read-only for tasks they don't own/aren't assigned to)
- **Task views** (today, upcoming, etc.): Current behavior unchanged (own tasks + department members' tasks)

### Department Member (`role='member'` in `areas_members`)
- **Project listing** sees:
  - Projects they own (created)
  - Projects in their department (`area_id`)
  - Projects where they have at least 1 task (owned or assigned)
  - Projects explicitly shared with them
- **Project detail page**: ALL tasks in the project (read-only for tasks they don't own/aren't assigned to)
- **Task views**: Only their own tasks (current behavior)

## Implementation

All changes are in **one file**: `backend/services/permissionsService.js`

No changes needed in:
- `backend/routes/projects.js` (project detail already returns all tasks once access is granted)
- `backend/routes/tasks/queries/query-builders.js` (task views keep current behavior)
- Frontend (API just returns more projects)

### Change 1: Admin bypass for projects in `ownershipOrPermissionWhere`

Add early return for admin users when `resourceType === 'project'`, mirroring the existing task admin bypass:

```js
if (isUserAdmin && resourceType === 'project') {
    const result = {};
    if (cache) cache.set(cacheKey, result);
    return result; // empty WHERE = all projects
}
```

### Change 2: Include task-owned projects in `ownershipOrPermissionWhere`

Current SQL only checks `assigned_to_user_id`. Change to also include `user_id` (task creator):

```sql
SELECT DISTINCT project_id FROM tasks
WHERE (assigned_to_user_id = :userId OR user_id = :userId)
AND project_id IS NOT NULL
```

### Change 3: Dept admin project visibility in `ownershipOrPermissionWhere`

After the assigned/owned project query, if the user is a department admin, find additional projects where any department member has tasks:

```sql
SELECT DISTINCT project_id FROM tasks
WHERE (assigned_to_user_id IN (:memberUserIds) OR user_id IN (:memberUserIds))
AND project_id IS NOT NULL
```

Reuses existing `getDepartmentMemberUserIds()`. Results merge into `conditions` array.

### Change 4: Fix `getAccess` for projects

Add three checks after the owner check, all granting `RO`:

1. **Department membership**: If project has `area_id`, check if user is a member of that area
2. **Task ownership**: Expand current `assigned_to_user_id` check to also include `user_id` (task creator)
3. **Dept admin member-tasks**: If user is a dept admin, check if any department members have tasks in the project

## Edge Cases

- **User in multiple dept roles**: Conditions are additive (OR), works correctly
- **Project has no `area_id`**: Department membership check skipped, falls through to task-based checks
- **Dept admin with no members**: `getDepartmentMemberUserIds` returns empty array, query skipped
- **Performance**: `getDepartmentMemberUserIds` is already cached per-request via `cache` param. `getAccess` (single-project middleware) adds one extra query only when needed

## Testing

- Admin sees all projects regardless of ownership/department
- Dept admin sees projects in their department
- Dept admin sees projects where department members have tasks
- Dept admin sees all tasks on project detail page (read-only)
- Dept member sees projects where they own or are assigned tasks
- Dept member sees all tasks on project detail page (read-only)
- Regular user (no department) sees only owned/shared/assigned projects
- Write access still restricted to project owner and explicitly shared users
