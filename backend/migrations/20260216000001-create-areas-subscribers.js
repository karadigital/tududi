'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('areas_subscribers', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            added_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            source: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'manual',
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

        await queryInterface.addIndex(
            'areas_subscribers',
            ['area_id', 'user_id'],
            {
                unique: true,
                name: 'areas_subscribers_unique_idx',
            }
        );

        await queryInterface.addIndex('areas_subscribers', ['area_id'], {
            name: 'areas_subscribers_area_id_idx',
        });

        await queryInterface.addIndex('areas_subscribers', ['user_id'], {
            name: 'areas_subscribers_user_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('areas_subscribers');
    },
};
