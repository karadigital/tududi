const request = require('supertest');
const app = require('../../app');
const { User, UserActivity, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

async function makeAdminDirect(userId) {
    await Role.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, is_admin: true },
    });
}

describe('User Activity Tracking', () => {
    describe('UserActivity model', () => {
        it('should create a user activity record', async () => {
            const user = await createTestUser({
                email: 'activity-model@example.com',
            });
            const now = new Date();
            const activity = await UserActivity.create({
                user_id: user.id,
                date: '2026-04-09',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
            expect(activity.id).toBeDefined();
            expect(activity.user_id).toBe(user.id);
            expect(activity.activity_type).toBe('passive');
        });

        it('should enforce unique constraint on user_id + date', async () => {
            const user = await createTestUser({
                email: 'activity-unique@example.com',
            });
            const now = new Date();
            await UserActivity.create({
                user_id: user.id,
                date: '2026-04-09',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
            await expect(
                UserActivity.create({
                    user_id: user.id,
                    date: '2026-04-09',
                    activity_type: 'active',
                    first_seen_at: now,
                    last_seen_at: now,
                    action_counts: {},
                })
            ).rejects.toThrow();
        });
    });

    describe('ActivityReportRecipient model', () => {
        it('should create a recipient record', async () => {
            const user = await createTestUser({
                email: 'recipient-admin@example.com',
            });
            const { ActivityReportRecipient } = require('../../models');
            const recipient = await ActivityReportRecipient.create({
                email: 'report@example.com',
                enabled: true,
                added_by: user.id,
            });
            expect(recipient.id).toBeDefined();
            expect(recipient.email).toBe('report@example.com');
            expect(recipient.enabled).toBe(true);
        });
    });

    describe('Activity tracking middleware', () => {
        let user, agent;

        beforeEach(async () => {
            user = await createTestUser({
                email: 'middleware-user@example.com',
            });
            agent = await loginAgent('middleware-user@example.com');
        });

        it('should create a passive activity record on GET request', async () => {
            await agent.get('/api/tasks');
            // Wait briefly for async tracking
            await new Promise((r) => setTimeout(r, 100));
            const activities = await UserActivity.findAll({
                where: { user_id: user.id },
            });
            expect(activities.length).toBe(1);
            expect(activities[0].activity_type).toBe('passive');
        });

        it('should upgrade to active on POST to tracked resource', async () => {
            // First a GET to create passive record
            await agent.get('/api/tasks');
            await new Promise((r) => setTimeout(r, 100));

            // Now a POST to tasks (create a task)
            await agent.post('/api/tasks').send({
                title: 'Test task for activity',
                status: 0,
                priority: 1,
            });
            await new Promise((r) => setTimeout(r, 100));

            const activities = await UserActivity.findAll({
                where: { user_id: user.id },
            });
            expect(activities.length).toBe(1);
            expect(activities[0].activity_type).toBe('active');
        });

        it('should increment action_counts on write operations', async () => {
            await agent.post('/api/tasks').send({
                title: 'Count test task',
                status: 0,
                priority: 1,
            });
            await new Promise((r) => setTimeout(r, 100));

            const activity = await UserActivity.findOne({
                where: { user_id: user.id },
            });
            expect(activity.action_counts.tasks_created).toBe(1);
        });

        it('should not track activity for unauthenticated requests', async () => {
            await request(app).get('/api/health');
            const activities = await UserActivity.findAll();
            // No activity records should exist for health check
            const healthActivities = activities.filter(
                (a) => a.user_id === null
            );
            expect(healthActivities.length).toBe(0);
        });
    });

    describe('Activity admin API', () => {
        let adminUser, adminAgent, regularUser;

        beforeEach(async () => {
            adminUser = await createTestUser({
                email: 'activity-admin@example.com',
            });
            adminAgent = await loginAgent('activity-admin@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);

            regularUser = await createTestUser({
                email: 'activity-regular@example.com',
            });

            // Seed some activity data
            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 3 },
            });
            await UserActivity.create({
                user_id: regularUser.id,
                date: '2026-04-08',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });
        });

        describe('GET /api/admin/activity', () => {
            it('should require admin', async () => {
                const agent = await loginAgent('activity-regular@example.com');
                const res = await agent.get(
                    '/api/admin/activity?startDate=2026-04-08&endDate=2026-04-08'
                );
                expect(res.status).toBe(403);
            });

            it('should return activity summary for date range', async () => {
                const res = await adminAgent.get(
                    '/api/admin/activity?startDate=2026-04-08&endDate=2026-04-08'
                );
                expect(res.status).toBe(200);
                expect(res.body.summary).toBeDefined();
                expect(res.body.users).toBeDefined();
                expect(res.body.summary.active).toBeGreaterThanOrEqual(1);
                expect(res.body.summary.passive).toBeGreaterThanOrEqual(1);
            });
        });

        describe('GET /api/admin/activity/trends', () => {
            it('should return trend data', async () => {
                const res = await adminAgent.get(
                    '/api/admin/activity/trends?days=7'
                );
                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
                expect(res.body.length).toBeLessThanOrEqual(7);
            });
        });
    });

    describe('Activity Report Recipients API', () => {
        let adminUser, adminAgent;

        beforeEach(async () => {
            adminUser = await createTestUser({
                email: 'recipient-admin2@example.com',
            });
            adminAgent = await loginAgent('recipient-admin2@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);
        });

        describe('POST /api/admin/activity-report/recipients', () => {
            it('should add a recipient', async () => {
                const res = await adminAgent
                    .post('/api/admin/activity-report/recipients')
                    .send({ email: 'daily@example.com' });
                expect(res.status).toBe(201);
                expect(res.body.email).toBe('daily@example.com');
                expect(res.body.enabled).toBe(true);
            });

            it('should reject missing email', async () => {
                const res = await adminAgent
                    .post('/api/admin/activity-report/recipients')
                    .send({});
                expect(res.status).toBe(400);
            });
        });

        describe('GET /api/admin/activity-report/recipients', () => {
            it('should list recipients', async () => {
                const { ActivityReportRecipient } = require('../../models');
                await ActivityReportRecipient.create({
                    email: 'list-test@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent.get(
                    '/api/admin/activity-report/recipients'
                );
                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
                expect(
                    res.body.some((r) => r.email === 'list-test@example.com')
                ).toBe(true);
            });
        });

        describe('PUT /api/admin/activity-report/recipients/:id', () => {
            it('should update enabled status', async () => {
                const { ActivityReportRecipient } = require('../../models');
                const recipient = await ActivityReportRecipient.create({
                    email: 'toggle@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent
                    .put(
                        `/api/admin/activity-report/recipients/${recipient.id}`
                    )
                    .send({ enabled: false });
                expect(res.status).toBe(200);
                expect(res.body.enabled).toBe(false);
            });
        });

        describe('DELETE /api/admin/activity-report/recipients/:id', () => {
            it('should delete a recipient', async () => {
                const { ActivityReportRecipient } = require('../../models');
                const recipient = await ActivityReportRecipient.create({
                    email: 'delete-me@example.com',
                    added_by: adminUser.id,
                });
                const res = await adminAgent.delete(
                    `/api/admin/activity-report/recipients/${recipient.id}`
                );
                expect(res.status).toBe(204);
            });
        });
    });

    describe('User deletion cleanup', () => {
        it('should delete activity records when user is deleted', async () => {
            const adminUser = await createTestUser({
                email: 'cleanup-admin@example.com',
            });
            const adminAgent = await loginAgent('cleanup-admin@example.com');
            await Role.destroy({ where: {} });
            await makeAdminDirect(adminUser.id);

            const targetUser = await createTestUser({
                email: 'cleanup-target@example.com',
            });

            const now = new Date();
            await UserActivity.create({
                user_id: targetUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 1 },
            });

            const { ActivityReportRecipient } = require('../../models');
            await ActivityReportRecipient.create({
                email: 'cleanup-target@example.com',
                added_by: targetUser.id,
            });

            // Delete the user
            const res = await adminAgent.delete(
                `/api/admin/users/${targetUser.id}`
            );
            expect(res.status).toBe(204);

            // Verify activity records are gone
            const activities = await UserActivity.findAll({
                where: { user_id: targetUser.id },
            });
            expect(activities.length).toBe(0);

            // Verify recipient added_by is set to null (not deleted)
            const recipients = await ActivityReportRecipient.findAll({
                where: { email: 'cleanup-target@example.com' },
            });
            expect(recipients.length).toBe(1);
            expect(recipients[0].added_by).toBeNull();
        });
    });
});
