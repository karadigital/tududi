const {
    canManageAreaMembers,
    addAreaMember,
    removeAreaMember,
    updateMemberRole,
    getAreaMembers,
} = require('../../../services/areaMembershipService');
const { Area, User, sequelize } = require('../../../models');
const { QueryTypes } = require('sequelize');
const { logError } = require('../../../services/logService');
const { isAdmin } = require('../../../services/rolesService');

// Mock dependencies
jest.mock('../../../models', () => ({
    Area: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
    },
    User: {
        findByPk: jest.fn(),
    },
    sequelize: {
        query: jest.fn(),
    },
    Action: {
        create: jest.fn(),
    },
    Permission: {
        destroy: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('../../../services/logService', () => ({
    logError: jest.fn(),
}));

jest.mock('../../../services/rolesService', () => ({
    isAdmin: jest.fn(),
}));

jest.mock('../../../services/execAction', () => ({
    execAction: jest.fn(),
}));

describe('areaMembershipService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('canManageAreaMembers', () => {
        const mockArea = {
            id: 1,
            uid: 'area-uid-123',
            name: 'Test Area',
            user_id: 100,
        };

        it('should return true for area owner', async () => {
            Area.findByPk.mockResolvedValue(mockArea);

            const result = await canManageAreaMembers(1, 100);

            expect(result).toBe(true);
            expect(Area.findByPk).toHaveBeenCalledWith(1);
        });

        it('should return true for admin user', async () => {
            Area.findByPk.mockResolvedValue(mockArea);
            User.findByPk.mockResolvedValue({ uid: 'user-uid-200' });
            isAdmin.mockResolvedValue(true);

            const result = await canManageAreaMembers(1, 200);

            expect(result).toBe(true);
            expect(isAdmin).toHaveBeenCalledWith('user-uid-200');
        });

        it('should return true for department admin (role: admin in areas_members)', async () => {
            Area.findByPk.mockResolvedValue(mockArea);
            User.findByPk.mockResolvedValue({ uid: 'user-uid-300' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([{ role: 'admin' }]);

            const result = await canManageAreaMembers(1, 300);

            expect(result).toBe(true);
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT role FROM areas_members'),
                expect.objectContaining({
                    replacements: { areaId: 1, userId: 300 },
                    type: QueryTypes.SELECT,
                    raw: true,
                })
            );
        });

        it('should return false for regular member', async () => {
            Area.findByPk.mockResolvedValue(mockArea);
            User.findByPk.mockResolvedValue({ uid: 'user-uid-400' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([{ role: 'member' }]);

            const result = await canManageAreaMembers(1, 400);

            expect(result).toBe(false);
        });

        it('should return false for non-member', async () => {
            Area.findByPk.mockResolvedValue(mockArea);
            User.findByPk.mockResolvedValue({ uid: 'user-uid-500' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([]);

            const result = await canManageAreaMembers(1, 500);

            expect(result).toBe(false);
        });

        it('should return false for non-existent area', async () => {
            Area.findByPk.mockResolvedValue(null);

            const result = await canManageAreaMembers(999, 100);

            expect(result).toBe(false);
        });

        it('should handle userId as string UID format', async () => {
            Area.findByPk.mockResolvedValue(mockArea);
            isAdmin.mockResolvedValue(true);

            const result = await canManageAreaMembers(1, 'user-uid-string');

            expect(result).toBe(true);
            expect(isAdmin).toHaveBeenCalledWith('user-uid-string');
            expect(User.findByPk).not.toHaveBeenCalled();
        });

        it('should return false and log error when an exception occurs', async () => {
            Area.findByPk.mockRejectedValue(new Error('Database error'));

            const result = await canManageAreaMembers(1, 100);

            expect(result).toBe(false);
            expect(logError).toHaveBeenCalledWith(
                'Error checking area management permissions:',
                expect.any(Error)
            );
        });
    });

    describe('addAreaMember', () => {
        const mockArea = {
            id: 1,
            uid: 'area-uid-123',
            name: 'Test Area',
            user_id: 100,
        };

        const mockUser = {
            id: 200,
            uid: 'user-uid-200',
            email: 'newmember@test.com',
        };

        beforeEach(() => {
            // Setup default successful canManageAreaMembers scenario
            Area.findByPk.mockResolvedValue(mockArea);
        });

        it('should successfully add member and create permission cascade', async () => {
            const { execAction } = require('../../../services/execAction');

            User.findByPk.mockImplementation((id) => {
                if (id === 200) return Promise.resolve(mockUser);
                if (id === 100) return Promise.resolve({ uid: 'owner-uid' });
                return Promise.resolve(null);
            });
            isAdmin.mockResolvedValue(false);
            // Since addedBy (100) === area.user_id, canManageAreaMembers returns true without querying
            // So first query is existingMember check, second is INSERT
            sequelize.query
                .mockResolvedValueOnce([]) // existingMember check - not a member yet
                .mockResolvedValueOnce(undefined); // INSERT

            const result = await addAreaMember(1, 200, 'member', 100);

            expect(result).toEqual(mockArea);
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO areas_members'),
                expect.objectContaining({
                    replacements: { areaId: 1, userId: 200, role: 'member' },
                    type: QueryTypes.INSERT,
                })
            );
            expect(execAction).toHaveBeenCalledWith({
                verb: 'area_member_add',
                actorUserId: 100,
                targetUserId: 200,
                resourceType: 'area',
                resourceUid: 'area-uid-123',
                accessLevel: 'rw',
            });
        });

        it('should set accessLevel to admin when role is admin', async () => {
            const { execAction } = require('../../../services/execAction');

            User.findByPk.mockImplementation((id) => {
                if (id === 200) return Promise.resolve(mockUser);
                if (id === 100) return Promise.resolve({ uid: 'owner-uid' });
                return Promise.resolve(null);
            });
            isAdmin.mockResolvedValue(false);
            // Since addedBy (100) === area.user_id, canManageAreaMembers returns true without querying
            sequelize.query
                .mockResolvedValueOnce([]) // existingMember check
                .mockResolvedValueOnce(undefined); // INSERT

            await addAreaMember(1, 200, 'admin', 100);

            expect(execAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessLevel: 'admin',
                })
            );
        });

        it('should throw error when not authorized', async () => {
            User.findByPk.mockResolvedValue({ uid: 'non-admin-uid' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([]); // Not a department admin either
            Area.findByPk.mockResolvedValue({ ...mockArea, user_id: 999 }); // Not the owner

            await expect(addAreaMember(1, 200, 'member', 500)).rejects.toThrow(
                'Not authorized to manage area members'
            );
            expect(logError).toHaveBeenCalledWith(
                'Error adding area member:',
                expect.any(Error)
            );
        });

        it('should throw error when area not found', async () => {
            // First call for canManageAreaMembers - area exists
            Area.findByPk.mockResolvedValueOnce(mockArea);
            // Second call inside addAreaMember - area not found
            Area.findByPk.mockResolvedValueOnce(null);

            await expect(addAreaMember(1, 200, 'member', 100)).rejects.toThrow(
                'Area not found'
            );
        });

        it('should throw error when user not found', async () => {
            User.findByPk.mockResolvedValue(null);

            await expect(addAreaMember(1, 999, 'member', 100)).rejects.toThrow(
                'User not found'
            );
        });

        it('should throw error when user is already a member', async () => {
            User.findByPk.mockImplementation((id) => {
                if (id === 200) return Promise.resolve(mockUser);
                return Promise.resolve(null);
            });
            sequelize.query.mockResolvedValueOnce([{ role: 'member' }]); // Already exists

            await expect(addAreaMember(1, 200, 'member', 100)).rejects.toThrow(
                'User is already a member'
            );
        });

        it('should use default role of member when not specified', async () => {
            const { execAction } = require('../../../services/execAction');

            User.findByPk.mockImplementation((id) => {
                if (id === 200) return Promise.resolve(mockUser);
                if (id === 100) return Promise.resolve({ uid: 'owner-uid' });
                return Promise.resolve(null);
            });
            isAdmin.mockResolvedValue(false);
            // Since addedBy (100) === area.user_id, canManageAreaMembers returns true without querying
            sequelize.query
                .mockResolvedValueOnce([]) // existingMember check
                .mockResolvedValueOnce(undefined); // INSERT

            await addAreaMember(1, 200, undefined, 100);

            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO areas_members'),
                expect.objectContaining({
                    replacements: expect.objectContaining({ role: 'member' }),
                })
            );
        });
    });

    describe('removeAreaMember', () => {
        const mockArea = {
            id: 1,
            uid: 'area-uid-123',
            name: 'Test Area',
            user_id: 100,
            update: jest.fn(),
        };

        beforeEach(() => {
            Area.findByPk.mockResolvedValue(mockArea);
            mockArea.update.mockClear();
        });

        it('should successfully remove member and permissions', async () => {
            const { execAction } = require('../../../services/execAction');

            // User 200 being removed by owner (100)
            sequelize.query
                .mockResolvedValueOnce([]) // canManageAreaMembers - not a department admin, but owner
                .mockResolvedValueOnce({ changes: 1 }); // DELETE

            const result = await removeAreaMember(1, 200, 100);

            expect(result).toEqual(mockArea);
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM areas_members'),
                expect.objectContaining({
                    replacements: { areaId: 1, userId: 200 },
                    type: QueryTypes.DELETE,
                })
            );
            expect(execAction).toHaveBeenCalledWith({
                verb: 'area_member_remove',
                actorUserId: 100,
                targetUserId: 200,
                resourceType: 'area',
                resourceUid: 'area-uid-123',
            });
        });

        it('should transfer ownership when removing owner (admin only)', async () => {
            const { Action, Permission } = require('../../../models');

            const areaWithOwner = {
                ...mockArea,
                user_id: 100, // Owner to be removed
                update: jest.fn().mockResolvedValue(true),
            };
            Area.findByPk.mockResolvedValue(areaWithOwner);

            // Admin 300 removes owner 100
            User.findByPk.mockImplementation((id) => {
                if (id === 300)
                    return Promise.resolve({
                        uid: 'admin-uid-300',
                        email: 'admin@test.com',
                    });
                if (id === 100)
                    return Promise.resolve({
                        uid: 'owner-uid-100',
                        email: 'owner@test.com',
                    });
                return Promise.resolve(null);
            });
            isAdmin.mockResolvedValue(true);
            sequelize.query.mockResolvedValue([]);

            const result = await removeAreaMember(1, 100, 300);

            expect(areaWithOwner.update).toHaveBeenCalledWith({ user_id: 300 });
            expect(Action.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    actor_user_id: 300,
                    verb: 'area_ownership_transfer',
                    resource_type: 'area',
                    resource_uid: 'area-uid-123',
                    target_user_id: 100,
                })
            );
            expect(Permission.destroy).toHaveBeenCalledWith({
                where: {
                    user_id: 100,
                    resource_type: 'area',
                    resource_uid: 'area-uid-123',
                    propagation: 'area_membership',
                },
            });
            expect(logError).toHaveBeenCalledWith(
                expect.stringContaining('Ownership transfer: Area "Test Area"')
            );
        });

        it('should throw error when non-admin tries to remove owner', async () => {
            const areaWithOwner = {
                ...mockArea,
                user_id: 100, // Owner
            };
            Area.findByPk.mockResolvedValue(areaWithOwner);

            // Department admin 300 (not system admin) tries to remove owner
            User.findByPk.mockImplementation((id) => {
                if (id === 300)
                    return Promise.resolve({ uid: 'dept-admin-uid-300' });
                return Promise.resolve(null);
            });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([{ role: 'admin' }]); // Is department admin

            await expect(removeAreaMember(1, 100, 300)).rejects.toThrow(
                'Only admins can remove the area owner'
            );
        });

        it('should throw error when not authorized', async () => {
            const differentArea = {
                ...mockArea,
                user_id: 999, // Different owner
            };
            Area.findByPk.mockResolvedValue(differentArea);
            User.findByPk.mockResolvedValue({ uid: 'non-admin-uid' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([]); // Not a department admin

            await expect(removeAreaMember(1, 200, 500)).rejects.toThrow(
                'Not authorized to manage area members'
            );
        });

        it('should throw error when area not found', async () => {
            // First call for canManageAreaMembers
            Area.findByPk.mockResolvedValueOnce(mockArea);
            // Second call inside removeAreaMember
            Area.findByPk.mockResolvedValueOnce(null);

            await expect(removeAreaMember(1, 200, 100)).rejects.toThrow(
                'Area not found'
            );
        });

        it('should handle removedBy as string UID', async () => {
            const areaWithOwner = {
                ...mockArea,
                user_id: 100,
                update: jest.fn().mockResolvedValue(true),
            };
            Area.findByPk.mockResolvedValue(areaWithOwner);

            // String UID for remover
            isAdmin.mockResolvedValue(true);
            User.findByPk.mockResolvedValue({
                uid: 'owner-uid',
                email: 'owner@test.com',
            });
            sequelize.query.mockResolvedValue([]);

            // removedBy is a string UID, userId is numeric owner
            await removeAreaMember(1, 100, 'string-uid-admin');

            // Should call isAdmin with the string UID directly
            expect(isAdmin).toHaveBeenCalledWith('string-uid-admin');
        });
    });

    describe('updateMemberRole', () => {
        const mockArea = {
            id: 1,
            uid: 'area-uid-123',
            name: 'Test Area',
            user_id: 100,
        };

        beforeEach(() => {
            Area.findByPk.mockResolvedValue(mockArea);
        });

        it('should successfully promote member to admin', async () => {
            const { Permission } = require('../../../models');

            sequelize.query.mockResolvedValue([]);

            const result = await updateMemberRole(1, 200, 'admin', 100);

            expect(result).toEqual(mockArea);
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE areas_members SET role'),
                expect.objectContaining({
                    replacements: { newRole: 'admin', areaId: 1, userId: 200 },
                    type: QueryTypes.UPDATE,
                })
            );
            expect(Permission.update).toHaveBeenCalledWith(
                { access_level: 'admin' },
                {
                    where: {
                        user_id: 200,
                        resource_type: 'area',
                        resource_uid: 'area-uid-123',
                        propagation: 'area_membership',
                    },
                }
            );
        });

        it('should successfully demote admin to member', async () => {
            const { Permission } = require('../../../models');

            sequelize.query.mockResolvedValue([]);

            const result = await updateMemberRole(1, 200, 'member', 100);

            expect(result).toEqual(mockArea);
            expect(sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE areas_members SET role'),
                expect.objectContaining({
                    replacements: { newRole: 'member', areaId: 1, userId: 200 },
                })
            );
            expect(Permission.update).toHaveBeenCalledWith(
                { access_level: 'rw' },
                expect.any(Object)
            );
        });

        it('should throw error when not authorized', async () => {
            const differentArea = {
                ...mockArea,
                user_id: 999, // Different owner
            };
            Area.findByPk.mockResolvedValue(differentArea);
            User.findByPk.mockResolvedValue({ uid: 'non-admin-uid' });
            isAdmin.mockResolvedValue(false);
            sequelize.query.mockResolvedValue([]); // Not a department admin

            await expect(
                updateMemberRole(1, 200, 'admin', 500)
            ).rejects.toThrow('Not authorized to manage area members');
            expect(logError).toHaveBeenCalledWith(
                'Error updating member role:',
                expect.any(Error)
            );
        });

        it('should throw error when area not found', async () => {
            // First call for canManageAreaMembers
            Area.findByPk.mockResolvedValueOnce(mockArea);
            // Second call inside updateMemberRole
            Area.findByPk.mockResolvedValueOnce(null);

            await expect(
                updateMemberRole(1, 200, 'admin', 100)
            ).rejects.toThrow('Area not found');
        });

        it('should handle database error during update', async () => {
            sequelize.query.mockRejectedValue(new Error('Database error'));

            await expect(
                updateMemberRole(1, 200, 'admin', 100)
            ).rejects.toThrow('Database error');
            expect(logError).toHaveBeenCalledWith(
                'Error updating member role:',
                expect.any(Error)
            );
        });
    });

    describe('getAreaMembers', () => {
        it('should return array of members with roles', async () => {
            const mockMembers = [
                {
                    id: 200,
                    uid: 'user-uid-200',
                    email: 'member1@test.com',
                    name: 'Member',
                    surname: 'One',
                    avatar_image: '/avatars/member1.png',
                    AreaMember: { role: 'admin', created_at: '2024-01-01' },
                },
                {
                    id: 300,
                    uid: 'user-uid-300',
                    email: 'member2@test.com',
                    name: 'Member',
                    surname: 'Two',
                    avatar_image: '/avatars/member2.png',
                    AreaMember: { role: 'member', created_at: '2024-01-02' },
                },
            ];

            Area.findOne.mockResolvedValue({
                id: 1,
                uid: 'area-uid-123',
                Members: mockMembers,
            });

            const result = await getAreaMembers('area-uid-123');

            expect(result).toEqual(mockMembers);
            expect(Area.findOne).toHaveBeenCalledWith({
                where: { uid: 'area-uid-123' },
                include: [
                    {
                        model: User,
                        as: 'Members',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'avatar_image',
                        ],
                        through: { attributes: ['role', 'created_at'] },
                    },
                ],
            });
        });

        it('should return empty array for area with no members', async () => {
            Area.findOne.mockResolvedValue({
                id: 1,
                uid: 'area-uid-123',
                Members: [],
            });

            const result = await getAreaMembers('area-uid-123');

            expect(result).toEqual([]);
        });

        it('should return empty array when Members is undefined', async () => {
            Area.findOne.mockResolvedValue({
                id: 1,
                uid: 'area-uid-123',
                Members: undefined,
            });

            const result = await getAreaMembers('area-uid-123');

            expect(result).toEqual([]);
        });

        it('should throw error when area not found', async () => {
            Area.findOne.mockResolvedValue(null);

            await expect(getAreaMembers('non-existent-uid')).rejects.toThrow(
                'Area not found'
            );
            expect(logError).toHaveBeenCalledWith(
                'Error getting area members:',
                expect.any(Error)
            );
        });

        it('should handle database error', async () => {
            Area.findOne.mockRejectedValue(new Error('Database error'));

            await expect(getAreaMembers('area-uid-123')).rejects.toThrow(
                'Database error'
            );
            expect(logError).toHaveBeenCalledWith(
                'Error getting area members:',
                expect.any(Error)
            );
        });
    });
});
