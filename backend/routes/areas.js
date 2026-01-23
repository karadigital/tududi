const express = require('express');
const { Area, User, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { isValidUid } = require('../utils/slug-utils');
const { logError } = require('../services/logService');
const _ = require('lodash');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');
const { hasAccess } = require('../middleware/authorize');
const areaMembershipService = require('../services/areaMembershipService');
const { isAdmin } = require('../services/rolesService');
const { execAction } = require('../services/execAction');

// Middleware to validate UID format before access checks
const validateUid =
    (paramName = 'uid') =>
    (req, res, next) => {
        const uid = req.params[paramName];
        if (!isValidUid(uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }
        next();
    };

router.get('/areas', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        // Get user's UID to check admin status
        const user = await User.findByPk(userId, {
            attributes: ['uid'],
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Check if user is admin
        const userIsAdmin = await isAdmin(user.uid);

        // If admin, return all areas
        if (userIsAdmin) {
            const areas = await Area.findAll({
                attributes: ['id', 'uid', 'name', 'description'],
                include: [
                    {
                        model: User,
                        as: 'Members',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'avatar_image',
                        ],
                        through: { attributes: ['role'] },
                    },
                ],
                order: [['name', 'ASC']],
            });
            return res.json(areas);
        }

        // For non-admin users, return only owned or member areas
        const { Op, QueryTypes } = require('sequelize');
        const { sequelize } = require('../models');

        // Get area IDs where user is a member
        const memberAreaIds = await sequelize.query(
            `SELECT area_id FROM areas_members WHERE user_id = :userId`,
            {
                replacements: { userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const areaIds = memberAreaIds.map((row) => row.area_id);

        const areas = await Area.findAll({
            where: {
                [Op.or]: [
                    { user_id: userId }, // Owned areas
                    { id: { [Op.in]: areaIds } }, // Member areas
                ],
            },
            attributes: ['id', 'uid', 'name', 'description'],
            include: [
                {
                    model: User,
                    as: 'Members',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: ['role'] },
                },
            ],
            order: [['name', 'ASC']],
        });

        res.json(areas);
    } catch (error) {
        logError('Error fetching areas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get(
    '/areas/:uid',
    validateUid('uid'),
    hasAccess('ro', 'area', (req) => req.params.uid, {
        forbiddenStatus: 404,
        notFoundMessage:
            "Area not found or doesn't belong to the current user.",
    }),
    async (req, res) => {
        try {
            const area = await Area.findOne({
                where: { uid: req.params.uid },
                attributes: ['id', 'uid', 'name', 'description'],
                include: [
                    {
                        model: User,
                        as: 'Members',
                        attributes: [
                            'id',
                            'uid',
                            'email',
                            'name',
                            'surname',
                            'avatar_image',
                        ],
                        through: { attributes: ['role'] },
                    },
                ],
            });

            if (!area) {
                return res.status(404).json({
                    error: 'Area not found',
                });
            }

            res.json(area);
        } catch (error) {
            logError('Error fetching area:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.post('/areas', async (req, res) => {
    let transaction;
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { name, description } = req.body;

        if (!name || _.isEmpty(name.trim())) {
            return res.status(400).json({ error: 'Area name is required.' });
        }

        // Start transaction AFTER validation
        transaction = await sequelize.transaction();

        const area = await Area.create(
            {
                name: name.trim(),
                description: description || '',
                user_id: userId,
            },
            { transaction }
        );

        // Add creator as department admin using Sequelize association
        await area.addMember(userId, {
            through: { role: 'admin' },
            transaction,
        });

        await transaction.commit();
        transaction = null; // Mark as committed

        // Create permission cascade via execAction (after commit so area is visible)
        // This is non-critical - log errors but don't fail the request
        try {
            await execAction({
                verb: 'area_member_add',
                actorUserId: userId,
                targetUserId: userId,
                resourceType: 'area',
                resourceUid: area.uid,
                accessLevel: 'admin',
            });
        } catch (execError) {
            logError('execAction failed after area creation:', execError);
        }

        res.status(201).json(_.pick(area, ['uid', 'name', 'description']));
    } catch (error) {
        if (transaction) await transaction.rollback();
        logError('Error creating area:', error);
        res.status(400).json({
            error: 'There was a problem creating the area.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.patch(
    '/areas/:uid',
    validateUid('uid'),
    hasAccess('admin', 'area', (req) => req.params.uid, {
        forbiddenStatus: 404,
        notFoundMessage: 'Area not found.',
    }),
    async (req, res) => {
        try {
            const area = await Area.findOne({
                where: { uid: req.params.uid },
            });

            if (!area) {
                return res.status(404).json({ error: 'Area not found.' });
            }

            const { name, description } = req.body;
            const updateData = {};

            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;

            await area.update(updateData);
            res.json(_.pick(area, ['uid', 'name', 'description']));
        } catch (error) {
            logError('Error updating area:', error);
            res.status(400).json({
                error: 'There was a problem updating the area.',
                details: error.errors
                    ? error.errors.map((e) => e.message)
                    : [error.message],
            });
        }
    }
);

router.delete(
    '/areas/:uid',
    validateUid('uid'),
    hasAccess('admin', 'area', (req) => req.params.uid, {
        forbiddenStatus: 404,
        notFoundMessage: 'Area not found.',
    }),
    async (req, res) => {
        try {
            const area = await Area.findOne({
                where: { uid: req.params.uid },
            });

            if (!area) {
                return res.status(404).json({ error: 'Area not found.' });
            }

            await area.destroy();
            return res.status(204).send();
        } catch (error) {
            logError('Error deleting area:', error);
            res.status(400).json({
                error: 'There was a problem deleting the area.',
            });
        }
    }
);

// Get area members
router.get(
    '/areas/:uid/members',
    hasAccess('ro', 'area', (req) => req.params.uid),
    async (req, res) => {
        try {
            const members = await areaMembershipService.getAreaMembers(
                req.params.uid
            );
            res.json({ members });
        } catch (error) {
            logError('Error fetching area members:', error);
            res.status(500).json({ error: 'Failed to fetch area members' });
        }
    }
);

// Add area member
router.post(
    '/areas/:uid/members',
    hasAccess('admin', 'area', (req) => req.params.uid),
    async (req, res) => {
        try {
            const userId = getAuthenticatedUserId(req);
            const { user_id, role } = req.body;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id is required' });
            }

            const area = await Area.findOne({ where: { uid: req.params.uid } });
            if (!area) {
                return res.status(404).json({ error: 'Area not found' });
            }

            await areaMembershipService.addAreaMember(
                area.id,
                user_id,
                role || 'member',
                userId
            );

            const updatedMembers = await areaMembershipService.getAreaMembers(
                req.params.uid
            );
            res.json({ members: updatedMembers });
        } catch (error) {
            logError('Error adding area member:', error);

            if (
                error.message ===
                'User is already a member of another department'
            ) {
                return res.status(400).json({
                    error: error.message,
                    departmentName: error.departmentName,
                });
            }
            if (error.message === 'User is already a member') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'Not authorized to manage area members') {
                return res.status(403).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to add area member' });
        }
    }
);

// Remove area member
router.delete(
    '/areas/:uid/members/:userId',
    hasAccess('admin', 'area', (req) => req.params.uid),
    async (req, res) => {
        try {
            const currentUserId = getAuthenticatedUserId(req);
            const { userId } = req.params;

            const area = await Area.findOne({ where: { uid: req.params.uid } });
            if (!area) {
                return res.status(404).json({ error: 'Area not found' });
            }

            await areaMembershipService.removeAreaMember(
                area.id,
                Number(userId),
                currentUserId
            );

            const updatedMembers = await areaMembershipService.getAreaMembers(
                req.params.uid
            );
            res.json({ members: updatedMembers });
        } catch (error) {
            logError('Error removing area member:', error);

            if (error.message === 'Cannot remove area owner from members') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'Not authorized to manage area members') {
                return res.status(403).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to remove area member' });
        }
    }
);

// Update member role
router.patch(
    '/areas/:uid/members/:userId/role',
    hasAccess('admin', 'area', (req) => req.params.uid),
    async (req, res) => {
        try {
            const currentUserId = getAuthenticatedUserId(req);
            const { userId } = req.params;
            const { role } = req.body;

            if (!role || !['member', 'admin'].includes(role)) {
                return res.status(400).json({
                    error: 'Invalid role. Must be "member" or "admin"',
                });
            }

            const area = await Area.findOne({ where: { uid: req.params.uid } });
            if (!area) {
                return res.status(404).json({ error: 'Area not found' });
            }

            await areaMembershipService.updateMemberRole(
                area.id,
                Number(userId),
                role,
                currentUserId
            );

            const updatedMembers = await areaMembershipService.getAreaMembers(
                req.params.uid
            );
            res.json({ members: updatedMembers });
        } catch (error) {
            logError('Error updating member role:', error);
            res.status(500).json({ error: 'Failed to update member role' });
        }
    }
);

module.exports = router;
