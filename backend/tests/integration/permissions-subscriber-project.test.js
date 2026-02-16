const request = require('supertest');
const app = require('../../app');
const { Task, Project, Permission, Role, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    subscribeToTask,
    unsubscribeFromTask,
} = require('../../services/taskSubscriptionService');

describe('Subscriber project visibility', () => {
    let owner, subscriber;
    let ownerAgent, subscriberAgent;
    let project, taskInProject, otherTaskInProject;

    beforeEach(async () => {
        const ts = Date.now();
        owner = await createTestUser({
            email: `owner-${ts}@test.com`,
            name: 'Project',
            surname: 'Owner',
        });
        subscriber = await createTestUser({
            email: `subscriber-${ts}@test.com`,
            name: 'Task',
            surname: 'Subscriber',
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: owner.id,
        });

        taskInProject = await Task.create({
            name: 'Subscribed Task',
            user_id: owner.id,
            project_id: project.id,
        });

        otherTaskInProject = await Task.create({
            name: 'Other Task In Project',
            user_id: owner.id,
            project_id: project.id,
        });

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        subscriberAgent = request.agent(app);
        await subscriberAgent
            .post('/api/login')
            .send({ email: subscriber.email, password: 'password123' });
    });

    afterEach(async () => {
        const userIds = [owner.id, subscriber.id];

        await Permission.destroy({ where: { user_id: userIds } });
        await sequelize.query(
            `DELETE FROM tasks_subscribers WHERE user_id IN (?)`,
            { replacements: [userIds] }
        );
        await Task.destroy({ where: { user_id: userIds }, force: true });
        await Project.destroy({ where: { user_id: userIds }, force: true });
        await Role.destroy({ where: { user_id: userIds } });
    });

    describe('project list visibility', () => {
        it('should NOT show project to user with no subscription', async () => {
            const res = await subscriberAgent.get('/api/projects');
            expect(res.status).toBe(200);

            const projectUids = res.body.projects.map((p) => p.uid);
            expect(projectUids).not.toContain(project.uid);
        });

        it('should show project to user subscribed to a task in it', async () => {
            await subscribeToTask(taskInProject.id, subscriber.id, owner.id);

            const res = await subscriberAgent.get('/api/projects');
            expect(res.status).toBe(200);

            const projectUids = res.body.projects.map((p) => p.uid);
            expect(projectUids).toContain(project.uid);
        });

        it('should NOT show project after unsubscribing from all tasks in it', async () => {
            await subscribeToTask(taskInProject.id, subscriber.id, owner.id);

            // Verify project is visible
            let res = await subscriberAgent.get('/api/projects');
            expect(res.body.projects.map((p) => p.uid)).toContain(project.uid);

            // Unsubscribe
            await unsubscribeFromTask(taskInProject.id, subscriber.id);

            res = await subscriberAgent.get('/api/projects');
            expect(res.body.projects.map((p) => p.uid)).not.toContain(
                project.uid
            );
        });
    });

    describe('individual project access', () => {
        it('should grant read-only access to project via subscription', async () => {
            await subscribeToTask(taskInProject.id, subscriber.id, owner.id);

            const slugged = project.name.toLowerCase().replace(/\s+/g, '-');
            const uidSlug = `${project.uid}-${slugged}`;

            const res = await subscriberAgent.get(`/api/project/${uidSlug}`);
            expect(res.status).toBe(200);
            expect(res.body.uid).toBe(project.uid);
        });

        it('should return 403 for project when not subscribed', async () => {
            const slugged = project.name.toLowerCase().replace(/\s+/g, '-');
            const uidSlug = `${project.uid}-${slugged}`;

            const res = await subscriberAgent.get(`/api/project/${uidSlug}`);
            expect(res.status).toBe(403);
        });
    });

    describe('task visibility in subscribed project', () => {
        it('should show all tasks in project when subscribed to one task', async () => {
            await subscribeToTask(taskInProject.id, subscriber.id, owner.id);

            const res = await subscriberAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);
            expect(taskIds).toContain(taskInProject.id);
            expect(taskIds).toContain(otherTaskInProject.id);
        });

        it('should NOT show tasks from project when not subscribed', async () => {
            const res = await subscriberAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);
            expect(taskIds).not.toContain(taskInProject.id);
            expect(taskIds).not.toContain(otherTaskInProject.id);
        });
    });
});
