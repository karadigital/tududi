# ASID-867: Project Visibility via Task Assignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement role-based project visibility so admins see all projects, department admins see projects where their members have tasks, and department members see projects where they have tasks.

**Architecture:** All logic changes are in `backend/services/permissionsService.js`. Two functions change: `ownershipOrPermissionWhere` (project listing) and `getAccess` (single-project middleware). One existing test file must be updated to match new admin behavior.

**Tech Stack:** Node.js, Sequelize ORM, SQLite, Jest + Supertest

---

## Execution Strategy

### Phase 1 — Write Tests (PARALLEL: Tasks 1, 2, 3)
Three independent test files, no shared state. Run as parallel subagents.

### Phase 2 — Implement (SEQUENTIAL: Task 4)
All implementation is in one file. Must run after Phase 1.

### Phase 3 — Fix Conflicts & Verify (SEQUENTIAL: Task 5)
Update old conflicting test, run full suite, lint, format, commit.

---

## Important Context for All Tasks

**Test helpers available:**
- `createTestUser({ email, is_admin })` from `backend/tests/helpers/testUtils.js` — creates user with role
- Use `request.agent(app)` + `agent.post('/api/login').send({ email, password: 'password123' })` to login
- Department member insertion via raw SQL (no model helper):
```js
await sequelize.query(
    `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
     VALUES (:areaId, :userId, :role, datetime('now'), datetime('now'))`,
    { replacements: { areaId, userId, role }, type: QueryTypes.INSERT }
);
```
- Use `const uniqueEmail = (prefix) => \`${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com\`;` for unique emails

**Models available:** `Task, Project, Area, Role, Permission, sequelize` from `../../models`

**Run single test file:** `cd backend && npx cross-env NODE_ENV=test jest tests/integration/<filename>.test.js`

**Existing conflicting test:** `backend/tests/integration/permissions-admin.test.js` line 67-90 asserts admin should NOT see other users' projects. This contradicts ASID-867 requirements. Will be updated in Task 5.

---

## Task 1: Write Admin Project Visibility Tests (PARALLEL)

**Files:**
- Create: `backend/tests/integration/project-visibility-admin.test.js`

**Step 1: Write test file**

```js
const request = require('supertest');
const app = require('../../app');
const { Project, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('ASID-867: Admin Project Visibility', () => {
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    async function makeAdmin(userId) {
        await Role.findOrCreate({
            where: { user_id: userId },
            defaults: { user_id: userId, is_admin: true },
        });
        await Role.update({ is_admin: true }, { where: { user_id: userId } });
    }

    async function loginAgent(email) {
        const agent = request.agent(app);
        await agent.post('/api/login').send({ email, password: 'password123' });
        return agent;
    }

    let admin, otherUser, adminAgent;

    beforeEach(async () => {
        admin = await createTestUser({ email: uniqueEmail('admin') });
        await makeAdmin(admin.id);
        otherUser = await createTestUser({ email: uniqueEmail('other') });
        adminAgent = await loginAgent(admin.email);
    });

    it('admin sees all projects in listing including other users projects', async () => {
        const adminProject = await Project.create({
            name: 'Admin Project',
            user_id: admin.id,
        });
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });

        const res = await adminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(adminProject.id);
        expect(projectIds).toContain(otherProject.id);
    });

    it('admin can access any project detail page', async () => {
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });
        const slugged = otherProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${otherProject.uid}-${slugged}`;

        const res = await adminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Other Project');
    });

    it('admin sees all tasks on project detail page', async () => {
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });
        const task = await require('../../models').Task.create({
            name: 'Other Task',
            user_id: otherUser.id,
            project_id: otherProject.id,
        });

        const slugged = otherProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${otherProject.uid}-${slugged}`;

        const res = await adminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);

        const taskIds = res.body.Tasks.map((t) => t.id);
        expect(taskIds).toContain(task.id);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/project-visibility-admin.test.js`
Expected: FAIL — admin currently cannot see other users' projects

---

## Task 2: Write Dept Member Project Visibility Tests (PARALLEL)

**Files:**
- Create: `backend/tests/integration/project-visibility-dept-member.test.js`

**Step 1: Write test file**

```js
const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

describe('ASID-867: Dept Member Project Visibility', () => {
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    async function loginAgent(email) {
        const agent = request.agent(app);
        await agent.post('/api/login').send({ email, password: 'password123' });
        return agent;
    }

    async function addAreaMember(areaId, userId, role = 'member') {
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, :role, datetime('now'), datetime('now'))`,
            { replacements: { areaId, userId, role }, type: QueryTypes.INSERT }
        );
    }

    let member, projectOwner, department, memberAgent;

    beforeEach(async () => {
        member = await createTestUser({ email: uniqueEmail('member') });
        projectOwner = await createTestUser({ email: uniqueEmail('owner') });

        department = await Area.create({
            name: 'Engineering',
            user_id: projectOwner.id,
        });

        await addAreaMember(department.id, member.id, 'member');

        memberAgent = await loginAgent(member.email);
    });

    it('member sees project where they own a task', async () => {
        const project = await Project.create({
            name: 'External Project',
            user_id: projectOwner.id,
        });
        await Task.create({
            name: 'Member Task',
            user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(project.id);
    });

    it('member sees project where they are assigned a task', async () => {
        const project = await Project.create({
            name: 'External Project',
            user_id: projectOwner.id,
        });
        await Task.create({
            name: 'Assigned Task',
            user_id: projectOwner.id,
            assigned_to_user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(project.id);
    });

    it('member sees projects in their department', async () => {
        const deptProject = await Project.create({
            name: 'Dept Project',
            user_id: projectOwner.id,
            area_id: department.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(deptProject.id);
    });

    it('member does NOT see project with no connection', async () => {
        const unrelatedProject = await Project.create({
            name: 'Unrelated Project',
            user_id: projectOwner.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).not.toContain(unrelatedProject.id);
    });

    it('member can access detail page of project they have tasks in', async () => {
        const project = await Project.create({
            name: 'Task Project',
            user_id: projectOwner.id,
        });
        await Task.create({
            name: 'Member Task',
            user_id: member.id,
            project_id: project.id,
        });

        const slugged = project.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${project.uid}-${slugged}`;

        const res = await memberAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
    });

    it('member sees ALL tasks on project detail page (read-only)', async () => {
        const project = await Project.create({
            name: 'Task Project',
            user_id: projectOwner.id,
        });
        const memberTask = await Task.create({
            name: 'Member Task',
            user_id: member.id,
            project_id: project.id,
        });
        const ownerTask = await Task.create({
            name: 'Owner Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        const slugged = project.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${project.uid}-${slugged}`;

        const res = await memberAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);

        const taskIds = res.body.Tasks.map((t) => t.id);
        expect(taskIds).toContain(memberTask.id);
        expect(taskIds).toContain(ownerTask.id);
    });

    it('member cannot edit tasks they do not own in the project', async () => {
        const project = await Project.create({
            name: 'Task Project',
            user_id: projectOwner.id,
        });
        await Task.create({
            name: 'Member Task',
            user_id: member.id,
            project_id: project.id,
        });
        const ownerTask = await Task.create({
            name: 'Owner Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        const res = await memberAgent
            .patch(`/api/task/${ownerTask.uid}`)
            .send({ name: 'Hacked Task' });
        expect(res.status).toBe(403);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/project-visibility-dept-member.test.js`
Expected: FAIL — "member sees project where they own a task" and detail page access tests will fail

---

## Task 3: Write Dept Admin Project Visibility Tests (PARALLEL)

**Files:**
- Create: `backend/tests/integration/project-visibility-dept-admin.test.js`

**Step 1: Write test file**

```js
const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

describe('ASID-867: Dept Admin Project Visibility', () => {
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    async function loginAgent(email) {
        const agent = request.agent(app);
        await agent.post('/api/login').send({ email, password: 'password123' });
        return agent;
    }

    async function addAreaMember(areaId, userId, role = 'member') {
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, :role, datetime('now'), datetime('now'))`,
            { replacements: { areaId, userId, role }, type: QueryTypes.INSERT }
        );
    }

    let deptAdmin, deptMember, outsider, department, deptAdminAgent;

    beforeEach(async () => {
        deptAdmin = await createTestUser({ email: uniqueEmail('deptadmin') });
        deptMember = await createTestUser({ email: uniqueEmail('deptmember') });
        outsider = await createTestUser({ email: uniqueEmail('outsider') });

        department = await Area.create({
            name: 'Engineering',
            user_id: deptAdmin.id,
        });

        await addAreaMember(department.id, deptAdmin.id, 'admin');
        await addAreaMember(department.id, deptMember.id, 'member');

        deptAdminAgent = await loginAgent(deptAdmin.email);
    });

    it('dept admin sees projects assigned to their department', async () => {
        const deptProject = await Project.create({
            name: 'Dept Project',
            user_id: outsider.id,
            area_id: department.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(deptProject.id);
    });

    it('dept admin sees projects they created', async () => {
        const ownProject = await Project.create({
            name: 'Own Project',
            user_id: deptAdmin.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(ownProject.id);
    });

    it('dept admin sees projects where dept members have tasks (assigned)', async () => {
        const externalProject = await Project.create({
            name: 'External Project',
            user_id: outsider.id,
        });
        await Task.create({
            name: 'Member Assigned Task',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: externalProject.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(externalProject.id);
    });

    it('dept admin sees projects where dept members have tasks (owned)', async () => {
        const externalProject = await Project.create({
            name: 'External Project',
            user_id: outsider.id,
        });
        await Task.create({
            name: 'Member Owned Task',
            user_id: deptMember.id,
            project_id: externalProject.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(externalProject.id);
    });

    it('dept admin does NOT see projects with no dept connection', async () => {
        const unrelatedProject = await Project.create({
            name: 'Unrelated Project',
            user_id: outsider.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).not.toContain(unrelatedProject.id);
    });

    it('dept admin can access detail page of project their member has tasks in', async () => {
        const externalProject = await Project.create({
            name: 'External Project',
            user_id: outsider.id,
        });
        await Task.create({
            name: 'Member Task',
            user_id: deptMember.id,
            project_id: externalProject.id,
        });

        const slugged = externalProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${externalProject.uid}-${slugged}`;

        const res = await deptAdminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
    });

    it('dept admin sees ALL tasks on project detail page', async () => {
        const externalProject = await Project.create({
            name: 'External Project',
            user_id: outsider.id,
        });
        const memberTask = await Task.create({
            name: 'Member Task',
            user_id: deptMember.id,
            project_id: externalProject.id,
        });
        const outsiderTask = await Task.create({
            name: 'Outsider Task',
            user_id: outsider.id,
            project_id: externalProject.id,
        });

        const slugged = externalProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${externalProject.uid}-${slugged}`;

        const res = await deptAdminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);

        const taskIds = res.body.Tasks.map((t) => t.id);
        expect(taskIds).toContain(memberTask.id);
        expect(taskIds).toContain(outsiderTask.id);
    });

    it('dept admin has read-only access to tasks they do not own', async () => {
        const externalProject = await Project.create({
            name: 'External Project',
            user_id: outsider.id,
        });
        await Task.create({
            name: 'Member Task',
            user_id: deptMember.id,
            project_id: externalProject.id,
        });
        const outsiderTask = await Task.create({
            name: 'Outsider Task',
            user_id: outsider.id,
            project_id: externalProject.id,
        });

        const res = await deptAdminAgent
            .patch(`/api/task/${outsiderTask.uid}`)
            .send({ name: 'Hacked' });
        expect(res.status).toBe(403);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/project-visibility-dept-admin.test.js`
Expected: FAIL — dept admin cannot see projects where members have tasks, cannot access detail page

---

## Task 4: Implement All Changes in permissionsService.js (SEQUENTIAL — after Tasks 1-3)

**Files:**
- Modify: `backend/services/permissionsService.js`

**Step 1: Add admin bypass for projects in `ownershipOrPermissionWhere`**

At line ~237 (after the existing task admin bypass block), add:

```js
// Superadmin sees all projects
if (isUserAdmin && resourceType === 'project') {
    const result = {};
    if (cache) cache.set(cacheKey, result);
    return result;
}
```

**Step 2: Update project task query to include owned tasks**

Replace the SQL at line 312 from:
```sql
SELECT DISTINCT project_id FROM tasks WHERE assigned_to_user_id = :userId AND project_id IS NOT NULL
```
To:
```sql
SELECT DISTINCT project_id FROM tasks WHERE (assigned_to_user_id = :userId OR user_id = :userId) AND project_id IS NOT NULL
```

**Step 3: Add dept admin member-task project visibility**

After the assigned/owned project rows block (~line 318), add dept admin logic:

```js
// Department admins also see projects where their members have tasks
const memberUserIds = await getDepartmentMemberUserIds(userId);
if (memberUserIds.length > 0) {
    const memberProjectRows = await sequelize.query(
        `SELECT DISTINCT project_id FROM tasks
         WHERE (assigned_to_user_id IN (:memberUserIds) OR user_id IN (:memberUserIds))
         AND project_id IS NOT NULL`,
        {
            replacements: { memberUserIds },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );

    if (memberProjectRows.length > 0) {
        const memberProjectIds = memberProjectRows.map((row) => row.project_id);
        conditions.push({ id: { [Op.in]: memberProjectIds } });
    }
}
```

**Step 4: Update `getAccess` for projects**

In the `getAccess` function, update the project block (lines 89-107).

First, add `area_id` to the attributes fetched at line 92:
```js
const proj = await Project.findOne({
    where: { uid: resourceUid },
    attributes: ['id', 'user_id', 'area_id'],
    raw: true,
});
```

Then, after the owner check (line 96), add department membership check:
```js
// Check if user is a member of the project's department
if (proj.area_id) {
    const membership = await sequelize.query(
        `SELECT 1 FROM areas_members WHERE area_id = :areaId AND user_id = :userId LIMIT 1`,
        {
            replacements: { areaId: proj.area_id, userId },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );
    if (membership.length > 0) return ACCESS.RO;
}
```

Then, update the existing assigned task check to also include owned tasks. Replace lines 98-107:
```js
// Check if user has tasks (assigned or owned) in this project
const connectedTask = await Task.findOne({
    where: {
        project_id: proj.id,
        [Op.or]: [
            { assigned_to_user_id: userId },
            { user_id: userId },
        ],
    },
    attributes: ['id'],
    raw: true,
});
if (connectedTask) return ACCESS.RO;
```

Then, add dept admin member-tasks check:
```js
// Check if user is a dept admin and their members have tasks in this project
const memberUserIds = await getDepartmentMemberUserIds(userId);
if (memberUserIds.length > 0) {
    const memberTask = await Task.findOne({
        where: {
            project_id: proj.id,
            [Op.or]: [
                { assigned_to_user_id: { [Op.in]: memberUserIds } },
                { user_id: { [Op.in]: memberUserIds } },
            ],
        },
        attributes: ['id'],
        raw: true,
    });
    if (memberTask) return ACCESS.RO;
}
```

**Step 5: Run all three new test files**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/integration/project-visibility-admin.test.js tests/integration/project-visibility-dept-member.test.js tests/integration/project-visibility-dept-admin.test.js`
Expected: ALL PASS

---

## Task 5: Fix Conflicting Test, Verify & Commit (SEQUENTIAL — after Task 4)

**Files:**
- Modify: `backend/tests/integration/permissions-admin.test.js`

**Step 1: Update the existing admin project visibility test**

In `backend/tests/integration/permissions-admin.test.js`, the `Projects visibility` describe block (lines 66-91) asserts that admin should NOT see other users' projects. Update it to match the new behavior:

Replace:
```js
// Admin should NOT see other user's project (THIS IS THE KEY FIX)
expect(projectIds).not.toContain(regularProject.id);
```

With:
```js
// ASID-867: Admin should see ALL projects
expect(projectIds).toContain(regularProject.id);
```

Also update the test name from:
```js
it('admin should only see their own projects, not all projects', async () => {
```
To:
```js
it('admin should see all projects including other users projects', async () => {
```

**Step 2: Run the full test suite**

Run: `cd backend && npx cross-env NODE_ENV=test jest --forceExit`
Expected: ALL PASS

**Step 3: Lint and format**

Run: `npm run lint:fix && npm run format:fix`

**Step 4: Commit**

```bash
git add backend/services/permissionsService.js backend/tests/integration/project-visibility-admin.test.js backend/tests/integration/project-visibility-dept-member.test.js backend/tests/integration/project-visibility-dept-admin.test.js backend/tests/integration/permissions-admin.test.js
git commit -m "$(cat <<'EOF'
[ASID-867] Project visibility via task assignment

- Admin bypass for project listing (sees all projects)
- Department members see projects where they own or are assigned tasks
- Department admins see projects where any member has tasks
- getAccess grants RO for dept membership, task ownership, dept admin member-tasks
- Update existing admin test to match new all-projects visibility
EOF
)"
```
