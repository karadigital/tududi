# Autosubscribe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Dispatch parallel subagents per phase.

**Goal:** Replace hardcoded dept-admin auto-subscribe with a configurable subscribers list per department.

**Architecture:** New `areas_subscribers` junction table stores who gets auto-subscribed. On task creation, query this table instead of `areas_members`. Dept admins are auto-managed on the list. New REST endpoints for CRUD. Frontend adds "Subscribers" section to existing members modal.

**Tech Stack:** Node.js/Express, Sequelize (SQLite), React/TypeScript, Jest, supertest

**Design doc:** `docs/plans/2026-02-16-autosubscribe-design.md`

---

## Phase 1: Database Foundation (Sequential — all others depend on this)

### Task 1: Create migration, model, and associations

**Files:**
- Create: `backend/migrations/20260216000001-create-areas-subscribers.js`
- Create: `backend/models/areas_subscriber.js`
- Modify: `backend/models/index.js:91` (add model registration) and `:108-120` (add associations)

**Step 1: Create the migration**

```js
// backend/migrations/20260216000001-create-areas-subscribers.js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('areas_subscribers', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            added_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            source: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'manual',
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

        await queryInterface.addIndex('areas_subscribers', ['area_id', 'user_id'], {
            unique: true,
            name: 'areas_subscribers_unique_idx',
        });

        await queryInterface.addIndex('areas_subscribers', ['area_id'], {
            name: 'areas_subscribers_area_id_idx',
        });

        await queryInterface.addIndex('areas_subscribers', ['user_id'], {
            name: 'areas_subscribers_user_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('areas_subscribers');
    },
};
```

**Step 2: Create the Sequelize model**

```js
// backend/models/areas_subscriber.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AreasSubscriber = sequelize.define(
        'AreasSubscriber',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            added_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            source: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'manual',
            },
        },
        {
            tableName: 'areas_subscribers',
            indexes: [
                {
                    unique: true,
                    fields: ['area_id', 'user_id'],
                    name: 'areas_subscribers_unique_idx',
                },
                { fields: ['area_id'], name: 'areas_subscribers_area_id_idx' },
                { fields: ['user_id'], name: 'areas_subscribers_user_id_idx' },
            ],
        }
    );

    return AreasSubscriber;
};
```

**Step 3: Register model and add associations in `backend/models/index.js`**

After line 91 (`const AreasMember = ...`), add:
```js
const AreasSubscriber = require('./areas_subscriber')(sequelize);
```

After the Area-User members associations (after line 120), add:
```js
// Area-User subscribers many-to-many relationship
Area.belongsToMany(User, {
    through: AreasSubscriber,
    foreignKey: 'area_id',
    otherKey: 'user_id',
    as: 'Subscribers',
});
User.belongsToMany(Area, {
    through: AreasSubscriber,
    foreignKey: 'user_id',
    otherKey: 'area_id',
    as: 'SubscribedAreas',
});
```

Add `AreasSubscriber` to the `module.exports` object (line ~284).

**Step 4: Run migrations and verify**

```bash
cd backend && npx cross-env NODE_ENV=test npx sequelize-cli db:migrate
```

**Step 5: Commit**

```
[ASID-XXX] Add areas_subscribers table, model, and associations
```

---

## Phase 2: Backend Logic (4 Parallel Tracks)

> After Phase 1 is committed, dispatch these 4 tracks as parallel subagents.

### Task 2A: Subscriber CRUD service + API routes + integration tests

**Files:**
- Create: `backend/services/areaSubscriberService.js`
- Modify: `backend/routes/areas.js:433` (add new routes before `module.exports`)
- Create: `backend/tests/integration/areas-subscribers.test.js`

**Context the subagent needs:**
- Design doc: `docs/plans/2026-02-16-autosubscribe-design.md`
- Route patterns: `backend/routes/areas.js` (lines 288-433 for member routes pattern)
- Auth middleware: `hasAccess('admin', 'area', (req) => req.params.uid)` for authorization
- Existing service pattern: `backend/services/areaMembershipService.js` (use `canManageAreaMembers()`)
- Test pattern: `backend/tests/integration/areas.test.js` (supertest + createTestUser)
- Test helper: `backend/tests/helpers/testUtils.js`
- Model imports: `const { Area, User, AreasSubscriber, sequelize } = require('../models');`

**Service: `backend/services/areaSubscriberService.js`**

Functions to implement:
- `getAreaSubscribers(areaUid)` — Find area by uid, query `AreasSubscriber` joined with `User` for that area. Return array of user objects with `source` and `added_by` fields.
- `addAreaSubscriber(areaId, userId, addedBy, source = 'manual')` — Insert into `areas_subscribers`. Check for existing entry first → throw 'User is already a subscriber' if exists. Validate user exists → throw 'User not found' if not.
- `removeAreaSubscriber(areaId, userId, source = null)` — Delete from `areas_subscribers`. If `source` is provided, only delete matching source. Throw 'User is not a subscriber' if no rows deleted.
- `isAreaSubscriber(areaId, userId)` — Returns the subscriber row or null.

**Routes to add in `backend/routes/areas.js`** (before the final `module.exports = router;`):

1. `GET /departments/:uid/subscribers` — `hasAccess('admin', 'area', ...)`, calls `getAreaSubscribers(req.params.uid)`, returns `{ subscribers: [...] }`
2. `POST /departments/:uid/subscribers` — `hasAccess('admin', 'area', ...)`, validates `user_id` in body, finds area by uid, calls `addAreaSubscriber(area.id, user_id, currentUserId, 'manual')`. If `retroactive: true` in body, also loop through all tasks in the department and call `subscribeToTask()` for each. Returns `{ subscribers: updatedList }`.
3. `DELETE /departments/:uid/subscribers/:userId` — `hasAccess('admin', 'area', ...)`, finds area by uid, checks subscriber exists and `source !== 'admin_role'` → 400 error "Cannot remove admin-role subscribers manually". Calls `removeAreaSubscriber(area.id, userId)`. Returns `{ subscribers: updatedList }`.

**Integration tests (`backend/tests/integration/areas-subscribers.test.js`):**

Setup: Create admin user (is_admin: true), create department, add admin as dept admin. Create regular member user. Create non-member user.

Positive tests:
- GET returns empty list for new department
- POST adds a subscriber, GET returns it with source='manual'
- POST with retroactive=true subscribes to existing tasks in dept
- DELETE removes a manual subscriber
- Dept admin can manage subscribers
- Superuser can manage subscribers

Negative tests:
- POST duplicate subscriber → 409
- DELETE non-existent subscriber → 404
- POST/DELETE by regular member (not admin) → 403
- POST with missing user_id → 400
- POST with nonexistent user_id → 404
- GET/POST/DELETE on nonexistent department → 404
- DELETE admin_role subscriber → 400

**Commit:** `[ASID-XXX] Add subscriber CRUD service, API routes, and integration tests`

---

### Task 2B: Update subscribeDepartmentAdmins + unit tests

**Files:**
- Modify: `backend/services/taskSubscriptionService.js:450-493`
- Modify: `backend/tests/unit/taskSubscriptionService.test.js`

**Context the subagent needs:**
- Current function: `backend/services/taskSubscriptionService.js` lines 450-493
- Current tests: `backend/tests/unit/taskSubscriptionService.test.js` (entire file)
- The function currently queries `AreasMember` for admins. Change it to query `AreasSubscriber` instead.
- Model: `AreasSubscriber` (imported from `../models`)

**Changes to `subscribeDepartmentAdmins()` (lines 450-493):**

Replace the function body:
1. Add `AreasSubscriber` to the destructured imports at top of file (line 6): add to `require('../models')`
2. Instead of `AreasMember.findOne({ where: { user_id: taskOwnerId } })` → still need to find owner's department, so keep this query
3. Instead of `AreasMember.findAll({ where: { area_id, role: 'admin' } })` → replace with `AreasSubscriber.findAll({ where: { area_id: membership.area_id } })`
4. Loop through subscribers (not admins), skip owner, call `subscribeToTask()` for each — same pattern as current

Updated function:
```js
async function subscribeDepartmentAdmins(taskId, taskOwnerId) {
    try {
        const membership = await AreasMember.findOne({
            where: { user_id: taskOwnerId },
        });

        if (!membership) {
            return;
        }

        const subscribers = await AreasSubscriber.findAll({
            where: { area_id: membership.area_id },
        });

        if (!subscribers || subscribers.length === 0) {
            return;
        }

        for (const subscriber of subscribers) {
            if (subscriber.user_id === taskOwnerId) {
                continue;
            }

            try {
                await subscribeToTask(taskId, subscriber.user_id, taskOwnerId);
            } catch (error) {
                if (error.message !== 'User already subscribed') {
                    logError(
                        `Error subscribing user ${subscriber.user_id} to task ${taskId}:`,
                        error
                    );
                }
            }
        }
    } catch (error) {
        logError('Error in subscribeDepartmentAdmins:', error);
    }
}
```

**Unit test updates (`backend/tests/unit/taskSubscriptionService.test.js`):**

Update the mock to include `AreasSubscriber` instead of using `AreasMember.findAll` for admins:

```js
// Add to the jest.mock block:
AreasSubscriber: {
    findAll: jest.fn(),
},
```

Update imports:
```js
const { AreasMember, AreasSubscriber, Task, User, Permission } = require('../../models');
```

Update tests:
- "should subscribe all department subscribers" — mock `AreasSubscriber.findAll` returning `[{ area_id: 1, user_id: 99 }]`
- "should skip when owner is on subscriber list" — mock returning `[{ area_id: 1, user_id: 10 }]`
- "should do nothing when owner has no department" — unchanged (still tests `AreasMember.findOne` returning null)
- "should subscribe multiple subscribers" — mock `AreasSubscriber.findAll` returning 2 entries
- NEW: "should do nothing when department has no subscribers" — mock `AreasSubscriber.findAll` returning `[]`

**Commit:** `[ASID-XXX] Update subscribeDepartmentAdmins to use areas_subscribers table`

---

### Task 2C: Update areaMembershipService for auto-manage + integration tests

**Files:**
- Modify: `backend/services/areaMembershipService.js`
- Create: `backend/tests/integration/areas-subscriber-lifecycle.test.js`

**Context the subagent needs:**
- Service: `backend/services/areaMembershipService.js` (full file — 349 lines)
- Model: `AreasSubscriber` from `../models`
- Service: `backend/services/areaSubscriberService.js` (from Task 2A — use `addAreaSubscriber` and `removeAreaSubscriber`)
- Test pattern: `backend/tests/integration/areas.test.js`

**NOTE:** This task depends on Task 2A's service existing. If running truly parallel, this subagent can import `AreasSubscriber` model directly and do raw inserts/deletes instead of depending on the service. Use the model directly for simplicity.

**Changes to `areaMembershipService.js`:**

Add import at top:
```js
const { Area, User, AreasSubscriber, sequelize } = require('../models');
```

1. **`addAreaMember()` (line 61):** After the `execAction` call (line 144), if `role === 'admin'`, insert into `areas_subscribers`:
```js
if (role === 'admin') {
    try {
        await AreasSubscriber.findOrCreate({
            where: { area_id: areaId, user_id: userId },
            defaults: { added_by: addedBy, source: 'admin_role' },
        });
    } catch (subError) {
        logError('Error auto-subscribing new admin:', subError);
    }
}
```

2. **`updateMemberRole()` (line 268):** After updating permissions (line 301), add:
```js
if (newRole === 'admin') {
    try {
        await AreasSubscriber.findOrCreate({
            where: { area_id: areaId, user_id: userId },
            defaults: { added_by: updatedBy, source: 'admin_role' },
        });
    } catch (subError) {
        logError('Error auto-subscribing promoted admin:', subError);
    }
} else {
    // Demoted from admin — remove admin_role subscriber entry only
    try {
        await AreasSubscriber.destroy({
            where: { area_id: areaId, user_id: userId, source: 'admin_role' },
        });
    } catch (subError) {
        logError('Error removing demoted admin from subscribers:', subError);
    }
}
```

3. **`removeAreaMember()` (line 157):** In the "Regular member removal" section (after line 246), before the `execAction` call, check if the user was an admin subscriber and remove:
```js
// Remove admin_role subscriber entry if exists
try {
    await AreasSubscriber.destroy({
        where: { area_id: areaId, user_id: userId, source: 'admin_role' },
    });
} catch (subError) {
    logError('Error removing subscriber on member removal:', subError);
}
```

Also in the owner removal section (around line 203, after removing from members table), add the same cleanup.

**Integration tests (`backend/tests/integration/areas-subscriber-lifecycle.test.js`):**

Setup: Admin user, create department, second user.

Positive tests:
- Adding member with role='admin' → creates entry in areas_subscribers with source='admin_role'
- Promoting member to admin → creates areas_subscribers entry
- Demoting admin to member → removes areas_subscribers admin_role entry
- Removing admin from department → removes areas_subscribers admin_role entry
- Manually-added subscriber survives admin demotion (add subscriber manually, promote to admin, demote — manual entry stays)

Negative tests:
- Demoting admin who was also manually added → only admin_role entry removed, manual entry persists
- Removing regular member → no effect on areas_subscribers
- Adding member as regular 'member' role → no areas_subscribers entry created

**Commit:** `[ASID-XXX] Auto-manage subscribers on admin role changes`

---

### Task 2D: Retroactive data migration

**Files:**
- Create: `backend/migrations/20260216000002-populate-areas-subscribers-from-admins.js`

**Context the subagent needs:**
- Existing migration pattern: `backend/migrations/20260123000001-subscribe-dept-admins-to-existing-tasks.js`
- This migration is simpler: just insert all current dept admins into `areas_subscribers`

**Migration:**

```js
'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;

        const deptAdmins = await sequelize.query(
            `SELECT area_id, user_id FROM areas_members WHERE role = 'admin'`,
            { type: QueryTypes.SELECT }
        );

        if (!deptAdmins || deptAdmins.length === 0) {
            console.log('No department admins found, skipping migration');
            return;
        }

        const transaction = await sequelize.transaction();

        try {
            let created = 0;
            for (const admin of deptAdmins) {
                // Idempotent: skip if already exists
                const existing = await sequelize.query(
                    `SELECT 1 FROM areas_subscribers WHERE area_id = :areaId AND user_id = :userId`,
                    {
                        replacements: { areaId: admin.area_id, userId: admin.user_id },
                        type: QueryTypes.SELECT,
                        transaction,
                    }
                );

                if (existing && existing.length > 0) {
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO areas_subscribers (area_id, user_id, added_by, source, created_at, updated_at)
                     VALUES (:areaId, :userId, :userId, 'admin_role', datetime('now'), datetime('now'))`,
                    {
                        replacements: { areaId: admin.area_id, userId: admin.user_id },
                        type: QueryTypes.INSERT,
                        transaction,
                    }
                );
                created++;
            }

            await transaction.commit();
            console.log(`Migration complete: ${created} admin subscribers created`);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const sequelize = queryInterface.sequelize;
        await sequelize.query(
            `DELETE FROM areas_subscribers WHERE source = 'admin_role'`,
            { type: QueryTypes.DELETE }
        );
    },
};
```

**Run migration:**
```bash
cd backend && npx cross-env NODE_ENV=test npx sequelize-cli db:migrate
```

**Commit:** `[ASID-XXX] Add retroactive migration to populate areas_subscribers from dept admins`

---

## Phase 3: Frontend (Sequential — depends on Phase 2A API endpoints existing)

### Task 3A: Frontend service functions + entity types

**Files:**
- Modify: `frontend/entities/Area.ts`
- Modify: `frontend/utils/areasService.ts`

**Context the subagent needs:**
- Entity: `frontend/entities/Area.ts` (full file)
- Service: `frontend/utils/areasService.ts` (full file, follow same patterns)

**Add to `frontend/entities/Area.ts`:**

```ts
export interface AreaSubscriber {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
    areas_subscribers?: {
        source: 'manual' | 'admin_role';
        added_by: number;
        created_at: string;
    };
}
```

Add `Subscribers?: AreaSubscriber[];` to the `Area` interface.

**Add to `frontend/utils/areasService.ts`:**

```ts
export const getAreaSubscribers = async (
    areaUid: string
): Promise<AreaSubscriber[]> => {
    const response = await fetch(getApiPath(`departments/${areaUid}/subscribers`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });

    await handleAuthResponse(response, 'Failed to fetch area subscribers.');
    const data = await response.json();
    return data.subscribers;
};

export const addAreaSubscriber = async (
    areaUid: string,
    userId: number,
    retroactive: boolean = false
): Promise<AreaSubscriber[]> => {
    const response = await fetch(getApiPath(`departments/${areaUid}/subscribers`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ user_id: userId, retroactive }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add subscriber');
    }

    const data = await response.json();
    return data.subscribers;
};

export const removeAreaSubscriber = async (
    areaUid: string,
    userId: number
): Promise<AreaSubscriber[]> => {
    const response = await fetch(
        getApiPath(`departments/${areaUid}/subscribers/${userId}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );

    await handleAuthResponse(response, 'Failed to remove subscriber.');
    const data = await response.json();
    return data.subscribers;
};
```

Add `AreaSubscriber` to the import in `areasService.ts`.

**Commit:** `[ASID-XXX] Add frontend subscriber types and service functions`

---

### Task 3B: Subscribers UI section in AreaMembers modal

**Files:**
- Modify: `frontend/components/Area/AreaMembers.tsx`

**Context the subagent needs:**
- Component: `frontend/components/Area/AreaMembers.tsx` (full file — 414 lines)
- Service functions from Task 3A
- Design doc section "Frontend UI Changes"
- i18n pattern: `t('namespace.key', 'Default text')` — keys NOT added to locale files

**Changes to `AreaMembers.tsx`:**

1. Add imports:
```ts
import { AreaSubscriber } from '../../entities/Area';
import {
    getAreaSubscribers,
    addAreaSubscriber,
    removeAreaSubscriber,
} from '../../utils/areasService';
```

2. Add state:
```ts
const [subscribers, setSubscribers] = useState<AreaSubscriber[]>([]);
const [showRetroactiveDropdown, setShowRetroactiveDropdown] = useState<number | null>(null);
const [showAdminWarning, setShowAdminWarning] = useState<{userId: number; action: 'demote' | 'remove'; userName: string} | null>(null);
```

3. Add `useEffect` to fetch subscribers when modal opens (alongside existing `fetchAllUsers`):
```ts
useEffect(() => {
    if (showManageModal && area.uid) {
        fetchSubscribers();
    }
}, [showManageModal]);

const fetchSubscribers = async () => {
    if (!area.uid) return;
    try {
        const subs = await getAreaSubscribers(area.uid);
        setSubscribers(subs);
    } catch (err) {
        console.error('Error fetching subscribers:', err);
    }
};
```

4. Add handler functions:
```ts
const handleAddSubscriber = async (userId: number, retroactive: boolean) => {
    if (!area.uid) return;
    setLoading(true);
    try {
        const updatedSubs = await addAreaSubscriber(area.uid, userId, retroactive);
        setSubscribers(updatedSubs);
        setShowRetroactiveDropdown(null);
        showSuccessToast(t('area.subscriber_added', 'Subscriber added'));
    } catch (err: any) {
        showErrorToast(err.message || t('area.add_subscriber_failed', 'Failed to add subscriber'));
    } finally {
        setLoading(false);
    }
};

const handleRemoveSubscriber = async (userId: number) => {
    if (!area.uid) return;
    setLoading(true);
    try {
        const updatedSubs = await removeAreaSubscriber(area.uid, userId);
        setSubscribers(updatedSubs);
        showSuccessToast(t('area.subscriber_removed', 'Subscriber removed'));
    } catch (err: any) {
        showErrorToast(err.message || t('area.remove_subscriber_failed', 'Failed to remove subscriber'));
    } finally {
        setLoading(false);
    }
};
```

5. Wrap existing `handleChangeRole` and `handleRemoveMember` to check for admin subscriber warning:

Before calling `handleChangeRole(userId, 'member')` — check if user is in subscribers with `source === 'admin_role'`. If yes, show confirmation dialog. Same for `handleRemoveMember` when user is an admin.

```ts
const handleRoleChangeWithWarning = (userId: number, newRole: 'member' | 'admin') => {
    if (newRole === 'member') {
        const sub = subscribers.find(
            (s) => s.id === userId && s.areas_subscribers?.source === 'admin_role'
        );
        if (sub) {
            const userName = sub.name || sub.email;
            setShowAdminWarning({ userId, action: 'demote', userName });
            return;
        }
    }
    handleChangeRole(userId, newRole);
};

const handleRemoveWithWarning = (userId: number) => {
    const member = members.find((m) => m.id === userId);
    if (member && getRole(member) === 'admin') {
        const sub = subscribers.find(
            (s) => s.id === userId && s.areas_subscribers?.source === 'admin_role'
        );
        if (sub) {
            const userName = member.name || member.email;
            setShowAdminWarning({ userId, action: 'remove', userName });
            return;
        }
    }
    handleRemoveMember(userId);
};

const confirmAdminWarning = () => {
    if (!showAdminWarning) return;
    if (showAdminWarning.action === 'demote') {
        handleChangeRole(showAdminWarning.userId, 'member');
    } else {
        handleRemoveMember(showAdminWarning.userId);
    }
    setShowAdminWarning(null);
};
```

6. Add the Subscribers section to the modal body — after the existing user list (`</div>` at line 395), before the modal footer. Separated by a divider:

```tsx
{/* Subscribers section */}
<div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
    <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('area.subscribers', 'Subscribers')}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('area.subscribers_subtitle', 'These users are automatically subscribed to new tasks in this department')}
        </p>
    </div>

    {/* Current subscribers */}
    <div className="space-y-2 mb-3">
        {subscribers.map((sub) => {
            const source = sub.areas_subscribers?.source;
            const isAdminSource = source === 'admin_role';

            return (
                <div key={sub.uid} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        {sub.avatar_image ? (
                            <img src={getApiPath(sub.avatar_image)} alt={sub.name || sub.email} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
                                {(sub.name || sub.email)[0].toUpperCase()}
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{sub.name || sub.email}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isAdminSource ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                                {isAdminSource ? t('area.source_admin', 'Admin') : t('area.source_manual', 'Manual')}
                            </span>
                        </div>
                    </div>
                    {!readOnly && !isAdminSource && (
                        <button
                            onClick={() => handleRemoveSubscriber(sub.id)}
                            disabled={loading}
                            className="px-3 py-1 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 disabled:opacity-50"
                        >
                            {t('common.remove', 'Remove')}
                        </button>
                    )}
                </div>
            );
        })}
        {subscribers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('area.no_subscribers', 'No subscribers')}
            </p>
        )}
    </div>

    {/* Add subscriber */}
    {!readOnly && (
        <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('area.add_subscriber', 'Add subscriber')}
            </p>
            {allUsers
                .filter((u) => !subscribers.some((s) => s.uid === u.uid))
                .map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                        <div className="flex items-center space-x-3">
                            {user.avatar_image ? (
                                <img src={getApiPath(user.avatar_image)} alt={user.name || user.email} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                    {(user.name || user.email)[0].toUpperCase()}
                                </div>
                            )}
                            <span className="text-sm text-gray-700 dark:text-gray-200">{user.name || user.email}</span>
                        </div>
                        <div className="relative">
                            {showRetroactiveDropdown === user.id ? (
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={() => handleAddSubscriber(user.id, false)}
                                        disabled={loading}
                                        className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 disabled:opacity-50"
                                    >
                                        {t('area.future_only', 'Future tasks only')}
                                    </button>
                                    <button
                                        onClick={() => handleAddSubscriber(user.id, true)}
                                        disabled={loading}
                                        className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 disabled:opacity-50"
                                    >
                                        {t('area.all_tasks', 'All existing + future')}
                                    </button>
                                    <button
                                        onClick={() => setShowRetroactiveDropdown(null)}
                                        className="px-1 py-1 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowRetroactiveDropdown(user.id)}
                                    disabled={loading}
                                    className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 disabled:opacity-50"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
        </div>
    )}
</div>
```

7. Add admin warning confirmation dialog (before the modal's closing `</div>`):

```tsx
{showAdminWarning && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('area.admin_warning_title', 'Remove subscriber?')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t(
                    'area.admin_warning_message',
                    'Removing {{name}} as department admin will also remove them from the auto-subscribers list. They will keep existing task subscriptions but won\'t be auto-subscribed to new tasks. Continue?',
                    { name: showAdminWarning.userName }
                )}
            </p>
            <div className="flex justify-end space-x-3">
                <button
                    onClick={() => setShowAdminWarning(null)}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                    {t('common.cancel', 'Cancel')}
                </button>
                <button
                    onClick={confirmAdminWarning}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                    {t('common.continue', 'Continue')}
                </button>
            </div>
        </div>
    </div>
)}
```

8. Update the role dropdown `onChange` and remove button `onClick` to use the warning wrappers:
- Line 337-344: `handleChangeRole(...)` → `handleRoleChangeWithWarning(...)`
- Line 366: `handleRemoveMember(...)` → `handleRemoveWithWarning(...)`

**Commit:** `[ASID-XXX] Add subscribers UI section to department members modal`

---

### Task 3C: Frontend tests

**Files:**
- Create: `frontend/components/Area/__tests__/AreaMembers.test.tsx`

**Context the subagent needs:**
- Component: `frontend/components/Area/AreaMembers.tsx` (after Task 3B changes)
- Test patterns: `frontend/components/Task/TaskForm/__tests__/TaskTitleSection.test.tsx`
- The project uses React Testing Library, jest, and msw or manual fetch mocking

**Tests to write:**

Positive:
- Renders subscribers section with header and subtitle
- Displays subscriber list with correct source badges
- "Add" button shows retroactive dropdown with two options
- Selecting "Future tasks only" calls addAreaSubscriber with retroactive=false
- Selecting "All existing + future" calls addAreaSubscriber with retroactive=true
- Remove button calls removeAreaSubscriber for manual subscribers
- Warning dialog shown when changing admin role to member (when admin is subscriber)
- Warning dialog confirm proceeds with role change

Negative:
- Admin-sourced subscriber has no remove button
- Read-only mode hides add/remove controls
- Subscribers section hidden when readOnly and no subscribers

**Commit:** `[ASID-XXX] Add frontend tests for subscribers UI`

---

## Phase Summary: Parallelism Map

```
Phase 1 (sequential):
  Task 1: Migration + Model + Associations
    │
    ▼
Phase 2 (4 parallel tracks):
  ┌──────────────┬───────────────┬────────────────┬──────────────┐
  │ Task 2A      │ Task 2B       │ Task 2C        │ Task 2D      │
  │ CRUD service │ Update        │ Auto-manage    │ Retroactive  │
  │ + routes     │ subscribeDept │ on role change │ migration    │
  │ + integ tests│ + unit tests  │ + integ tests  │              │
  └──────┬───────┴───────────────┴────────────────┴──────────────┘
         │
         ▼
Phase 3 (sequential, depends on 2A):
  Task 3A: Frontend service + types
    │
    ▼
  Task 3B: Subscribers UI in modal
    │
    ▼
  Task 3C: Frontend tests
```

**Total: 8 tasks, 3 phases, max 4 parallel subagents in Phase 2**

## Final Steps

After all phases complete:
1. Run `npm run lint:fix && npm run format:fix`
2. Run `npm test` (all backend tests)
3. Run `npm run frontend:test` (all frontend tests)
4. Review all changes with `git diff main...HEAD`
5. Use superpowers:finishing-a-development-branch
