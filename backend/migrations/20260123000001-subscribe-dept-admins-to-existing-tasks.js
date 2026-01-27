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

        // Build a map: user_id -> area_id
        const userToDept = {};
        for (const member of deptMembers) {
            userToDept[member.user_id] = member.area_id;
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
                const taskOwnerDept = userToDept[task.user_id];

                if (!taskOwnerDept) {
                    continue;
                }

                const admins = deptToAdmins[taskOwnerDept] || [];

                for (const adminUserId of admins) {
                    if (adminUserId === task.user_id) {
                        continue;
                    }

                    // Check if already subscribed
                    const existing = await sequelize.query(
                        `SELECT 1 FROM tasks_subscribers
                         WHERE task_id = :taskId AND user_id = :userId`,
                        {
                            replacements: { taskId: task.id, userId: adminUserId },
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
                         VALUES (:taskId, :userId, datetime('now'), datetime('now'))`,
                        {
                            replacements: { taskId: task.id, userId: adminUserId },
                            type: QueryTypes.INSERT,
                            transaction,
                        }
                    );
                    subscriptionsCreated++;

                    // Check if permission already exists
                    const existingPerm = await sequelize.query(
                        `SELECT 1 FROM permissions
                         WHERE user_id = :userId
                         AND resource_type = 'task'
                         AND resource_uid = :resourceUid
                         AND propagation = 'subscription'`,
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
        const sequelize = queryInterface.sequelize;

        // Find all subscription-based permissions for tasks
        const subscriptionPermissions = await sequelize.query(
            `SELECT p.user_id, p.resource_uid, t.id as task_id
             FROM permissions p
             JOIN tasks t ON t.uid = p.resource_uid
             WHERE p.resource_type = 'task'
             AND p.propagation = 'subscription'`,
            { type: QueryTypes.SELECT }
        );

        if (!subscriptionPermissions || subscriptionPermissions.length === 0) {
            console.log('No subscription-based permissions found, skipping down migration');
            return;
        }

        console.log(
            `Removing ${subscriptionPermissions.length} subscription-based permissions and their subscriptions`
        );

        let subscriptionsRemoved = 0;
        let permissionsRemoved = 0;

        // Wrap all modifications in a transaction for atomicity
        const transaction = await sequelize.transaction();

        try {
            for (const perm of subscriptionPermissions) {
                // Remove the subscription
                const [, subMeta] = await sequelize.query(
                    `DELETE FROM tasks_subscribers
                     WHERE task_id = :taskId AND user_id = :userId`,
                    {
                        replacements: { taskId: perm.task_id, userId: perm.user_id },
                        type: QueryTypes.DELETE,
                        transaction,
                    }
                );
                if (subMeta && subMeta.changes > 0) {
                    subscriptionsRemoved += subMeta.changes;
                } else {
                    subscriptionsRemoved++;
                }

                // Remove the permission
                const [, permMeta] = await sequelize.query(
                    `DELETE FROM permissions
                     WHERE user_id = :userId
                     AND resource_type = 'task'
                     AND resource_uid = :resourceUid
                     AND propagation = 'subscription'`,
                    {
                        replacements: {
                            userId: perm.user_id,
                            resourceUid: perm.resource_uid,
                        },
                        type: QueryTypes.DELETE,
                        transaction,
                    }
                );
                if (permMeta && permMeta.changes > 0) {
                    permissionsRemoved += permMeta.changes;
                } else {
                    permissionsRemoved++;
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        console.log(
            `Down migration complete: ${subscriptionsRemoved} subscriptions removed, ${permissionsRemoved} permissions removed`
        );
    },
};
