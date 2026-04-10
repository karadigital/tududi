'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_activities', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            activity_type: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'passive',
            },
            first_seen_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            last_seen_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            action_counts: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: {},
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

        await queryInterface.addIndex('user_activities', ['user_id']);
        await queryInterface.addIndex('user_activities', ['date']);
        await queryInterface.addIndex('user_activities', ['user_id', 'date'], {
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_activities');
    },
};
