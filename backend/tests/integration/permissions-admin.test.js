const request = require('supertest');
const app = require('../../app');
const { Task, Project, Note, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Admin Permissions - Resource Visibility', () => {
    let adminUser, regularUser, adminAgent, regularAgent;

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

    beforeEach(async () => {
        // Create admin user
        adminUser = await createTestUser({
            email: `admin_${Date.now()}@example.com`,
        });
        await makeAdmin(adminUser.id);

        // Create regular user
        regularUser = await createTestUser({
            email: `regular_${Date.now()}@example.com`,
        });

        // Login both users
        adminAgent = await loginAgent(adminUser.email);
        regularAgent = await loginAgent(regularUser.email);
    });

    describe('Tasks visibility', () => {
        it('admin should see all tasks including other users tasks', async () => {
            // Create tasks for both users
            const adminTask = await Task.create({
                name: 'Admin Task',
                user_id: adminUser.id,
            });

            const regularTask = await Task.create({
                name: 'Regular User Task',
                user_id: regularUser.id,
            });

            // Admin fetches all tasks
            const res = await adminAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Admin should see all tasks
            expect(taskIds).toContain(adminTask.id);
            expect(taskIds).toContain(regularTask.id);
        });
    });

    describe('Projects visibility', () => {
        it('admin should see all projects including other users projects', async () => {
            // Create projects for both users
            const adminProject = await Project.create({
                name: 'Admin Project',
                user_id: adminUser.id,
            });

            const regularProject = await Project.create({
                name: 'Regular User Project',
                user_id: regularUser.id,
            });

            // Admin fetches all projects
            const res = await adminAgent.get('/api/projects');
            expect(res.status).toBe(200);

            const projectIds = res.body.projects.map((p) => p.id);

            // Admin should see their own project
            expect(projectIds).toContain(adminProject.id);

            // ASID-867: Admin should see ALL projects
            expect(projectIds).toContain(regularProject.id);
        });
    });

    describe('Notes visibility', () => {
        it('admin should only see their own notes, not all notes', async () => {
            // Create notes for both users
            const adminNote = await Note.create({
                name: 'Admin Note',
                content: 'Admin content',
                user_id: adminUser.id,
            });

            const regularNote = await Note.create({
                name: 'Regular User Note',
                content: 'Regular content',
                user_id: regularUser.id,
            });

            // Admin fetches all notes
            const res = await adminAgent.get('/api/notes');
            expect(res.status).toBe(200);

            const noteIds = res.body.map((n) => n.id);

            // Admin should see their own note
            expect(noteIds).toContain(adminNote.id);

            // Admin should NOT see other user's note (THIS IS THE KEY FIX)
            expect(noteIds).not.toContain(regularNote.id);
        });
    });

    describe('Regular user behavior unchanged', () => {
        it('regular user should only see their own tasks', async () => {
            // Create tasks for both users
            const adminTask = await Task.create({
                name: 'Admin Task',
                user_id: adminUser.id,
            });

            const regularTask = await Task.create({
                name: 'Regular User Task',
                user_id: regularUser.id,
            });

            // Regular user fetches all tasks
            const res = await regularAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Regular user should see their own task
            expect(taskIds).toContain(regularTask.id);

            // Regular user should NOT see admin's task
            expect(taskIds).not.toContain(adminTask.id);
        });
    });

    describe('Task metrics visibility', () => {
        it('admin task listing includes all tasks', async () => {
            // Create tasks for admin
            const adminTask1 = await Task.create({
                name: 'Admin Task 1',
                user_id: adminUser.id,
            });

            const adminTask2 = await Task.create({
                name: 'Admin Task 2',
                user_id: adminUser.id,
            });

            // Create tasks for regular user
            const regularTask1 = await Task.create({
                name: 'Regular Task 1',
                user_id: regularUser.id,
            });

            const regularTask2 = await Task.create({
                name: 'Regular Task 2',
                user_id: regularUser.id,
            });

            // Admin fetches tasks — should see all tasks
            const tasksRes = await adminAgent.get('/api/tasks');
            expect(tasksRes.status).toBe(200);

            const taskIds = tasksRes.body.tasks.map((t) => t.id);
            expect(taskIds).toContain(adminTask1.id);
            expect(taskIds).toContain(adminTask2.id);
            expect(taskIds).toContain(regularTask1.id);
            expect(taskIds).toContain(regularTask2.id);
        });
    });
});
