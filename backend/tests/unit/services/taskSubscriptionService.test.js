const {
    subscribeToTask,
    unsubscribeFromTask,
    getTaskSubscribers,
    isUserSubscribed,
    subscribeDepartmentAdmins,
} = require('../../../services/taskSubscriptionService');

// Mock the models
jest.mock('../../../models', () => {
    const mockTask = {
        findByPk: jest.fn(),
        addSubscriber: jest.fn(),
        reload: jest.fn(),
    };

    const mockUser = {
        findByPk: jest.fn(),
    };

    const mockAreasMember = {
        findOne: jest.fn(),
    };

    const mockPermission = {
        create: jest.fn(),
        destroy: jest.fn(),
    };

    const mockSequelize = {
        query: jest.fn(),
    };

    return {
        Task: mockTask,
        User: mockUser,
        AreasMember: mockAreasMember,
        Permission: mockPermission,
        Notification: {
            createNotification: jest.fn(),
        },
        sequelize: mockSequelize,
    };
});

jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

jest.mock('../../../utils/notificationPreferences', () => ({
    shouldSendInAppNotification: jest.fn().mockReturnValue(true),
    shouldSendTelegramNotification: jest.fn().mockReturnValue(false),
}));

describe('TaskSubscriptionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('subscribeDepartmentAdmins', () => {
        it('should subscribe admin to their own tasks', async () => {
            const { AreasMember, sequelize } = require('../../../models');
            const { QueryTypes } = require('sequelize');

            // Task owner is also a department admin
            const taskId = 1;
            const taskOwnerId = 100;
            const areaId = 10;

            // Mock owner membership - owner is in department
            AreasMember.findOne.mockResolvedValue({
                user_id: taskOwnerId,
                area_id: areaId,
                role: 'admin',
            });

            // Mock admins query - returns the owner as an admin
            sequelize.query.mockResolvedValue([{ user_id: taskOwnerId }]);

            // Mock subscribeToTask dependencies
            const { Task, User, Permission } = require('../../../models');

            const mockTask = {
                id: taskId,
                uid: 'task-uid-1',
                user_id: taskOwnerId,
                Subscribers: [],
                addSubscriber: jest.fn().mockResolvedValue(),
                reload: jest.fn().mockResolvedValue(),
            };

            const mockSubscriber = {
                id: taskOwnerId,
                uid: 'user-uid-1',
                email: 'admin@test.com',
                name: 'Admin',
                surname: 'User',
            };

            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue(mockSubscriber);
            Permission.create.mockResolvedValue({});

            await subscribeDepartmentAdmins(taskId, taskOwnerId);

            // Verify admin query was called with correct area
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining("role = 'admin'"),
                expect.objectContaining({
                    replacements: { areaId },
                })
            );

            // Verify subscribeToTask was called for the admin (who is also owner)
            expect(Task.findByPk).toHaveBeenCalled();
            expect(mockTask.addSubscriber).toHaveBeenCalled();
        });

        it('should subscribe all department admins to tasks', async () => {
            const { AreasMember, sequelize } = require('../../../models');

            const taskId = 1;
            const taskOwnerId = 100;
            const admin1Id = 200;
            const admin2Id = 300;
            const areaId = 10;

            // Mock owner membership
            AreasMember.findOne.mockResolvedValue({
                user_id: taskOwnerId,
                area_id: areaId,
                role: 'member',
            });

            // Mock admins query - returns two admins
            sequelize.query.mockResolvedValue([
                { user_id: admin1Id },
                { user_id: admin2Id },
            ]);

            // Mock subscribeToTask dependencies
            const { Task, User, Permission } = require('../../../models');

            let addSubscriberCallCount = 0;
            const mockTask = {
                id: taskId,
                uid: 'task-uid-1',
                user_id: taskOwnerId,
                Subscribers: [],
                addSubscriber: jest.fn().mockImplementation(() => {
                    addSubscriberCallCount++;
                    return Promise.resolve();
                }),
                reload: jest.fn().mockResolvedValue(),
            };

            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue({
                id: admin1Id,
                uid: 'user-uid-1',
                email: 'admin1@test.com',
                name: 'Admin1',
                surname: 'User',
            });
            Permission.create.mockResolvedValue({});

            await subscribeDepartmentAdmins(taskId, taskOwnerId);

            // Verify both admins were subscribed
            expect(addSubscriberCallCount).toBe(2);
        });

        it('should do nothing if owner is not in any department', async () => {
            const { AreasMember, sequelize } = require('../../../models');

            const taskId = 1;
            const taskOwnerId = 100;

            // Owner not in any department
            AreasMember.findOne.mockResolvedValue(null);

            await subscribeDepartmentAdmins(taskId, taskOwnerId);

            // Should not query for admins
            expect(sequelize.query).not.toHaveBeenCalled();
        });

        it('should do nothing if department has no admins', async () => {
            const { AreasMember, sequelize, Task } = require('../../../models');

            const taskId = 1;
            const taskOwnerId = 100;
            const areaId = 10;

            // Owner is in department
            AreasMember.findOne.mockResolvedValue({
                user_id: taskOwnerId,
                area_id: areaId,
                role: 'member',
            });

            // No admins found
            sequelize.query.mockResolvedValue([]);

            await subscribeDepartmentAdmins(taskId, taskOwnerId);

            // Should not try to subscribe anyone
            expect(Task.findByPk).not.toHaveBeenCalled();
        });

        it('should continue if one admin subscription fails', async () => {
            const { AreasMember, sequelize } = require('../../../models');
            const { logError } = require('../../../services/logService');

            const taskId = 1;
            const taskOwnerId = 100;
            const admin1Id = 200;
            const admin2Id = 300;
            const areaId = 10;

            // Mock owner membership
            AreasMember.findOne.mockResolvedValue({
                user_id: taskOwnerId,
                area_id: areaId,
                role: 'member',
            });

            // Mock admins query
            sequelize.query.mockResolvedValue([
                { user_id: admin1Id },
                { user_id: admin2Id },
            ]);

            // Mock subscribeToTask dependencies
            const { Task, User, Permission } = require('../../../models');

            let callCount = 0;
            const mockTask = {
                id: taskId,
                uid: 'task-uid-1',
                user_id: taskOwnerId,
                Subscribers: [],
                addSubscriber: jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        // First admin subscription fails
                        throw new Error('Database error');
                    }
                    return Promise.resolve();
                }),
                reload: jest.fn().mockResolvedValue(),
            };

            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue({
                id: admin1Id,
                uid: 'user-uid-1',
                email: 'admin@test.com',
                name: 'Admin',
                surname: 'User',
            });
            Permission.create.mockResolvedValue({});

            // Should not throw
            await expect(
                subscribeDepartmentAdmins(taskId, taskOwnerId)
            ).resolves.not.toThrow();

            // Should have tried to subscribe both admins
            expect(callCount).toBe(2);

            // Should have logged the error
            expect(logError).toHaveBeenCalled();
        });

        it('should ignore "already subscribed" errors silently', async () => {
            const {
                AreasMember,
                sequelize,
                Task,
                User,
            } = require('../../../models');
            const { logError } = require('../../../services/logService');

            const taskId = 1;
            const taskOwnerId = 100;
            const adminId = 200;
            const areaId = 10;

            // Mock owner membership
            AreasMember.findOne.mockResolvedValue({
                user_id: taskOwnerId,
                area_id: areaId,
            });

            // Mock admins query
            sequelize.query.mockResolvedValue([{ user_id: adminId }]);

            // Mock task with admin already subscribed
            const mockTask = {
                id: taskId,
                uid: 'task-uid-1',
                user_id: taskOwnerId,
                Subscribers: [{ id: adminId }],
                addSubscriber: jest.fn(),
                reload: jest.fn(),
            };

            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue({
                id: adminId,
                uid: 'user-uid-1',
                email: 'admin@test.com',
            });

            await subscribeDepartmentAdmins(taskId, taskOwnerId);

            // Should not log error for "already subscribed"
            expect(logError).not.toHaveBeenCalledWith(
                expect.stringContaining('Error subscribing admin'),
                expect.any(Error)
            );
        });
    });

    describe('subscribeToTask', () => {
        it('should export subscribeToTask function', () => {
            expect(typeof subscribeToTask).toBe('function');
        });
    });

    describe('unsubscribeFromTask', () => {
        it('should export unsubscribeFromTask function', () => {
            expect(typeof unsubscribeFromTask).toBe('function');
        });
    });

    describe('getTaskSubscribers', () => {
        it('should export getTaskSubscribers function', () => {
            expect(typeof getTaskSubscribers).toBe('function');
        });
    });

    describe('isUserSubscribed', () => {
        it('should export isUserSubscribed function', () => {
            expect(typeof isUserSubscribed).toBe('function');
        });
    });
});
