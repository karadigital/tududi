const express = require('express');
const { Workspace, Project, sequelize } = require('../models');
const { Sequelize, QueryTypes } = require('sequelize');
const { isValidUid } = require('../utils/slug-utils');
const { logError } = require('../services/logService');
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

        // Find workspace IDs where user created the workspace OR user owns a project in the workspace
        const rows = await sequelize.query(
            `SELECT DISTINCT w.id
             FROM workspaces w
             WHERE w.creator = :userId
             UNION
             SELECT DISTINCT p.workspace_id
             FROM projects p
             WHERE p.user_id = :userId AND p.workspace_id IS NOT NULL`,
            {
                replacements: { userId },
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const workspaceIds = rows.map((r) => r.id).filter(Boolean);

        if (workspaceIds.length === 0) {
            return res.json([]);
        }

        const workspaces = await Workspace.findAll({
            where: { id: workspaceIds },
            attributes: [
                'uid',
                'name',
                'creator',
                'created_at',
                [
                    Sequelize.literal(
                        `(SELECT COUNT(*) FROM projects WHERE projects.workspace_id = "Workspace"."id" AND projects.user_id = ${Number(userId)})`
                    ),
                    'project_count',
                ],
            ],
            order: [['name', 'ASC']],
        });

        res.json(workspaces);
    } catch (error) {
        logError('Error fetching workspaces:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /workspaces/:uid — Get single workspace by uid
router.get('/workspaces/:uid', validateUid('uid'), async (req, res) => {
    try {
        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
            attributes: ['uid', 'name', 'creator', 'created_at', 'updated_at'],
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        res.json(workspace);
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

        const { name } = req.body;

        if (!name || _.isEmpty(name.trim())) {
            return res
                .status(400)
                .json({ error: 'Workspace name is required.' });
        }

        const workspace = await Workspace.create({
            name: name.trim(),
            creator: userId,
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
        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found.' });
        }

        const { name } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name;

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
        const workspace = await Workspace.findOne({
            where: { uid: req.params.uid },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found.' });
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
