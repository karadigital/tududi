const request = require('supertest');
const app = require('../../app');
const { Task, Area, Role, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

/**
 * Integration tests for department admin task visibility feature.
 *
 * Test scenarios:
 * 1. Superadmin sees all tasks
 * 2. Superadmin can edit any task
 * 3. Department admin sees member tasks only
 * 4. Department admin can view member task details (read-only)
 * 5. Department admin cannot edit member tasks (read-only access)
 * 6. Department admin cannot delete member tasks (read-only access)
 * 7. Department admin cannot see outsider tasks
 * 8. Regular member cannot see other member tasks
 * 9. Adding user to second department fails
 */
describe('Department Admin Task Visibility', () => {
    // Helper to generate unique emails
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    // Helper to make a user a superadmin
    async function makeSuperadmin(userId) {
        await Role.findOrCreate({
            where: { user_id: userId },
            defaults: { user_id: userId, is_admin: true },
        });
        await Role.update({ is_admin: true }, { where: { user_id: userId } });
    }

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

    describe('Superadmin task visibility', () => {
        let superadmin, regularUser, superadminAgent;

        beforeEach(async () => {
            superadmin = await createTestUser({
                email: uniqueEmail('superadmin'),
            });
            await makeSuperadmin(superadmin.id);

            regularUser = await createTestUser({
                email: uniqueEmail('regular'),
            });

            superadminAgent = await loginAgent(superadmin.email);
        });

        it('superadmin sees all tasks', async () => {
            // Create tasks for superadmin and regular user
            const superadminTask = await Task.create({
                name: 'Superadmin Task',
                user_id: superadmin.id,
            });

            const regularTask = await Task.create({
                name: 'Regular User Task',
                user_id: regularUser.id,
            });

            // Superadmin fetches tasks
            const res = await superadminAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Superadmin should see both tasks
            expect(taskIds).toContain(superadminTask.id);
            expect(taskIds).toContain(regularTask.id);
        });

        it('superadmin can edit any task', async () => {
            // Create a task owned by regular user
            const regularTask = await Task.create({
                name: 'Regular User Task',
                user_id: regularUser.id,
            });

            // Superadmin edits the task
            const res = await superadminAgent
                .patch(`/api/task/${regularTask.uid}`)
                .send({ name: 'Updated by Superadmin' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated by Superadmin');

            // Verify the update persisted
            const updatedTask = await Task.findByPk(regularTask.id);
            expect(updatedTask.name).toBe('Updated by Superadmin');
        });
    });

    describe('Department admin task visibility', () => {
        let deptAdmin, deptMember, outsider, department, deptAdminAgent;

        beforeEach(async () => {
            // Create department admin (also the area owner)
            deptAdmin = await createTestUser({
                email: uniqueEmail('deptadmin'),
            });

            // Create department member
            deptMember = await createTestUser({
                email: uniqueEmail('deptmember'),
            });

            // Create outsider (not in department)
            outsider = await createTestUser({ email: uniqueEmail('outsider') });

            // Create department (area)
            department = await Area.create({
                name: 'Test Department',
                user_id: deptAdmin.id,
            });

            // Add deptAdmin as department admin (role: 'admin')
            await addAreaMember(department.id, deptAdmin.id, 'admin');

            // Add deptMember as regular member (role: 'member')
            await addAreaMember(department.id, deptMember.id, 'member');

            // Login department admin
            deptAdminAgent = await loginAgent(deptAdmin.email);
        });

        it('department admin sees member tasks only', async () => {
            // Create tasks for department admin, department member, and outsider
            const adminTask = await Task.create({
                name: 'Dept Admin Task',
                user_id: deptAdmin.id,
            });

            const memberTask = await Task.create({
                name: 'Dept Member Task',
                user_id: deptMember.id,
            });

            const outsiderTask = await Task.create({
                name: 'Outsider Task',
                user_id: outsider.id,
            });

            // Department admin fetches tasks
            const res = await deptAdminAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Department admin should see their own task
            expect(taskIds).toContain(adminTask.id);

            // Department admin should see department member's task
            expect(taskIds).toContain(memberTask.id);

            // Department admin should NOT see outsider's task
            expect(taskIds).not.toContain(outsiderTask.id);
        });

        it('department admin can view member task details (read-only)', async () => {
            // Create a task owned by department member
            const memberTask = await Task.create({
                name: 'Dept Member Task',
                user_id: deptMember.id,
            });

            // Department admin can GET task details
            const res = await deptAdminAgent.get(
                `/api/task/${memberTask.uid}`
            );

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Dept Member Task');
        });

        it('department admin cannot edit member tasks (read-only access)', async () => {
            // Create a task owned by department member
            const memberTask = await Task.create({
                name: 'Dept Member Task',
                user_id: deptMember.id,
            });

            // Department admin attempts to edit the member's task
            const res = await deptAdminAgent
                .patch(`/api/task/${memberTask.uid}`)
                .send({ name: 'Updated by Dept Admin' });

            // Should be forbidden - department admins have read-only access
            expect(res.status).toBe(403);

            // Verify the task was NOT updated
            const unchangedTask = await Task.findByPk(memberTask.id);
            expect(unchangedTask.name).toBe('Dept Member Task');
        });

        it('department admin cannot delete member tasks (read-only access)', async () => {
            // Create a task owned by department member
            const memberTask = await Task.create({
                name: 'Dept Member Task',
                user_id: deptMember.id,
            });

            // Department admin attempts to delete the member's task
            const res = await deptAdminAgent.delete(
                `/api/task/${memberTask.uid}`
            );

            // Should be forbidden - department admins have read-only access
            expect(res.status).toBe(403);

            // Verify the task still exists
            const existingTask = await Task.findByPk(memberTask.id);
            expect(existingTask).not.toBeNull();
        });

        it('department admin cannot see outsider tasks', async () => {
            // Create task for outsider
            const outsiderTask = await Task.create({
                name: 'Outsider Task',
                user_id: outsider.id,
            });

            // Department admin fetches tasks
            const res = await deptAdminAgent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Department admin should NOT see outsider's task
            expect(taskIds).not.toContain(outsiderTask.id);

            // Also verify direct access is forbidden
            const directRes = await deptAdminAgent.get(
                `/api/task/${outsiderTask.uid}`
            );
            expect(directRes.status).toBe(403);
        });
    });

    describe('Regular member task visibility', () => {
        let deptAdmin, member1, member2, department, member1Agent;

        beforeEach(async () => {
            // Create department admin
            deptAdmin = await createTestUser({
                email: uniqueEmail('deptadmin'),
            });

            // Create two regular members
            member1 = await createTestUser({ email: uniqueEmail('member1') });
            member2 = await createTestUser({ email: uniqueEmail('member2') });

            // Create department
            department = await Area.create({
                name: 'Test Department',
                user_id: deptAdmin.id,
            });

            // Add deptAdmin as department admin
            await addAreaMember(department.id, deptAdmin.id, 'admin');

            // Add both as regular members
            await addAreaMember(department.id, member1.id, 'member');
            await addAreaMember(department.id, member2.id, 'member');

            // Login member1
            member1Agent = await loginAgent(member1.email);
        });

        it('regular member cannot see other member tasks', async () => {
            // Create tasks for both members
            const member1Task = await Task.create({
                name: 'Member 1 Task',
                user_id: member1.id,
            });

            const member2Task = await Task.create({
                name: 'Member 2 Task',
                user_id: member2.id,
            });

            // Member1 fetches tasks
            const res = await member1Agent.get('/api/tasks');
            expect(res.status).toBe(200);

            const taskIds = res.body.tasks.map((t) => t.id);

            // Member1 should see their own task
            expect(taskIds).toContain(member1Task.id);

            // Member1 should NOT see member2's task
            expect(taskIds).not.toContain(member2Task.id);

            // Also verify direct access is forbidden
            const directRes = await member1Agent.get(
                `/api/task/${member2Task.uid}`
            );
            expect(directRes.status).toBe(403);
        });
    });

    describe('Multi-department membership restriction', () => {
        let dept1Admin, dept2Admin, user, dept1, dept2, dept2AdminAgent;

        beforeEach(async () => {
            // Create two department admins
            dept1Admin = await createTestUser({
                email: uniqueEmail('dept1admin'),
            });
            dept2Admin = await createTestUser({
                email: uniqueEmail('dept2admin'),
            });

            // Create a regular user
            user = await createTestUser({ email: uniqueEmail('user') });

            // Create first department
            dept1 = await Area.create({
                name: 'Department 1',
                user_id: dept1Admin.id,
            });

            // Create second department
            dept2 = await Area.create({
                name: 'Department 2',
                user_id: dept2Admin.id,
            });

            // Add dept1Admin as admin of dept1
            await addAreaMember(dept1.id, dept1Admin.id, 'admin');

            // Add dept2Admin as admin of dept2
            await addAreaMember(dept2.id, dept2Admin.id, 'admin');

            // Add user to dept1
            await addAreaMember(dept1.id, user.id, 'member');

            // Login dept2Admin
            dept2AdminAgent = await loginAgent(dept2Admin.email);
        });

        it('adding user to second department fails', async () => {
            // Attempt to add user (who is already in dept1) to dept2
            const res = await dept2AdminAgent
                .post(`/api/v1/departments/${dept2.uid}/members`)
                .send({ user_id: user.id, role: 'member' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'User is already a member of another department'
            );
        });
    });
});
