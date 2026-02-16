const request = require('supertest');
const app = require('../../app');
const { Area, User, AreasSubscriber, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('/api/departments/:uid/subscribers', () => {
    let adminUser, adminAgent;
    let deptUid;

    beforeEach(async () => {
        // Create superuser (is_admin: true)
        adminUser = await createTestUser({
            email: 'admin@example.com',
            is_admin: true,
        });

        // Create authenticated agent for admin
        adminAgent = request.agent(app);
        await adminAgent.post('/api/login').send({
            email: 'admin@example.com',
            password: 'password123',
        });

        // Create a department via API (admin user becomes dept admin automatically)
        const createRes = await adminAgent
            .post('/api/departments')
            .send({ name: 'Engineering', description: 'Engineering dept' });
        deptUid = createRes.body.uid;
    });

    describe('GET /api/departments/:uid/subscribers', () => {
        it('should return empty list for new department', async () => {
            const res = await adminAgent.get(
                `/api/departments/${deptUid}/subscribers`
            );

            expect(res.status).toBe(200);
            expect(res.body.subscribers).toBeDefined();
            expect(res.body.subscribers).toHaveLength(0);
        });

        it('should return 404 for nonexistent department', async () => {
            const res = await adminAgent.get(
                '/api/departments/abcd1234efghijk/subscribers'
            );

            expect(res.status).toBe(404);
        });

        it('should require admin access', async () => {
            // Create a regular member (not admin)
            const memberUser = await createTestUser({
                email: 'member@example.com',
            });

            // Add as regular member
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: memberUser.id, role: 'member' });

            const memberAgent = request.agent(app);
            await memberAgent.post('/api/login').send({
                email: 'member@example.com',
                password: 'password123',
            });

            const res = await memberAgent.get(
                `/api/departments/${deptUid}/subscribers`
            );

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/departments/:uid/subscribers', () => {
        let subscriberUser;

        beforeEach(async () => {
            subscriberUser = await createTestUser({
                email: 'subscriber@example.com',
            });
        });

        it('should add a subscriber and return it with source=manual', async () => {
            const postRes = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            expect(postRes.status).toBe(200);
            expect(postRes.body.subscribers).toBeDefined();
            expect(postRes.body.subscribers).toHaveLength(1);
            expect(postRes.body.subscribers[0].id).toBe(subscriberUser.id);
            expect(postRes.body.subscribers[0].AreasSubscriber.source).toBe(
                'manual'
            );

            // Verify GET also returns it
            const getRes = await adminAgent.get(
                `/api/departments/${deptUid}/subscribers`
            );
            expect(getRes.status).toBe(200);
            expect(getRes.body.subscribers).toHaveLength(1);
            expect(getRes.body.subscribers[0].AreasSubscriber.source).toBe(
                'manual'
            );
        });

        it('should return 409 for duplicate subscriber', async () => {
            // Add subscriber first time
            await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            // Try to add again
            const res = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('User is already a subscriber');
        });

        it('should return 400 for missing user_id', async () => {
            const res = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('user_id is required');
        });

        it('should return 404 for nonexistent user_id', async () => {
            const res = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: 99999 });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('User not found');
        });

        it('should return 403 for regular member', async () => {
            const memberUser = await createTestUser({
                email: 'regularmember@example.com',
            });

            // Add as regular member
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: memberUser.id, role: 'member' });

            const memberAgent = request.agent(app);
            await memberAgent.post('/api/login').send({
                email: 'regularmember@example.com',
                password: 'password123',
            });

            const res = await memberAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            expect(res.status).toBe(403);
        });

        it('should return 404 for nonexistent department on POST', async () => {
            const res = await adminAgent
                .post('/api/departments/abcd1234efghijk/subscribers')
                .send({ user_id: subscriberUser.id });

            expect(res.status).toBe(404);
        });

        it('should subscribe to existing tasks with retroactive=true', async () => {
            // Add a member to the department
            const memberUser = await createTestUser({
                email: 'taskmember@example.com',
            });
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: memberUser.id, role: 'member' });

            // Create tasks owned by the member
            const task1 = await Task.create({
                name: 'Task 1',
                user_id: memberUser.id,
                status: 0,
            });
            const task2 = await Task.create({
                name: 'Task 2',
                user_id: memberUser.id,
                status: 0,
            });

            // Add subscriber with retroactive=true
            const res = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id, retroactive: true });

            expect(res.status).toBe(200);
            expect(res.body.subscribers).toHaveLength(1);

            // Verify subscriber is subscribed to the tasks
            const task1WithSubs = await Task.findByPk(task1.id, {
                include: [
                    {
                        model: User,
                        as: 'Subscribers',
                        attributes: ['id'],
                        through: { attributes: [] },
                    },
                ],
            });

            const task2WithSubs = await Task.findByPk(task2.id, {
                include: [
                    {
                        model: User,
                        as: 'Subscribers',
                        attributes: ['id'],
                        through: { attributes: [] },
                    },
                ],
            });

            expect(
                task1WithSubs.Subscribers.some(
                    (s) => s.id === subscriberUser.id
                )
            ).toBe(true);
            expect(
                task2WithSubs.Subscribers.some(
                    (s) => s.id === subscriberUser.id
                )
            ).toBe(true);
        });

        it('should allow department admin to manage subscribers', async () => {
            // Create a dept admin user
            const deptAdminUser = await createTestUser({
                email: 'deptadmin@example.com',
            });

            // Add as department admin
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: deptAdminUser.id, role: 'admin' });

            const deptAdminAgent = request.agent(app);
            await deptAdminAgent.post('/api/login').send({
                email: 'deptadmin@example.com',
                password: 'password123',
            });

            // Dept admin should be able to add subscriber
            const res = await deptAdminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            expect(res.status).toBe(200);
            // 2 subscribers: deptAdminUser (auto-subscribed as admin_role) + subscriberUser (manual)
            expect(res.body.subscribers).toHaveLength(2);
        });

        it('should allow superuser to manage subscribers', async () => {
            // adminUser is already a superuser (is_admin: true)
            const res = await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            expect(res.status).toBe(200);
            expect(res.body.subscribers).toHaveLength(1);
        });
    });

    describe('DELETE /api/departments/:uid/subscribers/:userId', () => {
        let subscriberUser;

        beforeEach(async () => {
            subscriberUser = await createTestUser({
                email: 'subscriber@example.com',
            });
        });

        it('should remove a manual subscriber', async () => {
            // Add subscriber first
            await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            // Delete subscriber
            const res = await adminAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.subscribers).toBeDefined();
            expect(res.body.subscribers).toHaveLength(0);
        });

        it('should return 404 for non-existent subscriber', async () => {
            const res = await adminAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('User is not a subscriber');
        });

        it('should return 400 for admin_role subscriber', async () => {
            // Manually insert an admin_role subscriber
            const area = await Area.findOne({ where: { uid: deptUid } });
            await AreasSubscriber.create({
                area_id: area.id,
                user_id: subscriberUser.id,
                added_by: adminUser.id,
                source: 'admin_role',
            });

            const res = await adminAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Cannot remove admin-role subscribers manually'
            );
        });

        it('should return 403 for regular member on DELETE', async () => {
            const memberUser = await createTestUser({
                email: 'regularmember@example.com',
            });

            // Add as regular member
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: memberUser.id, role: 'member' });

            // Add subscriber first
            await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            const memberAgent = request.agent(app);
            await memberAgent.post('/api/login').send({
                email: 'regularmember@example.com',
                password: 'password123',
            });

            const res = await memberAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(403);
        });

        it('should return 404 for nonexistent department on DELETE', async () => {
            const res = await adminAgent.delete(
                `/api/departments/abcd1234efghijk/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(404);
        });

        it('should allow department admin to remove subscribers', async () => {
            // Create a dept admin user
            const deptAdminUser = await createTestUser({
                email: 'deptadmin@example.com',
            });

            // Add as department admin
            await adminAgent
                .post(`/api/departments/${deptUid}/members`)
                .send({ user_id: deptAdminUser.id, role: 'admin' });

            // Add subscriber
            await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            const deptAdminAgent = request.agent(app);
            await deptAdminAgent.post('/api/login').send({
                email: 'deptadmin@example.com',
                password: 'password123',
            });

            // Dept admin should be able to remove subscriber
            const res = await deptAdminAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(200);
            // 1 subscriber remains: deptAdminUser (auto-subscribed as admin_role)
            expect(res.body.subscribers).toHaveLength(1);
        });

        it('should allow superuser to remove subscribers', async () => {
            // Add subscriber
            await adminAgent
                .post(`/api/departments/${deptUid}/subscribers`)
                .send({ user_id: subscriberUser.id });

            // adminUser is already a superuser
            const res = await adminAgent.delete(
                `/api/departments/${deptUid}/subscribers/${subscriberUser.id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.subscribers).toHaveLength(0);
        });
    });
});
