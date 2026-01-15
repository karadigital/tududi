const { Task } = require('../../../models');

/**
 * Validates that critical priority tasks have required fields.
 * @param {Object} taskData - The task data being created/updated
 * @param {Object} existingTask - The existing task (for updates), optional
 * @throws {Error} If critical priority requirements not met
 */
function validateCriticalPriority(taskData, existingTask = null) {
    const priority = taskData.priority;

    // Check if priority is critical (value 3 or string 'critical')
    const isCritical =
        priority === 3 ||
        priority === Task.PRIORITY.CRITICAL ||
        priority === 'critical';

    if (!isCritical) {
        return; // Not critical, no validation needed
    }

    // For updates, merge with existing task data
    const dueDate =
        taskData.due_date !== undefined
            ? taskData.due_date
            : existingTask?.due_date || null;

    const assignedTo =
        taskData.assigned_to_user_id !== undefined
            ? taskData.assigned_to_user_id
            : existingTask?.assigned_to_user_id || null;

    if (!dueDate || !assignedTo) {
        throw new Error('Critical tasks must have a due date and assignee');
    }
}

module.exports = {
    validateCriticalPriority,
};
