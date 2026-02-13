const request = require('supertest');
const app = require('../../app');
const { Project, Task, Area, sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { createTestUser } = require('../helpers/testUtils');

describe('Department Admin Project Visibility', () => {
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

    let deptAdmin, deptMember, outsider, department, deptAdminAgent;

    beforeEach(async () => {
        deptAdmin = await createTestUser({
            email: uniqueEmail('deptadmin'),
        });

        deptMember = await createTestUser({
            email: uniqueEmail('deptmember'),
        });

        outsider = await createTestUser({ email: uniqueEmail('outsider') });

        department = await Area.create({
            name: 'Test Department',
            user_id: deptAdmin.id,
        });

        await addAreaMember(department.id, deptAdmin.id, 'admin');
        await addAreaMember(department.id, deptMember.id, 'member');

        deptAdminAgent = await loginAgent(deptAdmin.email);
    });

    it('dept admin sees projects assigned to their department', async () => {
        const project = await Project.create({
            name: 'Department Project',
            user_id: outsider.id,
            area_id: department.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('dept admin sees projects they created', async () => {
        const project = await Project.create({
            name: 'My Own Project',
            user_id: deptAdmin.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('dept admin sees projects where dept members have tasks (assigned)', async () => {
        const project = await Project.create({
            name: 'External Project With Assigned Member Task',
            user_id: outsider.id,
        });

        await Task.create({
            name: 'Task Assigned To Dept Member',
            user_id: outsider.id,
            assigned_to_user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('dept admin does NOT see projects in other department', async () => {
        const otherDepartment = await Area.create({
            name: 'Other Department',
            user_id: outsider.id,
        });

        const project = await Project.create({
            name: 'External Project With Assigned Member Task',
            user_id: outsider.id,
            area_id: otherDepartment.id,
        });

        await Task.create({
            name: 'Task Assigned To Dept Member',
            user_id: outsider.id,
            assigned_to_user_id: outsider.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).not.toContain(project.uid);
    });

    it('dept admin sees projects where dept members have tasks (owned)', async () => {
        const project = await Project.create({
            name: 'External Project With Owned Member Task',
            user_id: outsider.id,
        });

        await Task.create({
            name: 'Task Owned By Dept Member',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).toContain(project.uid);
    });

    it('dept admin does NOT see projects with no dept connection', async () => {
        const project = await Project.create({
            name: 'Completely Unrelated Project',
            user_id: outsider.id,
        });

        await Task.create({
            name: 'Outsider Only Task',
            user_id: outsider.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.get('/api/projects');
        expect(res.status).toBe(200);

        const projectUids = res.body.projects.map((p) => p.uid);
        expect(projectUids).not.toContain(project.uid);
    });

    it('dept admin can access detail page of project their member has tasks in', async () => {
        const project = await Project.create({
            name: 'Member Task Project',
            user_id: outsider.id,
        });

        await Task.create({
            name: 'Dept Member Task In Project',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const uidSlug = `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;

        const res = await deptAdminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
        expect(res.body.uid).toBe(project.uid);
    });

    it('dept admin sees ALL tasks on project detail page', async () => {
        const project = await Project.create({
            name: 'Full Visibility Project',
            user_id: outsider.id,
        });

        const outsiderTask = await Task.create({
            name: 'Outsider Task In Project',
            user_id: outsider.id,
            project_id: project.id,
        });

        const memberTask = await Task.create({
            name: 'Member Task In Project',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const adminTask = await Task.create({
            name: 'Admin Task In Project',
            user_id: deptAdmin.id,
            project_id: project.id,
        });

        const uidSlug = `${project.uid}-${project.name.toLowerCase().replace(/\s+/g, '-')}`;

        const res = await deptAdminAgent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);

        const taskNames = res.body.Tasks.map((t) => t.name);
        expect(taskNames).toContain('Outsider Task In Project');
        expect(taskNames).toContain('Member Task In Project');
        expect(taskNames).toContain('Admin Task In Project');
    });

    it('dept admin can create tasks in department project', async () => {
        const project = await Project.create({
            name: 'Dept Project For Task Creation',
            user_id: outsider.id,
            area_id: department.id,
        });

        const res = await deptAdminAgent.post('/api/task').send({
            name: 'Task Created By Dept Admin',
            project_id: project.id,
        });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Task Created By Dept Admin');
        expect(res.body.project_id).toBe(project.id);
    });

    it('dept admin can create tasks in project where member has tasks', async () => {
        const project = await Project.create({
            name: 'Member Task Project For Creation',
            user_id: outsider.id,
        });

        await Task.create({
            name: 'Existing Member Task',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent.post('/api/task').send({
            name: 'Task Created By Dept Admin Via Member',
            project_id: project.id,
        });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Task Created By Dept Admin Via Member');
        expect(res.body.project_id).toBe(project.id);
    });

    it('dept admin has read-only access to tasks they do not own', async () => {
        const project = await Project.create({
            name: 'Read Only Test Project',
            user_id: outsider.id,
        });

        const memberTask = await Task.create({
            name: 'Member Task For RO Test',
            user_id: deptMember.id,
            project_id: project.id,
        });

        const res = await deptAdminAgent
            .patch(`/api/task/${memberTask.uid}`)
            .send({ name: 'Attempted Edit By Dept Admin' });

        expect(res.status).toBe(403);

        const unchangedTask = await Task.findByPk(memberTask.id);
        expect(unchangedTask.name).toBe('Member Task For RO Test');
    });
});
