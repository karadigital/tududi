'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create join table for project pins (per-user starring)
        await queryInterface.createTable('project_pins', {
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'projects',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Add composite unique index to prevent duplicate pins
        await queryInterface.addIndex(
            'project_pins',
            ['project_id', 'user_id'],
            {
                unique: true,
                name: 'project_pins_unique_idx',
            }
        );

        // Add indexes for performance
        await queryInterface.addIndex('project_pins', ['project_id'], {
            name: 'project_pins_project_id_idx',
        });

        await queryInterface.addIndex('project_pins', ['user_id'], {
            name: 'project_pins_user_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('project_pins');
    },
};
