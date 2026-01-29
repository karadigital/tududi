const request = require('supertest');
const app = require('../../../app');
const { Task, Role, Permission, sequelize } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('Admin task assignment permissions', () => {
    let owner, admin, assignee;
    let ownerAgent, adminAgent;
    let task;

    beforeEach(async () => {
        const timestamp = Date.now();
        owner = await createTestUser({
            email: `owner-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Owner',
        });
        admin = await createTestUser({
            email: `admin-${timestamp}@test.com`,
            name: 'Super',
            surname: 'Admin',
            is_admin: true,
        });
        assignee = await createTestUser({
            email: `assignee-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Assignee',
        });

        task = await Task.create({
            name: 'Test Task for Admin Assignment',
            user_id: owner.id,
        });

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });

        adminAgent = request.agent(app);
        await adminAgent
            .post('/api/login')
            .send({ email: admin.email, password: 'password123' });
    });

    afterEach(async () => {
        const userIds = [owner.id, admin.id, assignee.id];

        await Permission.destroy({
            where: { user_id: userIds },
        });

        await sequelize.query(
            `DELETE FROM tasks_subscribers WHERE user_id IN (?)`,
            { replacements: [userIds] }
        );

        await Task.destroy({
            where: { user_id: userIds },
            force: true,
        });

        await Role.destroy({
            where: { user_id: userIds },
        });
    });

    it('should allow admin to assign a task they do not own', async () => {
        // Admin assigns task (owned by owner) to assignee
        const res = await adminAgent
            .post(`/api/task/${task.uid}/assign`)
            .send({ assigned_to_user_id: assignee.id });

        expect(res.status).toBe(200);
        expect(res.body.AssignedTo).toBeDefined();
        expect(res.body.AssignedTo.id).toBe(assignee.id);
    });

    it('should allow admin to unassign a task they do not own', async () => {
        // First, owner assigns the task
        await ownerAgent
            .post(`/api/task/${task.uid}/assign`)
            .send({ assigned_to_user_id: assignee.id });

        // Admin unassigns the task
        const res = await adminAgent.post(`/api/task/${task.uid}/unassign`);

        expect(res.status).toBe(200);
        expect(res.body.AssignedTo).toBeNull();
    });

    it('should allow owner to assign their own task', async () => {
        const res = await ownerAgent
            .post(`/api/task/${task.uid}/assign`)
            .send({ assigned_to_user_id: assignee.id });

        expect(res.status).toBe(200);
        expect(res.body.AssignedTo).toBeDefined();
        expect(res.body.AssignedTo.id).toBe(assignee.id);
    });
});
