const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

describe('Department Member Project Visibility', () => {
    const uniqueEmail = (prefix) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;

    async function loginAgent(email) {
        const agent = request.agent(app);
        await agent.post('/api/login').send({ email, password: 'password123' });
        return agent;
    }

    async function addAreaMember(areaId, userId, role = 'member') {
        await sequelize.query(
            `INSERT INTO areas_members (area_id, user_id, role, created_at, updated_at)
             VALUES (:areaId, :userId, :role, datetime('now'), datetime('now'))`,
            {
                replacements: { areaId, userId, role },
                type: QueryTypes.INSERT,
            }
        );
    }

    function uidSlug(project) {
        return `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;
    }

    let member, projectOwner, department, memberAgent;

    beforeEach(async () => {
        member = await createTestUser({ email: uniqueEmail('member') });
        projectOwner = await createTestUser({
            email: uniqueEmail('projowner'),
        });

        department = await Area.create({
            name: 'Test Department',
            user_id: projectOwner.id,
        });

        await addAreaMember(department.id, member.id, 'member');

        memberAgent = await loginAgent(member.email);
    });

    it('member sees project where they own a task', async () => {
        const project = await Project.create({
            name: 'Owner Project With Member Task',
            user_id: projectOwner.id,
        });

        await Task.create({
            name: 'Member Owned Task',
            user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('member sees project where they are assigned a task', async () => {
        const project = await Project.create({
            name: 'Owner Project With Assigned Task',
            user_id: projectOwner.id,
        });

        await Task.create({
            name: 'Assigned To Member',
            user_id: projectOwner.id,
            assigned_to_user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('member does NOT see department project with no task connection', async () => {
        const project = await Project.create({
            name: 'Department Project',
            user_id: projectOwner.id,
            area_id: department.id,
        });

        await Task.create({
            name: 'Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).not.toContain(project.uid);
    });

    it('member does NOT see project with no connection', async () => {
        const outsider = await createTestUser({
            email: uniqueEmail('outsider'),
        });
        const unrelatedProject = await Project.create({
            name: 'Completely Unrelated Project',
            user_id: outsider.id,
        });

        const res = await memberAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).not.toContain(unrelatedProject.uid);
    });

    it('member cannot access detail page of department project with no task connection', async () => {
        const project = await Project.create({
            name: 'No Task Connection Project',
            user_id: projectOwner.id,
            area_id: department.id,
        });

        await Task.create({
            name: 'Owner Only Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        const res = await memberAgent.get(`/api/project/${uidSlug(project)}`);
        expect(res.status).toBe(403);
    });

    it('member can access detail page of project they have tasks in', async () => {
        const project = await Project.create({
            name: 'Accessible Project',
            user_id: projectOwner.id,
        });

        await Task.create({
            name: 'Member Task In Project',
            user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get(`/api/project/${uidSlug(project)}`);
        expect(res.status).toBe(200);
        expect(res.body.uid).toBe(project.uid);
    });

    it('member sees ALL tasks on project detail page', async () => {
        const project = await Project.create({
            name: 'Full Visibility Project',
            user_id: projectOwner.id,
        });

        await Task.create({
            name: 'Owner Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        await Task.create({
            name: 'Member Assigned Task',
            user_id: projectOwner.id,
            assigned_to_user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent.get(`/api/project/${uidSlug(project)}`);
        expect(res.status).toBe(200);

        const taskNames = res.body.Tasks.map((t) => t.name);
        expect(taskNames).toContain('Owner Task');
        expect(taskNames).toContain('Member Assigned Task');
    });

    it('member can edit tasks in projects they have access to', async () => {
        const project = await Project.create({
            name: 'Editable Via Access Project',
            user_id: projectOwner.id,
        });

        const ownerTask = await Task.create({
            name: 'Owner Only Task',
            user_id: projectOwner.id,
            project_id: project.id,
        });

        await Task.create({
            name: 'Member Access Task',
            user_id: projectOwner.id,
            assigned_to_user_id: member.id,
            project_id: project.id,
        });

        const res = await memberAgent
            .patch(`/api/task/${ownerTask.uid}`)
            .send({ name: 'Updated By Member' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated By Member');
    });
});
