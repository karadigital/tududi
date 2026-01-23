const request = require('supertest');
const app = require('../../app');
const { Task, Area, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

/**
 * Integration tests for department admin auto-subscription to tasks.
 *
 * Test scenarios:
 * 1. Department admin is auto-subscribed to member tasks
 * 2. Department admin is auto-subscribed to their own tasks
 * 3. Multiple admins are all auto-subscribed
 * 4. Users not in departments don't trigger subscriptions
 * 5. Non-admin members are not auto-subscribed
 */
describe('Department Admin Auto-Subscription', () => {
    // Helper to generate unique emails
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    // Helper to create a login agent
    async function loginAgent(email) {
        const agent = request.agent(app);
        await agent.post('/api/login').send({ email, password: 'password123' });
        return agent;
    }

    // Helper to add a user as department member
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

    // Helper to get task subscribers
    async function getTaskSubscribers(taskId) {
        const subscribers = await sequelize.query(
            `SELECT user_id FROM tasks_subscribers WHERE task_id = :taskId`,
            {
                replacements: { taskId },
                type: QueryTypes.SELECT,
            }
        );
        return subscribers.map((s) => s.user_id);
    }

    describe('Auto-subscription on task creation', () => {
        let deptAdmin, deptMember, department, memberAgent;

        beforeEach(async () => {
            // Create department admin
            deptAdmin = await createTestUser({
                email: uniqueEmail('deptadmin'),
            });

            // Create department member
            deptMember = await createTestUser({
                email: uniqueEmail('deptmember'),
            });

            // Create department (area)
            department = await Area.create({
                name: 'Test Department',
                user_id: deptAdmin.id,
            });

            // Add deptAdmin as department admin
            await addAreaMember(department.id, deptAdmin.id, 'admin');

            // Add deptMember as regular member
            await addAreaMember(department.id, deptMember.id, 'member');

            // Login department member
            memberAgent = await loginAgent(deptMember.email);
        });

        it('should auto-subscribe admin to member tasks', async () => {
            // Member creates a task
            const res = await memberAgent
                .post('/api/task')
                .send({ name: 'Member Task' });

            expect(res.status).toBe(201);

            // Get task subscribers
            const taskId = res.body.id;
            const subscribers = await getTaskSubscribers(taskId);

            // Department admin should be auto-subscribed
            expect(subscribers).toContain(deptAdmin.id);
        });

        it('should auto-subscribe admin to their own tasks', async () => {
            // Login as admin
            const adminAgent = await loginAgent(deptAdmin.email);

            // Admin creates a task
            const res = await adminAgent
                .post('/api/task')
                .send({ name: 'Admin Own Task' });

            expect(res.status).toBe(201);

            // Get task subscribers
            const taskId = res.body.id;
            const subscribers = await getTaskSubscribers(taskId);

            // Admin should be auto-subscribed to their own task
            expect(subscribers).toContain(deptAdmin.id);
        });

        it('should include Subscribers in task response', async () => {
            // Login as admin
            const adminAgent = await loginAgent(deptAdmin.email);

            // Admin creates a task
            const res = await adminAgent
                .post('/api/task')
                .send({ name: 'Admin Task With Subscribers' });

            expect(res.status).toBe(201);

            // Get the task with subscribers
            const taskRes = await adminAgent.get(`/api/task/${res.body.uid}`);
            expect(taskRes.status).toBe(200);

            // Subscribers should include the admin
            const subscriberIds = taskRes.body.Subscribers.map((s) => s.id);
            expect(subscriberIds).toContain(deptAdmin.id);
        });
    });

    describe('Multiple admins', () => {
        let admin1, admin2, deptMember, department, memberAgent;

        beforeEach(async () => {
            // Create two department admins
            admin1 = await createTestUser({
                email: uniqueEmail('admin1'),
            });
            admin2 = await createTestUser({
                email: uniqueEmail('admin2'),
            });

            // Create department member
            deptMember = await createTestUser({
                email: uniqueEmail('member'),
            });

            // Create department
            department = await Area.create({
                name: 'Multi-Admin Dept',
                user_id: admin1.id,
            });

            // Add both as admins
            await addAreaMember(department.id, admin1.id, 'admin');
            await addAreaMember(department.id, admin2.id, 'admin');

            // Add member
            await addAreaMember(department.id, deptMember.id, 'member');

            // Login member
            memberAgent = await loginAgent(deptMember.email);
        });

        it('should auto-subscribe all department admins', async () => {
            // Member creates a task
            const res = await memberAgent
                .post('/api/task')
                .send({ name: 'Task for Multiple Admins' });

            expect(res.status).toBe(201);

            // Get task subscribers
            const taskId = res.body.id;
            const subscribers = await getTaskSubscribers(taskId);

            // Both admins should be subscribed
            expect(subscribers).toContain(admin1.id);
            expect(subscribers).toContain(admin2.id);
        });
    });

    describe('Non-department users', () => {
        let regularUser, userAgent;

        beforeEach(async () => {
            // Create a user not in any department
            regularUser = await createTestUser({
                email: uniqueEmail('regular'),
            });

            userAgent = await loginAgent(regularUser.email);
        });

        it('should not trigger subscriptions for users not in departments', async () => {
            // User creates a task
            const res = await userAgent
                .post('/api/task')
                .send({ name: 'Independent Task' });

            expect(res.status).toBe(201);

            // Get task subscribers
            const taskId = res.body.id;
            const subscribers = await getTaskSubscribers(taskId);

            // No subscribers should be added
            expect(subscribers).toHaveLength(0);
        });
    });

    describe('Non-admin members', () => {
        let deptAdmin, member1, member2, department, member1Agent;

        beforeEach(async () => {
            // Create department admin
            deptAdmin = await createTestUser({
                email: uniqueEmail('admin'),
            });

            // Create two regular members
            member1 = await createTestUser({
                email: uniqueEmail('member1'),
            });
            member2 = await createTestUser({
                email: uniqueEmail('member2'),
            });

            // Create department
            department = await Area.create({
                name: 'Test Department',
                user_id: deptAdmin.id,
            });

            // Add admin and members
            await addAreaMember(department.id, deptAdmin.id, 'admin');
            await addAreaMember(department.id, member1.id, 'member');
            await addAreaMember(department.id, member2.id, 'member');

            // Login member1
            member1Agent = await loginAgent(member1.email);
        });

        it('should not auto-subscribe non-admin members', async () => {
            // Member1 creates a task
            const res = await member1Agent
                .post('/api/task')
                .send({ name: 'Member1 Task' });

            expect(res.status).toBe(201);

            // Get task subscribers
            const taskId = res.body.id;
            const subscribers = await getTaskSubscribers(taskId);

            // Only admin should be subscribed, not member2
            expect(subscribers).toContain(deptAdmin.id);
            expect(subscribers).not.toContain(member2.id);
        });
    });
});
