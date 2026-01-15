# Critical Priority Feature Design

**Date:** 2026-01-14
**Status:** Approved
**Author:** Product design session

## Overview

Add a new "critical" priority level to tasks that enforces quality requirements: critical tasks must have both a due date and an assignee. This ensures high-priority work is properly scoped and assigned.

## Requirements

### Core Functionality
- Add "critical" as a fourth priority level (above high, medium, low)
- Critical tasks MUST have a due date
- Critical tasks MUST have an assignee
- Validation blocks setting priority to critical if either field is missing
- Critical tasks appear first when sorting by priority

### User Experience
- Error blocks immediately when user selects critical from dropdown
- Error message: "Critical tasks must have a due date and assignee"
- Visual: Red exclamation triangle icon (⚠️)
- No special task list styling in initial implementation

## Database & Backend Changes

### Task Model (`backend/models/task.js`)

**Current validation:**
```javascript
priority: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
        min: 0,
        max: 2,  // <- Change to 3
    },
}
```

**Updated validation:**
```javascript
priority: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
        min: 0,
        max: 3,  // Allow critical priority
    },
}
```

### Priority Mapping
- 0 = Low
- 1 = Medium
- 2 = High
- 3 = Critical (NEW)

### API Validation

**Endpoints to update:**
- `POST /api/v1/task` (create)
- `PATCH /api/v1/task/:uid` (update)

**Validation logic:**
```javascript
if (priority === 3 && (!due_date || !assigned_to)) {
    return res.status(400).json({
        error: 'Critical tasks must have a due date and assignee'
    });
}
```

**Response:**
- Status: 400 Bad Request
- Body: `{ "error": "Critical tasks must have a due date and assignee" }`

## Frontend Changes

### Type Definitions (`frontend/entities/Task.ts`)

```typescript
export type PriorityType = 'low' | 'medium' | 'high' | 'critical' | null;
```

### Priority Dropdown (`frontend/components/Shared/PriorityDropdown.tsx`)

**Add critical option:**
```typescript
{
    value: 'critical',
    label: t('priority.critical', 'Critical'),
    icon: <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-500" />
}
```

**Validation on selection:**
```typescript
const handleSelect = (priority: PriorityType) => {
    if (priority === 'critical' && (!dueDate || !assignedTo)) {
        showError(t('errors.critical_requires_fields'));
        return; // Block selection, keep previous value
    }
    onChange(priority);
    setIsOpen(false);
};
```

### Visual Design
- **Icon:** `ExclamationTriangleIcon` from `@heroicons/react/24/outline`
- **Color:** `text-red-600 dark:text-red-500` (bright red, distinct from high priority)
- **Task list styling:** Deferred to future implementation

### Sorting Logic (`frontend/utils/taskSortUtils.ts`)

**Priority order mapping:**
```typescript
const priorityOrder = {
    'critical': 3,  // Highest
    'high': 2,
    'medium': 1,
    'low': 0,
    null: -1        // Lowest (or 0)
}
```

Critical tasks naturally appear first when sorting by priority descending.

### Backend-to-Frontend Conversion

**Unchanged mapping:**
- Backend 0 → Frontend 'low'
- Backend 1 → Frontend 'medium'
- Backend 2 → Frontend 'high'
- Backend 3 → Frontend 'critical' (NEW)

## Translations

### New Translation Keys

```json
{
    "priority.critical": "Critical",
    "errors.critical_requires_fields": "Critical tasks must have a due date and assignee"
}
```

Add to all 24 supported languages.

## Testing Strategy

### Backend Tests

**Unit tests** (`backend/tests/unit/models/task.test.js`):
- ✓ Priority validation accepts 0-3
- ✓ Priority validation rejects 4 and above
- ✓ Priority validation rejects negative values

**Integration tests** (`backend/tests/integration/tasks.test.js`):
- ✓ Create task with critical priority + due date + assignee → 201 SUCCESS
- ✓ Create task with critical priority but no due date → 400 ERROR
- ✓ Create task with critical priority but no assignee → 400 ERROR
- ✓ Create task with critical priority missing both → 400 ERROR
- ✓ Update task to critical without required fields → 400 ERROR
- ✓ Update task to critical with required fields → 200 SUCCESS
- ✓ Verify error message content matches spec

### Frontend Tests

**Component tests** (`PriorityDropdown.test.tsx`):
- ✓ Critical option renders in dropdown
- ✓ Selecting critical with valid fields calls onChange
- ✓ Selecting critical without due date shows error
- ✓ Selecting critical without assignee shows error
- ✓ Error message displays correctly
- ✓ Priority selection reverts on validation failure

**Optional E2E tests** (Playwright):
- ✓ Full flow: create task → attempt critical → see validation block
- ✓ Full flow: create task with fields → set critical → success
- ✓ Verify critical tasks sort to top of list

## Implementation Checklist

### Backend
- [ ] Update Task model validation (max: 2 → max: 3)
- [ ] Add validation middleware for critical priority
- [ ] Update task creation endpoint
- [ ] Update task update endpoint
- [ ] Add backend unit tests
- [ ] Add backend integration tests

### Frontend
- [ ] Update PriorityType definition
- [ ] Add critical option to PriorityDropdown
- [ ] Import ExclamationTriangleIcon
- [ ] Add immediate validation on selection
- [ ] Update priority sorting logic
- [ ] Add frontend component tests
- [ ] Update all translation files (24 languages)

### Documentation
- [ ] Update API documentation
- [ ] Update user documentation (if exists)

## Future Enhancements (Out of Scope)

- Visual styling for critical tasks in task lists (badges, borders, background tint)
- Special notifications for critical tasks
- Dashboard widget showing all critical tasks
- Auto-escalation rules for overdue critical tasks
- Critical task analytics/reporting

## Migration Notes

**No data migration required.** All existing tasks have priority 0-2, which remain valid. The new critical priority (3) is only available for new selections.

## Risks & Considerations

### UX Concern
Users might find it frustrating if they can't set critical until fields are filled. Mitigation: Clear, immediate error message guides them to fill required fields.

### Backward Compatibility
API clients must handle the new priority value. All existing priorities remain unchanged, so old clients continue working with tasks priority 0-2.

### Translation Coverage
Critical tasks require translations in 24 languages. English-only implementations should still function, falling back to English text.

## Success Criteria

- ✓ Users can select critical priority for tasks with due date + assignee
- ✓ Validation prevents critical selection when fields missing
- ✓ Critical tasks sort to top of priority-sorted lists
- ✓ Error messages are clear and actionable
- ✓ All tests pass (backend + frontend)
- ✓ No regressions in existing priority functionality
