const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Date Range Filter', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'datefilter@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'datefilter@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/v1/tasks with date_field and date_from/date_to', () => {
        beforeEach(async () => {
            // Task due March 5
            await Task.create({
                name: 'March 5 task',
                user_id: user.id,
                due_date: new Date('2025-03-05T12:00:00Z'),
                status: 0,
            });
            // Task due March 10
            await Task.create({
                name: 'March 10 task',
                user_id: user.id,
                due_date: new Date('2025-03-10T12:00:00Z'),
                status: 0,
            });
            // Task due April 1
            await Task.create({
                name: 'April 1 task',
                user_id: user.id,
                due_date: new Date('2025-04-01T12:00:00Z'),
                status: 0,
            });
            // Task with no due date
            await Task.create({
                name: 'No due date task',
                user_id: user.id,
                due_date: null,
                status: 0,
            });
        });

        it('should filter tasks by due_date range', async () => {
            const res = await agent.get(
                '/api/v1/tasks?date_field=due_date&date_from=2025-03-01&date_to=2025-03-15'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('March 5 task');
            expect(names).toContain('March 10 task');
            expect(names).not.toContain('April 1 task');
            expect(names).not.toContain('No due date task');
        });

        it('should filter with date_from only', async () => {
            const res = await agent.get(
                '/api/v1/tasks?date_field=due_date&date_from=2025-03-10'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('March 10 task');
            expect(names).toContain('April 1 task');
            expect(names).not.toContain('March 5 task');
            expect(names).not.toContain('No due date task');
        });

        it('should filter with date_to only', async () => {
            const res = await agent.get(
                '/api/v1/tasks?date_field=due_date&date_to=2025-03-07'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('March 5 task');
            expect(names).not.toContain('March 10 task');
            expect(names).not.toContain('No due date task');
        });

        it('should filter by created_at field', async () => {
            const res = await agent.get(
                '/api/v1/tasks?date_field=created_at&date_from=2020-01-01&date_to=2030-12-31'
            );
            expect(res.status).toBe(200);
            // All tasks created within this wide range
            expect(res.body.tasks.length).toBe(4);
        });

        it('should filter by completed_at field', async () => {
            // Complete a task first
            const task = await Task.findOne({ where: { name: 'March 5 task' } });
            await task.update({
                status: 2,
                completed_at: new Date('2025-03-06T10:00:00Z'),
            });

            const res = await agent.get(
                '/api/v1/tasks?date_field=completed_at&date_from=2025-03-01&date_to=2025-03-10&status=completed'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('March 5 task');
            expect(names.length).toBe(1);
        });

        it('should ignore invalid date_field values', async () => {
            const res = await agent.get(
                '/api/v1/tasks?date_field=invalid_field&date_from=2025-03-01'
            );
            expect(res.status).toBe(200);
            // Should return all tasks (filter not applied)
            expect(res.body.tasks.length).toBe(4);
        });

        it('should work together with status filter', async () => {
            const task = await Task.findOne({ where: { name: 'March 5 task' } });
            await task.update({ status: 2 });

            const res = await agent.get(
                '/api/v1/tasks?date_field=due_date&date_from=2025-03-01&date_to=2025-03-15&status=active'
            );
            expect(res.status).toBe(200);
            const names = res.body.tasks.map((t) => t.name);
            expect(names).toContain('March 10 task');
            expect(names).not.toContain('March 5 task');
        });
    });
});
