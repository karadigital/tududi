'use strict';

const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const sequelize = queryInterface.sequelize;

        // Get all departments with admins
        const deptAdmins = await sequelize.query(
            `SELECT area_id, user_id FROM areas_members WHERE role = 'admin'`,
            { type: QueryTypes.SELECT }
        );

        if (!deptAdmins || deptAdmins.length === 0) {
            console.log('No department admins found, skipping migration');
            return;
        }

        // Get all department members
        const deptMembers = await sequelize.query(
            `SELECT area_id, user_id FROM areas_members`,
            { type: QueryTypes.SELECT }
        );

        // Build a map: user_id -> [area_ids] (array to handle multiple dept memberships)
        const userToDepts = {};
        for (const member of deptMembers) {
            if (!userToDepts[member.user_id]) {
                userToDepts[member.user_id] = [];
            }
            userToDepts[member.user_id].push(member.area_id);
        }

        // Build a map: area_id -> [admin_user_ids]
        const deptToAdmins = {};
        for (const admin of deptAdmins) {
            if (!deptToAdmins[admin.area_id]) {
                deptToAdmins[admin.area_id] = [];
            }
            deptToAdmins[admin.area_id].push(admin.user_id);
        }

        // Get all tasks
        const tasks = await sequelize.query(
            `SELECT id, uid, user_id FROM tasks`,
            { type: QueryTypes.SELECT }
        );

        console.log(
            `Processing ${tasks.length} tasks for dept admin subscription`
        );

        let subscriptionsCreated = 0;
        let permissionsCreated = 0;

        // Wrap all modifications in a transaction for atomicity
        const transaction = await sequelize.transaction();

        try {
            for (const task of tasks) {
                const taskOwnerDepts = userToDepts[task.user_id];

                if (!taskOwnerDepts || taskOwnerDepts.length === 0) {
                    continue;
                }

                // Collect all unique admins across all departments the task owner belongs to
                const adminSet = new Set();
                for (const deptId of taskOwnerDepts) {
                    const deptAdminsList = deptToAdmins[deptId] || [];
                    for (const adminId of deptAdminsList) {
                        adminSet.add(adminId);
                    }
                }
                const admins = Array.from(adminSet);

                for (const adminUserId of admins) {
                    if (adminUserId === task.user_id) {
                        continue;
                    }

                    // Check if already subscribed
                    const existing = await sequelize.query(
                        `SELECT 1 FROM tasks_subscribers
                         WHERE task_id = :taskId AND user_id = :userId`,
                        {
                            replacements: {
                                taskId: task.id,
                                userId: adminUserId,
                            },
                            type: QueryTypes.SELECT,
                            transaction,
                        }
                    );

                    if (existing && existing.length > 0) {
                        continue;
                    }

                    // Add subscription
                    await sequelize.query(
                        `INSERT INTO tasks_subscribers (task_id, user_id, created_at, updated_at)
                         VALUES (:taskId, :userId, :now, :now)`,
                        {
                            replacements: {
                                taskId: task.id,
                                userId: adminUserId,
                                now: new Date(),
                            },
                            type: QueryTypes.INSERT,
                            transaction,
                        }
                    );
                    subscriptionsCreated++;

                    // Check if permission already exists (any propagation type to avoid unique constraint violation)
                    const existingPerm = await sequelize.query(
                        `SELECT 1 FROM permissions
                         WHERE user_id = :userId
                         AND resource_type = 'task'
                         AND resource_uid = :resourceUid`,
                        {
                            replacements: {
                                userId: adminUserId,
                                resourceUid: task.uid,
                            },
                            type: QueryTypes.SELECT,
                            transaction,
                        }
                    );

                    if (!existingPerm || existingPerm.length === 0) {
                        // Create permission
                        await sequelize.query(
                            `INSERT INTO permissions (user_id, resource_type, resource_uid, access_level, propagation, granted_by_user_id, created_at, updated_at)
                             VALUES (:userId, 'task', :resourceUid, 'rw', 'subscription', :grantedBy, datetime('now'), datetime('now'))`,
                            {
                                replacements: {
                                    userId: adminUserId,
                                    resourceUid: task.uid,
                                    grantedBy: task.user_id,
                                    now: new Date(),
                                },
                                type: QueryTypes.INSERT,
                                transaction,
                            }
                        );
                        permissionsCreated++;
                    }
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        console.log(
            `Migration complete: ${subscriptionsCreated} subscriptions created, ${permissionsCreated} permissions created`
        );
    },

    async down(queryInterface, Sequelize) {
        // Safe no-op: This migration cannot safely determine which subscription permissions
        // it created vs. those created through normal application usage. Deleting all
        // subscription-based permissions would remove data this migration didn't create.
        //
        // To fully reverse this migration, manually identify and remove:
        // 1. tasks_subscribers entries created by this migration
        // 2. permissions entries with propagation='subscription' created by this migration
        //
        // Consider using a database backup from before the migration was run.
        console.warn(
            'WARNING: Down migration for subscribe-dept-admins-to-existing-tasks is a no-op. ' +
                'This migration created subscription permissions that cannot be safely distinguished ' +
                'from those created through normal application usage. Manual cleanup may be required ' +
                'if you need to fully reverse this migration.'
        );
        return;
    },
};
