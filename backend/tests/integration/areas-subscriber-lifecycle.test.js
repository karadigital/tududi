const request = require('supertest');
const app = require('../../app');
const { Area, User, AreasSubscriber } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Areas Subscriber Lifecycle', () => {
    let adminUser, adminAgent, regularUser;

    beforeEach(async () => {
        adminUser = await createTestUser({
            email: 'admin@example.com',
            is_admin: true,
        });
        adminAgent = request.agent(app);
        await adminAgent.post('/api/login').send({
            email: 'admin@example.com',
            password: 'password123',
        });

        regularUser = await createTestUser({
            email: 'regular@example.com',
        });
    });

    describe('adding member with admin role', () => {
        it('should auto-subscribe when adding member with role=admin', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'admin' });

            const subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('admin_role');
            expect(subs[0].added_by).toBe(adminUser.id);
        });

        it('should not create subscriber entry when adding regular member', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'member' });

            const subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(0);
        });
    });

    describe('promoting member to admin', () => {
        it('should create subscriber entry when promoting to admin', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as regular member first
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'member' });

            // Promote to admin
            await adminAgent
                .patch(
                    `/api/departments/${createRes.body.uid}/members/${regularUser.id}/role`
                )
                .send({ role: 'admin' });

            const subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('admin_role');
            expect(subs[0].added_by).toBe(adminUser.id);
        });
    });

    describe('demoting admin to member', () => {
        it('should remove admin_role subscriber entry on demotion', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as admin
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'admin' });

            // Verify subscriber exists
            let subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);

            // Demote to member
            await adminAgent
                .patch(
                    `/api/departments/${createRes.body.uid}/members/${regularUser.id}/role`
                )
                .send({ role: 'member' });

            subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(0);
        });

        it('should preserve manually-added subscriber on admin demotion', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as regular member first
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'member' });

            // Manually add subscriber entry with source='manual'
            await AreasSubscriber.create({
                area_id: area.id,
                user_id: regularUser.id,
                added_by: adminUser.id,
                source: 'manual',
            });

            // Promote to admin — findOrCreate should find the existing manual entry
            await adminAgent
                .patch(
                    `/api/departments/${createRes.body.uid}/members/${regularUser.id}/role`
                )
                .send({ role: 'admin' });

            // The manual entry should still be there (findOrCreate found it, didn't overwrite)
            let subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('manual');

            // Demote — destroy targets source='admin_role' only, manual entry survives
            await adminAgent
                .patch(
                    `/api/departments/${createRes.body.uid}/members/${regularUser.id}/role`
                )
                .send({ role: 'member' });

            subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('manual');
        });

        it('should only remove admin_role entry when user also has manual subscription', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as admin — this creates an admin_role subscriber entry
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'admin' });

            let subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('admin_role');

            // Update the existing entry to manual (simulating a scenario where
            // the user was manually subscribed after being auto-subscribed)
            await AreasSubscriber.update(
                { source: 'manual' },
                { where: { area_id: area.id, user_id: regularUser.id } }
            );

            // Demote — only admin_role entries are destroyed, manual persists
            await adminAgent
                .patch(
                    `/api/departments/${createRes.body.uid}/members/${regularUser.id}/role`
                )
                .send({ role: 'member' });

            subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);
            expect(subs[0].source).toBe('manual');
        });
    });

    describe('removing member from department', () => {
        it('should remove admin_role subscriber entry when removing admin member', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as admin
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'admin' });

            // Verify subscriber exists
            let subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(1);

            // Remove member from department
            await adminAgent.delete(
                `/api/departments/${createRes.body.uid}/members/${regularUser.id}`
            );

            subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(0);
        });

        it('should have no effect on subscribers when removing regular member', async () => {
            const createRes = await adminAgent
                .post('/api/departments')
                .send({ name: 'Test Dept' });
            expect(createRes.status).toBe(201);

            const area = await Area.findOne({
                where: { uid: createRes.body.uid },
            });

            // Add as regular member
            await adminAgent
                .post(`/api/departments/${createRes.body.uid}/members`)
                .send({ user_id: regularUser.id, role: 'member' });

            // Verify no subscriber exists
            let subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(0);

            // Remove member
            await adminAgent.delete(
                `/api/departments/${createRes.body.uid}/members/${regularUser.id}`
            );

            // Still no subscriber entries
            subs = await AreasSubscriber.findAll({
                where: { area_id: area.id, user_id: regularUser.id },
            });
            expect(subs).toHaveLength(0);
        });
    });
});
