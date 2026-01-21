const { Task, Project, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    getTaskMetrics,
} = require('../../routes/tasks/queries/metrics-computation');

const dayFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

describe('Task Metrics Suggested Tasks', () => {
    let user;

    const createTask = async (overrides = {}) => {
        const { priority, status, ...rest } = overrides;
        return await Task.create({
            name: rest.name || 'Suggested task',
            user_id: user.id,
            status:
                typeof status === 'string'
                    ? Task.getStatusValue(status)
                    : (status ?? Task.STATUS.NOT_STARTED),
            today: false,
            priority:
                typeof priority === 'string'
                    ? Task.getPriorityValue(priority)
                    : (priority ?? Task.PRIORITY.LOW),
            parent_task_id: null,
            recurring_parent_id: null,
            ...rest,
        });
    };

    beforeEach(async () => {
        user = await createTestUser({ email: 'metrics@example.com' });
    });

    it('orders suggested tasks by priority, due date, and project', async () => {
        const projectAlpha = await Project.create({
            name: 'Alpha Project',
            user_id: user.id,
        });
        const projectBeta = await Project.create({
            name: 'Beta Project',
            user_id: user.id,
        });

        await createTask({
            name: 'High Due Later',
            priority: 'high',
            due_date: dayFromNow(3),
            project_id: projectBeta.id,
        });
        await createTask({
            name: 'High Due Soon',
            priority: 'high',
            due_date: dayFromNow(1),
            project_id: projectAlpha.id,
        });
        await createTask({
            name: 'Medium Alpha',
            priority: 'medium',
            due_date: dayFromNow(4),
            project_id: projectAlpha.id,
        });
        await createTask({
            name: 'Medium Beta',
            priority: 'medium',
            due_date: dayFromNow(4),
            project_id: projectBeta.id,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const names = metrics.suggested_tasks.map((task) => task.name);
        expect(names).toEqual([
            'High Due Soon',
            'High Due Later',
            'Medium Alpha',
            'Medium Beta',
        ]);
    });

    it('excludes tasks deferred into the future from suggested results', async () => {
        await createTask({ name: 'Ready Task', priority: 'high' });
        await createTask({
            name: 'Deferred Past Task',
            defer_until: dayFromNow(-1),
        });
        await createTask({
            name: 'Deferred Future Task',
            defer_until: dayFromNow(2),
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const names = metrics.suggested_tasks.map((task) => task.name);
        expect(names).toContain('Ready Task');
        expect(names).toContain('Deferred Past Task');
        expect(names).not.toContain('Deferred Future Task');
    });

    it('only suggests tasks owned by or assigned to the user', async () => {
        // Create another user who owns some tasks
        const otherUser = await createTestUser({
            email: 'other-user@example.com',
        });

        // Create a project owned by otherUser and share it with main user
        const sharedProject = await Project.create({
            name: 'Shared Project',
            user_id: otherUser.id,
        });

        // Share the project with the main user
        await Permission.create({
            user_id: user.id,
            resource_type: 'project',
            resource_uid: sharedProject.uid,
            access_level: 'rw',
            granted_by_user_id: otherUser.id,
        });

        // Create tasks owned by the main user (should be suggested)
        await createTask({ name: 'My Own Task', priority: 'high' });

        // Create a task owned by otherUser but assigned to main user (should be suggested)
        await Task.create({
            name: 'Assigned To Me',
            user_id: otherUser.id,
            assigned_to_user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.HIGH,
            today: false,
            parent_task_id: null,
            recurring_parent_id: null,
        });

        // Create a task in the shared project owned by otherUser (should NOT be suggested)
        await Task.create({
            name: 'Task In Shared Project',
            user_id: otherUser.id,
            project_id: sharedProject.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.HIGH,
            today: false,
            parent_task_id: null,
            recurring_parent_id: null,
        });

        // Create a task owned by otherUser with no relation to main user (should NOT be suggested)
        await Task.create({
            name: 'Other User Task',
            user_id: otherUser.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.HIGH,
            today: false,
            parent_task_id: null,
            recurring_parent_id: null,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const names = metrics.suggested_tasks.map((task) => task.name);

        // Should include tasks owned by user
        expect(names).toContain('My Own Task');

        // Should include tasks assigned to user
        expect(names).toContain('Assigned To Me');

        // Should NOT include tasks from shared projects that user doesn't own/isn't assigned to
        expect(names).not.toContain('Task In Shared Project');

        // Should NOT include other user's tasks
        expect(names).not.toContain('Other User Task');
    });
});
