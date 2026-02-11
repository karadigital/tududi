'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Copy existing pin_to_sidebar data into the new project_pins join table
        await queryInterface.sequelize.query(`
            INSERT INTO project_pins (project_id, user_id, created_at, updated_at)
            SELECT id, user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM projects WHERE pin_to_sidebar = 1
        `);

        // Disable FK checks so SQLite's removeColumn (backup-drop-recreate) works
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
        try {
            await queryInterface.removeColumn('projects', 'pin_to_sidebar');
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
        }
    },

    async down(queryInterface, Sequelize) {
        // Disable FK checks for the reverse operation
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
        try {
            await queryInterface.addColumn('projects', 'pin_to_sidebar', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        } finally {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
        }

        // Restore pin data from join table
        const pins = await queryInterface.sequelize.query(
            'SELECT project_id FROM project_pins',
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const pin of pins) {
            await queryInterface.sequelize.query(
                'UPDATE projects SET pin_to_sidebar = 1 WHERE id = :projectId',
                { replacements: { projectId: pin.project_id } }
            );
        }
    },
};
