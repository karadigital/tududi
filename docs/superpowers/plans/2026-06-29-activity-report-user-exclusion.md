# Per-user Activity Report Exclusion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `@karadigital.co` domain filter in the activity report with a per-user `exclude_from_activity_reports` flag, admin-toggled from a new tab in the activity admin page.

**Architecture:** Add one boolean column to `users`, backfilled so current behavior is preserved. The flag becomes the single source of truth for report inclusion across the email report and both dashboard endpoints. Admins flip it from a new "Report Users" tab that reuses the existing `/admin/users` CRUD routes.

**Tech Stack:** Express + Sequelize (SQLite), Jest + supertest (backend), React + TypeScript + Tailwind (frontend), react-i18next.

## Global Constraints

- Prettier: 4-space indent, semicolons, single quotes, trailing commas (es5). Run `npm run lint:fix` and `npm run format:fix` before every commit.
- i18n: inline fallbacks `t('namespace.key', 'Default text')`. Do NOT add keys to locale JSON.
- Commit messages: no `Co-Authored-By` / no "Generated with Claude Code".
- Backend tests get their schema from `sequelize.sync({ force: true })` (tests/helpers/setup.js) — so the **model field** is what tests see; the migration is for real databases.
- Column name is exactly `exclude_from_activity_reports` everywhere (DB, model, API, frontend).

---

### Task 1: Add `exclude_from_activity_reports` column + model field + backfill migration

**Files:**
- Create: `backend/migrations/20260629000000-add-exclude-from-activity-reports-to-users.js`
- Modify: `backend/models/user.js` (boolean-flags block, near `next_task_suggestion_enabled` ~line 142-146)

**Interfaces:**
- Produces: `User.exclude_from_activity_reports` (BOOLEAN, NOT NULL, default `false`) — read by Tasks 2 and 3.

- [ ] **Step 1: Add the model field**

In `backend/models/user.js`, immediately after the `next_task_suggestion_enabled` field definition block, add:

```javascript
            exclude_from_activity_reports: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
```

- [ ] **Step 2: Create the migration**

Create `backend/migrations/20260629000000-add-exclude-from-activity-reports-to-users.js`:

```javascript
'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'exclude_from_activity_reports',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);

        // Preserve existing behavior: internal staff were excluded by the
        // hardcoded @karadigital.co domain filter that this column replaces.
        await queryInterface.sequelize.query(
            `UPDATE users SET exclude_from_activity_reports = true
             WHERE LOWER(email) LIKE '%@karadigital.co'`
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'users',
            'exclude_from_activity_reports'
        );
    },
};
```

- [ ] **Step 3: Run the migration to verify it applies**

Run: `npm run db:migrate`
Expected: migration `20260629000000-add-exclude-from-activity-reports-to-users` runs without error. Then `npm run db:status` shows it as `up`.

- [ ] **Step 4: Commit**

```bash
git add backend/models/user.js backend/migrations/20260629000000-add-exclude-from-activity-reports-to-users.js
git commit -m "feat: add exclude_from_activity_reports column to users"
```

---

### Task 2: Use the flag in the report + dashboard filters (remove hardcoded domain)

**Files:**
- Modify: `backend/services/activityReportService.js` (`getActivityDataForDate`, ~lines 15-27)
- Modify: `backend/routes/activity.js` (constants ~lines 9-10; `GET /admin/activity` ~lines 59-64; `GET /admin/activity/trends` ~lines 150-159)
- Test: `backend/tests/integration/activity-report.test.js` (add a case in the existing `describe('generateReportHtml')` block)

**Interfaces:**
- Consumes: `User.exclude_from_activity_reports` from Task 1.

- [ ] **Step 1: Write the failing test**

In `backend/tests/integration/activity-report.test.js`, inside `describe('generateReportHtml', ...)`, add:

```javascript
        it('should exclude users flagged exclude_from_activity_reports', async () => {
            const {
                generateReportHtml,
            } = require('../../services/activityReportService');

            const includedUser = await createTestUser({
                email: 'report-included@example.com',
            });
            const excludedUser = await createTestUser({
                email: 'report-excluded@example.com',
            });
            await excludedUser.update({
                exclude_from_activity_reports: true,
            });

            const now = new Date();
            await UserActivity.create({
                user_id: includedUser.id,
                date: '2026-04-09',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
            await UserActivity.create({
                user_id: excludedUser.id,
                date: '2026-04-09',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });

            const html = await generateReportHtml('2026-04-09');
            expect(html).toContain('report-included@example.com');
            expect(html).not.toContain('report-excluded@example.com');
        });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-report.test.js -t "exclude_from_activity_reports"`
Expected: FAIL — `report-excluded@example.com` IS in the HTML, because filtering still keys off email domain, not the flag.

- [ ] **Step 3: Update the service filter**

In `backend/services/activityReportService.js`, replace the top of `getActivityDataForDate` (the `EXCLUDED_DOMAIN` / `isExcluded` constants and the `allUsers`/`reportUsers` block, ~lines 16-25) with:

```javascript
    const allUsers = await User.findAll({
        attributes: [
            'id',
            'email',
            'name',
            'surname',
            'exclude_from_activity_reports',
        ],
    });
    const reportUsers = allUsers.filter(
        (u) => !u.exclude_from_activity_reports
    );
```

(Leave the rest of the function — `reportUserIds`, `totalUsers`, etc. — unchanged.)

- [ ] **Step 4: Update `GET /admin/activity`**

In `backend/routes/activity.js`, in the `GET /admin/activity` handler, replace the `allUsers` fetch + `reportUsers` filter (~lines 59-62) with:

```javascript
        const allUsers = await User.findAll({
            attributes: [
                'id',
                'email',
                'name',
                'surname',
                'exclude_from_activity_reports',
            ],
        });
        const reportUsers = allUsers.filter(
            (u) => !u.exclude_from_activity_reports
        );
```

- [ ] **Step 5: Update `GET /admin/activity/trends`**

In the same file, in the trends handler, replace the `allUsers` fetch + `reportUserIds` build (~lines 151-158) with:

```javascript
            const allUsers = await User.findAll({
                attributes: ['id', 'exclude_from_activity_reports'],
            });
            const reportUserIds = new Set(
                allUsers
                    .filter((u) => !u.exclude_from_activity_reports)
                    .map((u) => u.id)
            );
```

- [ ] **Step 6: Remove the now-unused domain constants**

In `backend/routes/activity.js`, delete lines:

```javascript
const EXCLUDED_DOMAIN = '@karadigital.co';
const isExcludedEmail = (email) => email && email.endsWith(EXCLUDED_DOMAIN);
```

(There are no other references after Steps 4-5. Grep to confirm: `grep -n "isExcludedEmail\|EXCLUDED_DOMAIN" backend/routes/activity.js backend/services/activityReportService.js` returns nothing.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/activity-report.test.js`
Expected: PASS (new test + existing report tests still green).

- [ ] **Step 8: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/services/activityReportService.js backend/routes/activity.js backend/tests/integration/activity-report.test.js
git commit -m "feat: filter activity report by exclude_from_activity_reports flag"
```

---

### Task 3: Expose the flag on the admin users API

**Files:**
- Modify: `backend/routes/admin.js` (`GET /admin/users` ~lines 82-97; `PUT /admin/users/:id` ~lines 173-197; `POST /admin/users` ~lines 108-127)
- Test: `backend/tests/integration/` — add to the existing admin-users test file if one exists, else create `backend/tests/integration/admin-users-exclusion.test.js`

**Interfaces:**
- Consumes: `User.exclude_from_activity_reports` (Task 1).
- Produces: `GET /admin/users` returns `exclude_from_activity_reports` per row; `PUT /admin/users/:id` accepts `{ exclude_from_activity_reports: boolean }`. Consumed by Tasks 4-5.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/admin-users-exclusion.test.js`:

```javascript
const request = require('supertest');
const app = require('../../app');
const { Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

describe('Admin users — exclude_from_activity_reports', () => {
    let adminUser, adminAgent, target;

    beforeEach(async () => {
        adminUser = await createTestUser({ email: 'au-admin@example.com' });
        await Role.destroy({ where: {} });
        await Role.findOrCreate({
            where: { user_id: adminUser.id },
            defaults: { user_id: adminUser.id, is_admin: true },
        });
        adminAgent = await loginAgent('au-admin@example.com');
        target = await createTestUser({ email: 'au-target@example.com' });
    });

    it('PUT then GET reflects the toggle', async () => {
        const put = await adminAgent
            .put(`/api/admin/users/${target.id}`)
            .send({ exclude_from_activity_reports: true });
        expect(put.status).toBe(200);
        expect(put.body.exclude_from_activity_reports).toBe(true);

        const list = await adminAgent.get('/api/admin/users');
        expect(list.status).toBe(200);
        const row = list.body.find((u) => u.id === target.id);
        expect(row.exclude_from_activity_reports).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/admin-users-exclusion.test.js`
Expected: FAIL — `put.body.exclude_from_activity_reports` is `undefined` (route ignores the field).

- [ ] **Step 3: Add the field to `GET /admin/users`**

In `backend/routes/admin.js`, in `GET /admin/users`: add `'exclude_from_activity_reports'` to the `attributes` array, and add to the response map object:

```javascript
            exclude_from_activity_reports: u.exclude_from_activity_reports,
```

- [ ] **Step 4: Accept the field in `PUT /admin/users/:id`**

In the `PUT /admin/users/:id` handler, after the name/surname update lines and before `await user.save();`, add:

```javascript
        if (req.body.exclude_from_activity_reports !== undefined) {
            user.exclude_from_activity_reports =
                !!req.body.exclude_from_activity_reports;
        }
```

Then add to the response object (the `res.json({ ... })` near the end of the handler):

```javascript
            exclude_from_activity_reports: user.exclude_from_activity_reports,
```

- [ ] **Step 5: Accept the field on create in `POST /admin/users` (optional field)**

In the `POST /admin/users` handler, after `if (surname) userData.surname = surname;`, add:

```javascript
        if (req.body.exclude_from_activity_reports !== undefined) {
            userData.exclude_from_activity_reports =
                !!req.body.exclude_from_activity_reports;
        }
```

And add to its `res.status(201).json({ ... })` response object:

```javascript
            exclude_from_activity_reports: user.exclude_from_activity_reports,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/admin-users-exclusion.test.js`
Expected: PASS.

- [ ] **Step 7: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add backend/routes/admin.js backend/tests/integration/admin-users-exclusion.test.js
git commit -m "feat: expose exclude_from_activity_reports on admin users API"
```

---

### Task 4: Add frontend service functions

**Files:**
- Modify: `frontend/utils/activityService.ts`

**Interfaces:**
- Consumes: `GET /admin/users`, `PUT /admin/users/:id` (Task 3).
- Produces: `AdminUserRow` type; `fetchAdminUsers()`; `setUserActivityExclusion(id, excluded)` — consumed by Task 5.

- [ ] **Step 1: Add the type**

In `frontend/utils/activityService.ts`, after the `ReportRecipient` interface (~line 43), add:

```typescript
export interface AdminUserRow {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    role: 'admin' | 'user';
    exclude_from_activity_reports: boolean;
}
```

- [ ] **Step 2: Add the fetch + update functions**

At the end of `frontend/utils/activityService.ts`, add:

```typescript
export const fetchAdminUsers = async (): Promise<AdminUserRow[]> => {
    const response = await fetch(getApiPath('admin/users'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch users.');
    return await response.json();
};

export const setUserActivityExclusion = async (
    id: number,
    excluded: boolean
): Promise<AdminUserRow> => {
    const response = await fetch(getApiPath(`admin/users/${id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ exclude_from_activity_reports: excluded }),
    });
    await handleAuthResponse(response, 'Failed to update user.');
    return await response.json();
};
```

- [ ] **Step 3: Type-check**

Run: `npm run build` (or `cd frontend && npx tsc --noEmit`)
Expected: no TypeScript errors.

- [ ] **Step 4: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/utils/activityService.ts
git commit -m "feat: add admin users service functions for report exclusion"
```

---

### Task 5: Add the "Report Users" tab to the activity admin page

**Files:**
- Modify: `frontend/components/Admin/AdminActivityPage.tsx`

**Interfaces:**
- Consumes: `AdminUserRow`, `fetchAdminUsers`, `setUserActivityExclusion` (Task 4); `useToast` (already imported).

- [ ] **Step 1: Extend imports and the tab type**

In `AdminActivityPage.tsx`, add to the `activityService` import list (~lines 19-32):

```typescript
    AdminUserRow,
    fetchAdminUsers,
    setUserActivityExclusion,
```

Change the `TabType` (line 34) to:

```typescript
type TabType = 'trends' | 'daily' | 'report-users';
```

- [ ] **Step 2: Add state and a loader for report users**

After the recipients state block (~line 128), add:

```typescript
    // Report-users tab state
    const [reportUsers, setReportUsers] = useState<AdminUserRow[]>([]);
    const [loadingReportUsers, setLoadingReportUsers] = useState(false);
```

Then, with the other `useCallback`/`useEffect` hooks in the component, add a loader and fetch-on-tab-open:

```typescript
    const loadReportUsers = useCallback(async () => {
        setLoadingReportUsers(true);
        try {
            const data = await fetchAdminUsers();
            setReportUsers(data);
        } catch {
            showErrorToast(
                t('admin.activity.loadUsersError', 'Failed to load users')
            );
        } finally {
            setLoadingReportUsers(false);
        }
    }, [showErrorToast, t]);

    useEffect(() => {
        if (activeTab === 'report-users') {
            loadReportUsers();
        }
    }, [activeTab, loadReportUsers]);

    const handleToggleReportUser = async (
        id: number,
        currentlyExcluded: boolean
    ) => {
        try {
            await setUserActivityExclusion(id, !currentlyExcluded);
            setReportUsers((prev) =>
                prev.map((u) =>
                    u.id === id
                        ? {
                              ...u,
                              exclude_from_activity_reports: !currentlyExcluded,
                          }
                        : u
                )
            );
            showSuccessToast(
                t('admin.activity.userUpdated', 'User updated')
            );
        } catch {
            showErrorToast(
                t('admin.activity.userUpdateError', 'Failed to update user')
            );
        }
    };
```

- [ ] **Step 3: Add the third tab button**

In the tab bar (the `flex gap-1 rounded-lg` block, after the `daily` button ~line 338), add:

```tsx
                <button
                    onClick={() => setActiveTab('report-users')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'report-users'
                            ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('admin.activity.reportUsers', 'Report Users')}
                </button>
```

- [ ] **Step 4: Add the tab render block**

After the closing of the `daily` tab's render block (and before the recipients modal / component close), add:

```tsx
            {/* Report Users Tab */}
            {activeTab === 'report-users' && (
                <div>
                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'admin.activity.reportUsersHelp',
                            'Users switched off are excluded from the activity report.'
                        )}
                    </p>
                    {loadingReportUsers ? (
                        <p className="text-sm text-gray-500">
                            {t('admin.activity.loading', 'Loading…')}
                        </p>
                    ) : (
                        <ul className="divide-y dark:divide-gray-700">
                            {reportUsers.map((u) => {
                                const included =
                                    !u.exclude_from_activity_reports;
                                return (
                                    <li
                                        key={u.id}
                                        className="flex items-center justify-between py-2"
                                    >
                                        <span
                                            className={`text-sm ${included ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}
                                        >
                                            {u.name || u.surname
                                                ? `${u.name || ''} ${u.surname || ''}`.trim()
                                                : u.email}
                                            <span className="ml-2 text-xs text-gray-400">
                                                {u.email}
                                            </span>
                                        </span>
                                        <label className="relative inline-flex cursor-pointer items-center">
                                            <input
                                                type="checkbox"
                                                checked={included}
                                                onChange={() =>
                                                    handleToggleReportUser(
                                                        u.id,
                                                        u.exclude_from_activity_reports
                                                    )
                                                }
                                                aria-label={t(
                                                    'admin.activity.toggleReportUser',
                                                    `Toggle ${u.email} in report`
                                                )}
                                                className="peer sr-only"
                                            />
                                            <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-gray-600"></div>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
```

- [ ] **Step 5: Type-check and build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run the app (`npm run start`), log in as admin, open Admin → User Activity → "Report Users" tab. Toggle a user off → toast appears → user shows struck-through. Reload → state persists.

- [ ] **Step 7: Lint, format, commit**

```bash
npm run lint:fix && npm run format:fix
git add frontend/components/Admin/AdminActivityPage.tsx
git commit -m "feat: add Report Users tab to admin activity page"
```

---

## Self-Review

- **Spec coverage:** Data model → Task 1. Backend filter (3 spots, remove domain) → Task 2. Admin API (GET/PUT/POST) → Task 3. Frontend service → Task 4. New tab UI → Task 5. Backend filter test → Task 2 Step 1. All spec sections mapped.
- **Placeholder scan:** No TBD/TODO; every code step shows full code.
- **Type consistency:** `exclude_from_activity_reports` used verbatim in model, migration, routes, service `attributes`, `AdminUserRow`, and both service functions. `fetchAdminUsers` / `setUserActivityExclusion` defined in Task 4, consumed in Task 5. `AdminUserRow` shape matches the `GET /admin/users` response built in Task 3.
- **Note:** `getActivityDataForDate` is not exported, so Task 2's test exercises the filter through `generateReportHtml` (matches existing test style).
