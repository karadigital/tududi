# User Activity Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track daily user activity (passive/active/inactive), provide an admin dashboard, and send daily email reports.

**Architecture:** Middleware-based tracking writes one `UserActivity` record per user per day, with in-memory caching for performance. A `node-cron` job at 8 AM Sydney time sends HTML reports to configurable recipients stored in `ActivityReportRecipient`. Admin frontend has two tabs: trends overview with recharts and daily user list.

**Tech Stack:** Express.js middleware, Sequelize models + migrations, node-cron (already installed), nodemailer (existing emailService), React + TypeScript + Tailwind + recharts (already installed).

**Spec:** `docs/superpowers/specs/2026-04-09-user-activity-tracking-design.md`

---

## File Structure

### Backend — New Files
- `backend/models/user_activity.js` — UserActivity Sequelize model
- `backend/models/activity_report_recipient.js` — ActivityReportRecipient Sequelize model
- `backend/migrations/20260409000001-create-user-activities.js` — UserActivity table
- `backend/migrations/20260409000002-create-activity-report-recipients.js` — ActivityReportRecipient table
- `backend/middleware/activityTracker.js` — Middleware that tracks user activity per request
- `backend/routes/activity.js` — Admin API routes for activity data + recipient CRUD + manual report trigger
- `backend/services/activityReportService.js` — Report generation (HTML) + sending + cron scheduling
- `backend/tests/integration/activity-tracking.test.js` — Tests for middleware + API routes
- `backend/tests/integration/activity-report.test.js` — Tests for report service + manual trigger

### Backend — Modified Files
- `backend/models/index.js` — Register new models + associations
- `backend/app.js` — Mount activity tracker middleware + activity routes + initialize cron
- `backend/routes/admin.js` — Add cleanup of UserActivity + ActivityReportRecipient on user delete

### Frontend — New Files
- `frontend/components/Admin/AdminActivityPage.tsx` — Activity dashboard with two tabs
- `frontend/utils/activityService.ts` — API service functions for activity endpoints

### Frontend — Modified Files
- `frontend/App.tsx` — Add `/admin/activity` route

---

## Task 1: UserActivity Migration + Model

**Files:**
- Create: `backend/migrations/20260409000001-create-user-activities.js`
- Create: `backend/models/user_activity.js`
- Test: `backend/tests/integration/activity-tracking.test.js`

- [ ] **Step 1: Write failing test for UserActivity model**

Create `backend/tests/integration/activity-tracking.test.js`:

```javascript
const request = require('supertest');
const app = require('../../app');
const { User, UserActivity, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

async function makeAdminDirect(userId) {
    await Role.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, is_admin: true },
    });
}

describe('User Activity Tracking', () => {
    describe('UserActivity model', () => {
        it('should create a user activity record', async () => {
            const user = await createTestUser({
                email: 'activity-model@example.com',
            });
            const now = new Date();
            const activity = await UserActivity.create({
                user_id: user.id,
                date: '2026-04-09',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
            expect(activity.id).toBeDefined();
            expect(activity.user_id).toBe(user.id);
            expect(activity.activity_type).toBe('passive');
        });

        it('should enforce unique constraint on user_id + date', async () => {
            const user = await createTestUser({
                email: 'activity-unique@example.com',
            });
            const now = new Date();
            await UserActivity.create({
                user_id: user.id,
                date: '2026-04-09',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
            await expect(
                UserActivity.create({
                    user_id: user.id,
                    date: '2026-04-09',
                    activity_type: 'active',
                    first_seen_at: now,
                    last_seen_at: now,
                    action_counts: {},
                })
            ).rejects.toThrow();
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: FAIL — `UserActivity` is not exported from models

- [ ] **Step 3: Create migration**

Create `backend/migrations/20260409000001-create-user-activities.js`:

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_activities', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            activity_type: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'passive',
            },
            first_seen_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            last_seen_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            action_counts: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: {},
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await queryInterface.addIndex('user_activities', ['user_id']);
        await queryInterface.addIndex('user_activities', ['date']);
        await queryInterface.addIndex('user_activities', ['user_id', 'date'], {
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_activities');
    },
};
```

- [ ] **Step 4: Create model**

Create `backend/models/user_activity.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserActivity = sequelize.define(
        'UserActivity',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            activity_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'passive',
                validate: {
                    isIn: [['passive', 'active']],
                },
            },
            first_seen_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            last_seen_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            action_counts: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {},
            },
        },
        {
            tableName: 'user_activities',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['date'] },
                { fields: ['user_id', 'date'], unique: true },
            ],
        }
    );

    return UserActivity;
};
```

- [ ] **Step 5: Register model in index.js**

In `backend/models/index.js`, add after the `Workspace` require (~line 93):

```javascript
const UserActivity = require('./user_activity')(sequelize);
```

Add associations after existing ones (~line 276):

```javascript
// UserActivity associations
User.hasMany(UserActivity, { foreignKey: 'user_id', as: 'Activities' });
UserActivity.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
```

Add `UserActivity` to the `module.exports` object.

- [ ] **Step 6: Run migration**

Run: `npm run db:migrate`
Expected: Migration runs successfully

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: PASS — both tests green

- [ ] **Step 8: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/migrations/20260409000001-create-user-activities.js backend/models/user_activity.js backend/models/index.js backend/tests/integration/activity-tracking.test.js
git commit -m "[ASID-XXX] Add UserActivity model and migration"
```

---

## Task 2: ActivityReportRecipient Migration + Model

**Files:**
- Create: `backend/migrations/20260409000002-create-activity-report-recipients.js`
- Create: `backend/models/activity_report_recipient.js`
- Modify: `backend/models/index.js`

- [ ] **Step 1: Write failing test**

Append to `backend/tests/integration/activity-tracking.test.js`, inside the outer `describe`:

```javascript
    describe('ActivityReportRecipient model', () => {
        it('should create a recipient record', async () => {
            const user = await createTestUser({
                email: 'recipient-admin@example.com',
            });
            const { ActivityReportRecipient } = require('../../models');
            const recipient = await ActivityReportRecipient.create({
                email: 'report@example.com',
                enabled: true,
                added_by: user.id,
            });
            expect(recipient.id).toBeDefined();
            expect(recipient.email).toBe('report@example.com');
            expect(recipient.enabled).toBe(true);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: FAIL — `ActivityReportRecipient` not in models

- [ ] **Step 3: Create migration**

Create `backend/migrations/20260409000002-create-activity-report-recipients.js`:

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('activity_report_recipients', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            added_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('activity_report_recipients');
    },
};
```

- [ ] **Step 4: Create model**

Create `backend/models/activity_report_recipient.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ActivityReportRecipient = sequelize.define(
        'ActivityReportRecipient',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            added_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'activity_report_recipients',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return ActivityReportRecipient;
};
```

- [ ] **Step 5: Register model in index.js**

In `backend/models/index.js`, add after the `UserActivity` require:

```javascript
const ActivityReportRecipient = require('./activity_report_recipient')(sequelize);
```

Add association:

```javascript
// ActivityReportRecipient associations
User.hasMany(ActivityReportRecipient, { foreignKey: 'added_by', as: 'AddedRecipients' });
ActivityReportRecipient.belongsTo(User, { foreignKey: 'added_by', as: 'AddedBy' });
```

Add `ActivityReportRecipient` to `module.exports`.

- [ ] **Step 6: Run migration and test**

```bash
npm run db:migrate
cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage
```

Expected: PASS — all 3 tests green

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/migrations/20260409000002-create-activity-report-recipients.js backend/models/activity_report_recipient.js backend/models/index.js backend/tests/integration/activity-tracking.test.js
git commit -m "[ASID-XXX] Add ActivityReportRecipient model and migration"
```

---

## Task 3: Activity Tracker Middleware

**Files:**
- Create: `backend/middleware/activityTracker.js`
- Modify: `backend/app.js`
- Test: `backend/tests/integration/activity-tracking.test.js`

- [ ] **Step 1: Write failing tests for middleware**

Append to `backend/tests/integration/activity-tracking.test.js`, inside the outer `describe`:

```javascript
    describe('Activity tracking middleware', () => {
        let user, agent;

        beforeEach(async () => {
            user = await createTestUser({
                email: 'middleware-user@example.com',
            });
            agent = await loginAgent('middleware-user@example.com');
        });

        it('should create a passive activity record on GET request', async () => {
            await agent.get('/api/tasks');
            // Wait briefly for async tracking
            await new Promise((r) => setTimeout(r, 100));
            const activities = await UserActivity.findAll({
                where: { user_id: user.id },
            });
            expect(activities.length).toBe(1);
            expect(activities[0].activity_type).toBe('passive');
        });

        it('should upgrade to active on POST to tracked resource', async () => {
            // First a GET to create passive record
            await agent.get('/api/tasks');
            await new Promise((r) => setTimeout(r, 100));

            // Now a POST to tasks (create a task)
            await agent.post('/api/tasks').send({
                title: 'Test task for activity',
                status: 0,
                priority: 1,
            });
            await new Promise((r) => setTimeout(r, 100));

            const activities = await UserActivity.findAll({
                where: { user_id: user.id },
            });
            expect(activities.length).toBe(1);
            expect(activities[0].activity_type).toBe('active');
        });

        it('should increment action_counts on write operations', async () => {
            await agent.post('/api/tasks').send({
                title: 'Count test task',
                status: 0,
                priority: 1,
            });
            await new Promise((r) => setTimeout(r, 100));

            const activity = await UserActivity.findOne({
                where: { user_id: user.id },
            });
            expect(activity.action_counts.tasks_created).toBe(1);
        });

        it('should not track activity for unauthenticated requests', async () => {
            await request(app).get('/api/health');
            const activities = await UserActivity.findAll();
            // No activity records should exist for health check
            const healthActivities = activities.filter(
                (a) => a.user_id === null
            );
            expect(healthActivities.length).toBe(0);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: FAIL — middleware not yet active, no records created

- [ ] **Step 3: Create activity tracker middleware**

Create `backend/middleware/activityTracker.js`:

```javascript
const { UserActivity } = require('../models');
const moment = require('moment-timezone');
const { logError } = require('../services/logService');

// In-memory cache: Map<"userId:date", { activityType, actionCounts, dirty, lastFlush }>
const cache = new Map();
const FLUSH_INTERVAL_MS = 60000; // 60 seconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Route prefixes that count as "active" when written to (POST/PUT/DELETE)
const TRACKED_RESOURCES = ['/tasks', '/projects', '/departments', '/notes', '/tags'];

// Map route prefix + method to action_counts key
function getActionKey(path, method) {
    // Normalize: strip /api/v1 or /api prefix
    const normalized = path
        .replace(/^\/api\/v1/, '')
        .replace(/^\/api/, '');

    for (const prefix of TRACKED_RESOURCES) {
        if (normalized.startsWith(prefix)) {
            const resource = prefix.replace('/', '').replace('departments', 'areas');
            if (method === 'POST') return `${resource}_created`;
            if (method === 'PUT' || method === 'PATCH') return `${resource}_updated`;
            if (method === 'DELETE') return `${resource}_deleted`;
        }
    }
    return null;
}

function isWriteMethod(method) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function isTrackedWriteRequest(path, method) {
    if (!isWriteMethod(method)) return false;
    const normalized = path
        .replace(/^\/api\/v1/, '')
        .replace(/^\/api/, '');
    return TRACKED_RESOURCES.some((prefix) => normalized.startsWith(prefix));
}

async function flushToDb(userId, dateStr, entry) {
    try {
        const [activity, created] = await UserActivity.findOrCreate({
            where: { user_id: userId, date: dateStr },
            defaults: {
                user_id: userId,
                date: dateStr,
                activity_type: entry.activityType,
                first_seen_at: entry.firstSeenAt,
                last_seen_at: entry.lastSeenAt,
                action_counts: entry.actionCounts,
            },
        });

        if (!created) {
            const updates = {
                last_seen_at: entry.lastSeenAt,
                action_counts: entry.actionCounts,
            };
            if (
                entry.activityType === 'active' &&
                activity.activity_type !== 'active'
            ) {
                updates.activity_type = 'active';
            }
            await activity.update(updates);
        }

        entry.dirty = false;
        entry.lastFlush = Date.now();
    } catch (err) {
        logError(err, 'Failed to flush activity to DB');
    }
}

// Periodic flush of dirty cache entries
let flushTimer = null;

function startFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(async () => {
        const now = Date.now();
        const toDelete = [];

        for (const [key, entry] of cache.entries()) {
            // Flush dirty entries
            if (entry.dirty) {
                const [userIdStr, dateStr] = key.split(':');
                await flushToDb(parseInt(userIdStr, 10), dateStr, entry);
            }
            // Expire old entries
            if (now - entry.createdAt > CACHE_TTL_MS) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            cache.delete(key);
        }
    }, FLUSH_INTERVAL_MS);

    // Don't block process exit
    if (flushTimer.unref) flushTimer.unref();
}

function stopFlushTimer() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}

async function activityTracker(req, res, next) {
    // Only track authenticated requests
    const userId = req.currentUser?.id;
    if (!userId) return next();

    // Skip auth/health routes
    const path = req.originalUrl || req.path;
    if (
        path.includes('/health') ||
        path.includes('/login') ||
        path.includes('/current_user')
    ) {
        return next();
    }

    const now = new Date();
    const userTimezone = req.currentUser?.timezone || 'UTC';
    const dateStr = moment.tz(now, userTimezone).format('YYYY-MM-DD');
    const cacheKey = `${userId}:${dateStr}`;
    const method = req.method;

    let entry = cache.get(cacheKey);

    if (!entry) {
        // First request of the day for this user
        entry = {
            activityType: 'passive',
            firstSeenAt: now,
            lastSeenAt: now,
            actionCounts: {},
            dirty: true,
            createdAt: Date.now(),
            lastFlush: 0,
        };
        cache.set(cacheKey, entry);

        // Immediately flush the first record (creates DB row)
        await flushToDb(userId, dateStr, entry);
    }

    entry.lastSeenAt = now;

    // Check if this is a tracked write operation
    if (isTrackedWriteRequest(path, method)) {
        entry.activityType = 'active';
        const actionKey = getActionKey(path, method);
        if (actionKey) {
            entry.actionCounts[actionKey] =
                (entry.actionCounts[actionKey] || 0) + 1;
        }
        entry.dirty = true;

        // Immediately flush on write operations for accuracy
        await flushToDb(userId, dateStr, entry);
    } else {
        entry.dirty = true;
    }

    next();
}

module.exports = {
    activityTracker,
    startFlushTimer,
    stopFlushTimer,
    // Exported for testing
    _cache: cache,
    _getActionKey: getActionKey,
    _isTrackedWriteRequest: isTrackedWriteRequest,
};
```

- [ ] **Step 4: Mount middleware in app.js**

In `backend/app.js`, add import near the top (after line 13):

```javascript
const { activityTracker, startFlushTimer } = require('./middleware/activityTracker');
```

In the `registerApiRoutes` function, add the activity tracker immediately after `requireAuth` (after line 172):

```javascript
    app.use(basePath, activityTracker);
```

In the `startServer` function, add after `await taskScheduler.initialize();` (after line 252):

```javascript
        // Start activity tracker flush timer
        startFlushTimer();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 6: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/middleware/activityTracker.js backend/app.js backend/tests/integration/activity-tracking.test.js
git commit -m "[ASID-XXX] Add activity tracker middleware"
```

---

## Task 4: Activity Admin API Routes

**Files:**
- Create: `backend/routes/activity.js`
- Modify: `backend/app.js`
- Test: `backend/tests/integration/activity-tracking.test.js`

- [ ] **Step 1: Write failing tests for API routes**

Append to `backend/tests/integration/activity-tracking.test.js`, inside the outer `describe`:

```javascript
    describe('Activity admin API', () => {
        let adminUser, adminAgent, regularUser;

        beforeEach(async () => {
            adminUser = await createTestUser({
                email: 'activity-admin@example.com',
            });
            adminAgent = await loginAgent('activity-admin@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);

            regularUser = await createTestUser({
                email: 'activity-regular@example.com',
            });

            // Seed some activity data
            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 3 },
            });
            await UserActivity.create({
                user_id: regularUser.id,
                date: '2026-04-08',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
        });

        describe('GET /api/admin/activity', () => {
            it('should require admin', async () => {
                const agent = await loginAgent(
                    'activity-regular@example.com'
                );
                const res = await agent.get(
                    '/api/admin/activity?startDate=2026-04-08&endDate=2026-04-08'
                );
                expect(res.status).toBe(403);
            });

            it('should return activity summary for date range', async () => {
                const res = await adminAgent.get(
                    '/api/admin/activity?startDate=2026-04-08&endDate=2026-04-08'
                );
                expect(res.status).toBe(200);
                expect(res.body.summary).toBeDefined();
                expect(res.body.users).toBeDefined();
                expect(res.body.summary.active).toBeGreaterThanOrEqual(1);
                expect(res.body.summary.passive).toBeGreaterThanOrEqual(1);
            });
        });

        describe('GET /api/admin/activity/trends', () => {
            it('should return trend data', async () => {
                const res = await adminAgent.get(
                    '/api/admin/activity/trends?days=7'
                );
                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
                expect(res.body.length).toBeLessThanOrEqual(7);
            });
        });
    });

    describe('Activity Report Recipients API', () => {
        let adminUser, adminAgent;

        beforeEach(async () => {
            adminUser = await createTestUser({
                email: 'recipient-admin2@example.com',
            });
            adminAgent = await loginAgent('recipient-admin2@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);
        });

        describe('POST /api/admin/activity-report/recipients', () => {
            it('should add a recipient', async () => {
                const res = await adminAgent
                    .post('/api/admin/activity-report/recipients')
                    .send({ email: 'daily@example.com' });
                expect(res.status).toBe(201);
                expect(res.body.email).toBe('daily@example.com');
                expect(res.body.enabled).toBe(true);
            });

            it('should reject missing email', async () => {
                const res = await adminAgent
                    .post('/api/admin/activity-report/recipients')
                    .send({});
                expect(res.status).toBe(400);
            });
        });

        describe('GET /api/admin/activity-report/recipients', () => {
            it('should list recipients', async () => {
                const { ActivityReportRecipient } = require('../../models');
                await ActivityReportRecipient.create({
                    email: 'list-test@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent.get(
                    '/api/admin/activity-report/recipients'
                );
                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
                expect(
                    res.body.some((r) => r.email === 'list-test@example.com')
                ).toBe(true);
            });
        });

        describe('PUT /api/admin/activity-report/recipients/:id', () => {
            it('should update enabled status', async () => {
                const { ActivityReportRecipient } = require('../../models');
                const recipient = await ActivityReportRecipient.create({
                    email: 'toggle@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent
                    .put(
                        `/api/admin/activity-report/recipients/${recipient.id}`
                    )
                    .send({ enabled: false });
                expect(res.status).toBe(200);
                expect(res.body.enabled).toBe(false);
            });
        });

        describe('DELETE /api/admin/activity-report/recipients/:id', () => {
            it('should delete a recipient', async () => {
                const { ActivityReportRecipient } = require('../../models');
                const recipient = await ActivityReportRecipient.create({
                    email: 'delete-me@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent.delete(
                    `/api/admin/activity-report/recipients/${recipient.id}`
                );
                expect(res.status).toBe(204);
            });
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: FAIL — routes don't exist, 404s

- [ ] **Step 3: Create activity routes**

Create `backend/routes/activity.js`:

```javascript
const express = require('express');
const router = express.Router();
const {
    User,
    UserActivity,
    ActivityReportRecipient,
    Role,
} = require('../models');
const { requireAdmin } = require('../middleware/requireAdmin');
const { logError } = require('../services/logService');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Middleware: allow admin OR report recipient
async function requireActivityAccess(req, res, next) {
    try {
        const userId = req.currentUser?.id;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        // Check if admin
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (!user)
            return res.status(401).json({ error: 'Authentication required' });

        const { isAdmin } = require('../services/rolesService');
        const admin = await isAdmin(user.uid);
        if (admin) {
            req.isActivityAdmin = true;
            return next();
        }

        // Check if email is a report recipient
        const recipient = await ActivityReportRecipient.findOne({
            where: { email: user.email, enabled: true },
        });
        if (recipient) {
            req.isActivityAdmin = false;
            return next();
        }

        return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/activity - activity summary for date range
router.get('/admin/activity', requireActivityAccess, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res
                .status(400)
                .json({ error: 'startDate and endDate are required' });
        }

        // Get all users for inactive count
        const totalUsers = await User.count();

        // Get activity records in range
        const activities = await UserActivity.findAll({
            where: {
                date: { [Op.between]: [startDate, endDate] },
            },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'email', 'name', 'surname'],
                },
            ],
            order: [['date', 'DESC']],
        });

        // Get the latest date in range that has data
        const latestDate = activities.length > 0 ? activities[0].date : endDate;

        // Count for latest date
        const latestActivities = activities.filter(
            (a) => a.date === latestDate
        );
        const activeCount = latestActivities.filter(
            (a) => a.activity_type === 'active'
        ).length;
        const passiveCount = latestActivities.filter(
            (a) => a.activity_type === 'passive'
        ).length;
        const inactiveCount = totalUsers - activeCount - passiveCount;

        // Build user list for the latest date
        const activeUserIds = new Set(
            latestActivities.map((a) => a.user_id)
        );
        const allUsers = await User.findAll({
            attributes: ['id', 'email', 'name', 'surname'],
        });

        const users = allUsers.map((u) => {
            const activity = latestActivities.find(
                (a) => a.user_id === u.id
            );
            return {
                id: u.id,
                email: u.email,
                name: u.name,
                surname: u.surname,
                status: activity
                    ? activity.activity_type
                    : 'inactive',
                first_seen_at: activity?.first_seen_at || null,
                last_seen_at: activity?.last_seen_at || null,
                action_counts: activity?.action_counts || {},
            };
        });

        res.json({
            summary: {
                date: latestDate,
                total: totalUsers,
                active: activeCount,
                passive: passiveCount,
                inactive: inactiveCount,
            },
            users,
        });
    } catch (err) {
        logError('Error fetching activity:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/activity/trends - daily trend data
router.get(
    '/admin/activity/trends',
    requireActivityAccess,
    async (req, res) => {
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const totalUsers = await User.count();

            // If days === 0, treat as "all time" — no date filter
            let whereClause = {};
            if (days > 0) {
                const startDate = moment()
                    .subtract(days - 1, 'days')
                    .format('YYYY-MM-DD');
                whereClause = {
                    date: { [Op.gte]: startDate },
                };
            }

            const activities = await UserActivity.findAll({
                where: whereClause,
                attributes: ['date', 'activity_type'],
                order: [['date', 'ASC']],
            });

            // Group by date
            const byDate = {};
            for (const a of activities) {
                if (!byDate[a.date]) {
                    byDate[a.date] = { active: 0, passive: 0 };
                }
                if (a.activity_type === 'active') byDate[a.date].active++;
                else byDate[a.date].passive++;
            }

            const trends = Object.entries(byDate).map(([date, counts]) => ({
                date,
                active: counts.active,
                passive: counts.passive,
                inactive: totalUsers - counts.active - counts.passive,
            }));

            res.json(trends);
        } catch (err) {
            logError('Error fetching activity trends:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// --- Report Recipients CRUD (admin-only) ---

// GET /api/admin/activity-report/recipients
router.get(
    '/admin/activity-report/recipients',
    requireAdmin,
    async (req, res) => {
        try {
            const recipients = await ActivityReportRecipient.findAll({
                include: [
                    {
                        model: User,
                        as: 'AddedBy',
                        attributes: ['id', 'email', 'name'],
                    },
                ],
                order: [['created_at', 'ASC']],
            });
            res.json(recipients);
        } catch (err) {
            logError('Error fetching recipients:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /api/admin/activity-report/recipients
router.post(
    '/admin/activity-report/recipients',
    requireAdmin,
    async (req, res) => {
        try {
            const { email } = req.body;
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res
                    .status(400)
                    .json({ error: 'Valid email is required' });
            }

            const userId = req.currentUser?.id || req.session?.userId;
            const recipient = await ActivityReportRecipient.create({
                email,
                added_by: userId,
            });
            res.status(201).json(recipient);
        } catch (err) {
            logError('Error adding recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// PUT /api/admin/activity-report/recipients/:id
router.put(
    '/admin/activity-report/recipients/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id))
                return res.status(400).json({ error: 'Invalid id' });

            const recipient = await ActivityReportRecipient.findByPk(id);
            if (!recipient)
                return res
                    .status(404)
                    .json({ error: 'Recipient not found' });

            if (req.body.enabled !== undefined) {
                recipient.enabled = req.body.enabled;
            }
            if (req.body.email !== undefined) {
                recipient.email = req.body.email;
            }
            await recipient.save();
            res.json(recipient);
        } catch (err) {
            logError('Error updating recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// DELETE /api/admin/activity-report/recipients/:id
router.delete(
    '/admin/activity-report/recipients/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id))
                return res.status(400).json({ error: 'Invalid id' });

            const recipient = await ActivityReportRecipient.findByPk(id);
            if (!recipient)
                return res
                    .status(404)
                    .json({ error: 'Recipient not found' });

            await recipient.destroy();
            res.status(204).send();
        } catch (err) {
            logError('Error deleting recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
```

- [ ] **Step 4: Register routes in app.js**

In `backend/app.js`, inside `registerApiRoutes`, add after the admin route (after line 176):

```javascript
    app.use(basePath, require('./routes/activity'));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 6: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/routes/activity.js backend/app.js backend/tests/integration/activity-tracking.test.js
git commit -m "[ASID-XXX] Add activity admin API routes"
```

---

## Task 5: Activity Report Service + Cron

**Files:**
- Create: `backend/services/activityReportService.js`
- Modify: `backend/app.js`
- Modify: `backend/routes/activity.js`
- Test: `backend/tests/integration/activity-report.test.js`

- [ ] **Step 1: Write failing test for report service**

Create `backend/tests/integration/activity-report.test.js`:

```javascript
const request = require('supertest');
const app = require('../../app');
const {
    User,
    UserActivity,
    ActivityReportRecipient,
    Role,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

async function makeAdminDirect(userId) {
    await Role.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, is_admin: true },
    });
}

describe('Activity Report', () => {
    let adminUser, adminAgent;

    beforeEach(async () => {
        adminUser = await createTestUser({
            email: 'report-admin@example.com',
        });
        adminAgent = await loginAgent('report-admin@example.com');
        await Role.destroy({ where: {} });
        await makeAdminDirect(adminUser.id);
    });

    describe('generateReportHtml', () => {
        it('should generate HTML report for a date', async () => {
            const {
                generateReportHtml,
            } = require('../../services/activityReportService');

            const regularUser = await createTestUser({
                email: 'report-regular@example.com',
            });

            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 5 },
            });
            await UserActivity.create({
                user_id: regularUser.id,
                date: '2026-04-08',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });

            const html = await generateReportHtml('2026-04-08');
            expect(html).toContain('Activity Report');
            expect(html).toContain('2026-04-08');
            expect(html).toContain('report-admin@example.com');
            expect(html).toContain('Active');
            expect(html).toContain('Passive');
        });
    });

    describe('POST /api/admin/activity-report/send', () => {
        it('should require admin', async () => {
            const regularUser = await createTestUser({
                email: 'report-nonadmin@example.com',
            });
            const agent = await loginAgent('report-nonadmin@example.com');
            const res = await agent.post(
                '/api/admin/activity-report/send'
            );
            expect(res.status).toBe(403);
        });

        it('should trigger report generation', async () => {
            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 2 },
            });

            const res = await adminAgent
                .post('/api/admin/activity-report/send')
                .send({ date: '2026-04-08' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBeDefined();
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-report.test.js --no-coverage`
Expected: FAIL — service doesn't exist

- [ ] **Step 3: Create activity report service**

Create `backend/services/activityReportService.js`:

```javascript
const cron = require('node-cron');
const moment = require('moment-timezone');
const { User, UserActivity, ActivityReportRecipient } = require('../models');
const { sendEmail, isEmailEnabled } = require('./emailService');
const { logError, logInfo } = require('./logService');
const { Op } = require('sequelize');
const { getConfig } = require('../config/config');

const REPORT_TIMEZONE = 'Australia/Sydney';
// 8:00 AM Sydney time daily
const CRON_EXPRESSION = '0 8 * * *';

let cronJob = null;

async function getActivityDataForDate(dateStr) {
    const totalUsers = await User.count();

    const activities = await UserActivity.findAll({
        where: { date: dateStr },
        include: [
            {
                model: User,
                as: 'User',
                attributes: ['id', 'email', 'name', 'surname'],
            },
        ],
    });

    const activeUsers = activities.filter(
        (a) => a.activity_type === 'active'
    );
    const passiveUsers = activities.filter(
        (a) => a.activity_type === 'passive'
    );

    // Get all users for inactive list
    const activeUserIds = new Set(activities.map((a) => a.user_id));
    const allUsers = await User.findAll({
        attributes: ['id', 'email', 'name', 'surname'],
    });
    const inactiveUsers = allUsers.filter((u) => !activeUserIds.has(u.id));

    // Previous day comparison
    const prevDate = moment(dateStr).subtract(1, 'day').format('YYYY-MM-DD');
    const prevActivities = await UserActivity.findAll({
        where: { date: prevDate },
    });
    const prevActive = prevActivities.filter(
        (a) => a.activity_type === 'active'
    ).length;
    const prevPassive = prevActivities.filter(
        (a) => a.activity_type === 'passive'
    ).length;

    return {
        date: dateStr,
        total: totalUsers,
        active: { count: activeUsers.length, users: activeUsers, diff: activeUsers.length - prevActive },
        passive: { count: passiveUsers.length, users: passiveUsers, diff: passiveUsers.length - prevPassive },
        inactive: {
            count: inactiveUsers.length,
            users: inactiveUsers,
            diff: inactiveUsers.length - (totalUsers - prevActive - prevPassive),
        },
    };
}

function formatDiff(diff) {
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '0';
}

function formatActionCounts(counts) {
    if (!counts || Object.keys(counts).length === 0) return '—';
    const parts = [];
    const taskActions =
        (counts.tasks_created || 0) +
        (counts.tasks_updated || 0) +
        (counts.tasks_deleted || 0);
    if (taskActions > 0) parts.push(`${taskActions} task${taskActions > 1 ? 's' : ''}`);
    const projectActions =
        (counts.projects_created || 0) +
        (counts.projects_updated || 0) +
        (counts.projects_deleted || 0);
    if (projectActions > 0) parts.push(`${projectActions} project${projectActions > 1 ? 's' : ''}`);
    const areaActions =
        (counts.areas_created || 0) +
        (counts.areas_updated || 0) +
        (counts.areas_deleted || 0);
    if (areaActions > 0) parts.push(`${areaActions} area${areaActions > 1 ? 's' : ''}`);
    const noteActions =
        (counts.notes_created || 0) +
        (counts.notes_updated || 0) +
        (counts.notes_deleted || 0);
    if (noteActions > 0) parts.push(`${noteActions} note${noteActions > 1 ? 's' : ''}`);
    const tagActions =
        (counts.tags_created || 0) +
        (counts.tags_updated || 0) +
        (counts.tags_deleted || 0);
    if (tagActions > 0) parts.push(`${tagActions} tag${tagActions > 1 ? 's' : ''}`);
    return parts.join(', ') || '—';
}

function getUserDisplayName(user) {
    if (user.name && user.surname) return `${user.name} ${user.surname}`;
    if (user.name) return user.name;
    return user.email;
}

async function generateReportHtml(dateStr) {
    const data = await getActivityDataForDate(dateStr);
    const config = getConfig();
    const frontendUrl = config.frontendUrl || 'http://localhost:8080';

    const userRow = (user, status, actionCounts) => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${getUserDisplayName(user.User || user)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${(user.User || user).email}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;
                    background: ${status === 'Active' ? '#dcfce7' : status === 'Passive' ? '#fef9c3' : '#f3f4f6'};
                    color: ${status === 'Active' ? '#166534' : status === 'Passive' ? '#854d0e' : '#374151'};">
                    ${status}
                </span>
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${formatActionCounts(actionCounts)}</td>
        </tr>`;

    const activeRows = data.active.users
        .map((u) => userRow(u, 'Active', u.action_counts))
        .join('');
    const passiveRows = data.passive.users
        .map((u) => userRow(u, 'Passive', {}))
        .join('');
    const inactiveRows = data.inactive.users
        .map((u) => userRow(u, 'Inactive', {}))
        .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333;">
    <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
        Tududi Activity Report &mdash; ${data.date}
    </h1>

    <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="flex: 1; padding: 16px; background: #dcfce7; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #166534;">${data.active.count}</div>
            <div style="color: #166534;">Active</div>
            <div style="font-size: 12px; color: #166534; margin-top: 4px;">${formatDiff(data.active.diff)} vs prev day</div>
        </div>
        <div style="flex: 1; padding: 16px; background: #fef9c3; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #854d0e;">${data.passive.count}</div>
            <div style="color: #854d0e;">Passive</div>
            <div style="font-size: 12px; color: #854d0e; margin-top: 4px;">${formatDiff(data.passive.diff)} vs prev day</div>
        </div>
        <div style="flex: 1; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #374151;">${data.inactive.count}</div>
            <div style="color: #374151;">Inactive</div>
            <div style="font-size: 12px; color: #374151; margin-top: 4px;">${formatDiff(data.inactive.diff)} vs prev day</div>
        </div>
    </div>

    <p style="color: #6b7280;">Total users: ${data.total}</p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
            <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Status</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Actions</th>
            </tr>
        </thead>
        <tbody>
            ${activeRows}
            ${passiveRows}
            ${inactiveRows}
        </tbody>
    </table>

    <p style="margin-top: 24px; color: #9ca3af; font-size: 13px;">
        <a href="${frontendUrl}/admin/activity" style="color: #3b82f6;">View full dashboard</a>
    </p>
</body>
</html>`;
}

async function sendDailyReport(dateStr) {
    if (!dateStr) {
        // Report on yesterday (Sydney time)
        dateStr = moment
            .tz(REPORT_TIMEZONE)
            .subtract(1, 'day')
            .format('YYYY-MM-DD');
    }

    const recipients = await ActivityReportRecipient.findAll({
        where: { enabled: true },
    });

    if (recipients.length === 0) {
        logInfo('No activity report recipients configured, skipping');
        return { sent: 0, message: 'No recipients configured' };
    }

    const html = await generateReportHtml(dateStr);
    const subject = `Tududi Activity Report — ${dateStr}`;

    let sent = 0;
    let errors = 0;

    for (const recipient of recipients) {
        const result = await sendEmail({
            to: recipient.email,
            subject,
            html,
            text: `Tududi Activity Report for ${dateStr}. View the full report at your admin dashboard.`,
        });
        if (result.success) {
            sent++;
        } else {
            errors++;
            logError(
                new Error(
                    `Failed to send activity report to ${recipient.email}: ${result.reason}`
                )
            );
        }
    }

    logInfo(
        `Activity report for ${dateStr}: sent to ${sent}/${recipients.length} recipients`
    );
    return { sent, errors, total: recipients.length, date: dateStr };
}

function initializeActivityReportCron() {
    const config = getConfig();
    if (config.environment === 'test' || config.disableScheduler) {
        return;
    }

    cronJob = cron.schedule(CRON_EXPRESSION, async () => {
        logInfo('Running daily activity report cron job');
        try {
            await sendDailyReport();
        } catch (err) {
            logError(err, 'Activity report cron job failed');
        }
    }, {
        scheduled: true,
        timezone: REPORT_TIMEZONE,
    });

    logInfo(
        `Activity report cron scheduled: ${CRON_EXPRESSION} (${REPORT_TIMEZONE})`
    );
}

function stopActivityReportCron() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
}

module.exports = {
    generateReportHtml,
    sendDailyReport,
    initializeActivityReportCron,
    stopActivityReportCron,
};
```

- [ ] **Step 4: Add manual trigger route**

Append to `backend/routes/activity.js`, before `module.exports`:

```javascript
// POST /api/admin/activity-report/send - manual trigger
router.post(
    '/admin/activity-report/send',
    requireAdmin,
    async (req, res) => {
        try {
            const {
                sendDailyReport,
            } = require('../services/activityReportService');
            const date = req.body.date || undefined;
            const result = await sendDailyReport(date);
            res.json({
                message: `Report generated for ${result.date}`,
                ...result,
            });
        } catch (err) {
            logError('Error sending activity report:', err);
            res.status(500).json({ error: 'Failed to send report' });
        }
    }
);
```

- [ ] **Step 5: Initialize cron in app.js**

In `backend/app.js`, add import near the top:

```javascript
const { initializeActivityReportCron } = require('./services/activityReportService');
```

In `startServer`, after `startFlushTimer();`:

```javascript
        // Initialize daily activity report cron
        initializeActivityReportCron();
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-report.test.js --no-coverage`
Expected: PASS — all tests green

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/services/activityReportService.js backend/routes/activity.js backend/app.js backend/tests/integration/activity-report.test.js
git commit -m "[ASID-XXX] Add activity report service with cron and manual trigger"
```

---

## Task 6: User Deletion Cleanup

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Write failing test**

Append to `backend/tests/integration/activity-tracking.test.js`, inside the outer `describe`:

```javascript
    describe('User deletion cleanup', () => {
        it('should delete activity records when user is deleted', async () => {
            const adminUser = await createTestUser({
                email: 'cleanup-admin@example.com',
            });
            const adminAgent = await loginAgent('cleanup-admin@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);

            const targetUser = await createTestUser({
                email: 'cleanup-target@example.com',
            });

            const now = new Date();
            await UserActivity.create({
                user_id: targetUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 1 },
            });

            const { ActivityReportRecipient } = require('../../models');
            await ActivityReportRecipient.create({
                email: 'cleanup-target@example.com',
                added_by: targetUser.id,
            });

            // Delete the user
            const res = await adminAgent.delete(
                `/api/admin/users/${targetUser.id}`
            );
            expect(res.status).toBe(204);

            // Verify activity records are gone
            const activities = await UserActivity.findAll({
                where: { user_id: targetUser.id },
            });
            expect(activities.length).toBe(0);

            // Verify recipient added_by is set to null (not deleted)
            const recipients = await ActivityReportRecipient.findAll({
                where: { email: 'cleanup-target@example.com' },
            });
            expect(recipients.length).toBe(1);
            expect(recipients[0].added_by).toBeNull();
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js -t "User deletion cleanup" --no-coverage`
Expected: FAIL — activity records not cleaned up on user delete

- [ ] **Step 3: Add cleanup to admin.js user delete route**

In `backend/routes/admin.js`, add `UserActivity` and `ActivityReportRecipient` to the destructured models import at the top (line 2-19):

```javascript
const {
    Role,
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    Action,
    Permission,
    View,
    ApiToken,
    Notification,
    RecurringCompletion,
    UserActivity,
    ActivityReportRecipient,
} = require('../models');
```

In the DELETE route handler, add before `await Role.destroy(...)` (around line 307):

```javascript
        await UserActivity.destroy({ where: { user_id: id }, transaction });
        await ActivityReportRecipient.update(
            { added_by: null },
            { where: { added_by: id }, transaction }
        );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-tracking.test.js -t "User deletion cleanup" --no-coverage`
Expected: PASS

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/routes/admin.js backend/tests/integration/activity-tracking.test.js
git commit -m "[ASID-XXX] Clean up activity data on user deletion"
```

---

## Task 7: Frontend Activity Service

**Files:**
- Create: `frontend/utils/activityService.ts`

- [ ] **Step 1: Create the API service**

Create `frontend/utils/activityService.ts`:

```typescript
import { getApiPath } from '../config/paths';
import { handleAuthResponse } from './authUtils';

export interface ActivitySummary {
    date: string;
    total: number;
    active: number;
    passive: number;
    inactive: number;
}

export interface ActivityUser {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    status: 'active' | 'passive' | 'inactive';
    first_seen_at: string | null;
    last_seen_at: string | null;
    action_counts: Record<string, number>;
}

export interface ActivityResponse {
    summary: ActivitySummary;
    users: ActivityUser[];
}

export interface TrendEntry {
    date: string;
    active: number;
    passive: number;
    inactive: number;
}

export interface ReportRecipient {
    id: number;
    email: string;
    enabled: boolean;
    added_by: number | null;
    created_at: string;
    updated_at: string;
    AddedBy?: { id: number; email: string; name?: string };
}

export const fetchActivitySummary = async (
    startDate: string,
    endDate: string
): Promise<ActivityResponse> => {
    const response = await fetch(
        getApiPath(
            `admin/activity?startDate=${startDate}&endDate=${endDate}`
        ),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch activity data.');
    return await response.json();
};

export const fetchActivityTrends = async (
    days: number
): Promise<TrendEntry[]> => {
    const response = await fetch(
        getApiPath(`admin/activity/trends?days=${days}`),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch activity trends.');
    return await response.json();
};

export const fetchReportRecipients = async (): Promise<ReportRecipient[]> => {
    const response = await fetch(
        getApiPath('admin/activity-report/recipients'),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch recipients.');
    return await response.json();
};

export const addReportRecipient = async (
    email: string
): Promise<ReportRecipient> => {
    const response = await fetch(
        getApiPath('admin/activity-report/recipients'),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ email }),
        }
    );
    await handleAuthResponse(response, 'Failed to add recipient.');
    return await response.json();
};

export const updateReportRecipient = async (
    id: number,
    data: { enabled?: boolean; email?: string }
): Promise<ReportRecipient> => {
    const response = await fetch(
        getApiPath(`admin/activity-report/recipients/${id}`),
        {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(data),
        }
    );
    await handleAuthResponse(response, 'Failed to update recipient.');
    return await response.json();
};

export const deleteReportRecipient = async (id: number): Promise<void> => {
    const response = await fetch(
        getApiPath(`admin/activity-report/recipients/${id}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to delete recipient.');
};

export const sendActivityReport = async (
    date?: string
): Promise<{ message: string; sent: number; errors: number }> => {
    const response = await fetch(
        getApiPath('admin/activity-report/send'),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(date ? { date } : {}),
        }
    );
    await handleAuthResponse(response, 'Failed to send report.');
    return await response.json();
};
```

- [ ] **Step 2: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/utils/activityService.ts
git commit -m "[ASID-XXX] Add frontend activity API service"
```

---

## Task 8: Frontend Admin Activity Dashboard

**Files:**
- Create: `frontend/components/Admin/AdminActivityPage.tsx`
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Create the AdminActivityPage component**

Create `frontend/components/Admin/AdminActivityPage.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    TrashIcon,
    PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchActivitySummary,
    fetchActivityTrends,
    fetchReportRecipients,
    addReportRecipient,
    updateReportRecipient,
    deleteReportRecipient,
    sendActivityReport,
    ActivityResponse,
    TrendEntry,
    ReportRecipient,
    ActivityUser,
} from '../../utils/activityService';

type TabType = 'trends' | 'daily';
type DatePreset = '1' | '7' | '30' | '0';
type StatusFilter = 'all' | 'active' | 'passive' | 'inactive';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatTime(dateStr: string | null): string {
    if (!dateStr) return '\u2014';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatActionSummary(counts: Record<string, number>): string {
    if (!counts || Object.keys(counts).length === 0) return '\u2014';
    const parts: string[] = [];
    const taskActions =
        (counts.tasks_created || 0) +
        (counts.tasks_updated || 0) +
        (counts.tasks_deleted || 0);
    if (taskActions > 0) parts.push(`${taskActions} task${taskActions > 1 ? 's' : ''}`);
    const projectActions =
        (counts.projects_created || 0) +
        (counts.projects_updated || 0) +
        (counts.projects_deleted || 0);
    if (projectActions > 0) parts.push(`${projectActions} project${projectActions > 1 ? 's' : ''}`);
    const areaActions =
        (counts.areas_created || 0) +
        (counts.areas_updated || 0) +
        (counts.areas_deleted || 0);
    if (areaActions > 0) parts.push(`${areaActions} area${areaActions > 1 ? 's' : ''}`);
    const noteActions =
        (counts.notes_created || 0) +
        (counts.notes_updated || 0) +
        (counts.notes_deleted || 0);
    if (noteActions > 0) parts.push(`${noteActions} note${noteActions > 1 ? 's' : ''}`);
    const tagActions =
        (counts.tags_created || 0) +
        (counts.tags_updated || 0) +
        (counts.tags_deleted || 0);
    if (tagActions > 0) parts.push(`${tagActions} tag${tagActions > 1 ? 's' : ''}`);
    return parts.join(', ') || '\u2014';
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        passive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    return (
        <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.inactive}`}
        >
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const AdminActivityPage: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = true }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('trends');

    // Trends tab state
    const [preset, setPreset] = useState<DatePreset>('7');
    const [trends, setTrends] = useState<TrendEntry[]>([]);
    const [summary, setSummary] = useState<ActivityResponse | null>(null);
    const [loadingTrends, setLoadingTrends] = useState(true);

    // Daily tab state
    const [dailyDate, setDailyDate] = useState(formatDate(new Date()));
    const [dailyData, setDailyData] = useState<ActivityResponse | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [loadingDaily, setLoadingDaily] = useState(false);

    // Recipients state
    const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
    const [newRecipientEmail, setNewRecipientEmail] = useState('');
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Load trends
    const loadTrends = useCallback(async () => {
        setLoadingTrends(true);
        try {
            const days = parseInt(preset, 10);
            const trendData = await fetchActivityTrends(days);
            setTrends(trendData);

            // Also load summary for latest day
            const today = formatDate(new Date());
            const start =
                days === 0
                    ? '2020-01-01'
                    : formatDate(
                          new Date(
                              Date.now() - (days - 1) * 24 * 60 * 60 * 1000
                          )
                      );
            const summaryData = await fetchActivitySummary(start, today);
            setSummary(summaryData);
        } catch (err) {
            showToast(
                t('admin.activity.failedToLoad', 'Failed to load activity data'),
                'error'
            );
        } finally {
            setLoadingTrends(false);
        }
    }, [preset, t, showToast]);

    useEffect(() => {
        if (activeTab === 'trends') loadTrends();
    }, [activeTab, loadTrends]);

    // Load daily data
    const loadDaily = useCallback(async () => {
        setLoadingDaily(true);
        try {
            const data = await fetchActivitySummary(dailyDate, dailyDate);
            setDailyData(data);
        } catch (err) {
            showToast(
                t('admin.activity.failedToLoad', 'Failed to load activity data'),
                'error'
            );
        } finally {
            setLoadingDaily(false);
        }
    }, [dailyDate, t, showToast]);

    useEffect(() => {
        if (activeTab === 'daily') loadDaily();
    }, [activeTab, loadDaily]);

    // Load recipients
    const loadRecipients = useCallback(async () => {
        if (!isAdmin) return;
        setLoadingRecipients(true);
        try {
            const data = await fetchReportRecipients();
            setRecipients(data);
        } catch {
            // Non-admin users may get 403 — ignore
        } finally {
            setLoadingRecipients(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        loadRecipients();
    }, [loadRecipients]);

    const handleAddRecipient = async () => {
        if (!newRecipientEmail.includes('@')) return;
        try {
            await addReportRecipient(newRecipientEmail);
            setNewRecipientEmail('');
            await loadRecipients();
            showToast(
                t('admin.activity.recipientAdded', 'Recipient added'),
                'success'
            );
        } catch {
            showToast(
                t('admin.activity.failedToAddRecipient', 'Failed to add recipient'),
                'error'
            );
        }
    };

    const handleToggleRecipient = async (id: number, enabled: boolean) => {
        try {
            await updateReportRecipient(id, { enabled: !enabled });
            await loadRecipients();
        } catch {
            showToast(
                t('admin.activity.failedToUpdateRecipient', 'Failed to update recipient'),
                'error'
            );
        }
    };

    const handleDeleteRecipient = async (id: number) => {
        try {
            await deleteReportRecipient(id);
            await loadRecipients();
            showToast(
                t('admin.activity.recipientRemoved', 'Recipient removed'),
                'success'
            );
        } catch {
            showToast(
                t('admin.activity.failedToDeleteRecipient', 'Failed to delete recipient'),
                'error'
            );
        }
    };

    const handleSendReport = async () => {
        try {
            const result = await sendActivityReport();
            showToast(result.message, 'success');
        } catch {
            showToast(
                t('admin.activity.failedToSendReport', 'Failed to send report'),
                'error'
            );
        }
    };

    // Filter users for daily tab
    const filteredUsers: ActivityUser[] = dailyData
        ? dailyData.users.filter(
              (u) => statusFilter === 'all' || u.status === statusFilter
          )
        : [];

    return (
        <div className="mx-auto max-w-6xl p-4">
            <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                {t('admin.activity.title', 'User Activity')}
            </h1>

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <button
                    onClick={() => setActiveTab('trends')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'trends'
                            ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('admin.activity.trends', 'Trends Overview')}
                </button>
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'daily'
                            ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('admin.activity.dailyUsers', 'Daily User List')}
                </button>
            </div>

            {/* Trends Tab */}
            {activeTab === 'trends' && (
                <div>
                    {/* Date presets */}
                    <div className="mb-4 flex gap-2">
                        {[
                            { value: '1', label: t('admin.activity.today', 'Today') },
                            { value: '7', label: t('admin.activity.7days', '7 Days') },
                            { value: '30', label: t('admin.activity.30days', '30 Days') },
                            { value: '0', label: t('admin.activity.allTime', 'All Time') },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setPreset(value as DatePreset)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                    preset === value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Summary cards */}
                    {summary && (
                        <div className="mb-6 grid grid-cols-3 gap-4">
                            <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/30">
                                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                                    {summary.summary.active}
                                </div>
                                <div className="text-sm text-green-600 dark:text-green-400">
                                    {t('admin.activity.active', 'Active')}
                                </div>
                            </div>
                            <div className="rounded-lg bg-yellow-50 p-4 text-center dark:bg-yellow-900/30">
                                <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                                    {summary.summary.passive}
                                </div>
                                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                    {t('admin.activity.passive', 'Passive')}
                                </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50">
                                <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                                    {summary.summary.inactive}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('admin.activity.inactive', 'Inactive')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trend chart */}
                    {loadingTrends ? (
                        <div className="py-12 text-center text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : trends.length > 0 ? (
                        <div className="mb-8 rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={trends}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-gray-200 dark:stroke-gray-600"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12 }}
                                        className="fill-gray-500"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        className="fill-gray-500"
                                    />
                                    <Tooltip />
                                    <Legend />
                                    <Bar
                                        dataKey="active"
                                        fill="#22c55e"
                                        name={t('admin.activity.active', 'Active')}
                                    />
                                    <Bar
                                        dataKey="passive"
                                        fill="#eab308"
                                        name={t('admin.activity.passive', 'Passive')}
                                    />
                                    <Bar
                                        dataKey="inactive"
                                        fill="#9ca3af"
                                        name={t('admin.activity.inactive', 'Inactive')}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">
                            {t('admin.activity.noData', 'No activity data yet')}
                        </div>
                    )}

                    {/* Recipients section (admin only) */}
                    {isAdmin && (
                        <div className="mt-8 rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {t(
                                        'admin.activity.reportRecipients',
                                        'Report Recipients'
                                    )}
                                </h2>
                                <button
                                    onClick={handleSendReport}
                                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                                >
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                    {t(
                                        'admin.activity.sendNow',
                                        'Send Report Now'
                                    )}
                                </button>
                            </div>

                            {/* Add recipient */}
                            <div className="mb-4 flex gap-2">
                                <input
                                    type="email"
                                    value={newRecipientEmail}
                                    onChange={(e) =>
                                        setNewRecipientEmail(e.target.value)
                                    }
                                    placeholder={t(
                                        'admin.activity.addRecipientPlaceholder',
                                        'Enter email address'
                                    )}
                                    className="flex-1 rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                            handleAddRecipient();
                                    }}
                                />
                                <button
                                    onClick={handleAddRecipient}
                                    className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            </div>

                            {/* Recipient list */}
                            {recipients.length > 0 ? (
                                <ul className="divide-y dark:divide-gray-700">
                                    {recipients.map((r) => (
                                        <li
                                            key={r.id}
                                            className="flex items-center justify-between py-2"
                                        >
                                            <span
                                                className={`text-sm ${r.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}
                                            >
                                                {r.email}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={r.enabled}
                                                        onChange={() =>
                                                            handleToggleRecipient(
                                                                r.id,
                                                                r.enabled
                                                            )
                                                        }
                                                        className="peer sr-only"
                                                    />
                                                    <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-gray-600"></div>
                                                </label>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteRecipient(
                                                            r.id
                                                        )
                                                    }
                                                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    {t(
                                        'admin.activity.noRecipients',
                                        'No recipients configured'
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Daily Tab */}
            {activeTab === 'daily' && (
                <div>
                    {/* Date picker and filter */}
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                        <input
                            type="date"
                            value={dailyDate}
                            onChange={(e) => setDailyDate(e.target.value)}
                            className="rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                        <div className="flex gap-1">
                            {(
                                [
                                    'all',
                                    'active',
                                    'passive',
                                    'inactive',
                                ] as StatusFilter[]
                            ).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                        statusFilter === s
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User table */}
                    {loadingDaily ? (
                        <div className="py-12 text-center text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-800">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.name', 'Name')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.email', 'Email')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.status', 'Status')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.firstSeen', 'First Seen')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.lastSeen', 'Last Seen')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.actions', 'Actions')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {filteredUsers.map((u) => (
                                        <tr
                                            key={u.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                {u.name
                                                    ? `${u.name}${u.surname ? ` ${u.surname}` : ''}`
                                                    : '\u2014'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {u.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status={u.status}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatTime(u.first_seen_at)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatTime(u.last_seen_at)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatActionSummary(
                                                    u.action_counts
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-gray-500"
                                            >
                                                {t(
                                                    'admin.activity.noUsersFound',
                                                    'No users found'
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminActivityPage;
```

- [ ] **Step 2: Add route in App.tsx**

In `frontend/App.tsx`, add the `/admin/activity` route after the `/admin/users` route block (after line 309).

The access control in the spec says both admins AND report recipients should see the Activity tab. We allow all authenticated users through on the frontend (the backend `requireActivityAccess` middleware handles the real authorization, returning 403 for unauthorized users). Pass `isAdmin` as a prop to control recipient management visibility:

```tsx
                            <Route
                                path="/admin/activity"
                                element={
                                    <React.Suspense
                                        fallback={
                                            <div className="p-4">
                                                Loading...
                                            </div>
                                        }
                                    >
                                        {React.createElement(
                                            React.lazy(
                                                () =>
                                                    import(
                                                        './components/Admin/AdminActivityPage'
                                                    )
                                            ),
                                            { isAdmin: currentUser?.is_admin === true }
                                        )}
                                    </React.Suspense>
                                }
                            />
```

- [ ] **Step 3: Add navigation link**

Find where the admin nav link lives (likely in the sidebar/Layout component). Add an "Activity" link next to the existing "Users" admin link that points to `/admin/activity`. This link should be visible to admins. Non-admin recipients will need to navigate directly to `/admin/activity`.

Search for the admin users navigation link in the Layout or Sidebar component and add a matching link for activity. The exact file and location depends on the sidebar implementation — search for `admin/users` in the frontend components to find it.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/components/Admin/AdminActivityPage.tsx frontend/App.tsx
git commit -m "[ASID-XXX] Add admin activity dashboard frontend"
```

---

## Task 9: Full Integration Test + Verify

**Files:**
- All test files

- [ ] **Step 1: Run all backend tests**

Run: `npm test`
Expected: All ~1090+ tests pass (including new activity tests)

- [ ] **Step 2: Run frontend tests**

Run: `npm run frontend:test`
Expected: All ~137+ tests pass

- [ ] **Step 3: Run lint and format**

Run: `npm run lint:fix && npm run format:fix`
Expected: No errors

- [ ] **Step 4: Manual smoke test**

Start the dev servers:
```bash
npm run start
```

1. Log in as admin
2. Navigate to `/admin/activity`
3. Verify the trends tab loads with chart and summary cards
4. Switch to daily tab — verify user table shows current user as passive (just opened the app)
5. Create a task — verify the status upgrades to active on page refresh
6. Add a report recipient email
7. Click "Send Report Now" — verify it sends (or logs if email not configured)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
npm run lint:fix && npm run format:fix
git add -A
git commit -m "[ASID-XXX] Fix integration issues from smoke testing"
```
