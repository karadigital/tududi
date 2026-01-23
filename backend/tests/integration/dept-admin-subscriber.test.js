const request = require('supertest');
const app = require('../../app');
const { Area, Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { QueryTypes } = require('sequelize');

describe('Department Admin Auto-Subscription', () => {
    let deptOwner, deptAdmin, deptMember, area;
    let ownerAgent, memberAgent, adminAgent;

    beforeEach(async () => {
        // Create test users with unique emails
        deptOwner = await createTestUser({
            email: `dept-owner-${Date.now()}@test.com`,
            name: 'Dept',
            surname: 'Owner',
        });

        deptAdmin = await createTestUser({
            email: `dept-admin-${Date.now()}@test.com`,
            name: 'Dept',
            surname: 'Admin',
        });

        deptMember = await createTestUser({
            email: `dept-member-${Date.now()}@test.com`,
            name: 'Dept',
            surname: 'Member',
        });

        // Create area/department
        area = await Area.create({
            name: 'Test Department',
            user_id: deptOwner.id,
        });

        // Add admin to department
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, 'admin', datetime('now'), datetime('now'))`,
            {
                replacements: { areaId: area.id, userId: deptAdmin.id },
                type: QueryTypes.INSERT,
            }
        );

        // Add member to department
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, 'member', datetime('now'), datetime('now'))`,
            {
                replacements: { areaId: area.id, userId: deptMember.id },
                type: QueryTypes.INSERT,
            }
        );

        // Login users
        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: deptOwner.email, password: 'password123' });

        memberAgent = request.agent(app);
        await memberAgent
            .post('/api/login')
            .send({ email: deptMember.email, password: 'password123' });

        adminAgent = request.agent(app);
        await adminAgent
            .post('/api/login')
            .send({ email: deptAdmin.email, password: 'password123' });
    });

    afterEach(async () => {
        // Clean up in reverse order of dependencies
        await Task.destroy({
            where: { user_id: [deptOwner.id, deptMember.id, deptAdmin.id] },
            force: true,
        });
        await sequelize.query(`DELETE FROM areas_members WHERE area_id = :areaId`, {
            replacements: { areaId: area.id },
            type: QueryTypes.DELETE,
        });
        await area.destroy();
    });

    it('should auto-subscribe department admin when member creates a task', async () => {
        const res = await memberAgent
            .post('/api/task')
            .send({ name: 'Test task from member' });

        expect(res.status).toBe(201);

        // Check that admin is subscribed
        const subscribersRes = await memberAgent.get(
            `/api/task/${res.body.uid}/subscribers`
        );

        expect(subscribersRes.body.subscribers).toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );
    });

    it('should NOT auto-subscribe admin to their own tasks', async () => {
        const res = await adminAgent
            .post('/api/task')
            .send({ name: 'Test task from admin' });

        expect(res.status).toBe(201);

        // Check that admin is NOT in subscribers (self-subscription skipped)
        const subscribersRes = await adminAgent.get(
            `/api/task/${res.body.uid}/subscribers`
        );

        expect(subscribersRes.body.subscribers).not.toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );
    });
});
