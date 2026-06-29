const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

async function loginAgent(email, password = 'password123') {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
}

describe('Admin users — exclude_from_activity_reports', () => {
    let adminUser, adminAgent, target;

    beforeEach(async () => {
        adminUser = await createTestUser({
            email: 'au-admin@example.com',
            is_admin: true,
        });
        adminAgent = await loginAgent('au-admin@example.com');
        target = await createTestUser({ email: 'au-target@example.com' });
    });

    it('PUT then GET reflects the toggle', async () => {
        const put = await adminAgent
            .put(`/api/admin/users/${target.id}`)
            .send({ exclude_from_activity_reports: true });
        expect(put.status).toBe(200);
        expect(put.body.exclude_from_activity_reports).toBe(true);

        const list = await adminAgent.get('/api/admin/users');
        expect(list.status).toBe(200);
        const row = list.body.find((u) => u.id === target.id);
        expect(row.exclude_from_activity_reports).toBe(true);
    });
});
