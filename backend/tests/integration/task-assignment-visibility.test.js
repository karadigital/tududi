const request = require('supertest');
const app = require('../../app');
const { Project, Task, Workspace } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Assignment Visibility', () => {
    let owner, assignee, ownerAgent, assigneeAgent;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `owner_${Date.now()}@example.com`,
        });
        assignee = await createTestUser({
            email: `assignee_${Date.now()}@example.com`,
        });

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        assigneeAgent = request.agent(app);
        await assigneeAgent
            .post('/api/login')
            .send({ email: assignee.email, password: 'password123' });
    });

    describe('Project visibility via task assignment', () => {
        it('should show project to assignee when they have an assigned task in it', async () => {
            const project = await Project.create({
                name: 'Owner Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.get('/api/projects');
            expect(res.status).toBe(200);
            const projectUids = res.body.projects.map((p) => p.uid);
            expect(projectUids).toContain(project.uid);
        });

        it('should not show project to assignee when they have no assigned tasks in it', async () => {
            const project = await Project.create({
                name: 'Private Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Owner Only Task',
                user_id: owner.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.get('/api/projects');
            expect(res.status).toBe(200);
            const projectUids = res.body.projects.map((p) => p.uid);
            expect(projectUids).not.toContain(project.uid);
        });

        it('should grant access to project detail when user has assigned task in it', async () => {
            const project = await Project.create({
                name: 'Owner Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const slugged = project.name.toLowerCase().replace(/\s+/g, '-');
            const uidSlug = `${project.uid}-${slugged}`;

            const res = await assigneeAgent.get(`/api/project/${uidSlug}`);
            expect(res.status).toBe(200);
            expect(res.body.uid).toBe(project.uid);
        });

        it('should allow assignee to create tasks in project they have access to', async () => {
            const project = await Project.create({
                name: 'Task Creation Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Existing Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.post('/api/task').send({
                name: 'New Task By Assignee',
                project_id: project.id,
            });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('New Task By Assignee');
            expect(res.body.project_id).toBe(project.id);
        });

        it('should allow task owner to create tasks in project they have access to', async () => {
            const project = await Project.create({
                name: 'Task Owner Creation Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Task Owned By Assignee',
                user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.post('/api/task').send({
                name: 'Another Task By Assignee',
                project_id: project.id,
            });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Another Task By Assignee');
            expect(res.body.project_id).toBe(project.id);
        });

        it('should only show assignee their own tasks in the project', async () => {
            const project = await Project.create({
                name: 'Shared Project',
                user_id: owner.id,
            });

            await Task.create({
                name: 'Owner Task',
                user_id: owner.id,
                project_id: project.id,
            });

            await Task.create({
                name: 'Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.get(
                `/api/tasks?project_id=${project.id}`
            );
            expect(res.status).toBe(200);
            const taskNames = res.body.tasks.map((t) => t.name);
            expect(taskNames).toContain('Assigned Task');
            expect(taskNames).not.toContain('Owner Task');
        });
    });

    describe('Workspace visibility via task assignment', () => {
        it('should show workspace when assignee has a task in a project in that workspace', async () => {
            const workspace = await Workspace.create({
                name: 'Owner Workspace',
                creator: owner.id,
            });

            const project = await Project.create({
                name: 'Workspace Project',
                user_id: owner.id,
                workspace_id: workspace.id,
            });

            await Task.create({
                name: 'Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.get('/api/workspaces');
            expect(res.status).toBe(200);
            const wsUids = res.body.map((w) => w.uid);
            expect(wsUids).toContain(workspace.uid);
        });

        it('should not show workspace when assignee has no task in any project in it', async () => {
            const workspace = await Workspace.create({
                name: 'Private Workspace',
                creator: owner.id,
            });

            await Project.create({
                name: 'Private Project',
                user_id: owner.id,
                workspace_id: workspace.id,
            });

            const res = await assigneeAgent.get('/api/workspaces');
            expect(res.status).toBe(200);
            const wsUids = res.body.map((w) => w.uid);
            expect(wsUids).not.toContain(workspace.uid);
        });

        it('should allow assignee to access workspace detail via task assignment', async () => {
            const workspace = await Workspace.create({
                name: 'Workspace Detail',
                creator: owner.id,
            });

            const project = await Project.create({
                name: 'WS Project',
                user_id: owner.id,
                workspace_id: workspace.id,
            });

            await Task.create({
                name: 'Assigned Task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
                project_id: project.id,
            });

            const res = await assigneeAgent.get(
                `/api/workspaces/${workspace.uid}`
            );
            expect(res.status).toBe(200);
            expect(res.body.uid).toBe(workspace.uid);
            expect(res.body.is_creator).toBe(false);
        });
    });
});
