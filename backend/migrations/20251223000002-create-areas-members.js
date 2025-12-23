'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create junction table for area members and department heads
        await queryInterface.createTable('areas_members', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'areas',
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
            role: {
                type: Sequelize.ENUM('member', 'head'),
                allowNull: false,
                defaultValue: 'member',
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

        // Add composite unique index to prevent duplicate memberships
        await queryInterface.addIndex('areas_members', ['area_id', 'user_id'], {
            unique: true,
            name: 'areas_members_unique_idx',
        });

        // Add indexes for performance
        await queryInterface.addIndex('areas_members', ['area_id'], {
            name: 'areas_members_area_id_idx',
        });

        await queryInterface.addIndex('areas_members', ['user_id'], {
            name: 'areas_members_user_id_idx',
        });

        await queryInterface.addIndex('areas_members', ['role'], {
            name: 'areas_members_role_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('areas_members');
    },
};
