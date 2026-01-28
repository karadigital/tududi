# Task Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement role-based task permissions so only creators and super admins can delete tasks, and subscribers cannot edit tasks.

**Architecture:** Add `canDeleteTask()` helper to permissionsService, create `requireTaskDeleteAccess` middleware, update authorize.js to support custom forbidden messages, and apply to task routes.

**Tech Stack:** Node.js, Express, Sequelize, Jest

---

## Parallel Execution Groups

Tasks within each group can be executed in parallel. Groups must be executed sequentially.

### Group 1: Service Layer (Parallel)

- Task 1: Add `canDeleteTask()` to permissionsService
- Task 2: Add custom message support to authorize.js

### Group 2: Middleware Layer (Sequential after Group 1)

- Task 3: Add `requireTaskDeleteAccess` middleware

### Group 3: Route Layer (Sequential after Group 2)

- Task 4: Apply new middleware to DELETE route and update PATCH error message

### Group 4: Integration Tests (Parallel after Group 3)

- Task 5: Integration tests for DELETE permissions
- Task 6: Integration tests for PATCH (edit) permissions

---

## Task 1: Add `canDeleteTask()` to permissionsService

**Files:**
- Modify: `backend/services/permissionsService.js`
- Test: `backend/tests/unit/services/permissionsService.test.js`

**Step 1: Write the failing tests**

```javascript
// Add to existing test file or create new describe block
describe('canDeleteTask', () => {
    it('should return true for task owner', async () => {
        const task = await Task.create({
            name: 'Test task',
            user_id: testUser.id,
        });

        const result = await permissionsService.canDeleteTask(testUser.id, task.uid);
        expect(result).toBe(true);
    });

    it('should return true for super admin', async () => {
        const owner = await User.create({
            email: 'owner@test.com',
            password: 'password123',
        });
        const task = await Task.create({
            name: 'Test task',
            user_id: owner.id,
        });

        // Make testUser a super admin
        await Role.update({ is_admin: true }, { where: { user_id: testUser.id } });

        const result = await permissionsService.canDeleteTask(testUser.id, task.uid);
        expect(result).toBe(true);
    });

    it('should return false for assignee', async () => {
        const owner = await User.create({
            email: 'owner2@test.com',
            password: 'password123',
        });
        const task = await Task.create({
            name: 'Test task',
            user_id: owner.id,
            assigned_to_user_id: testUser.id,
        });

        const result = await permissionsService.canDeleteTask(testUser.id, task.uid);
        expect(result).toBe(false);
    });

    it('should return false for subscriber', async () => {
        const owner = await User.create({
            email: 'owner3@test.com',
            password: 'password123',
        });
        const task = await Task.create({
            name: 'Test task',
            user_id: owner.id,
        });

        // Subscribe testUser to the task
        await sequelize.query(
            'INSERT INTO tasks_subscribers (task_id, user_id, created_at, updated_at) VALUES (?, ?, datetime("now"), datetime("now"))',
            { replacements: [task.id, testUser.id] }
        );

        const result = await permissionsService.canDeleteTask(testUser.id, task.uid);
        expect(result).toBe(false);
    });

    it('should return false for unrelated user', async () => {
        const owner = await User.create({
            email: 'owner4@test.com',
            password: 'password123',
        });
        const task = await Task.create({
            name: 'Test task',
            user_id: owner.id,
        });

        const result = await permissionsService.canDeleteTask(testUser.id, task.uid);
        expect(result).toBe(false);
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run backend:test:unit -- --testPathPattern=permissionsService`
Expected: FAIL - canDeleteTask is not defined

**Step 3: Write minimal implementation**

Add to `backend/services/permissionsService.js` before `module.exports`:

```javascript
/**
 * Check if a user can delete a task.
 * Only the task owner or super admin can delete tasks.
 *
 * @param {number} userId - The user ID
 * @param {string} taskUid - The task UID
 * @returns {Promise<boolean>} True if user can delete the task
 */
async function canDeleteTask(userId, taskUid) {
    // Get user UID for admin check
    const { User } = require('../models');
    const user = await User.findByPk(userId, { attributes: ['uid'] });
    if (!user) return false;

    // Super admin can delete any task
    if (await isAdmin(user.uid)) return true;

    // Check if user is the task owner
    const task = await Task.findOne({
        where: { uid: taskUid },
        attributes: ['user_id'],
        raw: true,
    });

    if (!task) return false;
    return task.user_id === userId;
}
```

Add to `module.exports`:

```javascript
module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
    ownedOrAssignedTasksWhere,
    actionableTasksWhere,
    canDeleteTask,  // Add this
};
```

**Step 4: Run tests to verify they pass**

Run: `npm run backend:test:unit -- --testPathPattern=permissionsService`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/services/permissionsService.js backend/tests/unit/services/permissionsService.test.js
git commit -m "[ASID-744] Add canDeleteTask permission helper"
```

---

## Task 2: Add custom message support to authorize.js

**Files:**
- Modify: `backend/middleware/authorize.js`
- Test: `backend/tests/unit/middleware/authorize.test.js`

**Step 1: Write the failing test**

Create test file if it doesn't exist:

```javascript
const { hasAccess } = require('../../../middleware/authorize');

describe('hasAccess middleware', () => {
    describe('custom forbidden message', () => {
        it('should return custom forbiddenMessage when access denied', async () => {
            const middleware = hasAccess(
                'rw',
                'task',
                () => 'some-uid',
                { forbiddenMessage: 'Custom forbidden message' }
            );

            const req = { currentUser: { id: 999 } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();

            // Mock permissionsService to return 'none'
            jest.doMock('../../../services/permissionsService', () => ({
                getAccess: jest.fn().mockResolvedValue('none'),
            }));

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Custom forbidden message' });
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run backend:test:unit -- --testPathPattern=authorize`
Expected: FAIL

**Step 3: Write minimal implementation**

Modify `backend/middleware/authorize.js`:

```javascript
const permissionsService = require('../services/permissionsService');

// requiredAccess: 'ro' | 'rw' | 'admin'
// resourceType: 'project' | 'task' | 'note'
// getResourceUid: function(req) => string | Promise<string>
function hasAccess(requiredAccess, resourceType, getResourceUid, options = {}) {
    const notFoundMessage = options.notFoundMessage || 'Not found';
    const forbiddenMessage = options.forbiddenMessage || 'Forbidden';  // Add this
    const forbiddenStatus = options.forbiddenStatus || 403;
    const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
    return async function (req, res, next) {
        try {
            const uid = await (typeof getResourceUid === 'function'
                ? getResourceUid(req)
                : getResourceUid);
            if (!uid) return res.status(404).json({ error: notFoundMessage });

            const access = await permissionsService.getAccess(
                req.currentUser?.id || req.session?.userId,
                resourceType,
                uid
            );
            if (LEVELS[access] >= LEVELS[requiredAccess]) return next();
            if (forbiddenStatus === 404) {
                return res.status(404).json({ error: notFoundMessage });
            }
            return res.status(403).json({ error: forbiddenMessage });  // Use forbiddenMessage
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { hasAccess };
```

**Step 4: Run test to verify it passes**

Run: `npm run backend:test:unit -- --testPathPattern=authorize`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/middleware/authorize.js backend/tests/unit/middleware/authorize.test.js
git commit -m "[ASID-744] Add custom forbiddenMessage support to hasAccess middleware"
```

---

## Task 3: Add `requireTaskDeleteAccess` middleware

**Files:**
- Modify: `backend/routes/tasks/middleware/access.js`
- Test: `backend/tests/integration/tasks/delete.test.js`

**Step 1: Write the implementation**

Modify `backend/routes/tasks/middleware/access.js`:

```javascript
const { hasAccess } = require('../../../middleware/authorize');
const { canDeleteTask } = require('../../../services/permissionsService');

const requireTaskReadAccess = hasAccess(
    'ro',
    'task',
    async (req) => {
        return req.params.uid;
    },
    { notFoundMessage: 'Task not found.' }
);

const requireTaskWriteAccess = hasAccess(
    'rw',
    'task',
    async (req) => {
        return req.params.uid;
    },
    {
        notFoundMessage: 'Task not found.',
        forbiddenMessage: 'You are not allowed to edit this task. Please contact the creator if you want to make this change.',
    }
);

/**
 * Middleware to check if user can delete a task.
 * Only task owner or super admin can delete.
 */
const requireTaskDeleteAccess = async (req, res, next) => {
    try {
        const taskUid = req.params.uid;
        if (!taskUid) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const userId = req.currentUser?.id || req.session?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const canDelete = await canDeleteTask(userId, taskUid);
        if (canDelete) {
            return next();
        }

        return res.status(403).json({
            error: 'You are not allowed to delete this task. Please contact the creator if you want to make this change.',
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    requireTaskReadAccess,
    requireTaskWriteAccess,
    requireTaskDeleteAccess,
};
```

**Step 2: Commit**

```bash
git add backend/routes/tasks/middleware/access.js
git commit -m "[ASID-744] Add requireTaskDeleteAccess middleware"
```

---

## Task 4: Apply new middleware to DELETE route

**Files:**
- Modify: `backend/routes/tasks/index.js`

**Step 1: Update the import**

Change line 77-79 from:

```javascript
const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('./middleware/access');
```

To:

```javascript
const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
    requireTaskDeleteAccess,
} = require('./middleware/access');
```

**Step 2: Update the DELETE route**

Change line 856 from:

```javascript
router.delete('/task/:uid', requireTaskWriteAccess, async (req, res) => {
```

To:

```javascript
router.delete('/task/:uid', requireTaskDeleteAccess, async (req, res) => {
```

**Step 3: Commit**

```bash
git add backend/routes/tasks/index.js
git commit -m "[ASID-744] Apply requireTaskDeleteAccess to DELETE route"
```

---

## Task 5: Integration tests for DELETE permissions

**Files:**
- Create: `backend/tests/integration/tasks/delete-permissions.test.js`

**Step 1: Write integration tests**

```javascript
const request = require('supertest');
const app = require('../../../app');
const { User, Task, Role, sequelize } = require('../../../models');

describe('DELETE /api/v1/task/:uid permissions', () => {
    let owner, assignee, subscriber, superAdmin;
    let ownerSession, assigneeSession, subscriberSession, superAdminSession;
    let task;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // Create users
        owner = await User.create({
            email: 'owner@test.com',
            password: 'password123',
        });
        assignee = await User.create({
            email: 'assignee@test.com',
            password: 'password123',
        });
        subscriber = await User.create({
            email: 'subscriber@test.com',
            password: 'password123',
        });
        superAdmin = await User.create({
            email: 'superadmin@test.com',
            password: 'password123',
        });

        // Make superAdmin a super admin
        await Role.update({ is_admin: true }, { where: { user_id: superAdmin.id } });

        // Create task owned by owner, assigned to assignee
        task = await Task.create({
            name: 'Test Task',
            user_id: owner.id,
            assigned_to_user_id: assignee.id,
        });

        // Subscribe subscriber to the task
        await sequelize.query(
            'INSERT INTO tasks_subscribers (task_id, user_id, created_at, updated_at) VALUES (?, ?, datetime("now"), datetime("now"))',
            { replacements: [task.id, subscriber.id] }
        );

        // Get sessions
        const ownerRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'owner@test.com', password: 'password123' });
        ownerSession = ownerRes.headers['set-cookie'];

        const assigneeRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'assignee@test.com', password: 'password123' });
        assigneeSession = assigneeRes.headers['set-cookie'];

        const subscriberRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'subscriber@test.com', password: 'password123' });
        subscriberSession = subscriberRes.headers['set-cookie'];

        const superAdminRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'superadmin@test.com', password: 'password123' });
        superAdminSession = superAdminRes.headers['set-cookie'];
    });

    afterEach(async () => {
        await sequelize.query('DELETE FROM tasks_subscribers');
        await Task.destroy({ where: {}, force: true });
        await Role.destroy({ where: {} });
        await User.destroy({ where: {}, force: true });
    });

    it('should allow owner to delete task', async () => {
        const res = await request(app)
            .delete(`/api/v1/task/${task.uid}`)
            .set('Cookie', ownerSession);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task successfully deleted');
    });

    it('should allow super admin to delete task', async () => {
        const res = await request(app)
            .delete(`/api/v1/task/${task.uid}`)
            .set('Cookie', superAdminSession);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task successfully deleted');
    });

    it('should NOT allow assignee to delete task', async () => {
        const res = await request(app)
            .delete(`/api/v1/task/${task.uid}`)
            .set('Cookie', assigneeSession);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to delete this task. Please contact the creator if you want to make this change.'
        );
    });

    it('should NOT allow subscriber to delete task', async () => {
        const res = await request(app)
            .delete(`/api/v1/task/${task.uid}`)
            .set('Cookie', subscriberSession);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to delete this task. Please contact the creator if you want to make this change.'
        );
    });
});
```

**Step 2: Run tests**

Run: `npm run backend:test:integration -- --testPathPattern=delete-permissions`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/tests/integration/tasks/delete-permissions.test.js
git commit -m "[ASID-744] Add integration tests for task delete permissions"
```

---

## Task 6: Integration tests for PATCH (edit) permissions

**Files:**
- Create: `backend/tests/integration/tasks/edit-permissions.test.js`

**Step 1: Write integration tests**

```javascript
const request = require('supertest');
const app = require('../../../app');
const { User, Task, Role, sequelize } = require('../../../models');

describe('PATCH /api/v1/task/:uid permissions', () => {
    let owner, assignee, subscriber;
    let ownerSession, assigneeSession, subscriberSession;
    let task;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // Create users
        owner = await User.create({
            email: 'owner@test.com',
            password: 'password123',
        });
        assignee = await User.create({
            email: 'assignee@test.com',
            password: 'password123',
        });
        subscriber = await User.create({
            email: 'subscriber@test.com',
            password: 'password123',
        });

        // Create task owned by owner, assigned to assignee
        task = await Task.create({
            name: 'Test Task',
            user_id: owner.id,
            assigned_to_user_id: assignee.id,
        });

        // Subscribe subscriber to the task
        await sequelize.query(
            'INSERT INTO tasks_subscribers (task_id, user_id, created_at, updated_at) VALUES (?, ?, datetime("now"), datetime("now"))',
            { replacements: [task.id, subscriber.id] }
        );

        // Get sessions
        const ownerRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'owner@test.com', password: 'password123' });
        ownerSession = ownerRes.headers['set-cookie'];

        const assigneeRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'assignee@test.com', password: 'password123' });
        assigneeSession = assigneeRes.headers['set-cookie'];

        const subscriberRes = await request(app)
            .post('/api/v1/session')
            .send({ email: 'subscriber@test.com', password: 'password123' });
        subscriberSession = subscriberRes.headers['set-cookie'];
    });

    afterEach(async () => {
        await sequelize.query('DELETE FROM tasks_subscribers');
        await Task.destroy({ where: {}, force: true });
        await Role.destroy({ where: {} });
        await User.destroy({ where: {}, force: true });
    });

    it('should allow owner to edit task', async () => {
        const res = await request(app)
            .patch(`/api/v1/task/${task.uid}`)
            .set('Cookie', ownerSession)
            .send({ name: 'Updated Task Name' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Task Name');
    });

    it('should allow assignee to edit task', async () => {
        const res = await request(app)
            .patch(`/api/v1/task/${task.uid}`)
            .set('Cookie', assigneeSession)
            .send({ name: 'Assignee Updated' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Assignee Updated');
    });

    it('should NOT allow subscriber to edit task', async () => {
        const res = await request(app)
            .patch(`/api/v1/task/${task.uid}`)
            .set('Cookie', subscriberSession)
            .send({ name: 'Subscriber Updated' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to edit this task. Please contact the creator if you want to make this change.'
        );
    });
});
```

**Step 2: Run tests**

Run: `npm run backend:test:integration -- --testPathPattern=edit-permissions`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/tests/integration/tasks/edit-permissions.test.js
git commit -m "[ASID-744] Add integration tests for task edit permissions"
```

---

## Final Commit

After all tasks complete:

```bash
git log --oneline -10  # Verify all commits
npm run backend:test:unit
npm run backend:test:integration
```
