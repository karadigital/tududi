const { hasAccess } = require('../../../middleware/authorize');
const { canDeleteTask } = require('../../../services/permissionsService');

const requireTaskReadAccess = hasAccess(
    'ro',
    'task',
    async (req) => {
        return req.params.uid;
    },
    { notFoundMessage: 'Task not found.' }
);

const requireTaskWriteAccess = hasAccess(
    'rw',
    'task',
    async (req) => {
        return req.params.uid;
    },
    {
        notFoundMessage: 'Task not found.',
        forbiddenMessage:
            'You are not allowed to edit this task. Please contact the creator if you want to make this change.',
    }
);

/**
 * Middleware to check if user can delete a task.
 * Only task owner or super admin can delete.
 */
const requireTaskDeleteAccess = async (req, res, next) => {
    try {
        const taskUid = req.params.uid;
        if (!taskUid) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const userId = req.currentUser?.id || req.session?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const canDelete = await canDeleteTask(userId, taskUid);
        if (canDelete) {
            return next();
        }

        return res.status(403).json({
            error: 'You are not allowed to delete this task. Please contact the creator if you want to make this change.',
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    requireTaskReadAccess,
    requireTaskWriteAccess,
    requireTaskDeleteAccess,
};
