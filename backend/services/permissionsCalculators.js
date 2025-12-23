const { Area, Project, Task, Note } = require('../models');

function emptyChanges() {
    return { upserts: [], deletes: [] };
}

function pushUpsert(changes, u) {
    changes.upserts.push(u);
}
function pushDelete(changes, d) {
    changes.deletes.push(d);
}

async function collectProjectDescendants(projectId) {
    // tasks (all levels) and notes
    const rootTasks = await Task.findAll({
        where: { project_id: projectId },
        attributes: ['id', 'uid', 'parent_task_id'],
        raw: true,
    });
    const notes = await Note.findAll({
        where: { project_id: projectId },
        attributes: ['uid'],
        raw: true,
    });

    const taskUids = new Set();
    const queue = [...rootTasks];
    for (const t of rootTasks) taskUids.add(t.uid);
    while (queue.length) {
        const node = queue.shift();
        const children = await Task.findAll({
            where: { parent_task_id: node.id },
            attributes: ['id', 'uid'],
            raw: true,
        });
        for (const c of children) {
            if (!taskUids.has(c.uid)) {
                taskUids.add(c.uid);
                queue.push({ id: c.id });
            }
        }
    }
    return {
        taskUids: Array.from(taskUids),
        noteUids: notes.map((n) => n.uid),
    };
}

async function calculateProjectPerms(ctx, action) {
    const changes = emptyChanges();
    // find project id
    const project = await Project.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id', 'user_id'],
        transaction: ctx.tx,
    });
    if (!project) return changes;

    const { taskUids, noteUids } = await collectProjectDescendants(project.id);

    if (action.verb === 'share_grant') {
        const direct = {
            userId: action.targetUserId,
            resourceType: 'project',
            resourceUid: action.resourceUid,
            accessLevel: action.accessLevel,
            propagation: 'direct',
            grantedByUserId: action.actorUserId,
        };
        pushUpsert(changes, direct);
        for (const tuid of taskUids)
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
        for (const nuid of noteUids)
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'project',
            resourceUid: action.resourceUid,
        });
        for (const tuid of taskUids)
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
            });
        for (const nuid of noteUids)
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
            });
    }

    return changes;
}

async function calculateTaskPerms(ctx, action) {
    // Handle single task subtree (task + subtasks)
    const changes = emptyChanges();
    const task = await Task.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id'],
        transaction: ctx.tx,
    });
    if (!task) return changes;

    const taskUids = new Set([action.resourceUid]);
    const queue = [{ id: task.id }];
    while (queue.length) {
        const node = queue.shift();
        const children = await Task.findAll({
            where: { parent_task_id: node.id },
            attributes: ['id', 'uid'],
            transaction: ctx.tx,
            raw: true,
        });
        for (const c of children) {
            if (!taskUids.has(c.uid)) {
                taskUids.add(c.uid);
                queue.push({ id: c.id });
            }
        }
    }

    if (action.verb === 'share_grant') {
        for (const tuid of taskUids)
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
                accessLevel: action.accessLevel,
                propagation:
                    tuid === action.resourceUid ? 'direct' : 'inherited',
                grantedByUserId: action.actorUserId,
            });
    } else if (action.verb === 'share_revoke') {
        for (const tuid of taskUids)
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
            });
    }

    return changes;
}

async function calculateNotePerms(ctx, action) {
    const changes = emptyChanges();
    if (action.verb === 'share_grant') {
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType: 'note',
            resourceUid: action.resourceUid,
            accessLevel: action.accessLevel,
            propagation: 'direct',
            grantedByUserId: action.actorUserId,
        });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'note',
            resourceUid: action.resourceUid,
        });
    }
    return changes;
}

async function calculateAreaPerms(ctx, action) {
    const changes = emptyChanges();

    // Find area
    const area = await Area.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id', 'user_id'],
        transaction: ctx.tx,
    });

    if (!area) return changes;

    // Get all projects in this area
    const projects = await Project.findAll({
        where: { area_id: area.id },
        attributes: ['id', 'uid'],
        transaction: ctx.tx,
        raw: true,
    });

    // Collect descendants for each project
    const allTaskUids = [];
    const allNoteUids = [];

    for (const project of projects) {
        const { taskUids, noteUids } = await collectProjectDescendants(
            project.id
        );
        allTaskUids.push(...taskUids);
        allNoteUids.push(...noteUids);
    }

    if (action.verb === 'area_member_add') {
        // Direct permission on area
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType: 'area',
            resourceUid: action.resourceUid,
            accessLevel: action.accessLevel,
            propagation: 'area_membership',
            grantedByUserId: action.actorUserId,
        });

        // Cascade to all projects
        for (const project of projects) {
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'project',
                resourceUid: project.uid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
        }

        // Cascade to all tasks
        for (const tuid of allTaskUids) {
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
        }

        // Cascade to all notes
        for (const nuid of allNoteUids) {
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
        }
    } else if (action.verb === 'area_member_remove') {
        // Remove area permission
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'area',
            resourceUid: action.resourceUid,
        });

        // Remove cascaded permissions for projects
        for (const project of projects) {
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'project',
                resourceUid: project.uid,
            });
        }

        // Remove cascaded permissions for tasks
        for (const tuid of allTaskUids) {
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
            });
        }

        // Remove cascaded permissions for notes
        for (const nuid of allNoteUids) {
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
            });
        }
    }

    return changes;
}

async function calculateTagPerms(ctx, action) {
    const changes = emptyChanges();
    // No-op for now (tags excluded from project cascade)
    return changes;
}

module.exports = {
    calculateProjectPerms,
    calculateTaskPerms,
    calculateNotePerms,
    calculateAreaPerms,
    calculateTagPerms,
};
