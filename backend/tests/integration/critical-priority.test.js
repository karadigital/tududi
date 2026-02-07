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

    describe('PATCH /api/task/:uid - Clearing fields on existing critical task', () => {
        let criticalTask;

        beforeEach(async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });
            criticalTask = res.body;
        });

        it('should reject clearing assigned_to_user_id on critical task', async () => {
            const res = await agent
                .patch(`/api/task/${criticalTask.uid}`)
                .send({ assigned_to_user_id: null });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject clearing due_date on critical task', async () => {
            const res = await agent
                .patch(`/api/task/${criticalTask.uid}`)
                .send({ due_date: null });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject clearing due_date (empty string) on critical task', async () => {
            const res = await agent
                .patch(`/api/task/${criticalTask.uid}`)
                .send({ due_date: '' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should reject clearing due_date on recurring critical task instead of auto-filling today', async () => {
            // Make the critical task recurring
            await agent.patch(`/api/task/${criticalTask.uid}`).send({
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });

            // Try to clear due_date — should be rejected, not silently changed to today
            const res = await agent
                .patch(`/api/task/${criticalTask.uid}`)
                .send({ due_date: null });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });
    });

    describe('POST /api/task/:uid/unassign - Critical task protection', () => {
        let criticalTask;

        beforeEach(async () => {
            const res = await agent.post('/api/task').send({
                name: 'Critical Task',
                priority: 3,
                due_date: '2026-01-20',
                assigned_to_user_id: assignee.id,
            });
            criticalTask = res.body;
        });

        it('should reject unassigning a critical task', async () => {
            const res = await agent.post(
                `/api/task/${criticalTask.uid}/unassign`
            );

            expect(res.status).toBe(400);
            expect(res.body.error).toBe(
                'Critical tasks must have a due date and assignee'
            );
        });

        it('should allow unassigning a non-critical task', async () => {
            // Create a non-critical assigned task
            const createRes = await agent.post('/api/task').send({
                name: 'Normal Task',
                priority: 1,
                assigned_to_user_id: assignee.id,
            });
            expect(createRes.status).toBe(201);

            const res = await agent.post(
                `/api/task/${createRes.body.uid}/unassign`
            );

            expect(res.status).toBe(200);
            expect(res.body.AssignedTo).toBeNull();
        });
    });
});
