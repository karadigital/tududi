const request = require('supertest');
const app = require('../../app');
const { Project, Task, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Admin Project Visibility', () => {
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

    let adminUser, regularUser, adminAgent;

    beforeEach(async () => {
        adminUser = await createTestUser({ email: uniqueEmail('admin') });
        await makeAdmin(adminUser.id);

        regularUser = await createTestUser({ email: uniqueEmail('regular') });

        adminAgent = await loginAgent(adminUser.email);
    });

    it('admin sees all projects in listing including other users projects', async () => {
        const adminProject = await Project.create({
            name: 'Admin Project',
            user_id: adminUser.id,
        });

        const regularProject = await Project.create({
            name: 'Regular User Project',
            user_id: regularUser.id,
        });

        const res = await adminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectIds = res.body.projects.map((p) => p.id);
        expect(projectIds).toContain(adminProject.id);
        expect(projectIds).toContain(regularProject.id);
    });

    it('admin can access any project detail page', async () => {
        const regularProject = await Project.create({
            name: 'Regular User Project',
            user_id: regularUser.id,
        });

        const slugged = regularProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${regularProject.uid}-${slugged}`;

        const res = await adminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
        expect(res.body.uid).toBe(regularProject.uid);
    });

    it('admin sees all tasks on project detail page', async () => {
        const regularProject = await Project.create({
            name: 'Regular User Project',
            user_id: regularUser.id,
        });

        const task1 = await Task.create({
            name: 'Task One',
            user_id: regularUser.id,
            project_id: regularProject.id,
        });

        const task2 = await Task.create({
            name: 'Task Two',
            user_id: regularUser.id,
            project_id: regularProject.id,
        });

        const slugged = regularProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${regularProject.uid}-${slugged}`;

        const res = await adminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);

        const taskIds = res.body.Tasks.map((t) => t.id);
        expect(taskIds).toContain(task1.id);
        expect(taskIds).toContain(task2.id);
        expect(res.body.Tasks).toHaveLength(2);
    });
});
