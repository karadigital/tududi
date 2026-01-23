'use strict';

/**
 * Migration: Subscribe department admins to existing tasks
 *
 * This migration subscribes all department admins to tasks owned by members
 * of their department, including the admins' own tasks.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if required tables exist
        try {
            await queryInterface.describeTable('areas_members');
            await queryInterface.describeTable('tasks_subscribers');
            await queryInterface.describeTable('tasks');
        } catch (error) {
            // Tables don't exist yet, skip this migration
            console.log(
                'Required tables do not exist yet, skipping department admin subscription backfill'
            );
            return;
        }

        // Find all department admins
        const [admins] = await queryInterface.sequelize.query(
            `SELECT area_id, user_id FROM areas_members WHERE role = 'admin'`
        );

        if (admins.length === 0) {
            console.log('No department admins found, nothing to backfill');
            return;
        }

        let subscriptionsAdded = 0;

        for (const admin of admins) {
            // Find all tasks owned by members of this admin's department
            // This includes the admin's own tasks
            const [tasks] = await queryInterface.sequelize.query(
                `SELECT t.id as task_id
                 FROM tasks t
                 INNER JOIN areas_members am ON t.user_id = am.user_id
                 WHERE am.area_id = :areaId
                 AND NOT EXISTS (
                     SELECT 1 FROM tasks_subscribers ts
                     WHERE ts.task_id = t.id AND ts.user_id = :adminUserId
                 )`,
                {
                    replacements: {
                        areaId: admin.area_id,
                        adminUserId: admin.user_id,
                    },
                }
            );

            if (tasks.length === 0) {
                continue;
            }

            // Subscribe admin to each task
            const subscriptions = tasks.map((task) => ({
                task_id: task.task_id,
                user_id: admin.user_id,
                created_at: new Date(),
                updated_at: new Date(),
            }));

            await queryInterface.bulkInsert('tasks_subscribers', subscriptions);
            subscriptionsAdded += subscriptions.length;

            // Also create permission records for these subscriptions
            // First get the task UIDs
            const [taskDetails] = await queryInterface.sequelize.query(
                `SELECT id, uid FROM tasks WHERE id IN (:taskIds)`,
                {
                    replacements: {
                        taskIds: tasks.map((t) => t.task_id),
                    },
                }
            );

            const permissions = taskDetails.map((task) => ({
                user_id: admin.user_id,
                resource_type: 'task',
                resource_uid: task.uid,
                access_level: 'rw',
                propagation: 'subscription',
                granted_by_user_id: admin.user_id,
                created_at: new Date(),
                updated_at: new Date(),
            }));

            if (permissions.length > 0) {
                await queryInterface.bulkInsert('permissions', permissions);
            }
        }

        console.log(
            `Department admin subscription backfill complete: ${subscriptionsAdded} subscriptions added`
        );
    },

    async down(queryInterface, Sequelize) {
        // This migration only adds data that could have been added by the app
        // We don't remove subscriptions on rollback to preserve user preferences
        console.log(
            'Rollback: Department admin subscriptions preserved (no changes made)'
        );
    },
};
