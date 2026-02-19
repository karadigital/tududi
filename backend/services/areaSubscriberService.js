const { Area, User, AreasSubscriber } = require('../models');
const { logError } = require('./logService');

/**
 * Get all subscribers for an area by area UID
 * @param {string} areaUid - The area's UID
 * @returns {Promise<User[]>} Array of subscriber user objects with source and added_by
 */
async function getAreaSubscribers(areaUid) {
    try {
        const area = await Area.findOne({
            where: { uid: areaUid },
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: ['source', 'added_by'] },
                },
            ],
        });

        if (!area) throw new Error('Area not found');

        return area.Subscribers || [];
    } catch (error) {
        logError('Error getting area subscribers:', error);
        throw error;
    }
}

/**
 * Add a subscriber to an area
 * @param {number} areaId - Area ID
 * @param {number} userId - User ID to subscribe
 * @param {number} addedBy - User ID who added the subscriber
 * @param {string} source - Source of subscription ('manual', 'admin_role', etc.)
 * @returns {Promise<AreasSubscriber>} The created subscriber record
 */
async function addAreaSubscriber(areaId, userId, addedBy, source = 'manual') {
    try {
        // Check if user exists
        const user = await User.findByPk(userId);
        if (!user) throw new Error('User not found');

        // Check for existing subscription
        const existing = await AreasSubscriber.findOne({
            where: { area_id: areaId, user_id: userId },
        });

        if (existing) {
            throw new Error('User is already a subscriber');
        }

        const subscriber = await AreasSubscriber.create({
            area_id: areaId,
            user_id: userId,
            added_by: addedBy,
            source,
        });

        return subscriber;
    } catch (error) {
        logError('Error adding area subscriber:', error);
        throw error;
    }
}

/**
 * Remove a subscriber from an area
 * @param {number} areaId - Area ID
 * @param {number} userId - User ID to remove
 * @param {string|null} source - If provided, only delete matching source
 * @returns {Promise<void>}
 */
async function removeAreaSubscriber(areaId, userId, source = null) {
    try {
        const where = { area_id: areaId, user_id: userId };
        if (source) {
            where.source = source;
        }

        const deleted = await AreasSubscriber.destroy({ where });

        if (deleted === 0) {
            throw new Error('User is not a subscriber');
        }
    } catch (error) {
        logError('Error removing area subscriber:', error);
        throw error;
    }
}

/**
 * Check if a user is a subscriber of an area
 * @param {number} areaId - Area ID
 * @param {number} userId - User ID to check
 * @returns {Promise<AreasSubscriber|null>} The subscriber row or null
 */
async function isAreaSubscriber(areaId, userId) {
    try {
        return await AreasSubscriber.findOne({
            where: { area_id: areaId, user_id: userId },
        });
    } catch (error) {
        logError('Error checking area subscriber:', error);
        throw error;
    }
}

module.exports = {
    getAreaSubscribers,
    addAreaSubscriber,
    removeAreaSubscriber,
    isAreaSubscriber,
};
