const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Critical Priority API Validation', () => {
    let user;
    let agent;
    let assignee;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        assignee = await createTestUser({
            email: 'assignee@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/task - Create with critical priority', () => {
        it('should create critical task with due_date and assignee', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });

            expect(res.status).toBe(201);
            expect(res.body.priority).toBe(3);
        });

        it('should reject critical task without due_date', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
                assigned_to_user_id: assignee.id,
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject critical task without assignee', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
                due_date: '2026-01-20',
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject critical task missing both fields', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should allow non-critical priority without due_date and assignee', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Normal Task',
                priority: 1,
            });

            expect(res.status).toBe(201);
            expect(res.body.priority).toBe(1);
        });
    });

    describe('PATCH /api/task/:uid - Update to critical priority', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Regular Task',
                user_id: user.id,
                priority: 1,
            });
        });

        it('should update to critical when task has due_date and assignee', async () => {
            await task.update({
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });

            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ priority: 3 });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(3);
        });

        it('should reject update to critical without due_date', async () => {
            await task.update({ assigned_to_user_id: assignee.id });

            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ priority: 3 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject update to critical without assignee', async () => {
            await task.update({ due_date: '2026-01-20' });

            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ priority: 3 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should allow setting due_date and assignee together with critical', async () => {
            const res = await agent.patch(`/api/task/${task.uid}`).send({
                priority: 3,
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(3);
        });

        it('should allow updating non-critical task without due_date and assignee', async () => {
            const res = await agent.patch(`/api/task/${task.uid}`).send({
                priority: 2,
                name: 'Updated Name',
            });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(2);
        });
    });
});
