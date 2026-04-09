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
});
