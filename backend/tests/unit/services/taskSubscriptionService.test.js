const {
    subscribeToTask,
    unsubscribeFromTask,
    getTaskSubscribers,
    isUserSubscribed,
    notifySubscribers,
    notifySubscribersAboutUpdate,
    notifySubscribersAboutStatusChange,
} = require('../../../services/taskSubscriptionService');
const { Task, User, Permission, Notification } = require('../../../models');
const { logError } = require('../../../services/logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../../utils/notificationPreferences');

// Mock dependencies
jest.mock('../../../models', () => ({
    Task: {
        findByPk: jest.fn(),
    },
    User: {
        findByPk: jest.fn(),
    },
    Permission: {
        create: jest.fn(),
        destroy: jest.fn(),
    },
    Notification: {
        createNotification: jest.fn(),
    },
}));

jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

jest.mock('../../../utils/notificationPreferences', () => ({
    shouldSendInAppNotification: jest.fn(),
    shouldSendTelegramNotification: jest.fn(),
}));

describe('taskSubscriptionService', () => {
    // Common mock data
    const mockOwner = {
        id: 1,
        uid: 'owner-uid-1',
        email: 'owner@example.com',
        name: 'Owner',
        surname: 'User',
    };

    const mockSubscriber = {
        id: 2,
        uid: 'subscriber-uid-2',
        email: 'subscriber@example.com',
        name: 'Subscriber',
        surname: 'User',
        avatar_image: '/avatars/subscriber.png',
        notification_preferences: {
            task_updated_for_subscriber: { inApp: true, telegram: false },
        },
    };

    const mockSubscriber2 = {
        id: 3,
        uid: 'subscriber-uid-3',
        email: 'subscriber2@example.com',
        name: 'Subscriber2',
        surname: 'User',
        avatar_image: '/avatars/subscriber2.png',
        notification_preferences: null,
    };

    const mockAssignee = {
        id: 4,
        uid: 'assignee-uid-4',
        email: 'assignee@example.com',
        name: 'Assignee',
        surname: 'User',
    };

    const createMockTask = (overrides = {}) => ({
        id: 100,
        uid: 'task-uid-100',
        name: 'Test Task',
        status: 1,
        Owner: mockOwner,
        Subscribers: [],
        AssignedTo: null,
        addSubscriber: jest.fn().mockResolvedValue(undefined),
        removeSubscriber: jest.fn().mockResolvedValue(undefined),
        reload: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Default notification preference mocks
        shouldSendInAppNotification.mockReturnValue(true);
        shouldSendTelegramNotification.mockReturnValue(false);
    });

    describe('subscribeToTask', () => {
        it('should successfully subscribe a user and create permission', async () => {
            const addSubscriberMock = jest.fn().mockResolvedValue(undefined);
            const reloadMock = jest.fn().mockResolvedValue(undefined);
            const mockTask = {
                id: 100,
                uid: 'task-uid-100',
                name: 'Test Task',
                status: 1,
                Owner: mockOwner,
                Subscribers: [],
                AssignedTo: null,
                addSubscriber: addSubscriberMock,
                removeSubscriber: jest.fn().mockResolvedValue(undefined),
                reload: reloadMock,
            };

            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue(mockSubscriber);
            Permission.create.mockResolvedValue({});

            const result = await subscribeToTask(100, 2, 1);

            expect(Task.findByPk).toHaveBeenCalledWith(100, expect.any(Object));
            expect(User.findByPk).toHaveBeenCalledWith(2, expect.any(Object));
            expect(addSubscriberMock).toHaveBeenCalledWith(mockSubscriber);
            expect(Permission.create).toHaveBeenCalledWith({
                user_id: 2,
                resource_type: 'task',
                resource_uid: 'task-uid-100',
                access_level: 'rw',
                propagation: 'subscription',
                granted_by_user_id: 1,
            });
            expect(reloadMock).toHaveBeenCalled();
            expect(result).toBe(mockTask);
        });

        it('should throw error when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(subscribeToTask(999, 2, 1)).rejects.toThrow(
                'Task not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error subscribing to task:',
                expect.any(Error)
            );
            expect(User.findByPk).not.toHaveBeenCalled();
            expect(Permission.create).not.toHaveBeenCalled();
        });

        it('should throw error when user is not found', async () => {
            const mockTask = createMockTask();
            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue(null);

            await expect(subscribeToTask(100, 999, 1)).rejects.toThrow(
                'User not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error subscribing to task:',
                expect.any(Error)
            );
            expect(mockTask.addSubscriber).not.toHaveBeenCalled();
            expect(Permission.create).not.toHaveBeenCalled();
        });

        it('should throw error when user is already subscribed', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
            });
            Task.findByPk.mockResolvedValue(mockTask);
            User.findByPk.mockResolvedValue(mockSubscriber);

            await expect(subscribeToTask(100, 2, 1)).rejects.toThrow(
                'User already subscribed'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error subscribing to task:',
                expect.any(Error)
            );
            expect(mockTask.addSubscriber).not.toHaveBeenCalled();
            expect(Permission.create).not.toHaveBeenCalled();
        });
    });

    describe('unsubscribeFromTask', () => {
        it('should successfully remove subscription and permission', async () => {
            const removeSubscriberMock = jest.fn().mockResolvedValue(undefined);
            const reloadMock = jest.fn().mockResolvedValue(undefined);
            const mockTask = {
                id: 100,
                uid: 'task-uid-100',
                name: 'Test Task',
                status: 1,
                Owner: mockOwner,
                Subscribers: [mockSubscriber],
                AssignedTo: null,
                addSubscriber: jest.fn().mockResolvedValue(undefined),
                removeSubscriber: removeSubscriberMock,
                reload: reloadMock,
            };

            Task.findByPk.mockResolvedValue(mockTask);
            Permission.destroy.mockResolvedValue(1);

            const result = await unsubscribeFromTask(100, 2, 1);

            expect(Task.findByPk).toHaveBeenCalledWith(100, expect.any(Object));
            expect(removeSubscriberMock).toHaveBeenCalledWith(2);
            expect(Permission.destroy).toHaveBeenCalledWith({
                where: {
                    user_id: 2,
                    resource_type: 'task',
                    resource_uid: 'task-uid-100',
                    propagation: 'subscription',
                },
            });
            expect(reloadMock).toHaveBeenCalled();
            expect(result).toBe(mockTask);
        });

        it('should throw error when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(unsubscribeFromTask(999, 2, 1)).rejects.toThrow(
                'Task not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error unsubscribing from task:',
                expect.any(Error)
            );
            expect(Permission.destroy).not.toHaveBeenCalled();
        });

        it('should throw error when user is not subscribed', async () => {
            const mockTask = createMockTask({
                Subscribers: [], // No subscribers
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await expect(unsubscribeFromTask(100, 2, 1)).rejects.toThrow(
                'User not subscribed to task'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error unsubscribing from task:',
                expect.any(Error)
            );
            expect(mockTask.removeSubscriber).not.toHaveBeenCalled();
            expect(Permission.destroy).not.toHaveBeenCalled();
        });

        it('should throw error when different user is subscribed', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber2], // Different subscriber
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await expect(unsubscribeFromTask(100, 2, 1)).rejects.toThrow(
                'User not subscribed to task'
            );

            expect(mockTask.removeSubscriber).not.toHaveBeenCalled();
        });
    });

    describe('getTaskSubscribers', () => {
        it('should return array of subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber, mockSubscriber2],
            });
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await getTaskSubscribers(100);

            expect(Task.findByPk).toHaveBeenCalledWith(100, expect.any(Object));
            expect(result).toEqual([mockSubscriber, mockSubscriber2]);
            expect(result).toHaveLength(2);
        });

        it('should return empty array when no subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [],
            });
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await getTaskSubscribers(100);

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should return empty array when Subscribers is undefined', async () => {
            const mockTask = createMockTask();
            mockTask.Subscribers = undefined;
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await getTaskSubscribers(100);

            expect(result).toEqual([]);
        });

        it('should throw error when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(getTaskSubscribers(999)).rejects.toThrow(
                'Task not found'
            );

            expect(logError).toHaveBeenCalledWith(
                'Error getting task subscribers:',
                expect.any(Error)
            );
        });
    });

    describe('isUserSubscribed', () => {
        it('should return true when user is subscribed', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
            });
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await isUserSubscribed(100, 2);

            expect(Task.findByPk).toHaveBeenCalledWith(100, expect.any(Object));
            expect(result).toBe(true);
        });

        it('should return false when user is not subscribed', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
            });
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await isUserSubscribed(100, 999);

            expect(result).toBe(false);
        });

        it('should return false when task has no subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [],
            });
            Task.findByPk.mockResolvedValue(mockTask);

            const result = await isUserSubscribed(100, 2);

            expect(result).toBe(false);
        });

        it('should return false when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            const result = await isUserSubscribed(999, 2);

            expect(result).toBe(false);
        });

        it('should return false and log error on database error', async () => {
            Task.findByPk.mockRejectedValue(new Error('Database error'));

            const result = await isUserSubscribed(100, 2);

            expect(result).toBe(false);
            expect(logError).toHaveBeenCalledWith(
                'Error checking subscription:',
                expect.any(Error)
            );
        });
    });

    describe('notifySubscribers', () => {
        const actorUser = {
            id: 5,
            uid: 'actor-uid-5',
            email: 'actor@example.com',
            name: 'Actor',
        };

        it('should send notifications to subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);
            Notification.createNotification.mockResolvedValue({});

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Task.findByPk).toHaveBeenCalledWith(
                mockTask.id,
                expect.any(Object)
            );
            expect(shouldSendInAppNotification).toHaveBeenCalledWith(
                mockSubscriber,
                'task_updated_for_subscriber'
            );
            expect(Notification.createNotification).toHaveBeenCalledWith({
                userId: mockSubscriber.id,
                type: 'task_updated_for_subscriber',
                title: 'Subscribed task updated',
                message: 'Actor updated "Test Task"',
                level: 'info',
                sources: [],
                data: expect.objectContaining({
                    taskUid: mockTask.uid,
                    taskName: mockTask.name,
                    changedBy: 'Actor',
                    changedByUid: actorUser.uid,
                    changeType: 'update',
                }),
                sentAt: expect.any(Date),
            });
        });

        it('should skip notification to actor (own changes)', async () => {
            const subscriberWhoIsActor = { ...mockSubscriber, id: actorUser.id };
            const mockTask = createMockTask({
                Subscribers: [subscriberWhoIsActor],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should skip notification to owner (separate notification channel)', async () => {
            const subscriberWhoIsOwner = { ...mockSubscriber, id: mockOwner.id };
            const mockTask = createMockTask({
                Subscribers: [subscriberWhoIsOwner],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should skip notification to assignee (separate notification channel)', async () => {
            const subscriberWhoIsAssignee = {
                ...mockSubscriber,
                id: mockAssignee.id,
            };
            const mockTask = createMockTask({
                Subscribers: [subscriberWhoIsAssignee],
                Owner: mockOwner,
                AssignedTo: mockAssignee,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should respect notification preferences - skip when disabled', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);
            shouldSendInAppNotification.mockReturnValue(false);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(shouldSendInAppNotification).toHaveBeenCalledWith(
                mockSubscriber,
                'task_updated_for_subscriber'
            );
            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should include telegram in sources when preference is enabled', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);
            shouldSendTelegramNotification.mockReturnValue(true);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    sources: ['telegram'],
                })
            );
        });

        it('should handle status change notification type', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'status', actorUser, {
                newStatus: 1,
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_status_changed_for_subscriber',
                    title: 'Subscribed task status changed',
                    message: 'Actor changed status of "Test Task"',
                })
            );
        });

        it('should use special message when task is completed', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'status', actorUser, {
                newStatus: 2,
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Actor marked "Test Task" as completed',
                })
            );
        });

        it('should handle assignment change notification type', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'assignment', actorUser, {});

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_assignment_changed_for_subscriber',
                    title: 'Assignment changed on subscribed task',
                    message: 'Actor changed assignment of "Test Task"',
                })
            );
        });

        it('should handle unknown change type with default notification', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'unknown_type', actorUser, {});

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_updated_for_subscriber',
                    title: 'Subscribed task updated',
                })
            );
        });

        it('should include field name in update message when provided', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorUser, {
                field: 'due date',
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Actor updated due date in "Test Task"',
                })
            );
        });

        it('should not throw when task is not found', async () => {
            Task.findByPk.mockResolvedValue(null);

            await expect(
                notifySubscribers({ id: 999 }, 'update', actorUser, {})
            ).resolves.not.toThrow();

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should not throw when task has no subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [],
                Owner: mockOwner,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await expect(
                notifySubscribers(mockTask, 'update', actorUser, {})
            ).resolves.not.toThrow();

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should not throw when Subscribers is null', async () => {
            const mockTask = createMockTask({
                Owner: mockOwner,
            });
            mockTask.Subscribers = null;
            Task.findByPk.mockResolvedValue(mockTask);

            await expect(
                notifySubscribers(mockTask, 'update', actorUser, {})
            ).resolves.not.toThrow();

            expect(Notification.createNotification).not.toHaveBeenCalled();
        });

        it('should notify multiple subscribers', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber, mockSubscriber2],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorUser, {});

            expect(Notification.createNotification).toHaveBeenCalledTimes(2);
            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({ userId: mockSubscriber.id })
            );
            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({ userId: mockSubscriber2.id })
            );
        });

        it('should use email as actor name when name is not available', async () => {
            const actorWithoutName = {
                id: 5,
                uid: 'actor-uid-5',
                email: 'actor@example.com',
                name: null,
            };
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribers(mockTask, 'update', actorWithoutName, {});

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'actor@example.com updated "Test Task"',
                    data: expect.objectContaining({
                        changedBy: 'actor@example.com',
                    }),
                })
            );
        });

        it('should log error but not throw on notification failure', async () => {
            Task.findByPk.mockRejectedValue(new Error('Database error'));

            await expect(
                notifySubscribers({ id: 100 }, 'update', actorUser, {})
            ).resolves.not.toThrow();

            expect(logError).toHaveBeenCalledWith(
                'Error notifying subscribers:',
                expect.any(Error)
            );
        });
    });

    describe('notifySubscribersAboutUpdate', () => {
        const actorUser = {
            id: 5,
            uid: 'actor-uid-5',
            email: 'actor@example.com',
            name: 'Actor',
        };

        it('should send status notification when status changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(
                mockTask,
                actorUser,
                { status: 2 },
                { status: 1 }
            );

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_status_changed_for_subscriber',
                    data: expect.objectContaining({
                        newStatus: 2,
                        oldStatus: 1,
                    }),
                })
            );
        });

        it('should send assignment notification when assignment changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                assigned_to_user_id: 4,
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_assignment_changed_for_subscriber',
                })
            );
        });

        it('should send update notification with field name when name changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                name: 'New Task Name',
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_updated_for_subscriber',
                    data: expect.objectContaining({
                        field: 'name',
                    }),
                })
            );
        });

        it('should send update notification with field due date when due_date changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                due_date: '2025-01-15',
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        field: 'due date',
                    }),
                })
            );
        });

        it('should send update notification with field priority when priority changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                priority: 2,
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        field: 'priority',
                    }),
                })
            );
        });

        it('should send update notification with field notes when note changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                note: 'Updated notes',
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        field: 'notes',
                    }),
                })
            );
        });

        it('should send generic update notification for other field changes', async () => {
            const mockTask = createMockTask({
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutUpdate(mockTask, actorUser, {
                some_other_field: 'value',
            });

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_updated_for_subscriber',
                })
            );
        });

        it('should not throw on error and log from notifySubscribers', async () => {
            Task.findByPk.mockRejectedValue(new Error('Database error'));

            await expect(
                notifySubscribersAboutUpdate({ id: 100 }, actorUser, {
                    name: 'Test',
                })
            ).resolves.not.toThrow();

            // The error is caught by notifySubscribers internally
            expect(logError).toHaveBeenCalledWith(
                'Error notifying subscribers:',
                expect.any(Error)
            );
        });
    });

    describe('notifySubscribersAboutStatusChange', () => {
        const changedByUser = {
            id: 5,
            uid: 'user-uid-5',
            email: 'user@example.com',
            name: 'User',
        };

        it('should notify subscribers about status change', async () => {
            const mockTask = createMockTask({
                status: 2,
                Subscribers: [mockSubscriber],
                Owner: mockOwner,
                AssignedTo: null,
            });
            Task.findByPk.mockResolvedValue(mockTask);

            await notifySubscribersAboutStatusChange(mockTask, changedByUser);

            expect(Notification.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'task_status_changed_for_subscriber',
                    data: expect.objectContaining({
                        newStatus: 2,
                    }),
                })
            );
        });

        it('should not throw on error and log from notifySubscribers', async () => {
            Task.findByPk.mockRejectedValue(new Error('Database error'));

            await expect(
                notifySubscribersAboutStatusChange({ id: 100 }, changedByUser)
            ).resolves.not.toThrow();

            // The error is caught by notifySubscribers internally
            expect(logError).toHaveBeenCalledWith(
                'Error notifying subscribers:',
                expect.any(Error)
            );
        });
    });
});
