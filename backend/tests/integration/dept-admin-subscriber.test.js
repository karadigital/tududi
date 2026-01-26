const request = require('supertest');
const app = require('../../app');
const { Area, Task, User, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { QueryTypes } = require('sequelize');

describe('Department Admin Auto-Subscription', () => {
    let deptOwner, deptAdmin, deptMember, area;
    let ownerAgent, memberAgent, adminAgent;
    let additionalUsers = [];

    beforeEach(async () => {
        // Reset additional users array
        additionalUsers = [];

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
             VALUES (:areaId, :userId, 'admin', :now, :now)`,
            {
                replacements: {
                    areaId: area.id,
                    userId: deptAdmin.id,
                    now: new Date(),
                },
                type: QueryTypes.INSERT,
            }
        );

        // Add member to department
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, 'member', :now, :now)`,
            {
                replacements: {
                    areaId: area.id,
                    userId: deptMember.id,
                    now: new Date(),
                },
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
        // Collect all user IDs for cleanup (main users + dynamically created)
        const allUserIds = [
            deptOwner.id,
            deptMember.id,
            deptAdmin.id,
            ...additionalUsers.map((u) => u.id),
        ];

        // Clean up tasks_subscribers for all users (including subscriptions)
        await sequelize.query(
            `DELETE FROM tasks_subscribers WHERE user_id IN (:userIds)`,
            {
                replacements: { userIds: allUserIds },
                type: QueryTypes.DELETE,
            }
        );

        // Clean up permissions for all users
        await sequelize.query(
            `DELETE FROM permissions WHERE user_id IN (:userIds)`,
            {
                replacements: { userIds: allUserIds },
                type: QueryTypes.DELETE,
            }
        );

        // Clean up in reverse order of dependencies
        await Task.destroy({
            where: { user_id: allUserIds },
            force: true,
        });
        await sequelize.query(
            `DELETE FROM areas_members WHERE area_id = :areaId`,
            {
                replacements: { areaId: area.id },
                type: QueryTypes.DELETE,
            }
        );
        await area.destroy();

        // Destroy dynamically created users
        for (const user of additionalUsers) {
            await User.destroy({ where: { id: user.id }, force: true });
        }
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

    it('should allow dept admin to unsubscribe from auto-subscribed task', async () => {
        // Create task as member (admin gets auto-subscribed)
        const taskRes = await memberAgent
            .post('/api/task')
            .send({ name: 'Task for unsubscribe test' });

        expect(taskRes.status).toBe(201);

        // Verify admin is subscribed
        const beforeRes = await adminAgent.get(
            `/api/task/${taskRes.body.uid}/subscribers`
        );
        expect(beforeRes.body.subscribers).toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );

        // Admin unsubscribes
        const unsubRes = await adminAgent
            .post(`/api/task/${taskRes.body.uid}/unsubscribe`)
            .send({ user_id: deptAdmin.id });

        expect(unsubRes.status).toBe(200);

        // Verify admin is no longer subscribed
        const afterRes = await adminAgent.get(
            `/api/task/${taskRes.body.uid}/subscribers`
        );
        expect(afterRes.body.subscribers).not.toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );
    });

    it('should subscribe multiple admins when department has more than one', async () => {
        // Create a second admin
        const deptAdmin2 = await createTestUser({
            email: `dept-admin2-${Date.now()}@test.com`,
            name: 'Dept',
            surname: 'Admin2',
        });
        additionalUsers.push(deptAdmin2);

        // Add second admin to department
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, 'admin', :now, :now)`,
            {
                replacements: {
                    areaId: area.id,
                    userId: deptAdmin2.id,
                    now: new Date(),
                },
                type: QueryTypes.INSERT,
            }
        );

        // Create task as member
        const taskRes = await memberAgent
            .post('/api/task')
            .send({ name: 'Task for multiple admins test' });

        expect(taskRes.status).toBe(201);

        // Check that both admins are subscribed
        const subscribersRes = await memberAgent.get(
            `/api/task/${taskRes.body.uid}/subscribers`
        );

        expect(subscribersRes.body.subscribers).toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );
        expect(subscribersRes.body.subscribers).toContainEqual(
            expect.objectContaining({ id: deptAdmin2.id })
        );
    });

    it('should not subscribe users without department membership', async () => {
        // Create a user without department membership
        const noDeptUser = await createTestUser({
            email: `no-dept-${Date.now()}@test.com`,
            name: 'No',
            surname: 'Dept',
        });
        additionalUsers.push(noDeptUser);

        const noDeptAgent = request.agent(app);
        await noDeptAgent
            .post('/api/login')
            .send({ email: noDeptUser.email, password: 'password123' });

        // Create task as user without department
        const taskRes = await noDeptAgent
            .post('/api/task')
            .send({ name: 'Task from user without department' });

        expect(taskRes.status).toBe(201);

        // Check that no one is subscribed (no department = no admins to subscribe)
        const subscribersRes = await noDeptAgent.get(
            `/api/task/${taskRes.body.uid}/subscribers`
        );

        // Should have no subscribers (or only the owner if auto-subscribed)
        expect(subscribersRes.body.subscribers).not.toContainEqual(
            expect.objectContaining({ id: deptAdmin.id })
        );
    });
});
