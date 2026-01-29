const request = require('supertest');
const app = require('../../../app');
const { Task, Role, sequelize } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('DELETE /api/v1/task/:uid permissions', () => {
    let owner, assignee, subscriber, superAdmin;
    let ownerAgent, assigneeAgent, subscriberAgent, superAdminAgent;
    let task;

    beforeEach(async () => {
        // Create users with unique emails
        owner = await createTestUser({
            email: `owner-${Date.now()}@test.com`,
            name: 'Task',
            surname: 'Owner',
        });
        assignee = await createTestUser({
            email: `assignee-${Date.now()}@test.com`,
            name: 'Task',
            surname: 'Assignee',
        });
        subscriber = await createTestUser({
            email: `subscriber-${Date.now()}@test.com`,
            name: 'Task',
            surname: 'Subscriber',
        });
        superAdmin = await createTestUser({
            email: `superadmin-${Date.now()}@test.com`,
            name: 'Super',
            surname: 'Admin',
            is_admin: true,
        });

        // Create task owned by owner, assigned to assignee
        task = await Task.create({
            name: 'Test Task',
            user_id: owner.id,
            assigned_to_user_id: assignee.id,
        });

        // Subscribe subscriber to the task
        await sequelize.query(
            `INSERT INTO tasks_subscribers (task_id, user_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
            { replacements: [task.id, subscriber.id] }
        );

        // Login users
        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        assigneeAgent = request.agent(app);
        await assigneeAgent
            .post('/api/login')
            .send({ email: assignee.email, password: 'password123' });

        subscriberAgent = request.agent(app);
        await subscriberAgent
            .post('/api/login')
            .send({ email: subscriber.email, password: 'password123' });

        superAdminAgent = request.agent(app);
        await superAdminAgent
            .post('/api/login')
            .send({ email: superAdmin.email, password: 'password123' });
    });

    afterEach(async () => {
        const userIds = [owner.id, assignee.id, subscriber.id, superAdmin.id];

        // Clean up task subscriptions
        await sequelize.query(
            `DELETE FROM tasks_subscribers WHERE user_id IN (?)`,
            {
                replacements: [userIds],
            }
        );

        await Task.destroy({
            where: { user_id: userIds },
            force: true,
        });

        await Role.destroy({
            where: { user_id: userIds },
        });
    });

    it('should allow owner to delete task', async () => {
        const res = await ownerAgent.delete(`/api/task/${task.uid}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task successfully deleted');
    });

    it('should allow super admin to delete task', async () => {
        const res = await superAdminAgent.delete(`/api/task/${task.uid}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task successfully deleted');
    });

    it('should NOT allow assignee to delete task', async () => {
        const res = await assigneeAgent.delete(`/api/task/${task.uid}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to delete this task. Please contact the creator if you want to make this change.'
        );
    });

    it('should NOT allow subscriber to delete task', async () => {
        const res = await subscriberAgent.delete(`/api/task/${task.uid}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to delete this task. Please contact the creator if you want to make this change.'
        );
    });
});
