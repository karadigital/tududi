const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { Project, Task, Note, Permission } = require('../models');
const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };

/**
 * Get all user IDs from departments where the given user is an admin.
 * A user is a department admin if they are:
 * 1. The owner of an area (user_id in areas table), OR
 * 2. Have role='admin' in areas_members table
 *
 * @param {number} userId - The user ID to check
 * @returns {Promise<number[]>} Array of all member user IDs from those departments (including the admin)
 */
async function getDepartmentMemberUserIds(userId) {
    // Find areas where user is an admin (either as owner or as admin member)
    const adminAreas = await sequelize.query(
        `SELECT DISTINCT a.id
         FROM areas a
         WHERE a.user_id = :userId
         UNION
         SELECT DISTINCT am.area_id
         FROM areas_members am
         WHERE am.user_id = :userId AND am.role = 'admin'`,
        {
            replacements: { userId },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );

    if (adminAreas.length === 0) {
        return [];
    }

    const areaIds = adminAreas.map((row) => row.id);

    // Get all member user IDs from those areas
    const members = await sequelize.query(
        `SELECT DISTINCT user_id
         FROM areas_members
         WHERE area_id IN (:areaIds)
         UNION
         SELECT DISTINCT user_id
         FROM areas
         WHERE id IN (:areaIds)`,
        {
            replacements: { areaIds },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );

    return members.map((row) => row.user_id);
}

async function getSharedUidsForUser(resourceType, userId) {
    const rows = await Permission.findAll({
        where: { user_id: userId, resource_type: resourceType },
        attributes: ['resource_uid'],
        raw: true,
    });
    const set = new Set(rows.map((r) => r.resource_uid));
    return Array.from(set);
}

async function getAccess(userId, resourceType, resourceUid) {
    // Convert numeric userId to string UID for admin check
    let userUid = userId;
    if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
        const { User } = require('../models');
        const user = await User.findByPk(userId, {
            attributes: ['uid'],
        });
        if (user) {
            userUid = user.uid;
        }
    }

    // Superadmin gets RW access to tasks (not ADMIN, to maintain consistent behavior)
    if (resourceType === 'task' && (await isAdmin(userUid))) return ACCESS.RW;

    // For non-task resources, superadmin gets ADMIN access
    if (await isAdmin(userUid)) return ACCESS.ADMIN;

    // ownership via model
    if (resourceType === 'project') {
        const proj = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!proj) return ACCESS.NONE;
        if (proj.user_id === userId) return ACCESS.RW;
    } else if (resourceType === 'task') {
        const t = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id', 'assigned_to_user_id'],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === userId) return ACCESS.RW;

        // Check if user is assigned to the task
        if (t.assigned_to_user_id === userId) return ACCESS.RW;

        // Check if user is a department admin and the task owner is in their department
        // Department admins have read-only access to tasks in their department
        const memberUserIds = await getDepartmentMemberUserIds(userId);
        if (memberUserIds.includes(t.user_id)) return ACCESS.RO;

        // Check if user has access through the parent project
        if (t.project_id) {
            const project = await Project.findOne({
                where: { id: t.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    } else if (resourceType === 'note') {
        const n = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!n) return ACCESS.NONE;
        if (n.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent project
        if (n.project_id) {
            const project = await Project.findOne({
                where: { id: n.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    } else if (resourceType === 'area') {
        const { Area } = require('../models');
        const area = await Area.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!area) return ACCESS.NONE;
        if (area.user_id === userId) return ACCESS.ADMIN; // Owner has admin access

        // Check if user is area member
        const membership = await sequelize.query(
            `SELECT role FROM areas_members WHERE area_id = (SELECT id FROM areas WHERE uid = ?) AND user_id = ?`,
            {
                replacements: [resourceUid, userId],
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (membership && membership.length > 0) {
            // Department admin has admin access, member has rw
            return membership[0].role === 'admin' ? ACCESS.ADMIN : ACCESS.RW;
        }
    }

    // shared
    const perm = await Permission.findOne({
        where: {
            user_id: userId,
            resource_type: resourceType,
            resource_uid: resourceUid,
        },
        attributes: ['access_level'],
        raw: true,
    });
    return perm ? perm.access_level : ACCESS.NONE;
}

async function ownershipOrPermissionWhere(resourceType, userId, cache = null) {
    // Check cache first (request-scoped)
    const cacheKey = `permission_${resourceType}_${userId}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    // Build WHERE clause for resource queries based on ownership and sharing permissions
    // Note: isAdmin expects a UID, but we might receive a numeric ID
    // Get the user's UID if we received a numeric ID
    let userUid = userId;
    if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
        const { User } = require('../models');
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (user) {
            userUid = user.uid;
        }
    }

    const isUserAdmin = await isAdmin(userUid);

    // Superadmin sees all tasks
    if (isUserAdmin && resourceType === 'task') {
        const result = {};
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    const sharedUids = await getSharedUidsForUser(resourceType, userId);

    // For tasks and notes, also include items from shared projects
    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser('project', userId);

        // Get the project IDs for shared projects
        let sharedProjectIds = [];
        if (sharedProjectUids.length > 0) {
            const projects = await Project.findAll({
                where: { uid: { [Op.in]: sharedProjectUids } },
                attributes: ['id'],
                raw: true,
            });
            sharedProjectIds = projects.map((p) => p.id);
        }

        const conditions = [
            { user_id: userId }, // Items owned by user
            { assigned_to_user_id: userId }, // Items assigned to user
        ];

        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } }); // Items directly shared with user
        }

        if (sharedProjectIds.length > 0) {
            conditions.push({ project_id: { [Op.in]: sharedProjectIds } }); // Items in shared projects
        }

        // For tasks, also include tasks the user is subscribed to
        if (resourceType === 'task') {
            const subscribedTaskIds = await sequelize.query(
                `SELECT DISTINCT task_id FROM tasks_subscribers WHERE user_id = :userId`,
                {
                    replacements: { userId },
                    type: QueryTypes.SELECT,
                    raw: true,
                }
            );

            if (subscribedTaskIds.length > 0) {
                const taskIds = subscribedTaskIds.map((row) => row.task_id);
                conditions.push({ id: { [Op.in]: taskIds } }); // Subscribed tasks
            }

            // Department admins can see tasks of their department members
            const memberUserIds = await getDepartmentMemberUserIds(userId);
            if (memberUserIds.length > 0) {
                conditions.push({ user_id: { [Op.in]: memberUserIds } }); // Tasks owned by department members
            }
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For projects, also include projects in areas the user is a member of
    if (resourceType === 'project') {
        // Get area IDs where user is a member
        const areaMembers = await sequelize.query(
            `SELECT area_id FROM areas_members WHERE user_id = :userId`,
            {
                replacements: { userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const conditions = [
            { user_id: userId }, // Projects owned by user
        ];

        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } }); // Projects directly shared with user
        }

        if (areaMembers.length > 0) {
            const areaIds = areaMembers.map((row) => row.area_id);
            conditions.push({ area_id: { [Op.in]: areaIds } }); // Projects in member areas
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For other resource types, use the original logic
    const result = {
        [Op.or]: [
            { user_id: userId },
            sharedUids.length
                ? { uid: { [Op.in]: sharedUids } }
                : { uid: null },
        ],
    };
    if (cache) cache.set(cacheKey, result);
    return result;
}

/**
 * Returns a WHERE clause for tasks that the user owns or is assigned to.
 * This is a stricter filter than ownershipOrPermissionWhere, used for
 * suggested tasks where we only want to suggest tasks the user can act on.
 *
 * @param {number} userId - The user ID
 * @returns {Object} Sequelize WHERE clause
 */
function ownedOrAssignedTasksWhere(userId) {
    return {
        [Op.or]: [{ user_id: userId }, { assigned_to_user_id: userId }],
    };
}

/**
 * Returns a WHERE clause for tasks that the user can take action on.
 * This includes tasks the user owns, is assigned to, or is subscribed to.
 * Used for search where we want to show all tasks the user is involved with.
 *
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} Sequelize WHERE clause
 */
async function actionableTasksWhere(userId) {
    const conditions = [
        { user_id: userId }, // Owned tasks
        { assigned_to_user_id: userId }, // Assigned tasks
    ];

    // Get subscribed task IDs
    const subscribedTaskIds = await sequelize.query(
        `SELECT DISTINCT task_id FROM tasks_subscribers WHERE user_id = :userId`,
        {
            replacements: { userId },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );

    if (subscribedTaskIds.length > 0) {
        const taskIds = subscribedTaskIds.map((row) => row.task_id);
        conditions.push({ id: { [Op.in]: taskIds } }); // Subscribed tasks
    }

    return { [Op.or]: conditions };
}

module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
    ownedOrAssignedTasksWhere,
    actionableTasksWhere,
};
