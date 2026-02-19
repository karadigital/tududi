const {
    subscribeDepartmentAdmins,
} = require('../../services/taskSubscriptionService');

// Mock the models
jest.mock('../../models', () => {
    const originalModels = jest.requireActual('../../models');
    return {
        ...originalModels,
        AreasMember: {
            findOne: jest.fn(),
            findAll: jest.fn(),
        },
        AreasSubscriber: {
            findAll: jest.fn(),
        },
        Task: {
            findByPk: jest.fn(),
        },
        User: {
            findByPk: jest.fn(),
        },
        Permission: {
            create: jest.fn(),
        },
    };
});

const {
    AreasMember,
    AreasSubscriber,
    Task,
    User,
    Permission,
} = require('../../models');

describe('subscribeDepartmentAdmins', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should subscribe all department admins to a task', async () => {
        AreasMember.findOne.mockResolvedValue({ area_id: 1, user_id: 10 });
        AreasSubscriber.findAll.mockResolvedValue([
            { area_id: 1, user_id: 99 },
        ]);

        const mockTask = {
            id: 5,
            uid: 'task-uid-123',
            Subscribers: [],
            addSubscriber: jest.fn(),
            reload: jest.fn(),
        };
        Task.findByPk.mockResolvedValue(mockTask);
        User.findByPk.mockResolvedValue({
            id: 99,
            uid: 'admin-uid',
            email: 'admin@test.com',
        });
        Permission.create.mockResolvedValue({});

        await subscribeDepartmentAdmins(5, 10);

        expect(AreasMember.findOne).toHaveBeenCalledWith({
            where: { user_id: 10 },
        });
        expect(AreasSubscriber.findAll).toHaveBeenCalledWith({
            where: { area_id: 1 },
        });
        expect(mockTask.addSubscriber).toHaveBeenCalled();
    });

    it('should skip subscription when owner is the department admin', async () => {
        AreasMember.findOne.mockResolvedValue({ area_id: 1, user_id: 10 });
        AreasSubscriber.findAll.mockResolvedValue([
            { area_id: 1, user_id: 10 },
        ]);

        const mockTask = {
            id: 5,
            uid: 'task-uid-123',
            Subscribers: [],
            addSubscriber: jest.fn(),
        };
        Task.findByPk.mockResolvedValue(mockTask);

        await subscribeDepartmentAdmins(5, 10);

        expect(mockTask.addSubscriber).not.toHaveBeenCalled();
    });

    it('should do nothing when owner has no department', async () => {
        AreasMember.findOne.mockResolvedValue(null);

        const mockTask = {
            id: 5,
            addSubscriber: jest.fn(),
        };
        Task.findByPk.mockResolvedValue(mockTask);

        await subscribeDepartmentAdmins(5, 10);

        expect(AreasSubscriber.findAll).not.toHaveBeenCalled();
        expect(mockTask.addSubscriber).not.toHaveBeenCalled();
    });

    it('should subscribe multiple admins when department has more than one', async () => {
        AreasMember.findOne.mockResolvedValue({ area_id: 1, user_id: 10 });
        AreasSubscriber.findAll.mockResolvedValue([
            { area_id: 1, user_id: 99 },
            { area_id: 1, user_id: 100 },
        ]);

        const mockTask = {
            id: 5,
            uid: 'task-uid-123',
            Subscribers: [],
            addSubscriber: jest.fn(),
            reload: jest.fn(),
        };
        Task.findByPk.mockResolvedValue(mockTask);
        User.findByPk.mockResolvedValue({
            id: 99,
            uid: 'admin-uid',
            email: 'admin@test.com',
        });
        Permission.create.mockResolvedValue({});

        await subscribeDepartmentAdmins(5, 10);

        expect(mockTask.addSubscriber).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when department has no subscribers', async () => {
        AreasMember.findOne.mockResolvedValue({ area_id: 1, user_id: 10 });
        AreasSubscriber.findAll.mockResolvedValue([]);

        const mockTask = {
            id: 5,
            addSubscriber: jest.fn(),
        };
        Task.findByPk.mockResolvedValue(mockTask);

        await subscribeDepartmentAdmins(5, 10);

        expect(mockTask.addSubscriber).not.toHaveBeenCalled();
    });
});
