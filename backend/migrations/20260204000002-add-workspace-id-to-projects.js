'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('projects', 'workspace_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'workspaces',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('projects', ['workspace_id'], {
            name: 'projects_workspace_id_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'projects',
            'projects_workspace_id_index'
        );
        await queryInterface.removeColumn('projects', 'workspace_id');
    },
};
