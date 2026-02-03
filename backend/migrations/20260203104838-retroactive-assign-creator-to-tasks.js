'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Update all tasks where assigned_to_user_id is NULL
        // Set assigned_to_user_id = user_id (the creator)
        await queryInterface.sequelize.query(`
            UPDATE tasks
            SET assigned_to_user_id = user_id
            WHERE assigned_to_user_id IS NULL
        `);
    },

    async down(queryInterface, Sequelize) {
        console.warn(
            'Migration rollback skipped: Cannot reliably rollback since we cannot distinguish ' +
                'tasks that were originally unassigned vs intentionally assigned to creator.'
        );
    },
};
