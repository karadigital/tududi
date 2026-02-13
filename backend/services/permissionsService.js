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
async function getDepartmentMemberUserIds(userId, cache = null) {
    const cacheKey = `dept_members_${userId}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

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

    const result = members.map((row) => row.user_id);
    if (cache) cache.set(cacheKey, result);
    return result;
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
            attributes: ['id', 'user_id', 'area_id'],
            raw: true,
        });
        if (!proj) return ACCESS.NONE;
        if (proj.user_id === userId) return ACCESS.RW;

        // Check if user is a dept admin (owner or admin role) of the project's department
        // Regular members only get access via task assignment (checked below)
        if (proj.area_id) {
            const adminMembership = await sequelize.query(
                `SELECT 1 FROM areas_members WHERE area_id = :areaId AND user_id = :userId AND role = 'admin'
                 UNION
                 SELECT 1 FROM areas WHERE id = :areaId AND user_id = :userId
                 LIMIT 1`,
                {
                    replacements: { areaId: proj.area_id, userId },
                    type: QueryTypes.SELECT,
                    raw: true,
                }
            );
            if (adminMembership.length > 0) return ACCESS.RW;
        }

        // Check if user has tasks (assigned or owned) in this project
        const connectedTask = await Task.findOne({
            where: {
                project_id: proj.id,
                [Op.or]: [{ assigned_to_user_id: userId }, { user_id: userId }],
            },
            attributes: ['id'],
            raw: true,
        });
        if (connectedTask) return ACCESS.RW;

        // Check if user is a dept admin and their members have tasks in this project
        const memberUserIds = await getDepartmentMemberUserIds(userId);
        if (memberUserIds.length > 0) {
            const memberTask = await Task.findOne({
                where: {
                    project_id: proj.id,
                    [Op.or]: [
                        {
                            assigned_to_user_id: {
                                [Op.in]: memberUserIds,
                            },
                        },
                        { user_id: { [Op.in]: memberUserIds } },
                    ],
                },
                attributes: ['id'],
                raw: true,
            });
            if (memberTask) return ACCESS.RW;
        }
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

    // Superadmin sees all tasks and all projects
    if (
        isUserAdmin &&
        (resourceType === 'task' || resourceType === 'project')
    ) {
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
            const memberUserIds = await getDepartmentMemberUserIds(
                userId,
                cache
            );
            if (memberUserIds.length > 0) {
                conditions.push({ user_id: { [Op.in]: memberUserIds } }); // Tasks owned by department members
            }
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For projects, also include projects in areas the user is a member of
    // and projects containing tasks assigned to the user
    if (resourceType === 'project') {
        // Get area IDs where user is an admin (owner or admin role)
        // Regular members only see projects via task assignment/ownership
        const areaMembers = await sequelize.query(
            `SELECT area_id FROM areas_members WHERE user_id = :userId AND role = 'admin'
             UNION
             SELECT id AS area_id FROM areas WHERE user_id = :userId`,
            {
                replacements: { userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        // Get project IDs where user has tasks (assigned or owned)
        const assignedProjectRows = await sequelize.query(
            `SELECT DISTINCT project_id FROM tasks WHERE (assigned_to_user_id = :userId OR user_id = :userId) AND project_id IS NOT NULL`,
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

        if (assignedProjectRows.length > 0) {
            const assignedProjectIds = assignedProjectRows.map(
                (row) => row.project_id
            );
            conditions.push({ id: { [Op.in]: assignedProjectIds } }); // Projects with tasks assigned to or owned by user
        }

        // Department admins also see projects where their members have tasks
        const memberUserIds = await getDepartmentMemberUserIds(userId, cache);
        if (memberUserIds.length > 0) {
            const memberProjectRows = await sequelize.query(
                `SELECT DISTINCT project_id FROM tasks
                 WHERE (assigned_to_user_id IN (:memberUserIds) OR user_id IN (:memberUserIds))
                 AND project_id IS NOT NULL`,
                {
                    replacements: { memberUserIds },
                    type: QueryTypes.SELECT,
                    raw: true,
                }
            );

            if (memberProjectRows.length > 0) {
                const memberProjectIds = memberProjectRows.map(
                    (row) => row.project_id
                );
                conditions.push({ id: { [Op.in]: memberProjectIds } }); // Projects where dept members have tasks
            }
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

/**
 * Check if a user can delete a task.
 * Only the task owner or super admin can delete tasks.
 *
 * @param {number} userId - The user ID
 * @param {string} taskUid - The task UID
 * @returns {Promise<boolean>} True if user can delete the task
 */
async function canDeleteTask(userId, taskUid) {
    // Get user UID for admin check
    const { User } = require('../models');
    const user = await User.findByPk(userId, { attributes: ['uid'] });
    if (!user) return false;

    // Super admin can delete any task
    if (await isAdmin(user.uid)) return true;

    // Check if user is the task owner
    const task = await Task.findOne({
        where: { uid: taskUid },
        attributes: ['user_id'],
        raw: true,
    });

    if (!task) return false;
    return task.user_id === userId;
}

async function getAccessibleWorkspaceIds(userId) {
    const rows = await sequelize.query(
        `SELECT DISTINCT w.id
         FROM workspaces w
         WHERE w.creator = :userId
         UNION
         SELECT DISTINCT p.workspace_id
         FROM projects p
         WHERE p.user_id = :userId AND p.workspace_id IS NOT NULL
         UNION
         SELECT DISTINCT p.workspace_id
         FROM projects p
         INNER JOIN permissions perm ON perm.resource_uid = p.uid
           AND perm.resource_type = 'project'
           AND perm.user_id = :userId
         WHERE p.workspace_id IS NOT NULL
         UNION
         SELECT DISTINCT p.workspace_id
         FROM projects p
         INNER JOIN tasks t ON t.project_id = p.id
         WHERE (t.assigned_to_user_id = :userId OR t.user_id = :userId) AND p.workspace_id IS NOT NULL
         UNION
         SELECT DISTINCT p.workspace_id
         FROM projects p
         INNER JOIN tasks t ON t.project_id = p.id
         INNER JOIN areas_members am ON (t.assigned_to_user_id = am.user_id OR t.user_id = am.user_id)
         WHERE p.workspace_id IS NOT NULL
         AND am.area_id IN (
             SELECT a2.id FROM areas a2 WHERE a2.user_id = :userId
             UNION
             SELECT am2.area_id FROM areas_members am2 WHERE am2.user_id = :userId AND am2.role = 'admin'
         )`,
        {
            replacements: { userId },
            type: QueryTypes.SELECT,
            raw: true,
        }
    );
    return rows.map((r) => r.id).filter(Boolean);
}

async function hasWorkspaceAccess(workspaceId, userId) {
    const accessibleIds = await getAccessibleWorkspaceIds(userId);
    return accessibleIds.includes(workspaceId);
}

module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
    ownedOrAssignedTasksWhere,
    actionableTasksWhere,
    canDeleteTask,
    hasWorkspaceAccess,
    getAccessibleWorkspaceIds,
    getDepartmentMemberUserIds,
};
