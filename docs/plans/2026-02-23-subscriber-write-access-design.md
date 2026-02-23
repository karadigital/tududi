# Design: Subscriber Write Access

**Date:** 2026-02-23
**Status:** Approved

## Problem

Subscribers currently receive read-only (`ro`) access to tasks. Department admins also get read-only access to tasks created by their department members. Users need subscribers and department admins to have full write access to tasks they can see.

## Decision

Change the default access level for subscribers from `ro` to `rw` across the codebase, and upgrade department admin access to member tasks from `ro` to `rw`. Migrate existing subscription Permission records to match.

## Changes

### 1. taskSubscriptionService.js (line 88)

Change the Permission record created on task subscription:

```javascript
// Before
access_level: 'ro', // Subscribers have read-only access

// After
access_level: 'rw', // Subscribers have read-write access
```

### 2. permissionsService.js (line 163)

Change project-level subscriber access:

```javascript
// Before
if (subscribedInProject.length > 0) return ACCESS.RO;

// After
if (subscribedInProject.length > 0) return ACCESS.RW;
```

### 3. permissionsService.js (line 179)

Change department admin access to member tasks:

```javascript
// Before
if (memberUserIds.includes(t.user_id)) return ACCESS.RO;

// After
if (memberUserIds.includes(t.user_id)) return ACCESS.RW;
```

### 4. Database Migration

New migration to update existing Permission records:

```sql
UPDATE permissions
SET access_level = 'rw', updated_at = NOW()
WHERE propagation = 'subscription'
  AND access_level = 'ro';
```

With a matching down migration to revert:

```sql
UPDATE permissions
SET access_level = 'ro', updated_at = NOW()
WHERE propagation = 'subscription'
  AND access_level = 'rw';
```

## What This Enables

- Subscribers can edit all task fields (name, status, priority, due date, assignee, description, etc.)
- Department admins can edit tasks created by their department members
- Project-level subscriber access upgrades to RW (since it checks task subscription in the project)

## What Stays the Same

- Subscription/unsubscription logic
- Auto-subscription for department admins (just grants RW instead of RO)
- Task visibility queries (check for any Permission record, not access level)
- Delete access (owner + system admin only, via separate `requireTaskDeleteAccess`)
- API routes (already use `requireTaskWriteAccess` which checks `>= rw`)

## Tests to Update

Existing tests that assert subscribers get `ro` access need updating to expect `rw`. This includes:
- Permission service integration tests
- Task subscription service tests
- Any API tests that verify subscriber access level
