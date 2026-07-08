# Change Task Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized user reassign the owner (`Task.user_id`) of an already-created task via a dropdown in the task edit form, scoped to the task's department.

**Architecture:** A dedicated backend endpoint `POST /task/:uid/transfer-owner` (guarded, server-validated) mutates `user_id`; the generic PATCH never touches ownership. A companion `GET /task/:uid/owner-candidates` returns the department's members. A new service `taskOwnershipService.js` holds department resolution, candidate lookup, transfer, and notification. On the frontend, a new `TaskOwnerSection` reuses the existing `SearchableUserDropdown` (extended with `fetchPath` + `allowUnassigned` props) and calls the transfer endpoint immediately on selection, mirroring how the assignment dropdown persists.

**Tech Stack:** Express + Sequelize (SQLite), Jest + supertest (backend); React + TypeScript, react-i18next, Jest + RTL (frontend).

## Global Constraints

- Node.js 22+. CommonJS in `backend/`, TypeScript ESM-style modules in `frontend/`.
- Prettier: 4-space indent, semicolons, single quotes, trailing commas (`es5`). Run `npm run lint:fix` and `npm run format:fix` before every commit — no exceptions.
- i18n uses inline fallbacks `t('namespace.key', 'Default text')`; do NOT add keys to locale JSON files.
- `Task.user_id` is `allowNull: false` — never clear it; owner is always a valid user.
- A user belongs to **at most one** department (`areas_members` has a unique index on `user_id`). Department = the `Area` model.
- Commit prefix convention `[ASID-XXX]`; none assigned here, so use a plain descriptive subject. No `Co-Authored-By` / "Generated with Claude Code" trailers.
- Backend single-file test run: `cd backend && npx cross-env NODE_ENV=test jest tests/<path>`.

---

## Parallelization

Tasks split into three waves. Within a wave, tasks are independent and can be done by parallel agents.

| Wave | Tasks | Depends on |
|------|-------|-----------|
| 1 | **Task 1** (backend service), **Task 2** (dropdown props), **Task 3** (tasksService fns) | — |
| 2 | **Task 4** (backend routes), **Task 5** (TaskOwnerSection component) | T4←T1; T5←T2,T3 |
| 3 | **Task 6** (TaskModal + toggle wiring) | T5 |

Backend (T1, T4) and frontend (T2, T3, T5, T6) share no files; the two tracks run fully in parallel until they meet at runtime. Frontend tests mock `fetch`, so they don't need the backend endpoints to exist.

---

## File Structure

**Backend**
- Create: `backend/services/taskOwnershipService.js` — department resolution, candidate lookup, `transferTaskOwner`, transfer notification.
- Modify: `backend/routes/tasks/index.js` — register `transfer-owner` + `owner-candidates` routes.
- Create: `backend/tests/integration/tasks/owner-transfer.test.js` — route + service integration tests.

**Frontend**
- Modify: `frontend/components/Shared/SearchableUserDropdown.tsx` — add `fetchPath` and `allowUnassigned` props.
- Modify: `frontend/utils/tasksService.ts` — add `transferTaskOwner`.
- Create: `frontend/components/Task/TaskForm/TaskOwnerSection.tsx` — owner picker wrapper.
- Modify: `frontend/components/Task/TaskForm/TaskSectionToggle.tsx` — add `owner` toggle (existing tasks only).
- Modify: `frontend/components/Task/TaskModal.tsx` — render owner section, wire transfer callback.
- Create: `frontend/components/Shared/__tests__/SearchableUserDropdown.test.tsx` (if absent) — prop behavior.
- Create: `frontend/utils/__tests__/tasksService.transferOwner.test.ts` — service URL/body.
- Create: `frontend/components/Task/TaskForm/__tests__/TaskOwnerSection.test.tsx` — selection → transfer.

---

## Task 1: Backend ownership service

**Files:**
- Create: `backend/services/taskOwnershipService.js`
- Test: `backend/tests/integration/tasks/owner-transfer.test.js` (service-level cases; route cases added in Task 4)

**Interfaces:**
- Consumes: `Task`, `User`, `Area`, `Notification` from `../models`; `canManageAreaMembers` from `./areaMembershipService`; `AreasMember` from `../models`; notification prefs from `../utils/notificationPreferences`; `logError` from `./logService`.
- Produces:
  - `resolveTaskDepartmentAreaId(task)` → `Promise<number|null>`
  - `getDepartmentCandidates(areaId)` → `Promise<Array<{id, uid, email, name, surname, avatar_image}>>`
  - `transferTaskOwner(taskId, newOwnerUserId, requesterUserId)` → `Promise<void>` (throws `Task not found` | `Not authorized to transfer ownership` | `Task has no department` | `New owner is not a member of the task department` | `New owner user not found`)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/tasks/owner-transfer.test.js`:

```javascript
const {
    Area,
    Project,
    Task,
    sequelize,
} = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const {
    resolveTaskDepartmentAreaId,
    getDepartmentCandidates,
    transferTaskOwner,
} = require('../../../services/taskOwnershipService');

async function addAreaMember(areaId, userId, role = 'member') {
    await sequelize.query(
        `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        { replacements: [areaId, userId, role] }
    );
}

describe('taskOwnershipService', () => {
    let owner, member, outsider, admin, dept;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `own_${stamp}@example.com` });
        member = await createTestUser({ email: `mem_${stamp}@example.com` });
        outsider = await createTestUser({ email: `out_${stamp}@example.com` });
        admin = await createTestUser({ email: `adm_${stamp}@example.com` });
        dept = await Area.create({ name: 'Dept', user_id: owner.id });
        await addAreaMember(dept.id, owner.id, 'member');
        await addAreaMember(dept.id, member.id, 'member');
        await addAreaMember(dept.id, admin.id, 'admin');
    });

    it('resolves department from the project area', async () => {
        const project = await Project.create({
            name: 'P',
            user_id: owner.id,
            area_id: dept.id,
        });
        const task = await Task.create({
            name: 'T',
            user_id: owner.id,
            project_id: project.id,
        });
        expect(await resolveTaskDepartmentAreaId(task)).toBe(dept.id);
    });

    it('falls back to the owner department when task has no project', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        expect(await resolveTaskDepartmentAreaId(task)).toBe(dept.id);
    });

    it('lists department members as candidates', async () => {
        const candidates = await getDepartmentCandidates(dept.id);
        const ids = candidates.map((c) => c.id).sort();
        expect(ids).toEqual([owner.id, member.id, admin.id].sort());
    });

    it('lets the owner transfer to a department member', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await transferTaskOwner(task.id, member.id, owner.id);
        await task.reload();
        expect(task.user_id).toBe(member.id);
    });

    it('lets a department admin transfer ownership', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await transferTaskOwner(task.id, member.id, admin.id);
        await task.reload();
        expect(task.user_id).toBe(member.id);
    });

    it('rejects a requester who is neither owner nor dept admin', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await expect(
            transferTaskOwner(task.id, member.id, member.id)
        ).rejects.toThrow('Not authorized to transfer ownership');
        await task.reload();
        expect(task.user_id).toBe(owner.id);
    });

    it('rejects a new owner outside the department', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await expect(
            transferTaskOwner(task.id, outsider.id, owner.id)
        ).rejects.toThrow('New owner is not a member of the task department');
        await task.reload();
        expect(task.user_id).toBe(owner.id);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/tasks/owner-transfer.test.js`
Expected: FAIL — `Cannot find module '../../../services/taskOwnershipService'`.

- [ ] **Step 3: Write the service**

Create `backend/services/taskOwnershipService.js`:

```javascript
const { Task, User, Area, AreasMember, Notification } = require('../models');
const { logError } = require('./logService');
const { canManageAreaMembers } = require('./areaMembershipService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../utils/notificationPreferences');

const MEMBER_ATTRS = [
    'id',
    'uid',
    'email',
    'name',
    'surname',
    'avatar_image',
];

/**
 * Resolve the department (Area) a task belongs to.
 * Prefers the task's project area; falls back to the current owner's
 * single department membership. Returns null if none can be resolved.
 */
async function resolveTaskDepartmentAreaId(task) {
    if (task.project_id) {
        const { Project } = require('../models');
        const project = await Project.findByPk(task.project_id, {
            attributes: ['area_id'],
        });
        if (project && project.area_id) {
            return project.area_id;
        }
    }
    const membership = await AreasMember.findOne({
        where: { user_id: task.user_id },
        attributes: ['area_id'],
    });
    return membership ? membership.area_id : null;
}

/**
 * Return the users who are members of the given department area,
 * in the shape SearchableUserDropdown consumes.
 */
async function getDepartmentCandidates(areaId) {
    const area = await Area.findByPk(areaId, {
        include: [
            {
                model: User,
                as: 'Members',
                attributes: MEMBER_ATTRS,
                through: { attributes: [] },
            },
        ],
    });
    return area ? area.Members : [];
}

/**
 * Transfer ownership of a task to another department member.
 * Requester must be the current owner or an admin of the task's department.
 * The new owner must be a member of the task's department.
 */
async function transferTaskOwner(taskId, newOwnerUserId, requesterUserId) {
    try {
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
        });
        if (!task) {
            throw new Error('Task not found');
        }

        const areaId = await resolveTaskDepartmentAreaId(task);

        const requesterIsOwner = task.user_id === requesterUserId;
        let authorized = requesterIsOwner;
        if (!authorized && areaId) {
            authorized = await canManageAreaMembers(areaId, requesterUserId);
        }
        if (!authorized) {
            throw new Error('Not authorized to transfer ownership');
        }

        if (!areaId) {
            throw new Error('Task has no department');
        }

        const candidates = await getDepartmentCandidates(areaId);
        if (!candidates.some((c) => c.id === newOwnerUserId)) {
            throw new Error(
                'New owner is not a member of the task department'
            );
        }

        const newOwner = await User.findByPk(newOwnerUserId, {
            attributes: [
                'id',
                'uid',
                'email',
                'name',
                'surname',
                'notification_preferences',
            ],
        });
        if (!newOwner) {
            throw new Error('New owner user not found');
        }

        if (task.user_id === newOwnerUserId) {
            return; // no-op
        }

        const previousOwner = task.Owner;
        task.user_id = newOwnerUserId;
        await task.save();

        await notifyOwnershipTransfer(task, newOwner, previousOwner);
    } catch (error) {
        logError('Error transferring task owner:', error);
        throw error;
    }
}

/**
 * Notify the new owner that a task was transferred to them.
 */
async function notifyOwnershipTransfer(task, newOwner, previousOwner) {
    try {
        const notificationType = 'task_owner_transferred';
        if (!shouldSendInAppNotification(newOwner, notificationType)) {
            return;
        }
        const fromName = previousOwner
            ? previousOwner.name || previousOwner.email
            : 'Someone';
        const sources = [];
        if (shouldSendTelegramNotification(newOwner, notificationType)) {
            sources.push('telegram');
        }
        await Notification.createNotification({
            userId: newOwner.id,
            type: notificationType,
            title: 'You are now the owner of a task',
            message: `${fromName} made you the owner of "${task.name}"`,
            level: 'info',
            sources,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                previousOwnerUid: previousOwner ? previousOwner.uid : null,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error sending ownership transfer notification:', error);
        // Don't throw - notification failure shouldn't break transfer
    }
}

module.exports = {
    resolveTaskDepartmentAreaId,
    getDepartmentCandidates,
    transferTaskOwner,
    notifyOwnershipTransfer,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/tasks/owner-transfer.test.js`
Expected: PASS (6 service tests green).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/services/taskOwnershipService.js backend/tests/integration/tasks/owner-transfer.test.js
git commit -m "Add task ownership transfer service"
```

---

## Task 2: Extend SearchableUserDropdown

**Files:**
- Modify: `frontend/components/Shared/SearchableUserDropdown.tsx`
- Test: `frontend/components/Shared/__tests__/SearchableUserDropdown.test.tsx`

**Interfaces:**
- Produces: two new optional props on `SearchableUserDropdownProps`:
  - `fetchPath?: string` (default `'users'`) — API path passed to `getApiPath` for the user list.
  - `allowUnassigned?: boolean` (default `true`) — when `false`, the "Unassigned" option is hidden and cannot be selected.

- [ ] **Step 1: Write the failing test**

Create `frontend/components/Shared/__tests__/SearchableUserDropdown.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchableUserDropdown from '../SearchableUserDropdown';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d: string) => d }),
}));

const USERS = [
    { id: 1, uid: 'u1', email: 'a@x.com', name: 'Alice' },
    { id: 2, uid: 'u2', email: 'b@x.com', name: 'Bob' },
];

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => USERS,
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('fetches from the custom fetchPath', async () => {
    render(
        <SearchableUserDropdown
            selectedUserId={null}
            onChange={async () => {}}
            fetchPath="task/abc/owner-candidates"
        />
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('task/abc/owner-candidates');
});

it('hides the Unassigned option when allowUnassigned is false', async () => {
    render(
        <SearchableUserDropdown
            selectedUserId={1}
            onChange={async () => {}}
            allowUnassigned={false}
        />
    );
    // open the dropdown
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run frontend:test -- SearchableUserDropdown`
Expected: FAIL — custom path not used / "Unassigned" still present.

- [ ] **Step 3: Add the props**

In `frontend/components/Shared/SearchableUserDropdown.tsx`:

Update the props interface (currently lines 19-25):

```tsx
interface SearchableUserDropdownProps {
    selectedUserId: number | null;
    onChange: (userId: number | null) => Promise<void>;
    disabled?: boolean;
    className?: string;
    excludeUserIds?: number[];
    fetchPath?: string;
    allowUnassigned?: boolean;
}
```

Destructure the new props (currently lines 27-33):

```tsx
const SearchableUserDropdown: React.FC<SearchableUserDropdownProps> = ({
    selectedUserId,
    onChange,
    disabled = false,
    className = '',
    excludeUserIds = [],
    fetchPath = 'users',
    allowUnassigned = true,
}) => {
```

Use `fetchPath` in `fetchUsers` (currently line 56):

```tsx
            const response = await fetch(getApiPath(fetchPath), {
                method: 'GET',
                credentials: 'include',
            });
```

Compute an index offset so keyboard nav works whether or not the Unassigned row exists. Replace the `handleKeyDown` total/Enter logic (currently lines 157-190):

```tsx
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return;

        const offset = allowUnassigned ? 1 : 0;
        const totalItems = offset + filteredUsers.length;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedIndex((prev) =>
                prev < totalItems - 1 ? prev + 1 : prev
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (highlightedIndex === -1) return;

            if (allowUnassigned && highlightedIndex === 0) {
                handleSelect(null);
            } else {
                const userIndex = highlightedIndex - offset;
                if (userIndex >= 0 && userIndex < filteredUsers.length) {
                    handleSelect(filteredUsers[userIndex].id);
                }
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
        }
    };
```

Gate the Unassigned button and shift the user-row index. Wrap the existing "Unassigned Option" button (currently lines 285-309) in a conditional, and change the per-user `itemIndex`:

```tsx
                                {/* Unassigned Option */}
                                {allowUnassigned && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(null)}
                                        disabled={isSaving}
                                        className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 ${
                                            highlightedIndex === 0
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : ''
                                        } ${
                                            selectedUserId === null
                                                ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                            <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                        </div>
                                        <span className="flex-1">
                                            {t('task.unassigned', 'Unassigned')}
                                        </span>
                                        {selectedUserId === null && (
                                            <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                        )}
                                    </button>
                                )}
```

And in the `filteredUsers.map` (currently line 313-314) change the offset:

```tsx
                                    filteredUsers.map((user, index) => {
                                        const itemIndex =
                                            index + (allowUnassigned ? 1 : 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run frontend:test -- SearchableUserDropdown`
Expected: PASS. Also run the existing assignee-related tests to confirm no regression:
Run: `npm run frontend:test -- TaskModal` (assignee still defaults to `allowUnassigned` true).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/components/Shared/SearchableUserDropdown.tsx frontend/components/Shared/__tests__/SearchableUserDropdown.test.tsx
git commit -m "Add fetchPath and allowUnassigned props to user dropdown"
```

---

## Task 3: tasksService.transferTaskOwner

**Files:**
- Modify: `frontend/utils/tasksService.ts`
- Test: `frontend/utils/__tests__/tasksService.transferOwner.test.ts`

**Interfaces:**
- Consumes: `getApiPath`, `getPostHeaders`, `handleAuthResponse` (already imported in the file).
- Produces: `transferTaskOwner(taskUid: string, newOwnerId: number) => Promise<Task>` — `POST task/:uid/transfer-owner` with body `{ new_owner_user_id }`, returns the updated serialized task.

- [ ] **Step 1: Write the failing test**

Create `frontend/utils/__tests__/tasksService.transferOwner.test.ts`:

```ts
import { transferTaskOwner } from '../tasksService';

jest.mock('../authUtils', () => ({
    handleAuthResponse: jest.fn().mockResolvedValue(undefined),
    getDefaultHeaders: () => ({}),
    getPostHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ uid: 'abc', user_id: 7 }),
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('POSTs to the transfer-owner endpoint with the new owner id', async () => {
    const result = await transferTaskOwner('abc', 7);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('task/abc/transfer-owner');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ new_owner_user_id: 7 });
    expect(result).toEqual({ uid: 'abc', user_id: 7 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run frontend:test -- tasksService.transferOwner`
Expected: FAIL — `transferTaskOwner` is not exported.

- [ ] **Step 3: Add the service function**

In `frontend/utils/tasksService.ts`, after `updateTask` (currently ends line 104), add:

```ts
export const transferTaskOwner = async (
    taskUid: string,
    newOwnerId: number
): Promise<Task> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/transfer-owner`),
        {
            method: 'POST',
            credentials: 'include',
            headers: getPostHeaders(),
            body: JSON.stringify({ new_owner_user_id: newOwnerId }),
        }
    );

    await handleAuthResponse(response, 'Failed to transfer task owner.');
    return await response.json();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run frontend:test -- tasksService.transferOwner`
Expected: PASS.

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/utils/tasksService.ts frontend/utils/__tests__/tasksService.transferOwner.test.ts
git commit -m "Add transferTaskOwner to tasksService"
```

---

## Task 4: Backend routes

**Files:**
- Modify: `backend/routes/tasks/index.js`
- Test: `backend/tests/integration/tasks/owner-transfer.test.js` (add route describe block)

**Interfaces:**
- Consumes: `transferTaskOwner`, `resolveTaskDepartmentAreaId`, `getDepartmentCandidates` from `../../services/taskOwnershipService` (Task 1); existing `requireTaskWriteAccess`, `requireTaskReadAccess`, `taskRepository`, `serializeTask`, `Task`, `TASK_INCLUDES_WITH_SUBTASKS`.
- Produces:
  - `POST /api/v1/task/:uid/transfer-owner` body `{ new_owner_user_id }` → serialized task; 403 unauthorized, 422 invalid new owner, 404 missing task, 400 missing field.
  - `GET /api/v1/task/:uid/owner-candidates` → array of `{id, uid, email, name, surname, avatar_image}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/integration/tasks/owner-transfer.test.js` (add these imports at top: `const request = require('supertest');` and `const app = require('../../../app');`), a new describe block:

```javascript
describe('owner-transfer routes', () => {
    let owner, member, outsider, dept, ownerAgent, outsiderAgent;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `rown_${stamp}@example.com` });
        member = await createTestUser({ email: `rmem_${stamp}@example.com` });
        outsider = await createTestUser({
            email: `rout_${stamp}@example.com`,
        });
        dept = await Area.create({ name: 'RDept', user_id: owner.id });
        await addAreaMember(dept.id, owner.id, 'member');
        await addAreaMember(dept.id, member.id, 'member');

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
        outsiderAgent = request.agent(app);
        await outsiderAgent
            .post('/api/login')
            .send({ email: outsider.email, password: 'password123' });
    });

    it('transfers ownership for the owner', async () => {
        const task = await Task.create({ name: 'RT', user_id: owner.id });
        const res = await ownerAgent
            .post(`/api/v1/task/${task.uid}/transfer-owner`)
            .send({ new_owner_user_id: member.id });
        expect(res.status).toBe(200);
        await task.reload();
        expect(task.user_id).toBe(member.id);
    });

    it('returns 403 for a non-owner non-admin requester', async () => {
        const task = await Task.create({ name: 'RT', user_id: owner.id });
        const res = await outsiderAgent
            .post(`/api/v1/task/${task.uid}/transfer-owner`)
            .send({ new_owner_user_id: member.id });
        // outsider cannot read the task, so middleware yields 403/404
        expect([403, 404]).toContain(res.status);
        await task.reload();
        expect(task.user_id).toBe(owner.id);
    });

    it('returns 422 when the new owner is outside the department', async () => {
        const task = await Task.create({ name: 'RT', user_id: owner.id });
        const res = await ownerAgent
            .post(`/api/v1/task/${task.uid}/transfer-owner`)
            .send({ new_owner_user_id: outsider.id });
        expect(res.status).toBe(422);
    });

    it('lists department members as owner candidates', async () => {
        const task = await Task.create({ name: 'RT', user_id: owner.id });
        const res = await ownerAgent.get(
            `/api/v1/task/${task.uid}/owner-candidates`
        );
        expect(res.status).toBe(200);
        const ids = res.body.map((u) => u.id).sort();
        expect(ids).toEqual([owner.id, member.id].sort());
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/tasks/owner-transfer.test.js`
Expected: FAIL — routes return 404 (not registered).

- [ ] **Step 3: Register the routes**

In `backend/routes/tasks/index.js`, add the service import near the assignment import (currently lines 27-29):

```javascript
const {
    transferTaskOwner,
    resolveTaskDepartmentAreaId,
    getDepartmentCandidates,
} = require('../../services/taskOwnershipService');
```

After the `/task/:uid/unassign` route (currently ends line 1097), add:

```javascript
// Transfer task ownership
router.post(
    '/task/:uid/transfer-owner',
    requireTaskWriteAccess,
    async (req, res) => {
        try {
            const { new_owner_user_id } = req.body;
            if (!new_owner_user_id) {
                return res
                    .status(400)
                    .json({ error: 'new_owner_user_id is required' });
            }

            const task = await taskRepository.findByUid(req.params.uid);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            await transferTaskOwner(
                task.id,
                new_owner_user_id,
                req.currentUser.id
            );

            const updatedTask = await Task.findByPk(task.id, {
                include: TASK_INCLUDES_WITH_SUBTASKS,
            });
            const serialized = await serializeTask(
                updatedTask,
                req.currentUser.timezone
            );
            res.json(serialized);
        } catch (error) {
            logError('Error transferring task owner:', error);
            if (error.message === 'Not authorized to transfer ownership') {
                return res.status(403).json({ error: error.message });
            }
            if (
                error.message ===
                    'New owner is not a member of the task department' ||
                error.message === 'New owner user not found' ||
                error.message === 'Task has no department'
            ) {
                return res.status(422).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to transfer task owner' });
        }
    }
);

// List eligible owners (department members) for a task
router.get(
    '/task/:uid/owner-candidates',
    requireTaskReadAccess,
    async (req, res) => {
        try {
            const task = await taskRepository.findByUid(req.params.uid);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            const areaId = await resolveTaskDepartmentAreaId(task);
            const members = areaId
                ? await getDepartmentCandidates(areaId)
                : [];
            res.json(members);
        } catch (error) {
            logError('Error fetching owner candidates:', error);
            res.status(500).json({
                error: 'Failed to fetch owner candidates',
            });
        }
    }
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/tasks/owner-transfer.test.js`
Expected: PASS (service + route blocks all green).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/routes/tasks/index.js backend/tests/integration/tasks/owner-transfer.test.js
git commit -m "Add transfer-owner and owner-candidates routes"
```

---

## Task 5: TaskOwnerSection component

**Files:**
- Create: `frontend/components/Task/TaskForm/TaskOwnerSection.tsx`
- Test: `frontend/components/Task/TaskForm/__tests__/TaskOwnerSection.test.tsx`

**Interfaces:**
- Consumes: `SearchableUserDropdown` (Task 2 props `fetchPath`, `allowUnassigned`); `transferTaskOwner` from `../../../utils/tasksService` (Task 3).
- Produces: `TaskOwnerSection` default export with props:

```tsx
interface TaskOwnerSectionProps {
    taskUid: string;
    selectedUserId: number | null;
    onTransferred: (newOwnerId: number) => void;
    disabled?: boolean;
}
```

- [ ] **Step 1: Write the failing test**

Create `frontend/components/Task/TaskForm/__tests__/TaskOwnerSection.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskOwnerSection from '../TaskOwnerSection';
import * as tasksService from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d: string) => d }),
}));

const CANDIDATES = [
    { id: 1, uid: 'u1', email: 'a@x.com', name: 'Alice' },
    { id: 2, uid: 'u2', email: 'b@x.com', name: 'Bob' },
];

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => CANDIDATES,
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('transfers ownership and reports the new owner on selection', async () => {
    const spy = jest
        .spyOn(tasksService, 'transferTaskOwner')
        .mockResolvedValue({ uid: 'abc', user_id: 2 } as any);
    const onTransferred = jest.fn();

    render(
        <TaskOwnerSection
            taskUid="abc"
            selectedUserId={1}
            onTransferred={onTransferred}
        />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button')); // open dropdown
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Bob'));

    await waitFor(() =>
        expect(spy).toHaveBeenCalledWith('abc', 2)
    );
    expect(onTransferred).toHaveBeenCalledWith(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run frontend:test -- TaskOwnerSection`
Expected: FAIL — module `../TaskOwnerSection` not found.

- [ ] **Step 3: Write the component**

Create `frontend/components/Task/TaskForm/TaskOwnerSection.tsx`:

```tsx
import React from 'react';
import SearchableUserDropdown from '../../Shared/SearchableUserDropdown';
import { transferTaskOwner } from '../../../utils/tasksService';

interface TaskOwnerSectionProps {
    taskUid: string;
    selectedUserId: number | null;
    onTransferred: (newOwnerId: number) => void;
    disabled?: boolean;
}

const TaskOwnerSection: React.FC<TaskOwnerSectionProps> = ({
    taskUid,
    selectedUserId,
    onTransferred,
    disabled = false,
}) => {
    const handleChange = async (userId: number | null) => {
        if (userId === null) return; // owner cannot be unset
        await transferTaskOwner(taskUid, userId);
        onTransferred(userId);
    };

    return (
        <div className="space-y-2">
            <SearchableUserDropdown
                selectedUserId={selectedUserId}
                onChange={handleChange}
                disabled={disabled}
                className="w-full"
                fetchPath={`task/${encodeURIComponent(
                    taskUid
                )}/owner-candidates`}
                allowUnassigned={false}
            />
        </div>
    );
};

export default TaskOwnerSection;
```

`handleChange` intentionally lets errors propagate: `SearchableUserDropdown.handleSelect` catches them, keeps the dropdown open, and logs — so a failed transfer does not falsely call `onTransferred`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run frontend:test -- TaskOwnerSection`
Expected: PASS.

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/components/Task/TaskForm/TaskOwnerSection.tsx frontend/components/Task/TaskForm/__tests__/TaskOwnerSection.test.tsx
git commit -m "Add TaskOwnerSection owner picker"
```

---

## Task 6: Wire owner section into TaskModal

**Files:**
- Modify: `frontend/components/Task/TaskForm/TaskSectionToggle.tsx`
- Modify: `frontend/components/Task/TaskModal.tsx`

**Interfaces:**
- Consumes: `TaskOwnerSection` (Task 5).
- Produces: an `owner` entry in `expandedSections`; owner toggle button (existing tasks only); owner section rendered in the modal body.

- [ ] **Step 1: Add `owner` to the toggle**

In `frontend/components/Task/TaskForm/TaskSectionToggle.tsx`:

Add `owner: boolean;` to the `expandedSections` shape (currently lines 17-27), after `assignee`:

```tsx
    expandedSections: {
        tags: boolean;
        project: boolean;
        assignee: boolean;
        owner: boolean;
        priority: boolean;
        dueDate: boolean;
        deferUntil: boolean;
        recurrence: boolean;
        subtasks: boolean;
        attachments: boolean;
    };
```

Add an `isExistingTask` prop (default `true`) to `TaskSectionToggleProps` and destructure it:

```tsx
    subtasksCount: number;
    attachmentsCount?: number;
    isExistingTask?: boolean;
}
```

```tsx
    formData,
    subtasksCount,
    attachmentsCount = 0,
    isExistingTask = true,
}) => {
```

Import `UserCircleIcon` alongside the other icons (currently lines 2-12):

```tsx
    UserIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';
```

Add the owner button to `toggleButtons`, right after the `assignee` entry (currently ends line 62), and gate it on `isExistingTask` by filtering after the array is built:

```tsx
        {
            key: 'owner' as const,
            icon: UserCircleIcon,
            title: t('forms.task.labels.owner', 'Owner'),
            hasValue: !!formData.user_id,
        },
```

Immediately before `return (` (currently line 104), filter out `owner` for new tasks:

```tsx
    const visibleButtons = toggleButtons.filter(
        (b) => b.key !== 'owner' || isExistingTask
    );
```

Then change the map source from `toggleButtons.map(` to `visibleButtons.map(` (currently line 108).

- [ ] **Step 2: Wire the modal**

In `frontend/components/Task/TaskModal.tsx`:

Import the section near the assignee import (currently line 31):

```tsx
import TaskOwnerSection from './TaskForm/TaskOwnerSection';
```

Add `owner: false` to the `baseSections` initial state (currently lines 90-100) and to the reset object in the `isOpen` effect (currently lines 172-182), placing it after `assignee`.

Add a derived flag near the top of the component body (e.g. after line 106 where `expandedSections` is derived):

```tsx
    const isExistingTask = !!formData.uid;
```

Render the owner section after the assignee section block (currently ends line 804):

```tsx
                                                {expandedSections.owner &&
                                                    isExistingTask && (
                                                        <div
                                                            data-testid="owner-section"
                                                            data-state="expanded"
                                                            className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4"
                                                        >
                                                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                                {t(
                                                                    'forms.task.labels.owner',
                                                                    'Owner'
                                                                )}
                                                            </h3>
                                                            <TaskOwnerSection
                                                                taskUid={
                                                                    formData.uid!
                                                                }
                                                                selectedUserId={
                                                                    formData.user_id ||
                                                                    null
                                                                }
                                                                onTransferred={(
                                                                    newOwnerId
                                                                ) => {
                                                                    setFormData({
                                                                        ...formData,
                                                                        user_id:
                                                                            newOwnerId,
                                                                    });
                                                                    showSuccessToast(
                                                                        t(
                                                                            'task.ownerTransferred',
                                                                            'Task owner updated'
                                                                        )
                                                                    );
                                                                }}
                                                                disabled={
                                                                    isSaving
                                                                }
                                                            />
                                                        </div>
                                                    )}
```

Pass `isExistingTask` to `TaskSectionToggle` (currently around line 1093 where `expandedSections={expandedSections}` is passed):

```tsx
                                    expandedSections={expandedSections}
                                    isExistingTask={isExistingTask}
```

> **ponytail:** owner transfer persists immediately via the endpoint; the parent list refreshes on modal close/save, not instantly. Add an explicit list-refresh callback only if stale-until-close proves confusing in use.

Confirm `Task` entity type has `user_id?: number` — it is returned by the API on every task. If the TypeScript `Task` type in `frontend/entities/Task.ts` lacks `user_id`, add `user_id?: number;` to it (needed for `formData.user_id`).

- [ ] **Step 3: Run the frontend test suite**

Run: `npm run frontend:test -- TaskModal TaskSectionToggle`
Expected: PASS (no regression; owner toggle hidden for new tasks, shown for existing).

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: `tsc` passes (owner section + `user_id` typing resolve).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/components/Task/TaskForm/TaskSectionToggle.tsx frontend/components/Task/TaskModal.tsx frontend/entities/Task.ts
git commit -m "Wire owner picker into task modal"
```

---

## Final Verification

- [ ] Backend: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/tasks/owner-transfer.test.js` — all green.
- [ ] Frontend: `npm run frontend:test` — no regressions.
- [ ] `npm run build` — production build passes.
- [ ] Manual smoke: open an existing task, expand the Owner toggle, pick a department member, confirm the owner badge updates and (as a member/non-admin of another dept) the toggle/section is gated correctly.
