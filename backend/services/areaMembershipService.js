const { Area, User, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { logError } = require('./logService');
const { isAdmin } = require('./rolesService');

/**
 * Check if user can manage area membership
 * (owner, department admin, or admin)
 */
async function canManageAreaMembers(areaId, userId) {
    try {
        const area = await Area.findByPk(areaId);

        if (!area) return false;

        // Owner can always manage
        if (area.user_id === userId) return true;

        // Convert numeric userId to string UID for admin check
        let userUid = userId;
        if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
            const user = await User.findByPk(userId, {
                attributes: ['uid'],
            });
            if (user) {
                userUid = user.uid;
            }
        }

        // Admin can always manage
        if (await isAdmin(userUid)) return true;

        // Check if user is a department admin
        const membership = await sequelize.query(
            `SELECT role FROM areas_members WHERE area_id = :areaId AND user_id = :userId`,
            {
                replacements: { areaId, userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (
            membership &&
            membership.length > 0 &&
            membership[0].role === 'admin'
        ) {
            return true;
        }

        return false;
    } catch (error) {
        logError('Error checking area management permissions:', error);
        return false;
    }
}

/**
 * Add member to area
 */
async function addAreaMember(areaId, userId, role = 'member', addedBy) {
    try {
        // Validate permissions
        if (!(await canManageAreaMembers(areaId, addedBy))) {
            throw new Error('Not authorized to manage area members');
        }

        const area = await Area.findByPk(areaId);
        if (!area) throw new Error('Area not found');

        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        // Check if user is already a member of ANOTHER department
        const otherDepartmentMember = await sequelize.query(
            `SELECT * FROM areas_members WHERE user_id = :userId AND area_id != :areaId`,
            {
                replacements: { areaId, userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (otherDepartmentMember && otherDepartmentMember.length > 0) {
            throw new Error('User is already a member of another department');
        }

        // Check if already member of THIS area
        const existingMember = await sequelize.query(
            `SELECT * FROM areas_members WHERE area_id = :areaId AND user_id = :userId`,
            {
                replacements: { areaId, userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (existingMember && existingMember.length > 0) {
            throw new Error('User is already a member');
        }

        // Add member with role
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, :role, datetime('now'), datetime('now'))`,
            {
                replacements: { areaId, userId, role },
                type: QueryTypes.INSERT,
            }
        );

        // Create permission cascade via execAction
        const { execAction } = require('./execAction');
        await execAction({
            verb: 'area_member_add',
            actorUserId: addedBy,
            targetUserId: userId,
            resourceType: 'area',
            resourceUid: area.uid,
            accessLevel: role === 'admin' ? 'admin' : 'rw',
        });

        return area;
    } catch (error) {
        logError('Error adding area member:', error);
        throw error;
    }
}

/**
 * Remove member from area
 * If removing the owner, transfer ownership to the admin performing the action
 */
async function removeAreaMember(areaId, userId, removedBy) {
    try {
        // Validate permissions
        if (!(await canManageAreaMembers(areaId, removedBy))) {
            throw new Error('Not authorized to manage area members');
        }

        const area = await Area.findByPk(areaId);
        if (!area) throw new Error('Area not found');

        // Special handling for removing the owner
        if (area.user_id === userId) {
            // Convert removedBy to UID for admin check
            let removerUid = removedBy;
            if (typeof removedBy === 'number' || !isNaN(parseInt(removedBy))) {
                const remover = await User.findByPk(removedBy, {
                    attributes: ['uid', 'email'],
                });
                if (remover) {
                    removerUid = remover.uid;
                }
            }

            // Only admins can remove the owner (ownership transfer)
            if (!(await isAdmin(removerUid))) {
                throw new Error('Only admins can remove the area owner');
            }

            // Get old owner info for logging
            const oldOwner = await User.findByPk(userId, {
                attributes: ['uid', 'email'],
            });
            const newOwner = await User.findByPk(removedBy, {
                attributes: ['uid', 'email'],
            });

            // Transfer ownership to the admin
            await area.update({ user_id: removedBy });

            // Remove old owner from members table if they exist there
            await sequelize.query(
                `DELETE FROM areas_members WHERE area_id = :areaId AND user_id = :userId`,
                {
                    replacements: { areaId, userId },
                    type: QueryTypes.DELETE,
                }
            );

            // Log the ownership transfer
            const { Action } = require('../models');
            await Action.create({
                actor_user_id: removedBy,
                verb: 'area_ownership_transfer',
                resource_type: 'area',
                resource_uid: area.uid,
                target_user_id: userId,
                metadata: JSON.stringify({
                    old_owner_email: oldOwner?.email,
                    new_owner_email: newOwner?.email,
                    reason: 'admin_removal',
                }),
            });

            logError(
                `Ownership transfer: Area "${area.name}" (${area.uid}) transferred from ${oldOwner?.email} to ${newOwner?.email} by admin`
            );

            // Remove area_membership permissions for the old owner
            const { Permission } = require('../models');
            await Permission.destroy({
                where: {
                    user_id: userId,
                    resource_type: 'area',
                    resource_uid: area.uid,
                    propagation: 'area_membership',
                },
            });

            return area;
        }

        // Regular member removal (non-owner)
        // Remove member
        const deleted = await sequelize.query(
            `DELETE FROM areas_members WHERE area_id = :areaId AND user_id = :userId`,
            {
                replacements: { areaId, userId },
                type: QueryTypes.DELETE,
            }
        );

        // Remove permissions via execAction
        const { execAction } = require('./execAction');
        await execAction({
            verb: 'area_member_remove',
            actorUserId: removedBy,
            targetUserId: userId,
            resourceType: 'area',
            resourceUid: area.uid,
        });

        return area;
    } catch (error) {
        logError('Error removing area member:', error);
        throw error;
    }
}

/**
 * Update member role (member <-> admin)
 */
async function updateMemberRole(areaId, userId, newRole, updatedBy) {
    try {
        if (!(await canManageAreaMembers(areaId, updatedBy))) {
            throw new Error('Not authorized to manage area members');
        }

        const area = await Area.findByPk(areaId);
        if (!area) throw new Error('Area not found');

        // Update role in junction table
        await sequelize.query(
            `UPDATE areas_members SET role = :newRole, updated_at = datetime('now')
             WHERE area_id = :areaId AND user_id = :userId`,
            {
                replacements: { newRole, areaId, userId },
                type: QueryTypes.UPDATE,
            }
        );

        // Update permissions
        const { Permission } = require('../models');
        const accessLevel = newRole === 'admin' ? 'admin' : 'rw';

        await Permission.update(
            { access_level: accessLevel },
            {
                where: {
                    user_id: userId,
                    resource_type: 'area',
                    resource_uid: area.uid,
                    propagation: 'area_membership',
                },
            }
        );

        return area;
    } catch (error) {
        logError('Error updating member role:', error);
        throw error;
    }
}

/**
 * Get area members
 */
async function getAreaMembers(areaUid) {
    try {
        const area = await Area.findOne({
            where: { uid: areaUid },
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

        if (!area) throw new Error('Area not found');

        return area.Members || [];
    } catch (error) {
        logError('Error getting area members:', error);
        throw error;
    }
}

module.exports = {
    canManageAreaMembers,
    addAreaMember,
    removeAreaMember,
    updateMemberRole,
    getAreaMembers,
};
