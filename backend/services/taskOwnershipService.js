const { Task, User, Area, AreasMember, Notification } = require('../models');
const { logError } = require('./logService');
const { canManageAreaMembers } = require('./areaMembershipService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../utils/notificationPreferences');

const MEMBER_ATTRS = ['id', 'uid', 'email', 'name', 'surname', 'avatar_image'];

/**
 * Resolve the department (Area) a task belongs to.
 * Prefers the task's project area; falls back to the current owner's
 * single department membership. Returns null if none can be resolved.
 */
async function resolveTaskDepartmentAreaId(task) {
    if (task.project_id) {
        const { Project } = require('../models');
        const project = await Project.findByPk(task.project_id, {
            attributes: ['area_id'],
        });
        if (project && project.area_id) {
            return project.area_id;
        }
    }
    const membership = await AreasMember.findOne({
        where: { user_id: task.user_id },
        attributes: ['area_id'],
    });
    return membership ? membership.area_id : null;
}

/**
 * Return the users who are members of the given department area,
 * in the shape SearchableUserDropdown consumes.
 */
async function getDepartmentCandidates(areaId) {
    const area = await Area.findByPk(areaId, {
        include: [
            {
                model: User,
                as: 'Members',
                attributes: MEMBER_ATTRS,
                through: { attributes: [] },
            },
        ],
    });
    return area ? area.Members : [];
}

/**
 * Transfer ownership of a task to another department member.
 * Requester must be the current owner or an admin of the task's department.
 * The new owner must be a member of the task's department.
 */
async function transferTaskOwner(taskId, newOwnerUserId, requesterUserId) {
    try {
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
        });
        if (!task) {
            throw new Error('Task not found');
        }

        const areaId = await resolveTaskDepartmentAreaId(task);

        const requesterIsOwner = task.user_id === requesterUserId;
        let authorized = requesterIsOwner;
        if (!authorized && areaId) {
            authorized = await canManageAreaMembers(areaId, requesterUserId);
        }
        if (!authorized) {
            throw new Error('Not authorized to transfer ownership');
        }

        if (!areaId) {
            throw new Error('Task has no department');
        }

        const candidates = await getDepartmentCandidates(areaId);
        if (!candidates.some((c) => c.id === newOwnerUserId)) {
            throw new Error('New owner is not a member of the task department');
        }

        const newOwner = await User.findByPk(newOwnerUserId, {
            attributes: [
                'id',
                'uid',
                'email',
                'name',
                'surname',
                'notification_preferences',
            ],
        });
        if (!newOwner) {
            throw new Error('New owner user not found');
        }

        if (task.user_id === newOwnerUserId) {
            return; // no-op
        }

        const previousOwner = task.Owner;
        task.user_id = newOwnerUserId;
        await task.save();

        await notifyOwnershipTransfer(task, newOwner, previousOwner);
    } catch (error) {
        logError('Error transferring task owner:', error);
        throw error;
    }
}

/**
 * Notify the new owner that a task was transferred to them.
 */
async function notifyOwnershipTransfer(task, newOwner, previousOwner) {
    try {
        const notificationType = 'task_owner_transferred';
        if (!shouldSendInAppNotification(newOwner, notificationType)) {
            return;
        }
        const fromName = previousOwner
            ? previousOwner.name || previousOwner.email
            : 'Someone';
        const sources = [];
        if (shouldSendTelegramNotification(newOwner, notificationType)) {
            sources.push('telegram');
        }
        await Notification.createNotification({
            userId: newOwner.id,
            type: notificationType,
            title: 'You are now the owner of a task',
            message: `${fromName} made you the owner of "${task.name}"`,
            level: 'info',
            sources,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                previousOwnerUid: previousOwner ? previousOwner.uid : null,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error sending ownership transfer notification:', error);
        // Don't throw - notification failure shouldn't break transfer
    }
}

module.exports = {
    resolveTaskDepartmentAreaId,
    getDepartmentCandidates,
    transferTaskOwner,
    notifyOwnershipTransfer,
};
