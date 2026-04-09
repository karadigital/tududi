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
});
