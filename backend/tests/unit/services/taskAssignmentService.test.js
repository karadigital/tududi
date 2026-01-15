const {
    assignTask,
    unassignTask,
    notifyAssignment,
    notifyUnassignment,
    notifyTaskCompletion,
} = require('../../../services/taskAssignmentService');
const { Task, User, Permission, Notification } = require('../../../models');
const { logError } = require('../../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../../utils/notificationPreferences');

// Mock dependencies
jest.mock('../../../models', () => ({
    Task: { findByPk: jest.fn() },
    User: { findByPk: jest.fn() },
    Permission: { findOrCreate: jest.fn(), destroy: jest.fn() },
    Notification: { createNotification: jest.fn() },
}));

jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

jest.mock('../../../utils/notificationPreferences', () => ({
    shouldSendInAppNotification: jest.fn(),
    shouldSendTelegramNotification: jest.fn(),
}));

// Mock taskSubscriptionService for notifyTaskCompletion
jest.mock('../../../services/taskSubscriptionService', () => ({
    notifySubscribersAboutStatusChange: jest.fn(),
}));

describe('taskAssignmentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock implementations
        shouldSendInAppNotification.mockReturnValue(true);
        shouldSendTelegramNotification.mockReturnValue(false);
    });

    describe('assignTask', () => {
        const mockOwner = {
            id: 1,
            uid: 'owner-uid',
            email: 'owner@example.com',
            name: 'Owner',
            surname: 'User',
        };

        const mockAssignee = {
            id: 2,
            uid: 'assignee-uid',
            email: 'assignee@example.com',
            name: 'Assignee',
            surname: 'User',
            notification_preferences: {},
        };

        const mockTask = {
            id: 100,
            uid: 'task-uid-123',
            name: 'Test Task',
            user_id: 1,
            assigned_to_user_id: null,
            Owner: mockOwner,
            save: jest.fn().mockResolvedValue(true),
        };

        const mockUpdatedTask = {
            ...mockTask,
            assigned_to_user_id: 2,
            AssignedTo: mockAssignee,
        };

        it('should successfully assign a task, create permission, and send notification', async () => {
            // Setup mocks
            Task.findByPk
                .mockResolvedValueOnce(mockTask) // First call to load task with owner
                .mockResolvedValueOnce(mockUpdatedTask); // Second call to reload with AssignedTo
            User.findByPk.mockResolvedValue(mockAssignee);
            Permission.findOrCreate.mockResolvedValue([
                {
                    access_level: 'rw',
                    propagation: 'assignment',
                    granted_by_user_id: 1,
                    save: jest.fn(),
                },
                true, // created = true
            ]);
            Notification.createNotification.mockResolvedValue({});

            const result = await assignTask(100, 2, 1);

            // Verify task was loaded with Owner
            expect(Task.findByPk).toHaveBeenNthCalledWith(1, 100, {
                include: [
                    {
                        model: User,
                        as: 'Owner',
                        attributes: ['id', 'uid', 'email', 'name', 'surname'],
                    },
                ],
            });

            // Verify assignee was loaded
            expect(User.findByPk).toHaveBeenCalledWith(2, {
                attributes: [
                    'id',
                    'uid',
                    'email',
                    'name',
                    'surname',
                    'notification_preferences',
                ],
            });

            // Verify task was saved with assignment
            expect(mockTask.save).toHaveBeenCalled();
            expect(mockTask.assigned_to_user_id).toBe(2);

            // Verify permission was created
            expect(Permission.findOrCreate).toHaveBeenCalledWith({
                where: {
                    user_id: 2,
                    resource_type: 'task',
                    resource_uid: 'task-uid-123',
                },
                defaults: {
                    access_level: 'rw',
                    propagation: 'assignment',
                    granted_by_user_id: 1,
                },
            });

            // Verify notification was sent
            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 2,
                    type: 'task_assigned',
                    title: 'Task assigned to you',
                    message: 'Owner assigned you the task "Test Task"',
                    level: 'info',
                })
            );

            // Verify task was reloaded with AssignedTo
            expect(Task.findByPk).toHaveBeenNthCalledWith(2, 100, {
                include: [
                    {
                        model: User,
                        as: 'Owner',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'avatar_image',
                        ],
                    },
                    {
                        model: User,
                        as: 'AssignedTo',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'avatar_image',
                        ],
                    },
                ],
            });

            expect(result).toEqual(mockUpdatedTask);
        });

        it('should update existing permission when permission already exists', async () => {
            const existingPermission = {
                access_level: 'r',
                propagation: 'manual',
                granted_by_user_id: 5,
                save: jest.fn().mockResolvedValue(true),
            };

            Task.findByPk
                .mockResolvedValueOnce(mockTask)
                .mockResolvedValueOnce(mockUpdatedTask);
            User.findByPk.mockResolvedValue(mockAssignee);
            Permission.findOrCreate.mockResolvedValue([
                existingPermission,
                false, // created = false (already existed)
            ]);
            Notification.createNotification.mockResolvedValue({});

            await assignTask(100, 2, 1);

            // Verify permission was updated
            expect(existingPermission.access_level).toBe('rw');
            expect(existingPermission.propagation).toBe('assignment');
            expect(existingPermission.granted_by_user_id).toBe(1);
            expect(existingPermission.save).toHaveBeenCalled();
        });

        it('should throw error when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(assignTask(999, 2, 1)).rejects.toThrow(
                'Task not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error assigning task:',
                expect.any(Error)
            );
            expect(User.findByPk).not.toHaveBeenCalled();
            expect(Permission.findOrCreate).not.toHaveBeenCalled();
        });

        it('should throw error when assignee user is not found', async () => {
            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue(null);

            await expect(assignTask(100, 999, 1)).rejects.toThrow(
                'Assignee user not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error assigning task:',
                expect.any(Error)
            );
            expect(mockTask.save).not.toHaveBeenCalled();
            expect(Permission.findOrCreate).not.toHaveBeenCalled();
        });

        it('should throw error when non-owner tries to assign task', async () => {
            const taskWithDifferentOwner = {
                ...mockTask,
                user_id: 5, // Different owner
            };
            Task.findByPk.mockResolvedValue(taskWithDifferentOwner);

            await expect(assignTask(100, 2, 1)).rejects.toThrow(
                'Not authorized to assign this task'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error assigning task:',
                expect.any(Error)
            );
            expect(User.findByPk).not.toHaveBeenCalled();
        });

        it('should use email as assigner name when name is not available', async () => {
            const ownerWithoutName = {
                ...mockOwner,
                name: null,
            };
            const taskWithOwnerWithoutName = {
                ...mockTask,
                Owner: ownerWithoutName,
            };

            Task.findByPk
                .mockResolvedValueOnce(taskWithOwnerWithoutName)
                .mockResolvedValueOnce(mockUpdatedTask);
            User.findByPk.mockResolvedValue(mockAssignee);
            Permission.findOrCreate.mockResolvedValue([{}, true]);
            Notification.createNotification.mockResolvedValue({});

            await assignTask(100, 2, 1);

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'owner@example.com assigned you the task "Test Task"',
                })
            );
        });
    });

    describe('unassignTask', () => {
        // Helper function to create fresh mock objects for each test
        const createMockOwner = () => ({
            id: 1,
            uid: 'owner-uid',
            email: 'owner@example.com',
            name: 'Owner',
            surname: 'User',
        });

        const createMockAssignedUser = () => ({
            id: 2,
            uid: 'assignee-uid',
            email: 'assignee@example.com',
            name: 'Assignee',
            surname: 'User',
            notification_preferences: {},
        });

        const createMockAssignedTask = (owner, assignedUser) => ({
            id: 100,
            uid: 'task-uid-123',
            name: 'Test Task',
            user_id: 1,
            assigned_to_user_id: 2,
            Owner: owner,
            AssignedTo: assignedUser,
            save: jest.fn().mockResolvedValue(true),
        });

        const createMockUnassignedTask = (owner) => ({
            id: 100,
            uid: 'task-uid-123',
            name: 'Test Task',
            user_id: 1,
            assigned_to_user_id: null,
            Owner: owner,
            AssignedTo: null,
            save: jest.fn().mockResolvedValue(true),
        });

        it('should successfully unassign a task when owner unassigns', async () => {
            const mockOwner = createMockOwner();
            const mockAssignedUser = createMockAssignedUser();
            const mockAssignedTask = createMockAssignedTask(
                mockOwner,
                mockAssignedUser
            );
            const mockUnassignedTask = createMockUnassignedTask(mockOwner);

            Task.findByPk
                .mockResolvedValueOnce(mockAssignedTask)
                .mockResolvedValueOnce(mockUnassignedTask);
            Permission.destroy.mockResolvedValue(1);
            Notification.createNotification.mockResolvedValue({});

            const result = await unassignTask(100, 1); // Owner unassigning

            // Verify task was loaded with AssignedTo and Owner
            expect(Task.findByPk).toHaveBeenNthCalledWith(1, 100, {
                include: [
                    {
                        model: User,
                        as: 'AssignedTo',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'notification_preferences',
                        ],
                    },
                    {
                        model: User,
                        as: 'Owner',
                        attributes: ['id', 'uid', 'email', 'name', 'surname'],
                    },
                ],
            });

            // Verify task was saved with null assignment
            expect(mockAssignedTask.save).toHaveBeenCalled();

            // Verify permission was removed
            expect(Permission.destroy).toHaveBeenCalledWith({
                where: {
                    user_id: 2,
                    resource_type: 'task',
                    resource_uid: 'task-uid-123',
                    propagation: 'assignment',
                },
            });

            // Verify notification was sent
            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 2,
                    type: 'task_unassigned',
                    title: 'Task unassigned',
                    message: 'You were unassigned from "Test Task"',
                })
            );

            expect(result).toEqual(mockUnassignedTask);
        });

        it('should successfully unassign a task when assignee unassigns themselves', async () => {
            const mockOwner = createMockOwner();
            const mockAssignedUser = createMockAssignedUser();
            const mockAssignedTask = createMockAssignedTask(
                mockOwner,
                mockAssignedUser
            );
            const mockUnassignedTask = createMockUnassignedTask(mockOwner);

            Task.findByPk
                .mockResolvedValueOnce(mockAssignedTask)
                .mockResolvedValueOnce(mockUnassignedTask);
            Permission.destroy.mockResolvedValue(1);
            Notification.createNotification.mockResolvedValue({});

            await unassignTask(100, 2); // Assignee unassigning themselves

            expect(mockAssignedTask.save).toHaveBeenCalled();
            expect(Permission.destroy).toHaveBeenCalled();
        });

        it('should throw error when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(unassignTask(999, 1)).rejects.toThrow(
                'Task not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error unassigning task:',
                expect.any(Error)
            );
            expect(Permission.destroy).not.toHaveBeenCalled();
        });

        it('should throw error when task is not assigned', async () => {
            const mockOwner = createMockOwner();
            const unassignedTask = createMockUnassignedTask(mockOwner);
            Task.findByPk.mockResolvedValue(unassignedTask);

            await expect(unassignTask(100, 1)).rejects.toThrow(
                'Task is not assigned'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error unassigning task:',
                expect.any(Error)
            );
            expect(Permission.destroy).not.toHaveBeenCalled();
        });

        it('should throw error when non-owner and non-assignee tries to unassign', async () => {
            const mockOwner = createMockOwner();
            const mockAssignedUser = createMockAssignedUser();
            const mockAssignedTask = createMockAssignedTask(
                mockOwner,
                mockAssignedUser
            );

            Task.findByPk.mockResolvedValue(mockAssignedTask);

            await expect(unassignTask(100, 999)).rejects.toThrow(
                'Not authorized to unassign this task'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error unassigning task:',
                expect.any(Error)
            );
            expect(Permission.destroy).not.toHaveBeenCalled();
        });

        it('should not send notification if previouslyAssignedUser is null', async () => {
            const mockOwner = createMockOwner();
            const mockAssignedTask = createMockAssignedTask(mockOwner, null);
            // Task has assigned_to_user_id but AssignedTo relationship is null
            mockAssignedTask.AssignedTo = null;
            const mockUnassignedTask = createMockUnassignedTask(mockOwner);

            Task.findByPk
                .mockResolvedValueOnce(mockAssignedTask)
                .mockResolvedValueOnce(mockUnassignedTask);
            Permission.destroy.mockResolvedValue(1);

            await unassignTask(100, 1);

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });
    });

    describe('notifyAssignment', () => {
        const mockTask = {
            uid: 'task-uid-123',
            name: 'Test Task',
        };

        const mockAssignee = {
            id: 2,
            uid: 'assignee-uid',
            email: 'assignee@example.com',
            name: 'Assignee',
            notification_preferences: {},
        };

        const mockAssigner = {
            id: 1,
            uid: 'assigner-uid',
            email: 'assigner@example.com',
            name: 'Assigner',
        };

        it('should send notification to assignee', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(false);
            Notification.createNotification.mockResolvedValue({});

            await notifyAssignment(mockTask, mockAssignee, mockAssigner);

            expect(shouldSendInAppNotification).toHaveBeenCalledWith(
                mockAssignee,
                'task_assigned'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith({
                userId: 2,
                type: 'task_assigned',
                title: 'Task assigned to you',
                message: 'Assigner assigned you the task "Test Task"',
                level: 'info',
                sources: [],
                data: {
                    taskUid: 'task-uid-123',
                    taskName: 'Test Task',
                    assignedBy: 'Assigner',
                    assignedByUid: 'assigner-uid',
                },
                sentAt: expect.any(Date),
            });
        });

        it('should skip notification if assignee has disabled in-app notifications', async () => {
            shouldSendInAppNotification.mockReturnValue(false);

            await notifyAssignment(mockTask, mockAssignee, mockAssigner);

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should include telegram in sources when preference enabled', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyAssignment(mockTask, mockAssignee, mockAssigner);

            expect(shouldSendTelegramNotification).toHaveBeenCalledWith(
                mockAssignee,
                'task_assigned'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    sources: ['telegram'],
                })
            );
        });

        it('should use email as assigner name when name is not available', async () => {
            const assignerWithoutName = {
                ...mockAssigner,
                name: null,
            };
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyAssignment(mockTask, mockAssignee, assignerWithoutName);

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'assigner@example.com assigned you the task "Test Task"',
                    data: expect.objectContaining({
                        assignedBy: 'assigner@example.com',
                    }),
                })
            );
        });

        it('should not throw when notification creation fails', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockRejectedValue(
                new Error('Database error')
            );

            // Should not throw
            await expect(
                notifyAssignment(mockTask, mockAssignee, mockAssigner)
            ).resolves.toBeUndefined();

            expect(logError).toHaveBeenCalledWith(
                'Error sending assignment notification:',
                expect.any(Error)
            );
        });
    });

    describe('notifyUnassignment', () => {
        const mockTask = {
            uid: 'task-uid-123',
            name: 'Test Task',
        };

        const mockPreviousAssignee = {
            id: 2,
            uid: 'prev-assignee-uid',
            email: 'prev.assignee@example.com',
            name: 'Previous',
            notification_preferences: {},
        };

        const mockUnassigner = {
            id: 1,
            uid: 'unassigner-uid',
            email: 'unassigner@example.com',
            name: 'Unassigner',
        };

        it('should send notification to previous assignee', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(false);
            Notification.createNotification.mockResolvedValue({});

            await notifyUnassignment(
                mockTask,
                mockPreviousAssignee,
                mockUnassigner
            );

            expect(shouldSendInAppNotification).toHaveBeenCalledWith(
                mockPreviousAssignee,
                'task_unassigned'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith({
                userId: 2,
                type: 'task_unassigned',
                title: 'Task unassigned',
                message: 'You were unassigned from "Test Task"',
                level: 'info',
                sources: [],
                data: {
                    taskUid: 'task-uid-123',
                    taskName: 'Test Task',
                    unassignedBy: 'Unassigner',
                    unassignedByUid: 'unassigner-uid',
                },
                sentAt: expect.any(Date),
            });
        });

        it('should skip notification if user has disabled notifications', async () => {
            shouldSendInAppNotification.mockReturnValue(false);

            await notifyUnassignment(
                mockTask,
                mockPreviousAssignee,
                mockUnassigner
            );

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should include telegram in sources when preference enabled', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyUnassignment(
                mockTask,
                mockPreviousAssignee,
                mockUnassigner
            );

            expect(shouldSendTelegramNotification).toHaveBeenCalledWith(
                mockPreviousAssignee,
                'task_unassigned'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    sources: ['telegram'],
                })
            );
        });

        it('should use email as unassigner name when name is not available', async () => {
            const unassignerWithoutName = {
                ...mockUnassigner,
                name: null,
            };
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyUnassignment(
                mockTask,
                mockPreviousAssignee,
                unassignerWithoutName
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        unassignedBy: 'unassigner@example.com',
                    }),
                })
            );
        });

        it('should not throw when notification creation fails', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockRejectedValue(
                new Error('Database error')
            );

            await expect(
                notifyUnassignment(
                    mockTask,
                    mockPreviousAssignee,
                    mockUnassigner
                )
            ).resolves.toBeUndefined();

            expect(logError).toHaveBeenCalledWith(
                'Error sending unassignment notification:',
                expect.any(Error)
            );
        });
    });

    describe('notifyTaskCompletion', () => {
        const mockTask = {
            uid: 'task-uid-123',
            name: 'Test Task',
            completed_at: new Date('2024-01-15T10:00:00Z'),
        };

        const mockAssignee = {
            id: 2,
            uid: 'assignee-uid',
            email: 'assignee@example.com',
            name: 'Assignee',
        };

        const mockOwner = {
            id: 1,
            uid: 'owner-uid',
            email: 'owner@example.com',
            name: 'Owner',
            notification_preferences: {},
        };

        it('should send notification to owner when assignee completes task', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(false);
            Notification.createNotification.mockResolvedValue({});

            await notifyTaskCompletion(mockTask, mockAssignee, mockOwner);

            expect(shouldSendInAppNotification).toHaveBeenCalledWith(
                mockOwner,
                'assigned_task_completed'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith({
                userId: 1,
                type: 'assigned_task_completed',
                title: 'Assigned task completed',
                message: 'Assignee completed "Test Task"',
                level: 'success',
                sources: [],
                data: {
                    taskUid: 'task-uid-123',
                    taskName: 'Test Task',
                    completedBy: 'Assignee',
                    completedByUid: 'assignee-uid',
                    completedAt: mockTask.completed_at,
                },
                sentAt: expect.any(Date),
            });
        });

        it('should skip notification if owner completed their own task', async () => {
            const ownerAsAssignee = {
                ...mockOwner,
            };

            shouldSendInAppNotification.mockReturnValue(true);

            await notifyTaskCompletion(mockTask, ownerAsAssignee, mockOwner);

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should skip notification if owner has disabled notifications', async () => {
            shouldSendInAppNotification.mockReturnValue(false);

            await notifyTaskCompletion(mockTask, mockAssignee, mockOwner);

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should include telegram in sources when preference enabled', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            shouldSendTelegramNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyTaskCompletion(mockTask, mockAssignee, mockOwner);

            expect(shouldSendTelegramNotification).toHaveBeenCalledWith(
                mockOwner,
                'assigned_task_completed'
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    sources: ['telegram'],
                })
            );
        });

        it('should use email as assignee name when name is not available', async () => {
            const assigneeWithoutName = {
                ...mockAssignee,
                name: null,
            };
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});

            await notifyTaskCompletion(
                mockTask,
                assigneeWithoutName,
                mockOwner
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'assignee@example.com completed "Test Task"',
                    data: expect.objectContaining({
                        completedBy: 'assignee@example.com',
                    }),
                })
            );
        });

        it('should not throw when notification creation fails', async () => {
            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockRejectedValue(
                new Error('Database error')
            );

            await expect(
                notifyTaskCompletion(mockTask, mockAssignee, mockOwner)
            ).resolves.toBeUndefined();

            expect(logError).toHaveBeenCalledWith(
                'Error sending task completion notification:',
                expect.any(Error)
            );
        });

        it('should call notifySubscribersAboutStatusChange after notifying owner', async () => {
            const {
                notifySubscribersAboutStatusChange,
            } = require('../../../services/taskSubscriptionService');

            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});
            notifySubscribersAboutStatusChange.mockResolvedValue({});

            await notifyTaskCompletion(mockTask, mockAssignee, mockOwner);

            expect(notifySubscribersAboutStatusChange).toHaveBeenCalledWith(
                mockTask,
                mockAssignee
            );
        });

        it('should not throw when subscriber notification fails', async () => {
            const {
                notifySubscribersAboutStatusChange,
            } = require('../../../services/taskSubscriptionService');

            shouldSendInAppNotification.mockReturnValue(true);
            Notification.createNotification.mockResolvedValue({});
            notifySubscribersAboutStatusChange.mockRejectedValue(
                new Error('Subscriber notification error')
            );

            await expect(
                notifyTaskCompletion(mockTask, mockAssignee, mockOwner)
            ).resolves.toBeUndefined();

            expect(logError).toHaveBeenCalledWith(
                'Error notifying subscribers about completion:',
                expect.any(Error)
            );
        });
    });
});
