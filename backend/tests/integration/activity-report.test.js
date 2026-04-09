const request = require('supertest');
const app = require('../../app');
const {
    User,
    UserActivity,
    ActivityReportRecipient,
    Role,
} = require('../../models');
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

describe('Activity Report', () => {
    let adminUser, adminAgent;

    beforeEach(async () => {
        adminUser = await createTestUser({
            email: 'report-admin@example.com',
        });
        adminAgent = await loginAgent('report-admin@example.com');
        await Role.destroy({ where: {} });
        await makeAdminDirect(adminUser.id);
    });

    describe('generateReportHtml', () => {
        it('should generate HTML report for a date', async () => {
            const {
                generateReportHtml,
            } = require('../../services/activityReportService');

            const regularUser = await createTestUser({
                email: 'report-regular@example.com',
            });

            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 5 },
            });
            await UserActivity.create({
                user_id: regularUser.id,
                date: '2026-04-08',
                activity_type: 'passive',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: {},
            });

            const html = await generateReportHtml('2026-04-08');
            expect(html).toContain('Activity Report');
            expect(html).toContain('2026-04-08');
            expect(html).toContain('report-admin@example.com');
            expect(html).toContain('Active');
            expect(html).toContain('Passive');
        });
    });

    describe('POST /api/admin/activity-report/send', () => {
        it('should require admin', async () => {
            const regularUser = await createTestUser({
                email: 'report-nonadmin@example.com',
            });
            const agent = await loginAgent('report-nonadmin@example.com');
            const res = await agent.post('/api/admin/activity-report/send');
            expect(res.status).toBe(403);
        });

        it('should trigger report generation', async () => {
            const now = new Date();
            await UserActivity.create({
                user_id: adminUser.id,
                date: '2026-04-08',
                activity_type: 'active',
                first_seen_at: now,
                last_seen_at: now,
                action_counts: { tasks_created: 2 },
            });

            const res = await adminAgent
                .post('/api/admin/activity-report/send')
                .send({ date: '2026-04-08' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBeDefined();
        });
    });
});
