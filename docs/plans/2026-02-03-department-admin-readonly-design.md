# Department Admin Read-Only Access for Tasks

**Date:** 2026-02-03
**Branch:** feature/ASID-744-department-admin-readonly

## Summary

Change department admin permissions so they can no longer edit tasks owned by department members. Their access level changes from read-write (rw) to read-only (ro).

## Requirements

| Aspect | Behavior |
|--------|----------|
| Task visibility in lists | ✅ Unchanged - can see department member tasks |
| View task details (GET) | ✅ Allowed - read-only access |
| Edit task (PATCH/DELETE) | ❌ Blocked - 403 Forbidden |

## Implementation

### Code Change

**File:** `/backend/services/permissionsService.js` (lines 109-111)

```javascript
// Before (read-write access)
const memberUserIds = await getDepartmentMemberUserIds(userId);
if (memberUserIds.includes(t.user_id)) return ACCESS.RW;

// After (read-only access)
const memberUserIds = await getDepartmentMemberUserIds(userId);
if (memberUserIds.includes(t.user_id)) return ACCESS.RO;
```

### Test Updates

**File:** `/backend/tests/integration/department-admin-task-visibility.test.js`

Update existing tests and add:
- Department admin can GET task details (200 OK)
- Department admin cannot PATCH task (403 Forbidden)
- Department admin cannot DELETE task (403 Forbidden)
- Department admin still sees tasks in task list queries

## Risk Assessment

- **Risk Level:** Low
- **Scope:** Single permission check change
- **Rollback:** Change `ACCESS.RO` back to `ACCESS.RW`

## Testing Plan

1. Run existing department admin tests (expect some to fail initially)
2. Update test assertions to match new behavior
3. Add new test cases for read-only enforcement
4. Run full test suite to ensure no regressions
