const { sequelize, User, Task, Role } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');

/**
 * Helper to create a user with a role
 */
async function createUserWithRole(email, isAdmin = false) {
    const user = await User.create({
        email,
        password_digest: 'hashed_password',
    });

    // Use upsert to handle role creation/update
    const [role, created] = await Role.findOrCreate({
        where: { user_id: user.id },
        defaults: {
            user_id: user.id,
            is_admin: isAdmin,
        },
    });

    // If role already exists but has different is_admin value, update it
    if (!created && role.is_admin !== isAdmin) {
        await role.update({ is_admin: isAdmin });
    }

    return user;
}

describe('permissionsService', () => {
    // Clean up roles table before each test in this describe block
    beforeEach(async () => {
        await Role.destroy({ where: {} });
    });

    describe('canDeleteTask', () => {
        it('should return true for task owner', async () => {
            const owner = await createUserWithRole('owner@test.com', false);
            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
            });

            const result = await permissionsService.canDeleteTask(
                owner.id,
                task.uid
            );
            expect(result).toBe(true);
        });

        it('should return true for super admin', async () => {
            const owner = await createUserWithRole('owner@test.com', false);
            const admin = await createUserWithRole('admin@test.com', true);

            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
            });

            const result = await permissionsService.canDeleteTask(
                admin.id,
                task.uid
            );
            expect(result).toBe(true);
        });

        it('should return false for assignee', async () => {
            const owner = await createUserWithRole('owner@test.com', false);
            const assignee = await createUserWithRole(
                'assignee@test.com',
                false
            );

            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
                assigned_to_user_id: assignee.id,
            });

            const result = await permissionsService.canDeleteTask(
                assignee.id,
                task.uid
            );
            expect(result).toBe(false);
        });

        it('should return false for subscriber', async () => {
            const owner = await createUserWithRole('owner@test.com', false);
            const subscriber = await createUserWithRole(
                'subscriber@test.com',
                false
            );

            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
            });

            // Subscribe user to the task using the Task model's association
            await task.addSubscribers(subscriber);

            const result = await permissionsService.canDeleteTask(
                subscriber.id,
                task.uid
            );
            expect(result).toBe(false);
        });

        it('should return false for unrelated user', async () => {
            const owner = await createUserWithRole('owner@test.com', false);
            const unrelatedUser = await createUserWithRole(
                'unrelated@test.com',
                false
            );

            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
            });

            const result = await permissionsService.canDeleteTask(
                unrelatedUser.id,
                task.uid
            );
            expect(result).toBe(false);
        });

        it('should return false for non-existent task', async () => {
            const user = await createUserWithRole('user@test.com', false);

            const result = await permissionsService.canDeleteTask(
                user.id,
                'non-existent-uid'
            );
            expect(result).toBe(false);
        });

        it('should return false for non-existent user', async () => {
            const owner = await createUserWithRole('owner@test.com', false);

            const task = await Task.create({
                name: 'Test task',
                user_id: owner.id,
            });

            const result = await permissionsService.canDeleteTask(
                99999,
                task.uid
            );
            expect(result).toBe(false);
        });
    });
});
