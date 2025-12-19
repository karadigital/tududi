'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const dialect = queryInterface.sequelize.getDialect();
        console.log(`🔧 Running migration for dialect: ${dialect}`);

        // Step 1: Disable foreign keys for SQLite (MUST be outside transaction)
        if (dialect === 'sqlite') {
            await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
        }

        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Step 2: Count original rows for verification
            const [originalCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 Original tasks_tags count: ${originalCount.count}`);

            // Step 3: Backup existing data
            await queryInterface.sequelize.query(
                `CREATE TABLE tasks_tags_migration_backup AS SELECT * FROM tasks_tags;`,
                { transaction }
            );

            const [backupCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags_migration_backup;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📦 Backed up ${backupCount.count} task-tag associations`);

            // Step 4: Drop the broken table (works for all database dialects)
            await queryInterface.dropTable('tasks_tags', { transaction });

            // Step 5: Create new table with correct schema
            await queryInterface.createTable('tasks_tags', {
                task_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'tasks',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                tag_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'tags',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
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
            }, { transaction });

            // Step 6: Add composite primary key (works for all database dialects)
            await queryInterface.addConstraint('tasks_tags', {
                fields: ['task_id', 'tag_id'],
                type: 'primary key',
                name: 'tasks_tags_pkey',
                transaction,
            });

            // Step 7: Restore data from backup
            await queryInterface.sequelize.query(
                `INSERT INTO tasks_tags (task_id, tag_id, created_at, updated_at)
                 SELECT task_id, tag_id, created_at, updated_at
                 FROM tasks_tags_migration_backup;`,
                { transaction }
            );

            // Step 8: Verify data was restored correctly
            const [finalCount] = await queryInterface.sequelize.query(
                'SELECT COUNT(*) as count FROM tasks_tags;',
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );
            console.log(`📊 Restored ${finalCount.count} task-tag associations`);

            if (finalCount.count !== originalCount.count) {
                throw new Error(
                    `Data verification failed! Expected ${originalCount.count} rows but found ${finalCount.count}`
                );
            }

            // Step 9: Drop backup table
            await queryInterface.dropTable('tasks_tags_migration_backup', { transaction });

            await transaction.commit();

            // Step 10: Re-enable foreign keys for SQLite (MUST be after transaction)
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
            }

            console.log('✅ Successfully fixed tasks_tags table schema');
            console.log(`✅ All ${finalCount.count} task-tag associations preserved`);

        } catch (error) {
            await transaction.rollback();

            // Re-enable foreign keys for SQLite even on error
            if (dialect === 'sqlite') {
                try {
                    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
                } catch (pragmaError) {
                    console.error('Failed to re-enable foreign keys:', pragmaError);
                }
            }

            console.error('❌ Error fixing tasks_tags table:', error);
            console.error('❌ Transaction rolled back - no changes were made');
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Cannot safely rollback a schema fix
        console.warn('⚠️  Cannot rollback this migration - it fixes a broken schema');
        console.warn('⚠️  Please restore from database backup if needed');
    },
};
