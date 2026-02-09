const request = require('supertest');
const app = require('../../../app');
const {
    Task,
    Tag,
    Project,
    Role,
    Permission,
    sequelize,
} = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('Task assignment/unassignment preserves associations', () => {
    let owner, assignee;
    let ownerAgent;
    let task, subtask, tag, project;

    beforeEach(async () => {
        const timestamp = Date.now();
        owner = await createTestUser({
            email: `owner-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Owner',
        });
        assignee = await createTestUser({
            email: `assignee-${timestamp}@test.com`,
            name: 'Task',
            surname: 'Assignee',
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: owner.id,
        });

        task = await Task.create({
            name: 'Parent Task',
            user_id: owner.id,
            project_id: project.id,
        });

        subtask = await Task.create({
            name: 'Child Subtask',
            user_id: owner.id,
            parent_task_id: task.id,
        });

        tag = await Tag.create({ name: `tag-${timestamp}`, user_id: owner.id });
        await task.addTag(tag);

        ownerAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
    });

    afterEach(async () => {
        const userIds = [owner.id, assignee.id];

        await Permission.destroy({ where: { user_id: userIds } });
        await sequelize.query(
            `DELETE FROM tasks_subscribers WHERE user_id IN (:userIds)`,
            { replacements: { userIds } }
        );
        await sequelize.query(
            `DELETE FROM tasks_tags WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (:userIds))`,
            { replacements: { userIds } }
        );
        await Task.destroy({ where: { user_id: userIds }, force: true });
        await Tag.destroy({ where: { user_id: owner.id } });
        await Project.destroy({ where: { user_id: owner.id }, force: true });
        await Role.destroy({ where: { user_id: userIds } });
    });

    it('should preserve subtasks, tags, and project when assigning a task', async () => {
        const res = await ownerAgent
            .post(`/api/task/${task.uid}/assign`)
            .send({ assigned_to_user_id: assignee.id });

        expect(res.status).toBe(200);
        expect(res.body.AssignedTo).toBeDefined();
        expect(res.body.AssignedTo.id).toBe(assignee.id);
        expect(res.body.subtasks).toHaveLength(1);
        expect(res.body.subtasks[0].name).toBe('Child Subtask');
        expect(res.body.tags).toHaveLength(1);
        expect(res.body.tags[0].name).toBe(tag.name);
        expect(res.body.Project).toBeDefined();
        expect(res.body.Project.name).toBe('Test Project');
    });

    it('should preserve subtasks, tags, and project when unassigning a task', async () => {
        // First assign
        await ownerAgent
            .post(`/api/task/${task.uid}/assign`)
            .send({ assigned_to_user_id: assignee.id });

        // Then unassign
        const res = await ownerAgent.post(`/api/task/${task.uid}/unassign`);

        expect(res.status).toBe(200);
        expect(res.body.AssignedTo).toBeNull();
        expect(res.body.subtasks).toHaveLength(1);
        expect(res.body.subtasks[0].name).toBe('Child Subtask');
        expect(res.body.tags).toHaveLength(1);
        expect(res.body.tags[0].name).toBe(tag.name);
        expect(res.body.Project).toBeDefined();
        expect(res.body.Project.name).toBe('Test Project');
    });

    it('should preserve subtasks when updating a task via PATCH', async () => {
        const res = await ownerAgent
            .patch(`/api/task/${task.uid}`)
            .send({ name: 'Updated Parent Task' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Parent Task');
        expect(res.body.subtasks).toHaveLength(1);
        expect(res.body.subtasks[0].name).toBe('Child Subtask');
        expect(res.body.tags).toHaveLength(1);
        expect(res.body.Project).toBeDefined();
    });
});
