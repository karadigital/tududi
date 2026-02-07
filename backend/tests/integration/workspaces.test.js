const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { Workspace, Project, sequelize } = require('../../models');

describe('/api workspaces', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/workspace', () => {
        it('should create a workspace successfully', async () => {
            const response = await agent
                .post('/api/workspace')
                .send({ name: 'My Workspace' });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('My Workspace');
            expect(response.body.uid).toBeDefined();
            expect(typeof response.body.uid).toBe('string');
        });

        it('should return 400 with empty name', async () => {
            const response = await agent
                .post('/api/workspace')
                .send({ name: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Workspace name is required.');
        });

        it('should return 400 with missing name', async () => {
            const response = await agent.post('/api/workspace').send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Workspace name is required.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/workspace')
                .send({ name: 'Test' });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/workspaces', () => {
        it('should return workspaces user has created', async () => {
            const ws = await Workspace.create({
                name: 'Created Workspace',
                creator: user.id,
            });

            const response = await agent.get('/api/workspaces');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].uid).toBe(ws.uid);
            expect(response.body[0].name).toBe('Created Workspace');
        });

        it('should return workspaces where user has projects', async () => {
            // Create another user who owns the workspace
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const ws = await Workspace.create({
                name: 'Other Workspace',
                creator: otherUser.id,
            });

            // Current user has a project in this workspace
            await Project.create({
                name: 'My Project',
                user_id: user.id,
                workspace_id: ws.id,
            });

            const response = await agent.get('/api/workspaces');

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
            const wsUids = response.body.map((w) => w.uid);
            expect(wsUids).toContain(ws.uid);
        });

        it('should not return workspaces with no accessible projects and not created by user', async () => {
            const otherUser = await createTestUser({
                email: 'other2@example.com',
            });

            // Other user creates a workspace and a project in it
            const ws = await Workspace.create({
                name: 'Inaccessible Workspace',
                creator: otherUser.id,
            });

            await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
                workspace_id: ws.id,
            });

            const response = await agent.get('/api/workspaces');

            expect(response.status).toBe(200);
            const wsUids = response.body.map((w) => w.uid);
            expect(wsUids).not.toContain(ws.uid);
        });

        it('should include my_project_count for each workspace', async () => {
            const ws = await Workspace.create({
                name: 'Workspace With Projects',
                creator: user.id,
            });

            await Project.create({
                name: 'Project 1',
                user_id: user.id,
                workspace_id: ws.id,
            });

            await Project.create({
                name: 'Project 2',
                user_id: user.id,
                workspace_id: ws.id,
            });

            const response = await agent.get('/api/workspaces');

            expect(response.status).toBe(200);
            const found = response.body.find((w) => w.uid === ws.uid);
            expect(found).toBeDefined();
            expect(Number(found.my_project_count)).toBe(2);
        });

        it('should return empty array when user has no workspaces', async () => {
            const response = await agent.get('/api/workspaces');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/workspaces');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/workspaces/:uid', () => {
        it('should return 404 when user has no access to workspace', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const ws = await Workspace.create({
                name: 'Private Workspace',
                creator: otherUser.id,
            });

            const response = await agent.get(`/api/workspaces/${ws.uid}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Workspace not found');
        });

        it('should allow access when user has a project in the workspace', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const ws = await Workspace.create({
                name: 'Shared Workspace',
                creator: otherUser.id,
            });

            await Project.create({
                name: 'My Project',
                user_id: user.id,
                workspace_id: ws.id,
            });

            const response = await agent.get(`/api/workspaces/${ws.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.uid).toBe(ws.uid);
        });

        it('should return workspace detail', async () => {
            const ws = await Workspace.create({
                name: 'Detail Workspace',
                creator: user.id,
            });

            const response = await agent.get(`/api/workspaces/${ws.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.uid).toBe(ws.uid);
            expect(response.body.name).toBe('Detail Workspace');
            expect(response.body.is_creator).toBe(true);
            expect(response.body.created_at).toBeDefined();
            expect(response.body.updated_at).toBeDefined();
        });

        it('should return 404 for non-existent uid', async () => {
            const response = await agent.get('/api/workspaces/abcd1234efghijk');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Workspace not found');
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.get('/api/workspaces/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should require authentication', async () => {
            const ws = await Workspace.create({
                name: 'Auth Test',
                creator: user.id,
            });

            const response = await request(app).get(
                `/api/workspaces/${ws.uid}`
            );

            expect(response.status).toBe(401);
        });
    });

    describe('PATCH /api/workspace/:uid', () => {
        it('should update workspace name', async () => {
            const ws = await Workspace.create({
                name: 'Old Name',
                creator: user.id,
            });

            const response = await agent
                .patch(`/api/workspace/${ws.uid}`)
                .send({ name: 'New Name' });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Name');
            expect(response.body.uid).toBe(ws.uid);

            // Verify in database
            const updated = await Workspace.findOne({
                where: { uid: ws.uid },
            });
            expect(updated.name).toBe('New Name');
        });

        it('should return 403 when non-creator tries to update', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const ws = await Workspace.create({
                name: 'Other Workspace',
                creator: otherUser.id,
            });

            const response = await agent
                .patch(`/api/workspace/${ws.uid}`)
                .send({ name: 'Hijacked' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe(
                'Not authorized to modify this workspace.'
            );

            // Verify name was not changed
            const unchanged = await Workspace.findOne({
                where: { uid: ws.uid },
            });
            expect(unchanged.name).toBe('Other Workspace');
        });

        it('should return 400 for empty name', async () => {
            const ws = await Workspace.create({
                name: 'Valid Name',
                creator: user.id,
            });

            const response = await agent
                .patch(`/api/workspace/${ws.uid}`)
                .send({ name: '   ' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Workspace name is required.');
        });

        it('should return 404 for non-existent workspace', async () => {
            const response = await agent
                .patch('/api/workspace/abcd1234efghijk')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Workspace not found.');
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent
                .patch('/api/workspace/invalid-uid')
                .send({ name: 'Updated' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should require authentication', async () => {
            const ws = await Workspace.create({
                name: 'Auth Test',
                creator: user.id,
            });

            const response = await request(app)
                .patch(`/api/workspace/${ws.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
        });
    });

    describe('DELETE /api/workspace/:uid', () => {
        it('should delete workspace and orphan projects', async () => {
            const ws = await Workspace.create({
                name: 'To Delete',
                creator: user.id,
            });

            // Create a project in this workspace
            const project = await Project.create({
                name: 'Orphan Project',
                user_id: user.id,
                workspace_id: ws.id,
            });

            const response = await agent.delete(`/api/workspace/${ws.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Workspace deleted');

            // Verify workspace is deleted
            const deleted = await Workspace.findOne({
                where: { uid: ws.uid },
            });
            expect(deleted).toBeNull();

            // Verify project still exists but workspace_id is null
            const orphanedProject = await Project.findByPk(project.id);
            expect(orphanedProject).not.toBeNull();
            expect(orphanedProject.workspace_id).toBeNull();
        });

        it('should return 403 when non-creator tries to delete', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const ws = await Workspace.create({
                name: 'Other Workspace',
                creator: otherUser.id,
            });

            const response = await agent.delete(`/api/workspace/${ws.uid}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe(
                'Not authorized to modify this workspace.'
            );

            // Verify workspace was not deleted
            const stillExists = await Workspace.findOne({
                where: { uid: ws.uid },
            });
            expect(stillExists).not.toBeNull();
        });

        it('should return 404 for non-existent workspace', async () => {
            const response = await agent.delete(
                '/api/workspace/abcd1234efghijk'
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Workspace not found.');
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.delete('/api/workspace/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should require authentication', async () => {
            const ws = await Workspace.create({
                name: 'Auth Test',
                creator: user.id,
            });

            const response = await request(app).delete(
                `/api/workspace/${ws.uid}`
            );

            expect(response.status).toBe(401);
        });
    });
});
