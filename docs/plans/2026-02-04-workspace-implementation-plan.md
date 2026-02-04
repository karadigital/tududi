# Workspace Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "workspace" feature that groups projects into named collections, with sidebar navigation, a list/detail page, and task grouping support.

**Architecture:** One new `workspaces` table with a nullable `workspace_id` FK on `projects`. Backend CRUD routes at `/api/v1/workspaces`. Frontend adds sidebar section, list page, detail page (reusing Projects component), and two new task grouping modes. Workspace visibility is derived from project access.

**Tech Stack:** Node.js/Express/Sequelize (backend), React/TypeScript/Zustand/Tailwind (frontend)

**Design doc:** `docs/plans/2026-02-04-workspace-feature-design.md`

---

## Task 1: Database Migration — Create workspaces table [ASID-858] ⚙️ PARALLEL-GROUP-A

**Files:**
- Create: `backend/migrations/20260204000001-create-workspaces-table.js`

**Step 1: Create migration file**

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('workspaces', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            creator: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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

        await queryInterface.addIndex('workspaces', ['uid'], {
            name: 'workspaces_uid_index',
            unique: true,
        });
        await queryInterface.addIndex('workspaces', ['creator'], {
            name: 'workspaces_creator_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('workspaces');
    },
};
```

**Step 2: Run migration**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: Migration runs successfully.

**Step 3: Commit**

```bash
git add backend/migrations/20260204000001-create-workspaces-table.js
git commit -m "[ASID-858] Add workspaces table migration"
```

---

## Task 2: Database Migration — Add workspace_id to projects [ASID-858] ⚙️ PARALLEL-GROUP-A

**Files:**
- Create: `backend/migrations/20260204000002-add-workspace-id-to-projects.js`

**Step 1: Create migration file**

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('projects', 'workspace_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'workspaces',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('projects', ['workspace_id'], {
            name: 'projects_workspace_id_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_workspace_id_index');
        await queryInterface.removeColumn('projects', 'workspace_id');
    },
};
```

**Step 2: Run migration**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: Migration runs successfully.

**Step 3: Commit**

```bash
git add backend/migrations/20260204000002-add-workspace-id-to-projects.js
git commit -m "[ASID-858] Add workspace_id column to projects table"
```

---

## Task 3: Backend Model — Workspace model + associations [ASID-858]

**Depends on:** Tasks 1–2 (migrations must exist)

**Files:**
- Create: `backend/models/workspace.js`
- Modify: `backend/models/project.js` — add `workspace_id` field
- Modify: `backend/models/index.js` — add Workspace model import, associations, and export

**Step 1: Create Workspace model**

Create `backend/models/workspace.js` following the pattern in `backend/models/area.js`:

```javascript
const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const Workspace = sequelize.define(
        'Workspace',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            creator: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'workspaces',
            indexes: [
                {
                    fields: ['creator'],
                },
            ],
        }
    );

    return Workspace;
};
```

**Step 2: Add workspace_id to Project model**

In `backend/models/project.js`, add `workspace_id` field to the model definition (after `area_id`):

```javascript
workspace_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
        model: 'workspaces',
        key: 'id',
    },
},
```

**Step 3: Add associations and export in models/index.js**

In `backend/models/index.js`:

1. Import the Workspace model (near other model imports):
```javascript
const Workspace = require('./workspace')(sequelize);
```

2. Add associations (near the Project/Area associations):
```javascript
User.hasMany(Workspace, { foreignKey: 'creator' });
Workspace.belongsTo(User, { foreignKey: 'creator', as: 'Creator' });

Workspace.hasMany(Project, { foreignKey: 'workspace_id' });
Project.belongsTo(Workspace, { foreignKey: 'workspace_id', allowNull: true });
```

3. Add `Workspace` to the module.exports object.

**Step 4: Run tests to verify model loads**

Run: `cd backend && cross-env NODE_ENV=test jest tests/integration/tasks.test.js --testNamePattern="should get all tasks" --no-coverage`
Expected: PASS — model loads without errors.

**Step 5: Commit**

```bash
git add backend/models/workspace.js backend/models/project.js backend/models/index.js
git commit -m "[ASID-858] Add Workspace model and associations"
```

---

## Task 4: Backend Routes — Workspace CRUD [ASID-858]

**Depends on:** Task 3

**Files:**
- Create: `backend/routes/workspaces.js`
- Modify: `backend/app.js` — register the new route

**Step 1: Create workspace routes**

Create `backend/routes/workspaces.js` following the pattern in `backend/routes/areas.js`.

Endpoints:
- `GET /workspaces` — List workspaces where user has access to ≥1 project. Use a Sequelize query that joins `workspaces` → `projects` and filters by projects the user can access. Return `[{ uid, name, creator, created_at, project_count }]`.
- `GET /workspaces/:uid` — Get single workspace by uid. Return workspace with `{ uid, name, creator }`.
- `POST /workspace` — Create workspace. Body: `{ name }`. Set `creator` to authenticated user id. Return created workspace.
- `PATCH /workspace/:uid` — Update workspace. Body: `{ name }`. Return updated workspace.
- `DELETE /workspace/:uid` — Delete workspace. Projects' `workspace_id` set to NULL automatically (ON DELETE SET NULL). Return `{ message: 'Workspace deleted' }`.

Key implementation details:
- Import `{ Workspace, Project, User, sequelize }` from models
- Use `getAuthenticatedUserId(req)` from `backend/utils/auth-utils.js` for auth
- Use `validateUid('uid')` middleware from `backend/middleware/validators.js` on param routes
- For GET /workspaces visibility: query workspaces that have at least one project where `user_id = currentUserId` OR the project is shared with the user. A simple approach: find all project IDs the user owns, get distinct workspace_ids, then fetch those workspaces. Also include workspaces the user created (even if no projects yet).
- Use `Sequelize.fn('COUNT', ...)` or a subquery for `project_count`

**Step 2: Register route in app.js**

In `backend/app.js` in the `registerApiRoutes` function, add:
```javascript
app.use(basePath, require('./routes/workspaces'));
```

**Step 3: Write integration tests**

Create `backend/tests/integration/workspaces.test.js` with tests for:
- GET /workspaces — returns only workspaces with accessible projects + user-created workspaces
- GET /workspaces/:uid — returns workspace detail
- POST /workspace — creates workspace
- PATCH /workspace/:uid — updates workspace name
- DELETE /workspace/:uid — deletes workspace, orphans projects

Use test helpers from `backend/tests/helpers/testUtils.js`:
```javascript
const { createTestUser, authenticateUser } = require('../helpers/testUtils');
```

**Step 4: Run tests**

Run: `cd backend && cross-env NODE_ENV=test jest tests/integration/workspaces.test.js --no-coverage`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add backend/routes/workspaces.js backend/app.js backend/tests/integration/workspaces.test.js
git commit -m "[ASID-858] Add workspace CRUD routes and tests"
```

---

## Task 5: Backend — Add workspace filter to projects route [ASID-858]

**Depends on:** Task 3

**Files:**
- Modify: `backend/routes/projects.js` — add `workspace` query param filter + accept `workspace_id` on create/update

**Step 1: Add workspace filter to GET /projects**

In `backend/routes/projects.js`, in the GET `/projects` handler, add a filter for the `workspace` query param (by uid). Pattern: same as the existing `area` filter.

```javascript
// After existing area filter logic
if (req.query.workspace) {
    const workspaceUid = req.query.workspace.split('-')[0]; // Extract uid from uid-slug format
    const workspace = await Workspace.findOne({ where: { uid: workspaceUid } });
    if (workspace) {
        where.workspace_id = workspace.id;
    }
}
```

Import `Workspace` from models at the top of the file.

**Step 2: Accept workspace_id on POST /project and PATCH /project/:uid**

In the POST handler, accept `workspace_id` from `req.body` and include it in the create data.
In the PATCH handler, accept `workspace_id` from `req.body` and include it in the update data. Allow setting to `null` to unassign.

**Step 3: Include Workspace in project serialization**

In GET `/projects` and GET `/project/:uid`, add Workspace to the Sequelize include:
```javascript
{
    model: Workspace,
    attributes: ['id', 'uid', 'name'],
    required: false,
}
```

**Step 4: Run existing project tests + add workspace filter test**

Run: `cd backend && cross-env NODE_ENV=test jest tests/integration/projects.test.js --no-coverage`
Expected: Existing tests still PASS.

**Step 5: Commit**

```bash
git add backend/routes/projects.js
git commit -m "[ASID-858] Add workspace filter and field to projects route"
```

---

## Task 6: Backend — Include workspace data in task serialization [ASID-858]

**Depends on:** Task 3

**Files:**
- Modify: `backend/routes/tasks/utils/constants.js` — nest Workspace include inside Project include
- Modify: `backend/routes/tasks/core/serializers.js` — pass through workspace data

**Step 1: Add Workspace to TASK_INCLUDES**

In `backend/routes/tasks/utils/constants.js`, modify the Project include to nest a Workspace include:

```javascript
const { Tag, Project, Task, User, Workspace } = require('../../../models');

// In TASK_INCLUDES, replace the Project entry:
{
    model: Project,
    attributes: ['id', 'name', 'uid', 'image_url'],
    required: false,
    include: [
        {
            model: Workspace,
            attributes: ['id', 'uid', 'name'],
            required: false,
        },
    ],
},
```

**Step 2: Pass workspace through in serializer**

In `backend/routes/tasks/core/serializers.js`, the serializer already spreads `taskJson.Project` (line 56-61). The nested Workspace will be included automatically since it does `...taskJson.Project`. Verify this works by checking the Project serialization block:

```javascript
Project: taskJson.Project
    ? {
          ...taskJson.Project,
          uid: taskJson.Project.uid,
      }
    : null,
```

The `...taskJson.Project` spread already includes `Workspace` from the nested include. No changes needed to the serializer itself.

**Step 3: Run task tests to verify**

Run: `cd backend && cross-env NODE_ENV=test jest tests/integration/tasks.test.js --testNamePattern="should get all tasks" --no-coverage`
Expected: PASS.

**Step 4: Commit**

```bash
git add backend/routes/tasks/utils/constants.js
git commit -m "[ASID-858] Include workspace data in task serialization"
```

---

## Task 7: Frontend Entity + Service + Store [ASID-858] ⚙️ PARALLEL-GROUP-B

**Depends on:** Task 4 (backend routes must exist)

**Files:**
- Create: `frontend/entities/Workspace.ts`
- Create: `frontend/utils/workspacesService.ts`
- Modify: `frontend/entities/Project.ts` — add optional `Workspace` field
- Modify: `frontend/store/useStore.ts` — add `workspacesStore` slice

**Step 1: Create Workspace entity**

Create `frontend/entities/Workspace.ts`:

```typescript
export interface Workspace {
    id?: number;
    uid?: string;
    name: string;
    creator?: number;
    project_count?: number;
    created_at?: string;
    updated_at?: string;
}
```

**Step 2: Add Workspace to Project entity**

In `frontend/entities/Project.ts`, add import and field:

```typescript
import { Workspace } from './Workspace';
// Add to Project interface:
workspace_id?: number | null;
Workspace?: Workspace | null;
```

**Step 3: Create workspaces service**

Create `frontend/utils/workspacesService.ts` following the pattern in `frontend/utils/areasService.ts`:

```typescript
import { Workspace } from '../entities/Workspace';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export const fetchWorkspaces = async (): Promise<Workspace[]> => {
    const response = await fetch(getApiPath('workspaces'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch workspaces.');
    return await response.json();
};

export const fetchWorkspace = async (uid: string): Promise<Workspace> => {
    const response = await fetch(getApiPath(`workspaces/${uid}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch workspace.');
    return await response.json();
};

export const createWorkspace = async (data: Partial<Workspace>): Promise<Workspace> => {
    const response = await fetch(getApiPath('workspace'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to create workspace.');
    return await response.json();
};

export const updateWorkspace = async (uid: string, data: Partial<Workspace>): Promise<Workspace> => {
    const response = await fetch(getApiPath(`workspace/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to update workspace.');
    return await response.json();
};

export const deleteWorkspace = async (uid: string): Promise<void> => {
    const response = await fetch(getApiPath(`workspace/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to delete workspace.');
};
```

**Step 4: Add workspacesStore to Zustand**

In `frontend/store/useStore.ts`, add the `workspacesStore` slice following the `areasStore` pattern:

1. Add interface:
```typescript
interface WorkspacesStore {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    isLoading: boolean;
    isError: boolean;
    hasLoaded: boolean;
    setWorkspaces: (workspaces: Workspace[]) => void;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (isError: boolean) => void;
    loadWorkspaces: () => Promise<void>;
}
```

2. Add to StoreState interface:
```typescript
workspacesStore: WorkspacesStore;
```

3. Add implementation following `areasStore` pattern with dynamic import of `fetchWorkspaces`.

**Step 5: Commit**

```bash
git add frontend/entities/Workspace.ts frontend/entities/Project.ts frontend/utils/workspacesService.ts frontend/store/useStore.ts
git commit -m "[ASID-858] Add Workspace entity, service, and Zustand store"
```

---

## Task 8: Frontend — Sidebar Workspaces component [ASID-854] ⚙️ PARALLEL-GROUP-B

**Depends on:** Task 7 (entity/store must exist)

**Files:**
- Create: `frontend/components/Sidebar/SidebarWorkspaces.tsx`
- Modify: `frontend/components/Sidebar.tsx` — add SidebarWorkspaces between SidebarProjects and SidebarHabits

**Step 1: Create SidebarWorkspaces component**

Create `frontend/components/Sidebar/SidebarWorkspaces.tsx` following the exact pattern in `SidebarProjects.tsx`:

- Use `RectangleStackIcon` from `@heroicons/react/24/outline` as the icon (collection/stack metaphor)
- Props: `handleNavClick`, `location`, `isDarkMode`, `openWorkspaceModal`
- Navigate to `/workspaces` on click
- Active state when `location.pathname === '/workspaces'` or starts with `/workspaces/`
- "+" button calls `openWorkspaceModal`
- Translation key: `sidebar.workspaces` with fallback "Workspaces"

**Step 2: Add to Sidebar.tsx**

In `frontend/components/Sidebar.tsx`:

1. Import `SidebarWorkspaces`
2. Add an `openWorkspaceModal` prop or handler (follow the pattern of `openProjectModal` / `openAreaModal`)
3. Render `<SidebarWorkspaces>` between `<SidebarProjects>` and the habits/areas section

**Step 3: Commit**

```bash
git add frontend/components/Sidebar/SidebarWorkspaces.tsx frontend/components/Sidebar.tsx
git commit -m "[ASID-854] Add workspace section to sidebar"
```

---

## Task 9: Frontend — Workspace list page [ASID-858]

**Depends on:** Tasks 7, 8

**Files:**
- Create: `frontend/components/Workspaces.tsx`
- Modify: `frontend/App.tsx` — add route

**Step 1: Create Workspaces list page**

Create `frontend/components/Workspaces.tsx` following the pattern in `frontend/components/Areas.tsx`:

- Fetch workspaces from store on mount (using `loadWorkspaces`)
- Display as a responsive card grid (1-4 columns, matching Areas.tsx layout)
- Each card shows workspace name, links to `/workspaces/:uid`
- Dropdown menu per card with Edit/Delete options
- Create button in header opens workspace modal
- Reuse the same card styling and dropdown pattern from Areas.tsx

**Step 2: Create WorkspaceModal component**

Create a simple modal for create/edit workspace. It only needs a `name` text field. Follow existing modal patterns in the codebase (e.g., the area modal pattern).

**Step 3: Add routes to App.tsx**

In `frontend/App.tsx`, add:
```typescript
<Route path="/workspaces" element={<Workspaces />} />
```

Import the `Workspaces` component.

**Step 4: Commit**

```bash
git add frontend/components/Workspaces.tsx frontend/App.tsx
# Include modal file if created separately
git commit -m "[ASID-858] Add workspace list page and routing"
```

---

## Task 10: Frontend — Workspace detail page (project list filtered by workspace) [ASID-857]

**Depends on:** Tasks 5, 7, 9

**Files:**
- Create: `frontend/components/WorkspaceDetail.tsx`
- Modify: `frontend/App.tsx` — add route
- Modify: `frontend/components/Projects.tsx` — ensure it accepts workspace filter prop or use URL param

**Step 1: Create WorkspaceDetail page**

Create `frontend/components/WorkspaceDetail.tsx`:

- Fetch workspace info from `GET /workspaces/:uid` on mount
- Reuse the existing `Projects` component, passing `workspace=:uid` as a filter
- The simplest approach: `WorkspaceDetail` is a thin wrapper that:
  1. Reads `:uid` from URL params
  2. Fetches workspace name for the header
  3. Renders `<Projects />` with a `workspaceFilter` prop or navigates to `/projects?workspace=:uid`

**Option A (preferred — simpler):** Have WorkspaceDetail navigate/render Projects with a workspace query param. The Projects component already supports URL params for filtering. Add `workspace` URL param support to Projects.tsx (same as existing `area` param handling).

In `frontend/components/Projects.tsx`, add workspace URL param parsing (alongside existing area param):
```typescript
const workspaceParam = searchParams.get('workspace');
```

Then filter projects by `workspace_id` or `Workspace.uid` matching the param.

WorkspaceDetail.tsx becomes:
```typescript
// Read uid from params, fetch workspace name, render Projects filtered
const { uid } = useParams();
// Show workspace name as page title, render <Projects workspaceUid={uid} />
```

**Step 2: Add route to App.tsx**

```typescript
<Route path="/workspaces/:uid" element={<WorkspaceDetail />} />
```

**Step 3: Commit**

```bash
git add frontend/components/WorkspaceDetail.tsx frontend/components/Projects.tsx frontend/App.tsx
git commit -m "[ASID-857] Add workspace detail page with filtered project list"
```

---

## Task 11: Frontend — Task grouping by workspace [ASID-858]

**Depends on:** Task 6 (backend includes workspace in task data), Task 7

**Files:**
- Modify: `frontend/components/Task/GroupedTaskList.tsx` — add `workspace` and `workspace_project` grouping logic + rendering
- Modify: `frontend/components/Tasks.tsx` — add new groupBy options to dropdown

**Step 1: Update GroupedTaskList types**

In `frontend/components/Task/GroupedTaskList.tsx`:

1. Update the `groupBy` prop type:
```typescript
groupBy?: 'none' | 'project' | 'assignee' | 'status' | 'involvement' | 'workspace' | 'workspace_project';
```

2. Add new interfaces:
```typescript
interface WorkspaceGroup {
    key: string;
    workspaceName: string;
    tasks: Task[];
    order: number;
}

interface WorkspaceProjectGroup {
    key: string;
    workspaceName: string;
    projects: {
        key: string;
        projectName: string;
        tasks: Task[];
    }[];
    order: number;
}
```

**Step 2: Add workspace grouping logic**

Add a `useMemo` for `groupedByWorkspace`:
- Group tasks by `task.Project?.Workspace?.uid` or `'no_workspace'`
- Each group: workspace name + task count
- "No workspace" group for tasks without a workspace
- Sort: "no_workspace" first, then by insertion order

**Step 3: Add workspace_project grouping logic**

Add a `useMemo` for `groupedByWorkspaceProject`:
- First level: group by workspace (same as above)
- Second level: within each workspace, group by project
- Each workspace group contains an array of project subgroups
- Project subgroup headers get 4-space prefix

**Step 4: Add rendering for workspace grouping**

In the render section (the ternary chain starting at line 682), add branches for:
- `groupBy === 'workspace' && groupedByWorkspace` — render group headers with workspace name + count, then TaskItems
- `groupBy === 'workspace_project' && groupedByWorkspaceProject` — render workspace headers, then indented project subgroup headers (with 4-space prefix or `pl-4` padding), then TaskItems

**Step 5: Update Tasks.tsx groupBy options**

In `frontend/components/Tasks.tsx`:

1. Update the `groupBy` state type (line 69):
```typescript
const [groupBy, setGroupBy] = useState<'none' | 'project' | 'assignee' | 'involvement' | 'workspace' | 'workspace_project'>('none');
```

2. Add `'workspace'` and `'workspace_project'` to the groupBy dropdown array (line 864):
```typescript
{['none', 'project', 'assignee', 'involvement', 'workspace', 'workspace_project'].map((val) => (
```

3. Add translation labels for the new options:
```typescript
: val === 'workspace'
  ? t('tasks.groupByWorkspace', 'Workspace')
  : val === 'workspace_project'
    ? t('tasks.groupByWorkspaceProject', 'Workspace & Project')
```

**Step 6: Commit**

```bash
git add frontend/components/Task/GroupedTaskList.tsx frontend/components/Tasks.tsx
git commit -m "[ASID-858] Add workspace and workspace & project task grouping"
```

---

## Task 12: Run full test suite and fix issues [ASID-858]

**Depends on:** All previous tasks

**Files:** Any files that need fixes

**Step 1: Run backend tests**

Run: `npm test`
Expected: All previously-passing tests still pass.

**Step 2: Run frontend tests**

Run: `npm run frontend:test`
Expected: All tests pass.

**Step 3: Run linting**

Run: `npm run lint`
Expected: No new lint errors.

**Step 4: Fix any issues found**

If tests or linting fail, fix the issues.

**Step 5: Commit fixes if any**

```bash
git commit -m "[ASID-858] Fix test and lint issues"
```

---

## Parallelization Guide

Tasks are designed for maximum parallel execution:

```
PARALLEL-GROUP-A (no dependencies):
  Task 1: Migration — create workspaces table
  Task 2: Migration — add workspace_id to projects

Sequential (depends on Group A):
  Task 3: Backend model + associations

PARALLEL-GROUP-B (depends on Task 3):
  Task 4: Backend workspace CRUD routes
  Task 5: Backend workspace filter on projects route
  Task 6: Backend workspace in task serialization

PARALLEL-GROUP-C (depends on Tasks 4-6):
  Task 7: Frontend entity + service + store
  Task 8: Frontend sidebar (depends on 7)

PARALLEL-GROUP-D (depends on Group C):
  Task 9: Frontend workspace list page
  Task 10: Frontend workspace detail page
  Task 11: Frontend task grouping

Sequential (depends on all):
  Task 12: Full test suite verification
```

**Subagent dispatch opportunities:**
- Tasks 1 + 2 → dispatch in parallel (both are standalone migration files)
- Tasks 4 + 5 + 6 → dispatch in parallel (all modify different backend files, depend on Task 3)
- Tasks 7 is prerequisite for 8, 9, 10, 11 — run 7 first, then dispatch 8 + 9 + 10 + 11 in parallel (they modify different frontend files)
