'use strict';

/**
 * Migration: Enforce Single Department Membership
 *
 * This migration ensures each user can only belong to ONE department (area) at a time.
 * It removes duplicate memberships (keeping the oldest one with lowest id) and adds
 * a unique constraint on user_id.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Step 1: Count users with multiple memberships
            const [duplicateUsers] = await queryInterface.sequelize.query(
                `
                SELECT user_id, COUNT(*) as membership_count
                FROM areas_members
                GROUP BY user_id
                HAVING COUNT(*) > 1
                `,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );

            const duplicateCount = duplicateUsers ? duplicateUsers.length : 0;
            console.log(
                `Found ${duplicateCount} user(s) with multiple department memberships`
            );

            if (duplicateCount > 0) {
                // Step 2: Log which memberships will be removed for audit purposes
                const [membershipsToRemove] =
                    await queryInterface.sequelize.query(
                        `
                    SELECT am.id, am.user_id, am.area_id, am.role
                    FROM areas_members am
                    WHERE am.id NOT IN (
                        SELECT MIN(id)
                        FROM areas_members
                        GROUP BY user_id
                    )
                    ORDER BY am.user_id, am.id
                    `,
                        { transaction, type: Sequelize.QueryTypes.SELECT }
                    );

                console.log(
                    `Removing ${membershipsToRemove ? membershipsToRemove.length : 0} duplicate membership(s):`
                );
                if (membershipsToRemove && membershipsToRemove.length > 0) {
                    membershipsToRemove.forEach((m) => {
                        console.log(
                            `  - Membership id=${m.id}: user_id=${m.user_id}, area_id=${m.area_id}, role=${m.role}`
                        );
                    });
                }

                // Step 3: Delete duplicate memberships, keeping oldest (lowest id) per user
                await queryInterface.sequelize.query(
                    `
                    DELETE FROM areas_members
                    WHERE id NOT IN (
                        SELECT MIN(id)
                        FROM areas_members
                        GROUP BY user_id
                    )
                    `,
                    { transaction }
                );

                console.log('Duplicate memberships removed successfully');
            }

            // Step 4: Verify no duplicates remain
            const [remainingDuplicates] = await queryInterface.sequelize.query(
                `
                SELECT user_id, COUNT(*) as cnt
                FROM areas_members
                GROUP BY user_id
                HAVING COUNT(*) > 1
                `,
                { transaction, type: Sequelize.QueryTypes.SELECT }
            );

            if (remainingDuplicates && remainingDuplicates.length > 0) {
                throw new Error(
                    'Failed to remove all duplicate memberships - data integrity check failed'
                );
            }

            // Step 5: Add unique index on user_id to enforce single department membership
            await queryInterface.addIndex('areas_members', ['user_id'], {
                unique: true,
                name: 'areas_members_user_unique_idx',
                transaction,
            });

            console.log(
                'Added unique index on user_id to enforce single department membership'
            );

            await transaction.commit();
            console.log(
                'Migration completed: Single department membership enforced'
            );
        } catch (error) {
            await transaction.rollback();
            console.error('Migration failed:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        // Remove the unique index on user_id
        // Note: This does NOT restore deleted duplicate memberships
        await queryInterface.removeIndex(
            'areas_members',
            'areas_members_user_unique_idx'
        );

        console.log(
            'Removed unique index on user_id - users can now have multiple department memberships'
        );
        console.log(
            'Note: Previously deleted duplicate memberships cannot be restored'
        );
    },
};
