'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;

        const deptAdmins = await sequelize.query(
            `SELECT area_id, user_id FROM areas_members WHERE role = 'admin'`,
            { type: QueryTypes.SELECT }
        );

        if (!deptAdmins || deptAdmins.length === 0) {
            console.log('No department admins found, skipping migration');
            return;
        }

        const transaction = await sequelize.transaction();

        try {
            let created = 0;
            for (const admin of deptAdmins) {
                // Idempotent: skip if already exists
                const existing = await sequelize.query(
                    `SELECT 1 FROM areas_subscribers WHERE area_id = :areaId AND user_id = :userId`,
                    {
                        replacements: {
                            areaId: admin.area_id,
                            userId: admin.user_id,
                        },
                        type: QueryTypes.SELECT,
                        transaction,
                    }
                );

                if (existing && existing.length > 0) {
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO areas_subscribers (area_id, user_id, added_by, source, created_at, updated_at)
                     VALUES (:areaId, :userId, :userId, 'admin_role', datetime('now'), datetime('now'))`,
                    {
                        replacements: {
                            areaId: admin.area_id,
                            userId: admin.user_id,
                        },
                        type: QueryTypes.INSERT,
                        transaction,
                    }
                );
                created++;
            }

            await transaction.commit();
            console.log(
                `Migration complete: ${created} admin subscribers created`
            );
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const sequelize = queryInterface.sequelize;
        await sequelize.query(
            `DELETE FROM areas_subscribers WHERE source = 'admin_role'`,
            { type: QueryTypes.DELETE }
        );
    },
};
