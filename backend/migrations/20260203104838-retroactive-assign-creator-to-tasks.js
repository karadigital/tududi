'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Temporarily disable FK checks — SQLite re-validates ALL foreign keys
        // on updated rows, and some tasks may have orphaned project_id,
        // recurring_parent_id, or parent_task_id references from deleted records.
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        try {
            // Update all tasks where assigned_to_user_id is NULL
            // Set assigned_to_user_id = user_id (the creator)
            await queryInterface.sequelize.query(`
                UPDATE tasks
                SET assigned_to_user_id = user_id
                WHERE assigned_to_user_id IS NULL
                  AND user_id IN (SELECT id FROM users)
            `);
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
        }
    },

    async down(queryInterface, Sequelize) {
        console.warn(
            'Migration rollback skipped: Cannot reliably rollback since we cannot distinguish ' +
                'tasks that were originally unassigned vs intentionally assigned to creator.'
        );
    },
};
