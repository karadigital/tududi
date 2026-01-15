const { sequelize, Action } = require('../models');
const { isAdmin } = require('./rolesService');
const { applyPerms } = require('./applyPerms');
const {
    calculateProjectPerms,
    calculateTaskPerms,
    calculateNotePerms,
    calculateAreaPerms,
    calculateTagPerms,
} = require('./permissionsCalculators');

async function assertActorCanShare(
    actorUserId,
    resourceType,
    resourceOwnerId,
    resourceUid = null
) {
    // Convert numeric userId to string UID for admin check
    let userUid = actorUserId;
    if (typeof actorUserId === 'number' || !isNaN(parseInt(actorUserId))) {
        const { User } = require('../models');
        const user = await User.findByPk(actorUserId, {
            attributes: ['uid'],
        });
        if (user) {
            userUid = user.uid;
        }
    }

    if (await isAdmin(userUid)) return;
    if (resourceOwnerId === actorUserId) return;

    // For area resources, check if actor is a department admin
    if (resourceType === 'area' && resourceUid) {
        const { QueryTypes } = require('sequelize');
        const membership = await sequelize.query(
            `SELECT role FROM areas_members
             WHERE area_id = (SELECT id FROM areas WHERE uid = ?)
             AND user_id = ?`,
            {
                replacements: [resourceUid, actorUserId],
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (
            membership &&
            membership.length > 0 &&
            membership[0].role === 'admin'
        ) {
            return; // Department admin can share within their area
        }
    }

    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
}

async function execAction(action) {
    // action: { verb, actorUserId, targetUserId, resourceType, resourceUid, accessLevel? }
    return await sequelize.transaction(async (tx) => {
        // Resolve owner id for authorization
        let ownerUserId = null;
        if (action.resourceType === 'project') {
            const { Project } = require('../models');
            const proj = await Project.findOne({
                where: { uid: action.resourceUid },
                attributes: ['user_id'],
                transaction: tx,
                lock: tx.LOCK.UPDATE,
            });
            if (!proj) {
                const err = new Error('Resource not found');
                err.status = 404;
                throw err;
            }
            ownerUserId = proj.user_id;
        } else if (action.resourceType === 'area') {
            const { Area } = require('../models');
            const area = await Area.findOne({
                where: { uid: action.resourceUid },
                attributes: ['user_id'],
                transaction: tx,
                lock: tx.LOCK.UPDATE,
            });
            if (!area) {
                const err = new Error('Resource not found');
                err.status = 404;
                throw err;
            }
            ownerUserId = area.user_id;
        }

        await assertActorCanShare(
            action.actorUserId,
            action.resourceType,
            ownerUserId,
            action.resourceUid
        );

        const actionRow = await Action.create(
            {
                actor_user_id: action.actorUserId,
                verb: action.verb,
                resource_type: action.resourceType,
                resource_uid: action.resourceUid,
                target_user_id: action.targetUserId,
                access_level: action.accessLevel || null,
                metadata: null,
            },
            { transaction: tx }
        );

        let changes = { upserts: [], deletes: [] };
        const ctx = { tx };

        if (action.resourceType === 'project') {
            changes = await calculateProjectPerms(ctx, action);
        } else if (action.resourceType === 'task') {
            changes = await calculateTaskPerms(ctx, action);
        } else if (action.resourceType === 'note') {
            changes = await calculateNotePerms(ctx, action);
        } else if (action.resourceType === 'area') {
            changes = await calculateAreaPerms(ctx, action);
        } else if (action.resourceType === 'tag') {
            changes = await calculateTagPerms(ctx, action);
        }

        // Attach source_action_id
        changes.upserts = changes.upserts.map((u) => ({
            ...u,
            source_action_id: actionRow.id,
        }));

        await applyPerms(tx, changes);

        return actionRow.id;
    });
}

module.exports = { execAction };
