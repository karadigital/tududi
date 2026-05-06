# Workspace Owner Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show workspace owner email alongside workspace name across the Workspaces list, Workspace detail header, and Project banner badge, so users can disambiguate workspaces with similar names.

**Architecture:** Backend adds an `owner_email` field to every workspace payload by joining `users` on `workspaces.creator` (raw SQL for `GET /workspaces`, Sequelize `include` elsewhere) and flattening `Creator.email` server-side. Frontend `Workspace` entity gains `owner_email?: string` (which propagates automatically through `project.Workspace`); three render surfaces display it (stacked under the name on list/detail, inline with `·` separator on the banner badge). Missing email is handled defensively via `LEFT JOIN` + `console.log`.

**Tech Stack:** Express/Sequelize backend, raw SQL + ORM, React/TypeScript frontend, Jest integration tests (backend), Jest + React Testing Library (frontend).

**Ticket:** ASID-1017 · **Branch:** `feature/ASID-1017-add-owner-name-to-workspace` · **Spec:** `docs/superpowers/specs/2026-04-22-workspace-owner-display-design.md`

---

## Parallelization overview

| Phase | Tracks | Parallel? | Notes |
|-------|--------|-----------|-------|
| Phase 1 (backend) | Track A: `workspaces.js` (Tasks 1–2) / Track B: `projects.js` (Task 3) | **Yes — 2 subagents** | Different files; no shared lines |
| Phase 2 (frontend type) | Task 4 | No (blocker) | Must land before Phase 3 |
| Phase 3 (frontend UI) | Tasks 5, 6, 7 | **Yes — 3 subagents** | 3 independent components (`Workspaces.tsx`, `WorkspaceDetail.tsx`, `ProjectBanner.tsx`) |
| Phase 4 (verify) | Task 8 | No | Final lint/format/full test run after all tracks merge |

Dependency graph:
```
      ┌── Task 1 ──┐
Start ┤            ├── Task 4 ── Task 5 ┐
      └── Task 2 ──┤             Task 6 ├── Task 8 (verify) ── Done
                   └── Task 3 ── Task 7 ┘
```

When dispatching subagents: run Tasks 1, 2, 3 as three parallel subagents (same phase, different files). Merge / commit each track. Then run Task 4 solo. Then dispatch Tasks 5, 6, 7 as three parallel subagents.

---

## File Structure

**Modify:**
- `backend/routes/workspaces.js` — add `owner_email` to `GET /workspaces` (raw SQL) and `GET /workspaces/:uid` (Sequelize include + flatten)
- `backend/routes/projects.js` — extend three `include: { model: Workspace }` sites (lines 299, 509, 805) with nested `Creator.email` include + flatten each project response
- `backend/tests/integration/workspaces.test.js` — assertions for `owner_email` on list + detail responses
- `backend/tests/integration/projects.test.js` — assertion for `owner_email` on `project.Workspace` in responses
- `frontend/entities/Workspace.ts` — add `owner_email?: string`
- `frontend/components/Workspaces.tsx` — stacked name + email rendering on list cards
- `frontend/components/Workspace/WorkspaceDetail.tsx` — stacked subtitle under detail header
- `frontend/components/Project/ProjectBanner.tsx` — inline `Name · email` inside badge

**Create:** None.

**No migrations, no association changes** (`Workspace.belongsTo(User, { foreignKey: 'creator', as: 'Creator' })` already exists in `backend/models/index.js`).

---

## Phase 1 — Backend

### Task 1: GET /workspaces returns owner_email

**Parallel:** Runnable in parallel with Task 2 (different file) and Task 3 (different file). If two subagents both touch `workspaces.js`, run Task 1 and Task 2 serially.

**Files:**
- Modify: `backend/routes/workspaces.js:28-98`
- Test: `backend/tests/integration/workspaces.test.js` (extend existing `describe('GET /api/workspaces')` block)

- [ ] **Step 1: Write failing test — owner_email in list response**

Append inside the existing `describe('GET /api/workspaces', ...)` block in `backend/tests/integration/workspaces.test.js`:

```javascript
it('should include owner_email matching the creator email', async () => {
    await Workspace.create({ name: 'Alpha', creator: user.id });

    const response = await agent.get('/api/workspaces');

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    const alpha = response.body.find((w) => w.name === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha.owner_email).toBe('test@example.com');
});

it('should still order results by name ascending after join', async () => {
    await Workspace.create({ name: 'Zulu', creator: user.id });
    await Workspace.create({ name: 'Alpha', creator: user.id });

    const response = await agent.get('/api/workspaces');

    const names = response.body.map((w) => w.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js -t "owner_email"`
Expected: FAIL — `alpha.owner_email` is `undefined`.

- [ ] **Step 3: Update SQL in GET /workspaces**

In `backend/routes/workspaces.js`, modify both query branches (the member branch around line 54 and the non-member branch around line 72) to add `LEFT JOIN users u ON u.id = w.creator` and select `u.email AS owner_email`. Final queries:

Member branch (replace lines 54–65):
```javascript
query = `
    SELECT w.uid, w.name, w.creator, w.created_at,
        u.email AS owner_email,
        (SELECT COUNT(DISTINCT p.id) FROM projects p
         WHERE p.workspace_id = w.id
         AND (p.user_id = :userId OR p.id IN (
            SELECT DISTINCT t.project_id FROM tasks t
            WHERE (t.assigned_to_user_id IN (:memberIds) OR t.user_id IN (:memberIds))
            AND t.project_id IS NOT NULL
         ))) AS my_project_count
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.creator
    WHERE w.id IN (:workspaceIds)
    ORDER BY w.name ASC`;
```

Non-member branch (replace lines 72–79):
```javascript
query = `
    SELECT w.uid, w.name, w.creator, w.created_at,
        u.email AS owner_email,
        (SELECT COUNT(*) FROM projects
         WHERE projects.workspace_id = w.id
         AND projects.user_id = :userId) AS my_project_count
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.creator
    WHERE w.id IN (:workspaceIds)
    ORDER BY w.name ASC`;
```

The existing map at line 88 already spreads `rest` which now includes `owner_email`; no change needed there.

- [ ] **Step 4: Run test to verify pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js -t "owner_email"`
Expected: PASS.

Run the full file once to catch regressions:
Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/workspaces.js backend/tests/integration/workspaces.test.js
git commit -m "[ASID-1017] Return owner_email from GET /workspaces"
```

---

### Task 2: GET /workspaces/:uid returns owner_email

**Parallel:** Runnable in parallel with Task 3 (different file). Must follow Task 1 if both touch `workspaces.js` in the same subagent.

**Files:**
- Modify: `backend/routes/workspaces.js:101-135` (the `GET /workspaces/:uid` handler)
- Test: `backend/tests/integration/workspaces.test.js` (new assertion in the single-workspace describe block)

- [ ] **Step 1: Write failing test**

Append inside the `describe('GET /api/workspaces/:uid', ...)` block (or create it if it doesn't exist — follow the file's existing structure) in `backend/tests/integration/workspaces.test.js`:

```javascript
it('should include owner_email on single workspace response', async () => {
    const ws = await Workspace.create({ name: 'Solo', creator: user.id });

    const response = await agent.get(`/api/workspaces/${ws.uid}`);

    expect(response.status).toBe(200);
    expect(response.body.owner_email).toBe('test@example.com');
    expect(response.body.Creator).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js -t "single workspace response"`
Expected: FAIL — `owner_email` missing.

- [ ] **Step 3: Update the handler**

In `backend/routes/workspaces.js`, update the `GET /workspaces/:uid` handler (around line 112):

Before:
```javascript
const workspace = await Workspace.findOne({
    where: { uid: req.params.uid },
    attributes: [
        'id',
        'uid',
        'name',
        'creator',
        'created_at',
        'updated_at',
    ],
});
```

After:
```javascript
const { User } = require('../models'); // add at top if not already imported

// ...

const workspace = await Workspace.findOne({
    where: { uid: req.params.uid },
    attributes: [
        'id',
        'uid',
        'name',
        'creator',
        'created_at',
        'updated_at',
    ],
    include: [
        {
            model: User,
            as: 'Creator',
            attributes: ['email'],
        },
    ],
});
```

Then, immediately before responding, flatten and strip `Creator`. Find the existing `res.json(...)` call in this handler and replace with:

```javascript
const workspaceJson = workspace.toJSON();
const owner_email = workspaceJson.Creator?.email ?? null;
delete workspaceJson.Creator;
res.json({ ...workspaceJson, owner_email });
```

(Adjust to match whatever envelope the handler currently uses — if it returns `{ workspace, ... }` or similar, place `owner_email` on the workspace object inside that shape. Open the current handler and mirror its existing response structure.)

- [ ] **Step 4: Verify the User import**

At the top of `backend/routes/workspaces.js`, ensure `User` is destructured from `../models`. If the current line reads `const { Workspace, sequelize } = require('../models');`, change it to `const { Workspace, User, sequelize } = require('../models');`.

- [ ] **Step 5: Run test to verify pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js`
Expected: PASS (all workspace tests).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/workspaces.js backend/tests/integration/workspaces.test.js
git commit -m "[ASID-1017] Return owner_email from GET /workspaces/:uid"
```

---

### Task 3: Nested workspace.owner_email in projects responses

**Parallel:** Runnable in parallel with Tasks 1 and 2 (different file).

**Files:**
- Modify: `backend/routes/projects.js:299-302, 509-512, 805-808` (three `include: { model: Workspace }` sites)
- Test: `backend/tests/integration/projects.test.js`

- [ ] **Step 1: Write failing test**

Append to `backend/tests/integration/projects.test.js` (inside an appropriate top-level `describe` block — mirror the style of existing tests in that file):

```javascript
it('should include workspace.owner_email on project list response', async () => {
    const ws = await Workspace.create({ name: 'WS', creator: user.id });
    await Project.create({
        name: 'P1',
        user_id: user.id,
        workspace_id: ws.id,
    });

    const response = await agent.get('/api/projects');

    expect(response.status).toBe(200);
    const list = Array.isArray(response.body)
        ? response.body
        : response.body.projects;
    const project = list.find((p) => p.name === 'P1');
    expect(project).toBeDefined();
    expect(project.Workspace).toBeDefined();
    expect(project.Workspace.owner_email).toBe('test@example.com');
    expect(project.Workspace.Creator).toBeUndefined();
});

it('should include workspace.owner_email on single project response', async () => {
    const ws = await Workspace.create({ name: 'WS2', creator: user.id });
    const p = await Project.create({
        name: 'P2',
        user_id: user.id,
        workspace_id: ws.id,
    });

    const response = await agent.get(`/api/projects/${p.uid || p.id}`);

    expect(response.status).toBe(200);
    const body = response.body.project || response.body;
    expect(body.Workspace).toBeDefined();
    expect(body.Workspace.owner_email).toBe('test@example.com');
    expect(body.Workspace.Creator).toBeUndefined();
});
```

(If `projects.test.js` already has a helper to look up a project by name/uid, use that helper instead of the inline `find`.)

- [ ] **Step 2: Run test to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/projects.test.js -t "owner_email"`
Expected: FAIL — `project.Workspace.owner_email` is `undefined`.

- [ ] **Step 3: Extend all three Workspace include sites**

In `backend/routes/projects.js`, locate each of the three `{ model: Workspace, ... }` includes (lines 299, 509, 805). For each one, extend it to also include `Creator`:

Before (same at all three sites):
```javascript
{
    model: Workspace,
    required: false,
    attributes: ['id', 'uid', 'name'],
},
```

After (same replacement at all three sites):
```javascript
{
    model: Workspace,
    required: false,
    attributes: ['id', 'uid', 'name'],
    include: [
        {
            model: User,
            as: 'Creator',
            required: false,
            attributes: ['email'],
        },
    ],
},
```

`User` is already imported in `projects.js` (it's used in the other includes around line 309). Do not re-import.

- [ ] **Step 4: Flatten `Workspace.Creator.email` → `Workspace.owner_email`**

Find every place in `projects.js` that serializes a project response (look for `.toJSON()` calls and places where the project or project list is passed to `res.json(...)`). For each, after converting the project (or each project in a list) to a plain object, flatten:

```javascript
if (projectJson.Workspace) {
    projectJson.Workspace.owner_email =
        projectJson.Workspace.Creator?.email ?? null;
    delete projectJson.Workspace.Creator;
}
```

For list endpoints, map this transform across the array before `res.json(...)`. Example shape:

```javascript
const projectsOut = projects.map((p) => {
    const json = p.toJSON();
    if (json.Workspace) {
        json.Workspace.owner_email = json.Workspace.Creator?.email ?? null;
        delete json.Workspace.Creator;
    }
    return json;
});
res.json(projectsOut);
```

Apply this pattern to each of the three endpoint handlers that use the three modified include sites (the list endpoint around line 290, the alternate list/query endpoint around line 500, and the single-project endpoint around line 790). Preserve all existing response-shape transforms (status counts, share counts, pin computation) — the flattening should be inserted alongside those, not in place of them.

- [ ] **Step 5: Run test to verify pass**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/projects.test.js -t "owner_email"`
Expected: PASS.

Run the full projects test file to catch regressions:
Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/projects.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/projects.js backend/tests/integration/projects.test.js
git commit -m "[ASID-1017] Include owner_email on nested project.Workspace"
```

---

## Phase 2 — Frontend type

### Task 4: Add owner_email to Workspace entity

**Parallel:** No — this is a shared dependency for Phase 3 and must land before any UI task.

**Files:**
- Modify: `frontend/entities/Workspace.ts`

- [ ] **Step 1: Update entity type**

Replace the contents of `frontend/entities/Workspace.ts` with:

```ts
export interface Workspace {
    id?: number;
    uid?: string;
    name: string;
    owner_email?: string;
    is_creator?: boolean;
    my_project_count?: number;
    created_at?: string;
    updated_at?: string;
}
```

(Only the one new line `owner_email?: string;` is added; the rest is unchanged.)

`Project.Workspace?: Workspace | null` in `frontend/entities/Project.ts` already references this interface, so the nested case is covered automatically. No change to `Project.ts`.

- [ ] **Step 2: Verify typecheck**

Run: `npm run build` (or `npx tsc --noEmit` if faster)
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/entities/Workspace.ts
git commit -m "[ASID-1017] Add owner_email to Workspace entity"
```

---

## Phase 3 — Frontend render surfaces (3 parallel subagents)

These three tasks touch three separate files and are fully independent. Dispatch them as three parallel subagents.

### Task 5: Workspaces list cards show owner email

**Parallel:** Yes — with Tasks 6 and 7 (different files).

**Files:**
- Modify: `frontend/components/Workspaces.tsx` (the card-rendering block around line 160 where `{workspace.name}` appears)
- Test: frontend test file for Workspaces (check `frontend/components/__tests__` or wherever existing tests live; create `Workspaces.test.tsx` if no test for this component exists yet)

- [ ] **Step 1: Locate the existing test file or create one**

Run: `find frontend -name "Workspaces.test.*" -not -path "*/node_modules/*"`

If a test file exists, extend it. If not, create `frontend/components/__tests__/Workspaces.test.tsx` modeled after another component test in the same directory (use an existing test as template — pick the simplest one that renders a list component with the Zustand store).

- [ ] **Step 2: Write failing tests**

Add to the test file:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Workspaces from '../Workspaces';
// ...mirror any store/provider setup the existing tests use

describe('Workspaces list owner display', () => {
    it('renders workspace name and owner email stacked', () => {
        // Seed store with [{ uid, name: 'Alpha', owner_email: 'alice@example.com' }]
        render(
            <MemoryRouter>
                <Workspaces />
            </MemoryRouter>
        );
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', () => {
        // Seed store with [{ uid, name: 'Beta' }] — no owner_email
        render(
            <MemoryRouter>
                <Workspaces />
            </MemoryRouter>
        );
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
});
```

Fill in the store-seeding lines by mirroring another component test that uses `useStore` — typically a `beforeEach` that calls `useStore.setState(...)` or a mock. Do not invent the seed pattern; copy it from a working test.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm run frontend:test -- Workspaces`
Expected: FAIL on the email assertion.

- [ ] **Step 4: Update the card render**

In `frontend/components/Workspaces.tsx`, find the block around line 160:

```tsx
{workspace.name}
```

Replace the single-line name with a stacked block. The exact surrounding JSX depends on the card; the essential change is:

```tsx
<div className="flex flex-col">
    <span className="font-medium">{workspace.name}</span>
    {workspace.owner_email && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {workspace.owner_email}
        </span>
    )}
</div>
```

When `workspace.owner_email` is missing, also run:
```ts
if (!workspace.owner_email) {
    console.log('Workspace owner email unavailable', { uid: workspace.uid });
}
```
Place this `console.log` in the render path (above the return) only if the value is falsy; do not fire it on every render storm. If a `useEffect(() => { ... }, [workspace.uid, workspace.owner_email])` is cleaner, use that.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run frontend:test -- Workspaces`
Expected: PASS.

- [ ] **Step 6: Lint & format**

Run: `npm run lint:fix && npm run format:fix`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/Workspaces.tsx frontend/components/__tests__/Workspaces.test.tsx
git commit -m "[ASID-1017] Show workspace owner email on list cards"
```

---

### Task 6: Workspace detail header shows owner email

**Parallel:** Yes — with Tasks 5 and 7 (different files).

**Files:**
- Modify: `frontend/components/Workspace/WorkspaceDetail.tsx` (the title block around line 140 where `{workspace.name}` appears)
- Test: existing or new `WorkspaceDetail.test.tsx` alongside the component

- [ ] **Step 1: Locate or create the test file**

Run: `find frontend -name "WorkspaceDetail.test.*" -not -path "*/node_modules/*"`

If none, create `frontend/components/Workspace/__tests__/WorkspaceDetail.test.tsx` modeled after any existing detail-component test in the project.

- [ ] **Step 2: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkspaceDetail from '../WorkspaceDetail';

describe('WorkspaceDetail owner display', () => {
    it('renders owner email under the workspace name', async () => {
        // Seed store or mock fetch to return { uid: 'abc', name: 'Gamma', owner_email: 'gamma@example.com' }
        render(
            <MemoryRouter initialEntries={['/workspaces/abc']}>
                <Routes>
                    <Route path="/workspaces/:uid" element={<WorkspaceDetail />} />
                </Routes>
            </MemoryRouter>
        );
        expect(await screen.findByText('Gamma')).toBeInTheDocument();
        expect(await screen.findByText('gamma@example.com')).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', async () => {
        // Seed { uid: 'def', name: 'Delta' }
        render(
            <MemoryRouter initialEntries={['/workspaces/def']}>
                <Routes>
                    <Route path="/workspaces/:uid" element={<WorkspaceDetail />} />
                </Routes>
            </MemoryRouter>
        );
        expect(await screen.findByText('Delta')).toBeInTheDocument();
        expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
});
```

Fill in the data-seeding (mock fetch or set Zustand state) by copying from a working detail-component test in the repo.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm run frontend:test -- WorkspaceDetail`
Expected: FAIL on the email assertion.

- [ ] **Step 4: Update the header render**

In `frontend/components/Workspace/WorkspaceDetail.tsx`, find around line 140:

```tsx
{workspace.name}
```

Update that header block to render the email as a subtitle directly beneath the name:

```tsx
<div className="flex flex-col">
    <h1 className="...">{workspace.name}</h1>
    {workspace.owner_email && (
        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {workspace.owner_email}
        </span>
    )}
</div>
```

(Preserve the existing heading styles, aria attributes, and any adjacent action buttons — only the name's JSX wrapper and the optional email span change.)

When `workspace.owner_email` is falsy, log once:
```ts
useEffect(() => {
    if (workspace && !workspace.owner_email) {
        console.log('Workspace owner email unavailable', { uid: workspace.uid });
    }
}, [workspace?.uid, workspace?.owner_email]);
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run frontend:test -- WorkspaceDetail`
Expected: PASS.

- [ ] **Step 6: Lint & format**

Run: `npm run lint:fix && npm run format:fix`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/Workspace/WorkspaceDetail.tsx frontend/components/Workspace/__tests__/WorkspaceDetail.test.tsx
git commit -m "[ASID-1017] Show workspace owner email on detail header"
```

---

### Task 7: Project banner badge shows inline owner email

**Parallel:** Yes — with Tasks 5 and 6 (different files).

**Files:**
- Modify: `frontend/components/Project/ProjectBanner.tsx:89-104` (the Workspace badge)
- Test: existing or new `ProjectBanner.test.tsx` alongside the component

- [ ] **Step 1: Locate or create the test file**

Run: `find frontend -name "ProjectBanner.test.*" -not -path "*/node_modules/*"`

If none, create `frontend/components/Project/__tests__/ProjectBanner.test.tsx` modeled after an existing component test.

- [ ] **Step 2: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectBanner from '../ProjectBanner';

const projectBase = {
    uid: 'p1',
    name: 'Test Project',
};

describe('ProjectBanner workspace badge', () => {
    it('renders workspace name and owner email inline with separator', () => {
        const project = {
            ...projectBase,
            Workspace: {
                uid: 'w1',
                name: 'Acme',
                owner_email: 'owner@acme.com',
            },
        };
        render(
            <MemoryRouter>
                <ProjectBanner project={project} />
            </MemoryRouter>
        );
        expect(
            screen.getByText(/Acme\s*·\s*owner@acme\.com/)
        ).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', () => {
        const project = {
            ...projectBase,
            Workspace: { uid: 'w2', name: 'Beta' },
        };
        render(
            <MemoryRouter>
                <ProjectBanner project={project} />
            </MemoryRouter>
        );
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    });
});
```

If `ProjectBanner` requires more props than `project` (check the component signature), fill in minimal stub props to match. Use whatever `Project` mock shape existing tests use elsewhere.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm run frontend:test -- ProjectBanner`
Expected: FAIL on the separator assertion.

- [ ] **Step 4: Update the badge JSX**

In `frontend/components/Project/ProjectBanner.tsx`, replace the existing button text (line 101):

Before:
```tsx
{project.Workspace!.name}
```

After:
```tsx
{project.Workspace!.name}
{project.Workspace!.owner_email && (
    <>{` · ${project.Workspace!.owner_email}`}</>
)}
```

When `project.Workspace!.owner_email` is falsy, log once (guard so it doesn't fire every render for workspaces without a Creator — place inside a `useEffect` keyed on the workspace uid + owner_email):

```tsx
useEffect(() => {
    if (project.Workspace && !project.Workspace.owner_email) {
        console.log('Workspace owner email unavailable', {
            uid: project.Workspace.uid,
        });
    }
}, [project.Workspace?.uid, project.Workspace?.owner_email]);
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run frontend:test -- ProjectBanner`
Expected: PASS.

- [ ] **Step 6: Lint & format**

Run: `npm run lint:fix && npm run format:fix`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/Project/ProjectBanner.tsx frontend/components/Project/__tests__/ProjectBanner.test.tsx
git commit -m "[ASID-1017] Show workspace owner email on project banner"
```

---

## Phase 4 — Verify

### Task 8: Full test + lint + format + manual smoke

**Parallel:** No — runs after all prior tasks land.

**Files:** None modified; verification only.

- [ ] **Step 1: Run full backend test suite**

Run: `npm test`
Expected: all tests pass (~1090 tests). `workspaces.test.js` is flaky in parallel per project memory — if it fails, re-run just that file in isolation (`cd backend && npx cross-env NODE_ENV=test jest tests/integration/workspaces.test.js`) to confirm the failure is flake, not regression.

- [ ] **Step 2: Run full frontend test suite**

Run: `npm run frontend:test`
Expected: all tests pass.

- [ ] **Step 3: Run full lint + format**

Run: `npm run lint:fix && npm run format:fix`
Expected: exit 0, no diff.

- [ ] **Step 4: Manual smoke in dev**

Run: `npm run start`

In the browser (http://localhost:8080):
1. Go to the Workspaces list — confirm each card shows workspace name with owner email underneath (stacked).
2. Click a workspace — confirm the detail header shows name with owner email as subtitle.
3. Open a project with a workspace attached — confirm the banner badge shows `Workspace Name · owner@email.com` inline.
4. Open the browser DevTools console — confirm no errors and no `console.log('Workspace owner email unavailable', ...)` noise for workspaces that should have an owner.

- [ ] **Step 5: Final commit (only if verify produced any fix)**

If any of Steps 1–4 produced fixes, commit:
```bash
git add -p
git commit -m "[ASID-1017] Fix lint/format after workspace owner display"
```

Otherwise skip this step.

- [ ] **Step 6: Push**

```bash
git push origin feature/ASID-1017-add-owner-name-to-workspace
```

Open PR via `gh pr create` with a short summary referencing ASID-1017.

---

## Self-review notes

- **Spec coverage:** AC1 (display format everywhere) → Tasks 5–7. AC2 (uses stored owner name, not index) → Tasks 1–3 (joins on FK). AC3 (empty name) → explicitly dropped (D4). AC4 (error fallback) → `LEFT JOIN` in Tasks 1 & 3, `console.log` in Tasks 5–7. AC5 (sort/search) → Task 1 Step 1 adds regression test for sort order; search was already name-only (no code change needed). AC6 (no data change) → no migration in plan.
- **No placeholders:** All test code and impl changes are spelled out. Where store-seeding or test-helper shape varies by repo convention, the plan explicitly directs the engineer to copy from an existing working test rather than leaving a TBD — this is deliberate and safer than inventing a shape that may not match.
- **Type consistency:** `owner_email` snake_case everywhere (entity, responses, tests); `Creator` (capital C) matches the existing association alias in `backend/models/index.js`.
