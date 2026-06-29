'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'exclude_from_activity_reports',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);

        // Preserve existing behavior: internal staff were excluded by the
        // hardcoded @karadigital.co domain filter that this column replaces.
        await queryInterface.sequelize.query(
            `UPDATE users SET exclude_from_activity_reports = true
             WHERE LOWER(email) LIKE '%@karadigital.co'`
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'users',
            'exclude_from_activity_reports'
        );
    },
};
