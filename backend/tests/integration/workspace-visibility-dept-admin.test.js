const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area, Workspace, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

describe('Department Admin Workspace Visibility', () => {
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
            {
                replacements: { areaId, userId, role },
                type: QueryTypes.INSERT,
            }
        );
    }

    let deptAdmin, deptMember, outsider, department, deptAdminAgent;

    beforeEach(async () => {
        deptAdmin = await createTestUser({
            email: uniqueEmail('deptadmin'),
        });

        deptMember = await createTestUser({
            email: uniqueEmail('deptmember'),
        });

        outsider = await createTestUser({ email: uniqueEmail('outsider') });

        department = await Area.create({
            name: 'Test Department',
            user_id: deptAdmin.id,
        });

        await addAreaMember(department.id, deptAdmin.id, 'admin');
        await addAreaMember(department.id, deptMember.id, 'member');

        deptAdminAgent = await loginAgent(deptAdmin.email);
    });

    it('dept admin sees workspace when member has task in workspace project', async () => {
        const workspace = await Workspace.create({
            name: 'Outsider Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Outsider Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Task Assigned To Dept Member',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/workspaces');
        expect(res.status).toBe(200);

        const wsUids = res.body.map((w) => w.uid);
        expect(wsUids).toContain(workspace.uid);
    });

    it('dept admin can access workspace detail page', async () => {
        const workspace = await Workspace.create({
            name: 'Detail Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Project With Member Task',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Member Task',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get(
            `/api/workspaces/${workspace.uid}`
        );
        expect(res.status).toBe(200);
        expect(res.body.uid).toBe(workspace.uid);
        expect(res.body.name).toBe('Detail Workspace');
        expect(res.body.is_creator).toBe(false);
    });

    it('dept admin does NOT see workspace with no member involvement', async () => {
        const workspace = await Workspace.create({
            name: 'No Member Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Outsider Only Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Outsider Task',
            user_id: outsider.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/workspaces');
        expect(res.status).toBe(200);

        const wsUids = res.body.map((w) => w.uid);
        expect(wsUids).not.toContain(workspace.uid);
    });

    it('dept admin gets 404 for workspace detail with no member involvement', async () => {
        const workspace = await Workspace.create({
            name: 'Inaccessible Workspace',
            creator: outsider.id,
        });

        await Project.create({
            name: 'Outsider Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        const res = await deptAdminAgent.get(
            `/api/workspaces/${workspace.uid}`
        );
        expect(res.status).toBe(404);
    });

    it('my_project_count reflects member-connected projects', async () => {
        const workspace = await Workspace.create({
            name: 'Count Test Workspace',
            creator: outsider.id,
        });

        // Project 1: outsider owns, member has task
        const project1 = await Project.create({
            name: 'Member Project 1',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Member Task 1',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project1.id,
        });

        // Project 2: outsider owns, no member involvement
        await Project.create({
            name: 'Outsider Only Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        const res = await deptAdminAgent.get('/api/workspaces');
        expect(res.status).toBe(200);

        const found = res.body.find((w) => w.uid === workspace.uid);
        expect(found).toBeDefined();
        expect(Number(found.my_project_count)).toBe(1);
    });

    it('dept admin cannot modify workspace (PATCH returns 403)', async () => {
        const workspace = await Workspace.create({
            name: 'Protected Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Member Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Member Task',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent
            .patch(`/api/workspace/${workspace.uid}`)
            .send({ name: 'Hijacked Name' });

        expect(res.status).toBe(403);

        // Verify name unchanged
        const unchanged = await Workspace.findOne({
            where: { uid: workspace.uid },
        });
        expect(unchanged.name).toBe('Protected Workspace');
    });

    it('dept admin cannot delete workspace (DELETE returns 403)', async () => {
        const workspace = await Workspace.create({
            name: 'Undeletable Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Member Project',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Member Task',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.delete(
            `/api/workspace/${workspace.uid}`
        );

        expect(res.status).toBe(403);

        // Verify workspace still exists
        const stillExists = await Workspace.findOne({
            where: { uid: workspace.uid },
        });
        expect(stillExists).not.toBeNull();
    });

    it('dept admin sees workspace when member owns task in workspace project', async () => {
        const workspace = await Workspace.create({
            name: 'Owned Task Workspace',
            creator: outsider.id,
        });

        const project = await Project.create({
            name: 'Project With Owned Task',
            user_id: outsider.id,
            workspace_id: workspace.id,
        });

        await Task.create({
            name: 'Task Owned By Dept Member',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/workspaces');
        expect(res.status).toBe(200);

        const wsUids = res.body.map((w) => w.uid);
        expect(wsUids).toContain(workspace.uid);
    });
});
