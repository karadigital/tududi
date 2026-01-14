# Critical Priority Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "critical" priority level that requires tasks to have both a due date and assignee.

**Architecture:** Backend validation enforces critical priority requirements. Frontend validates immediately on dropdown selection. Priority stored as INTEGER 3 in database.

**Tech Stack:** Node.js/Express/Sequelize (backend), React/TypeScript/Zustand (frontend), Jest (testing)

---

## Task 1: Backend - Update Task Model Priority Constants

**Files:**
- Modify: `backend/models/task.js:45-52` (validation)
- Modify: `backend/models/task.js:274-278` (PRIORITY constants)
- Modify: `backend/models/task.js:313-316` (getPriorityName)
- Modify: `backend/models/task.js:329-334` (getPriorityValue)

**Step 1: Update priority validation max value**

In `backend/models/task.js`, change the priority validation:

```javascript
// Line 45-52: Change max from 2 to 3
priority: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
        min: 0,
        max: 3,  // Changed from 2 to allow critical (3)
    },
},
```

**Step 2: Add CRITICAL constant**

```javascript
// Line 274-278: Add CRITICAL to PRIORITY object
Task.PRIORITY = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
};
```

**Step 3: Update getPriorityName function**

```javascript
// Line 313-316: Add 'critical' to array
const getPriorityName = (priorityValue) => {
    const priorities = ['low', 'medium', 'high', 'critical'];
    return priorities[priorityValue] || 'low';
};
```

**Step 4: Update getPriorityValue function**

```javascript
// Line 329-334: Add critical mapping
const getPriorityValue = (priorityName) => {
    const priorities = { low: 0, medium: 1, high: 2, critical: 3 };
    return priorities[priorityName] !== undefined
        ? priorities[priorityName]
        : 0;
};
```

**Step 5: Commit**

```bash
git add backend/models/task.js
git commit -m "feat(backend): add critical priority level to Task model

- Update priority validation max from 2 to 3
- Add PRIORITY.CRITICAL constant (value 3)
- Update getPriorityName to return 'critical' for value 3
- Update getPriorityValue to map 'critical' to 3"
```

---

## Task 2: Backend - Add Critical Priority Validation Utility

**Files:**
- Create: `backend/routes/tasks/utils/critical-validation.js`
- Test: `backend/tests/unit/routes/tasks/critical-validation.test.js`

**Step 1: Write the failing test**

Create `backend/tests/unit/routes/tasks/critical-validation.test.js`:

```javascript
const { validateCriticalPriority } = require('../../../../routes/tasks/utils/critical-validation');

describe('Critical Priority Validation', () => {
    describe('validateCriticalPriority', () => {
        it('should pass when priority is not critical', () => {
            expect(() => validateCriticalPriority({ priority: 2 })).not.toThrow();
            expect(() => validateCriticalPriority({ priority: 'high' })).not.toThrow();
            expect(() => validateCriticalPriority({ priority: null })).not.toThrow();
        });

        it('should pass when critical priority has due_date and assigned_to', () => {
            expect(() => validateCriticalPriority({
                priority: 3,
                due_date: '2026-01-15',
                assigned_to_user_id: 1
            })).not.toThrow();

            expect(() => validateCriticalPriority({
                priority: 'critical',
                due_date: '2026-01-15',
                assigned_to_user_id: 2
            })).not.toThrow();
        });

        it('should throw when critical priority missing due_date', () => {
            expect(() => validateCriticalPriority({
                priority: 3,
                assigned_to_user_id: 1
            })).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should throw when critical priority missing assigned_to', () => {
            expect(() => validateCriticalPriority({
                priority: 3,
                due_date: '2026-01-15'
            })).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should throw when critical priority missing both fields', () => {
            expect(() => validateCriticalPriority({
                priority: 'critical'
            })).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should check existing task values when updating', () => {
            const existingTask = {
                due_date: '2026-01-15',
                assigned_to_user_id: 1
            };

            // Update only sets priority to critical, existing task has required fields
            expect(() => validateCriticalPriority(
                { priority: 3 },
                existingTask
            )).not.toThrow();
        });

        it('should fail if existing task missing required field on update to critical', () => {
            const existingTask = {
                due_date: '2026-01-15',
                assigned_to_user_id: null
            };

            expect(() => validateCriticalPriority(
                { priority: 3 },
                existingTask
            )).toThrow('Critical tasks must have a due date and assignee');
        });
    });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run backend:test:unit -- --testPathPattern="critical-validation"
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `backend/routes/tasks/utils/critical-validation.js`:

```javascript
const { Task } = require('../../../models');

/**
 * Validates that critical priority tasks have required fields.
 * @param {Object} taskData - The task data being created/updated
 * @param {Object} existingTask - The existing task (for updates), optional
 * @throws {Error} If critical priority requirements not met
 */
function validateCriticalPriority(taskData, existingTask = null) {
    const priority = taskData.priority;

    // Check if priority is critical (value 3 or string 'critical')
    const isCritical = priority === 3 ||
                       priority === Task.PRIORITY.CRITICAL ||
                       priority === 'critical';

    if (!isCritical) {
        return; // Not critical, no validation needed
    }

    // For updates, merge with existing task data
    const dueDate = taskData.due_date !== undefined
        ? taskData.due_date
        : (existingTask?.due_date || null);

    const assignedTo = taskData.assigned_to_user_id !== undefined
        ? taskData.assigned_to_user_id
        : (existingTask?.assigned_to_user_id || null);

    if (!dueDate || !assignedTo) {
        throw new Error('Critical tasks must have a due date and assignee');
    }
}

module.exports = {
    validateCriticalPriority,
};
```

**Step 4: Run test to verify it passes**

```bash
npm run backend:test:unit -- --testPathPattern="critical-validation"
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/tasks/utils/critical-validation.js backend/tests/unit/routes/tasks/critical-validation.test.js
git commit -m "feat(backend): add critical priority validation utility

- Create validateCriticalPriority function
- Validates critical tasks have due_date and assigned_to_user_id
- Supports both create and update scenarios
- Add comprehensive unit tests"
```

---

## Task 3: Backend - Integrate Validation into Task Routes

**Files:**
- Modify: `backend/routes/tasks/index.js:333-420` (POST /task)
- Modify: `backend/routes/tasks/index.js:460-600` (PATCH /task/:uid)
- Test: `backend/tests/integration/critical-priority.test.js`

**Step 1: Write the failing integration test**

Create `backend/tests/integration/critical-priority.test.js`:

```javascript
const request = require('supertest');
const app = require('../../app');
const { User, Task } = require('../../models');
const bcrypt = require('bcrypt');

describe('Critical Priority API Validation', () => {
    let user;
    let authCookie;
    let assignee;

    beforeEach(async () => {
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        assignee = await User.create({
            email: 'assignee@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        const loginRes = await request(app)
            .post('/api/login')
            .send({ email: 'test@example.com', password: 'password123' });
        authCookie = loginRes.headers['set-cookie'];
    });

    describe('POST /api/task - Create with critical priority', () => {
        it('should create critical task with due_date and assignee', async () => {
            const res = await request(app)
                .post('/api/task')
                .set('Cookie', authCookie)
                .send({
                    name: 'Critical Task',
                    priority: 3,
                    due_date: '2026-01-20',
                    assigned_to_user_id: assignee.id,
                });

            expect(res.status).toBe(201);
            expect(res.body.priority).toBe(3);
        });

        it('should reject critical task without due_date', async () => {
            const res = await request(app)
                .post('/api/task')
                .set('Cookie', authCookie)
                .send({
                    name: 'Critical Task',
                    priority: 3,
                    assigned_to_user_id: assignee.id,
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Critical tasks must have a due date and assignee');
        });

        it('should reject critical task without assignee', async () => {
            const res = await request(app)
                .post('/api/task')
                .set('Cookie', authCookie)
                .send({
                    name: 'Critical Task',
                    priority: 3,
                    due_date: '2026-01-20',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Critical tasks must have a due date and assignee');
        });

        it('should reject critical task missing both fields', async () => {
            const res = await request(app)
                .post('/api/task')
                .set('Cookie', authCookie)
                .send({
                    name: 'Critical Task',
                    priority: 'critical',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Critical tasks must have a due date and assignee');
        });
    });

    describe('PATCH /api/task/:uid - Update to critical priority', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Regular Task',
                user_id: user.id,
                priority: 1,
            });
        });

        it('should update to critical when task has due_date and assignee', async () => {
            await task.update({
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });

            const res = await request(app)
                .patch(`/api/task/${task.uid}`)
                .set('Cookie', authCookie)
                .send({ priority: 3 });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(3);
        });

        it('should reject update to critical without due_date', async () => {
            await task.update({ assigned_to_user_id: assignee.id });

            const res = await request(app)
                .patch(`/api/task/${task.uid}`)
                .set('Cookie', authCookie)
                .send({ priority: 3 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Critical tasks must have a due date and assignee');
        });

        it('should reject update to critical without assignee', async () => {
            await task.update({ due_date: '2026-01-20' });

            const res = await request(app)
                .patch(`/api/task/${task.uid}`)
                .set('Cookie', authCookie)
                .send({ priority: 3 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Critical tasks must have a due date and assignee');
        });

        it('should allow setting due_date and assignee together with critical', async () => {
            const res = await request(app)
                .patch(`/api/task/${task.uid}`)
                .set('Cookie', authCookie)
                .send({
                    priority: 3,
                    due_date: '2026-01-20',
                    assigned_to_user_id: assignee.id,
                });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(3);
        });
    });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run backend:test:integration -- --testPathPattern="critical-priority"
```

Expected: FAIL (validation not yet integrated)

**Step 3: Add import and validation to POST /task**

In `backend/routes/tasks/index.js`, add import at top (around line 45):

```javascript
const { validateCriticalPriority } = require('./utils/critical-validation');
```

In POST /task handler (around line 358, after `validateDeferUntilAndDueDate`):

```javascript
// Add after the validateDeferUntilAndDueDate try-catch block
try {
    validateCriticalPriority({
        priority: taskAttributes.priority,
        due_date: taskAttributes.due_date,
        assigned_to_user_id: req.body.assigned_to_user_id,
    });
} catch (error) {
    return res.status(400).json({ error: error.message });
}
```

**Step 4: Add validation to PATCH /task/:uid**

In PATCH /task/:uid handler (around line 545, after `validateDeferUntilAndDueDate`):

```javascript
// Add critical priority validation
try {
    validateCriticalPriority(
        {
            priority: taskAttributes.priority,
            due_date: taskAttributes.due_date,
            assigned_to_user_id: req.body.assigned_to_user_id,
        },
        task // existing task for fallback values
    );
} catch (error) {
    return res.status(400).json({ error: error.message });
}
```

**Step 5: Run test to verify it passes**

```bash
npm run backend:test:integration -- --testPathPattern="critical-priority"
```

Expected: PASS

**Step 6: Commit**

```bash
git add backend/routes/tasks/index.js backend/tests/integration/critical-priority.test.js
git commit -m "feat(backend): integrate critical priority validation in task routes

- Add validation to POST /api/task endpoint
- Add validation to PATCH /api/task/:uid endpoint
- Return 400 error when critical priority requirements not met
- Add integration tests for all scenarios"
```

---

## Task 4: Backend - Update Existing Unit Tests

**Files:**
- Modify: `backend/tests/unit/models/task.test.js`

**Step 1: Update priority constant test**

In `backend/tests/unit/models/task.test.js`, update the constants test:

```javascript
it('should have correct priority constants', () => {
    expect(Task.PRIORITY.LOW).toBe(0);
    expect(Task.PRIORITY.MEDIUM).toBe(1);
    expect(Task.PRIORITY.HIGH).toBe(2);
    expect(Task.PRIORITY.CRITICAL).toBe(3);
});
```

**Step 2: Add priority validation test for critical**

```javascript
it('should accept critical priority value', async () => {
    const taskData = {
        name: 'Test Task',
        user_id: user.id,
        priority: 3,
    };

    const task = await Task.create(taskData);
    expect(task.priority).toBe(3);
});

it('should reject priority above critical', async () => {
    const taskData = {
        name: 'Test Task',
        user_id: user.id,
        priority: 4,
    };

    await expect(Task.create(taskData)).rejects.toThrow();
});
```

**Step 3: Add getPriorityName test for critical**

```javascript
it('should return correct priority name for critical', () => {
    expect(Task.getPriorityName(3)).toBe('critical');
});
```

**Step 4: Run tests to verify they pass**

```bash
npm run backend:test:unit -- --testPathPattern="task.test"
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/tests/unit/models/task.test.js
git commit -m "test(backend): update task model tests for critical priority

- Add PRIORITY.CRITICAL constant test
- Add validation test for priority value 3
- Add validation test rejecting priority > 3
- Add getPriorityName test for critical"
```

---

## Task 5: Frontend - Update TypeScript Types

**Files:**
- Modify: `frontend/entities/Task.ts:88`

**Step 1: Update PriorityType**

In `frontend/entities/Task.ts`, update line 88:

```typescript
export type PriorityType = 'low' | 'medium' | 'high' | 'critical' | null | undefined;
```

**Step 2: Commit**

```bash
git add frontend/entities/Task.ts
git commit -m "feat(frontend): add critical to PriorityType definition"
```

---

## Task 6: Frontend - Update PriorityDropdown Component

**Files:**
- Modify: `frontend/components/Shared/PriorityDropdown.tsx`

**Step 1: Add ExclamationTriangleIcon import**

In `frontend/components/Shared/PriorityDropdown.tsx`, update imports (around line 4):

```typescript
import {
    ChevronDownIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    FireIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
```

**Step 2: Update component props interface**

Add new props for validation:

```typescript
interface PriorityDropdownProps {
    value: PriorityType;
    onChange: (value: PriorityType) => void;
    dueDate?: string | null;
    assignedToUserId?: number | null;
    onValidationError?: (message: string) => void;
}
```

**Step 3: Update component function signature**

```typescript
const PriorityDropdown: React.FC<PriorityDropdownProps> = ({
    value,
    onChange,
    dueDate,
    assignedToUserId,
    onValidationError,
}) => {
```

**Step 4: Add critical priority to options array**

```typescript
const priorities = [
    {
        value: null,
        label: t('priority.none', 'None'),
        icon: (
            <XMarkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        ),
    },
    {
        value: 'low',
        label: t('priority.low', 'Low'),
        icon: (
            <ArrowDownIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        ),
    },
    {
        value: 'medium',
        label: t('priority.medium', 'Medium'),
        icon: (
            <ArrowUpIcon className="w-5 h-5 text-orange-500 dark:text-orange-400" />
        ),
    },
    {
        value: 'high',
        label: t('priority.high', 'High'),
        icon: (
            <FireIcon className="w-5 h-5 text-red-500 dark:text-red-400" />
        ),
    },
    {
        value: 'critical',
        label: t('priority.critical', 'Critical'),
        icon: (
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-500" />
        ),
    },
];
```

**Step 5: Update handleSelect with validation**

```typescript
const handleSelect = (priority: PriorityType) => {
    // Validate critical priority requirements
    if (priority === 'critical') {
        if (!dueDate || !assignedToUserId) {
            const errorMessage = t(
                'errors.critical_requires_fields',
                'Critical tasks must have a due date and assignee'
            );
            if (onValidationError) {
                onValidationError(errorMessage);
            }
            setIsOpen(false);
            return; // Block selection
        }
    }

    onChange(priority);
    setIsOpen(false);
};
```

**Step 6: Update normalizedValue conversion**

```typescript
// Convert numeric priority to string if needed
const normalizedValue =
    typeof value === 'number'
        ? (['low', 'medium', 'high', 'critical'][value] as PriorityType)
        : value;
```

**Step 7: Commit**

```bash
git add frontend/components/Shared/PriorityDropdown.tsx
git commit -m "feat(frontend): add critical priority to PriorityDropdown

- Add critical option with ExclamationTriangleIcon
- Add bright red color (text-red-600) for critical
- Add validation on selection for due date and assignee
- Add onValidationError callback prop
- Update numeric to string conversion for value 3"
```

---

## Task 7: Frontend - Update Sort Utilities

**Files:**
- Modify: `frontend/utils/taskSortUtils.ts:40-47`

**Step 1: Update priorityOrder mapping**

In `frontend/utils/taskSortUtils.ts`, update the getPriorityValue function:

```typescript
const getPriorityValue = (priority: any): number => {
    if (typeof priority === 'number') {
        // Backend numeric format: 0 = LOW, 1 = MEDIUM, 2 = HIGH, 3 = CRITICAL
        return priority;
    }
    // Frontend string format
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    return priorityOrder[priority as keyof typeof priorityOrder] ?? -1;
};
```

**Step 2: Commit**

```bash
git add frontend/utils/taskSortUtils.ts
git commit -m "feat(frontend): update task sorting for critical priority

- Add critical priority to priorityOrder mapping (value 3)
- Critical tasks now sort above high priority"
```

---

## Task 8: Frontend - Update Translation Files

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: All other locale files (24 total)

**Step 1: Update English translation**

In `public/locales/en/translation.json`, find the `"priority"` section and add critical:

```json
"priority": {
    "none": "None",
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "critical": "Critical"
},
```

Also add the error message in the `"errors"` section:

```json
"errors": {
    "somethingWentWrong": "Something went wrong, please try again",
    "critical_requires_fields": "Critical tasks must have a due date and assignee"
}
```

**Step 2: Run script to add to other locales**

Create a simple script or manually add to each locale file:
- `public/locales/es/translation.json`: `"critical": "Crítico"`, error: `"Las tareas críticas deben tener fecha de vencimiento y responsable"`
- `public/locales/de/translation.json`: `"critical": "Kritisch"`, error: `"Kritische Aufgaben müssen ein Fälligkeitsdatum und einen Verantwortlichen haben"`
- `public/locales/fr/translation.json`: `"critical": "Critique"`, error: `"Les tâches critiques doivent avoir une date d'échéance et un responsable"`
- (Continue for all 25 locales)

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat(i18n): add critical priority translations

- Add priority.critical to all 25 locale files
- Add errors.critical_requires_fields error message"
```

---

## Task 9: Frontend - Integrate Validation Error Display

**Files:**
- Modify: `frontend/components/Task/TaskModal.tsx` (or wherever PriorityDropdown is used)
- Modify: `frontend/components/Task/TaskForm/TaskPrioritySection.tsx`

**Step 1: Check where PriorityDropdown is used**

Find usages and update to pass required props:

```typescript
<PriorityDropdown
    value={task.priority}
    onChange={(priority) => handlePriorityChange(priority)}
    dueDate={task.due_date}
    assignedToUserId={task.assigned_to_user_id}
    onValidationError={(message) => {
        // Show toast notification
        toast.error(message);
    }}
/>
```

**Step 2: Commit**

```bash
git add frontend/components/Task/
git commit -m "feat(frontend): integrate critical priority validation in task forms

- Pass dueDate and assignedToUserId to PriorityDropdown
- Display validation error via toast notification"
```

---

## Task 10: Run All Tests and Verify

**Step 1: Run backend tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run frontend tests**

```bash
npm run frontend:test
```

Expected: All tests pass

**Step 3: Run full pre-push checks**

```bash
npm run pre-push
```

Expected: All checks pass

**Step 4: Manual testing**

1. Start dev server: `npm start`
2. Create task without due date → try to set critical → should show error
3. Create task with due date but no assignee → try to set critical → should show error
4. Create task with due date AND assignee → set critical → should succeed
5. Verify critical tasks appear first when sorted by priority

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `backend/models/task.js` | Update priority max to 3, add CRITICAL constant, update conversion functions |
| `backend/routes/tasks/utils/critical-validation.js` | NEW: Validation utility |
| `backend/routes/tasks/index.js` | Add validation to POST and PATCH endpoints |
| `backend/tests/unit/models/task.test.js` | Update tests for critical priority |
| `backend/tests/unit/routes/tasks/critical-validation.test.js` | NEW: Unit tests for validation |
| `backend/tests/integration/critical-priority.test.js` | NEW: Integration tests |
| `frontend/entities/Task.ts` | Add 'critical' to PriorityType |
| `frontend/components/Shared/PriorityDropdown.tsx` | Add critical option, validation logic |
| `frontend/utils/taskSortUtils.ts` | Add critical to priority order |
| `public/locales/*/translation.json` | Add critical translation (25 files) |
| Task form components | Integrate validation error display |

---

## Rollback Plan

If issues are discovered after deployment:

1. Revert priority validation to max: 2
2. Remove CRITICAL constant
3. Update getPriorityName/getPriorityValue to exclude 'critical'
4. Frontend will gracefully handle existing critical tasks (fall back to 'high')
