# Task Permissions Design

## Overview

Implement clear rules for who can edit and delete tasks based on their role.

## Permission Matrix

| Role | View | Edit | Delete |
|------|------|------|--------|
| Creator/Owner | ✅ | ✅ | ✅ |
| Assignee | ✅ | ✅ | ❌ |
| Subscriber | ✅ | ❌ | ❌ |
| Super Admin | ✅ | ✅ | ✅ |

## Error Messages

- **Delete attempt by non-owner:**
  `"You are not allowed to delete this task. Please contact the creator if you want to make this change."`

- **Edit attempt by subscriber:**
  `"You are not allowed to edit this task. Please contact the creator if you want to make this change."`

## Implementation

### 1. permissionsService.js

Add `canDeleteTask(userId, taskUid)` function:
- Returns `true` if user is task owner (`user_id`) or super admin
- Returns `false` otherwise

### 2. access.js middleware

Add `requireTaskDeleteAccess` middleware:
- Uses `canDeleteTask()` to check permission
- Returns 403 with custom error message if not authorized

### 3. tasks/index.js routes

- Change DELETE `/task/:uid` route from `requireTaskWriteAccess` to `requireTaskDeleteAccess`

### 4. authorize.js

- Update `hasAccess()` to support custom forbidden messages
- Update `requireTaskWriteAccess` to use custom edit error message

## Files to Modify

1. `backend/services/permissionsService.js`
2. `backend/routes/tasks/middleware/access.js`
3. `backend/routes/tasks/index.js`
4. `backend/middleware/authorize.js`

## Testing

- Unit tests for `canDeleteTask()` function
- Integration tests for DELETE endpoint with different user roles
- Integration tests for PATCH endpoint with subscriber role
