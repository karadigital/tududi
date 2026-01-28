const request = require('supertest');
const app = require('../../../app');
const { Task, Role, Permission, sequelize } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const {
    subscribeToTask,
} = require('../../../services/taskSubscriptionService');

describe('Subscriber edit permissions via subscribeToTask', () => {
    let owner, subscriber;
    let ownerAgent, subscriberAgent;
    let task;

    beforeEach(async () => {
        const timestamp = Date.now();
        owner = await createTestUser({
            email: `owner-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Owner',
        });
        subscriber = await createTestUser({
            email: `subscriber-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Subscriber',
        });

        task = await Task.create({
            name: 'Test Task',
            user_id: owner.id,
        });

        // Subscribe using the ACTUAL subscribeToTask function (which creates Permission)
        await subscribeToTask(task.id, subscriber.id, owner.id);

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

    it('should NOT allow subscriber to edit task even when subscribed via API', async () => {
        // Check permission was created with 'rw'
        const perm = await Permission.findOne({
            where: {
                user_id: subscriber.id,
                resource_type: 'task',
                resource_uid: task.uid,
            },
            raw: true,
        });
        console.log('Permission record:', perm);

        const res = await subscriberAgent
            .patch(`/api/task/${task.uid}`)
            .send({ name: 'Subscriber Updated' });

        console.log('Response status:', res.status);
        console.log('Response body:', res.body);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe(
            'You are not allowed to edit this task. Please contact the creator if you want to make this change.'
        );
    });
});
