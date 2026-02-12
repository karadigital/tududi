const express = require('express');
const { Workspace, Project } = require('../models');
const { Sequelize } = require('sequelize');
const { isValidUid } = require('../utils/slug-utils');
const { logError } = require('../services/logService');
const {
    hasWorkspaceAccess,
    getAccessibleWorkspaceIds,
    getDepartmentMemberUserIds,
} = require('../services/permissionsService');
const _ = require('lodash');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

// Middleware to validate UID format
const validateUid =
    (paramName = 'uid') =>
    (req, res, next) => {
        const uid = req.params[paramName];
        if (!isValidUid(uid)) {
            return res.status(400).json({ error: 'Invalid UID' });
        }
        next();
    };

// GET /workspaces — List workspaces visible to the user
router.get('/workspaces', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        const safeUserId = parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        // Find workspace IDs where user created the workspace OR user owns a project in the workspace
        const workspaceIds = await getAccessibleWorkspaceIds(safeUserId);

        if (workspaceIds.length === 0) {
            return res.json([]);
        }

        // Build project count subquery — includes dept member projects
        const memberUserIds = await getDepartmentMemberUserIds(safeUserId);
        let countSubquery;
        if (memberUserIds.length > 0) {
            const memberIdList = memberUserIds
                .map((id) => parseInt(id, 10))
                .filter(Number.isInteger)
                .join(',');
            countSubquery = `(SELECT COUNT(DISTINCT p.id) FROM projects p WHERE p.workspace_id = "Workspace"."id" AND (p.user_id = ${safeUserId} OR p.id IN (SELECT DISTINCT t.project_id FROM tasks t WHERE (t.assigned_to_user_id IN (${memberIdList}) OR t.user_id IN (${memberIdList})) AND t.project_id IS NOT NULL)))`;
        } else {
            countSubquery = `(SELECT COUNT(*) FROM projects WHERE projects.workspace_id = "Workspace"."id" AND projects.user_id = ${safeUserId})`;
        }

        const workspaces = await Workspace.findAll({
            where: { id: workspaceIds },
            attributes: [
                'uid',
                'name',
                'creator',
                'created_at',
                [Sequelize.literal(countSubquery), 'my_project_count'],
            ],
            order: [['name', 'ASC']],
        });

        const result = workspaces.map((ws) => {
            const plain = ws.toJSON();
            const { creator, ...rest } = plain;
            return { ...rest, is_creator: creator === safeUserId };
        });

        res.json(result);
    } catch (error) {
        logError('Error fetching workspaces:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /workspaces/:uid — Get single workspace by uid
router.get('/workspaces/:uid', validateUid('uid'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        const safeUserId = parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
            attributes: [
                'id',
                'uid',
                'name',
                'creator',
                'created_at',
                'updated_at',
            ],
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Check visibility: user must be creator or have a project in the workspace
        if (!(await hasWorkspaceAccess(workspace.id, safeUserId))) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Remove internal id and replace creator with is_creator
        const { id, creator, ...workspaceData } = workspace.toJSON();
        res.json({ ...workspaceData, is_creator: creator === safeUserId });
    } catch (error) {
        logError('Error fetching workspace:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /workspace — Create workspace
router.post('/workspace', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const safeUserId = parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const { name } = req.body;

        if (!name || _.isEmpty(name.trim())) {
            return res
                .status(400)
                .json({ error: 'Workspace name is required.' });
        }

        const workspace = await Workspace.create({
            name: name.trim(),
            creator: safeUserId,
        });

        res.status(201).json(_.pick(workspace, ['uid', 'name']));
    } catch (error) {
        logError('Error creating workspace:', error);
        res.status(400).json({
            error: 'There was a problem creating the workspace.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// PATCH /workspace/:uid — Update workspace
router.patch('/workspace/:uid', validateUid('uid'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        const safeUserId = parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }

        if (workspace.creator !== safeUserId) {
            return res
                .status(403)
                .json({ error: 'Not authorized to modify this workspace.' });
        }

        const { name } = req.body;
        const updateData = {};

        if (name !== undefined) {
            if (_.isEmpty(name.trim())) {
                return res
                    .status(400)
                    .json({ error: 'Workspace name is required.' });
            }
            updateData.name = name.trim();
        }

        await workspace.update(updateData);
        res.json(_.pick(workspace, ['uid', 'name']));
    } catch (error) {
        logError('Error updating workspace:', error);
        res.status(400).json({
            error: 'There was a problem updating the workspace.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /workspace/:uid — Delete workspace
router.delete('/workspace/:uid', validateUid('uid'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        const safeUserId = parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }

        if (workspace.creator !== safeUserId) {
            return res
                .status(403)
                .json({ error: 'Not authorized to modify this workspace.' });
        }

        await workspace.destroy();
        res.json({ message: 'Workspace deleted' });
    } catch (error) {
        logError('Error deleting workspace:', error);
        res.status(400).json({
            error: 'There was a problem deleting the workspace.',
        });
    }
});

module.exports = router;
