const {
    Area,
    Notification,
    Project,
    Task,
    sequelize,
} = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const {
    resolveTaskDepartmentAreaId,
    getDepartmentCandidates,
    transferTaskOwner,
} = require('../../../services/taskOwnershipService');

async function addAreaMember(areaId, userId, role = 'member') {
    await sequelize.query(
        `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        { replacements: [areaId, userId, role] }
    );
}

describe('taskOwnershipService', () => {
    let owner, member, outsider, admin, dept;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `own_${stamp}@example.com` });
        member = await createTestUser({ email: `mem_${stamp}@example.com` });
        outsider = await createTestUser({ email: `out_${stamp}@example.com` });
        admin = await createTestUser({ email: `adm_${stamp}@example.com` });
        dept = await Area.create({ name: 'Dept', user_id: owner.id });
        await addAreaMember(dept.id, owner.id, 'member');
        await addAreaMember(dept.id, member.id, 'member');
        await addAreaMember(dept.id, admin.id, 'admin');
    });

    it('resolves department from the project area', async () => {
        const project = await Project.create({
            name: 'P',
            user_id: owner.id,
            area_id: dept.id,
        });
        const task = await Task.create({
            name: 'T',
            user_id: owner.id,
            project_id: project.id,
        });
        expect(await resolveTaskDepartmentAreaId(task)).toBe(dept.id);
    });

    it('falls back to the owner department when task has no project', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        expect(await resolveTaskDepartmentAreaId(task)).toBe(dept.id);
    });

    it('lists department members as candidates', async () => {
        const candidates = await getDepartmentCandidates(dept.id);
        const ids = candidates.map((c) => c.id).sort();
        expect(ids).toEqual([owner.id, member.id, admin.id].sort());
    });

    it('lets the owner transfer to a department member', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await transferTaskOwner(task.id, member.id, owner.id);
        await task.reload();
        expect(task.user_id).toBe(member.id);
    });

    it('lets a department admin transfer ownership', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await transferTaskOwner(task.id, member.id, admin.id);
        await task.reload();
        expect(task.user_id).toBe(member.id);
    });

    it('rejects a requester who is neither owner nor dept admin', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await expect(
            transferTaskOwner(task.id, member.id, member.id)
        ).rejects.toThrow('Not authorized to transfer ownership');
        await task.reload();
        expect(task.user_id).toBe(owner.id);
    });

    it('rejects a new owner outside the department', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await expect(
            transferTaskOwner(task.id, outsider.id, owner.id)
        ).rejects.toThrow('New owner is not a member of the task department');
        await task.reload();
        expect(task.user_id).toBe(owner.id);
    });

    it('notifies the new owner after a transfer', async () => {
        const task = await Task.create({ name: 'T', user_id: owner.id });
        await transferTaskOwner(task.id, member.id, owner.id);
        const notif = await Notification.findOne({
            where: { user_id: member.id, type: 'task_owner_transferred' },
        });
        expect(notif).not.toBeNull();
    });
});
