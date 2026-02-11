const request = require('supertest');
const app = require('../../app');
const {
    Project,
    User,
    Area,
    Task,
    Note,
    Permission,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Projects Routes', () => {
    let user, area, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        area = await Area.create({
            name: 'Work',
            user_id: user.id,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/project', () => {
        it('should create a new project', async () => {
            const projectData = {
                name: 'Test Project',
                description: 'Test Description',
                state: 'planned',
                priority: 1,
                area_id: area.id,
            };

            const response = await agent.post('/api/project').send(projectData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(projectData.name);
            expect(response.body.description).toBe(projectData.description);
            expect(response.body.state).toBe(projectData.state);
            expect(response.body.pin_to_sidebar).toBe(false);
            expect(response.body.priority).toBe(projectData.priority);
            expect(response.body.area_id).toBe(area.id);
            expect(response.body.user_id).toBe(user.id);
        });

        it('should require authentication', async () => {
            const projectData = {
                name: 'Test Project',
            };

            const response = await request(app)
                .post('/api/project')
                .send(projectData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require project name', async () => {
            const projectData = {
                description: 'Project without name',
            };

            const response = await agent.post('/api/project').send(projectData);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/projects', () => {
        let project1, project2;

        beforeEach(async () => {
            project1 = await Project.create({
                name: 'Project 1',
                description: 'First project',
                user_id: user.id,
                area_id: area.id,
            });

            project2 = await Project.create({
                name: 'Project 2',
                description: 'Second project',
                user_id: user.id,
            });
        });

        it('should get all user projects', async () => {
            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            expect(response.body.projects).toBeDefined();
            expect(response.body.projects.length).toBe(2);
            expect(response.body.projects.map((p) => p.id)).toContain(
                project1.id
            );
            expect(response.body.projects.map((p) => p.id)).toContain(
                project2.id
            );
        });

        it('should include area information', async () => {
            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            const projectWithArea = response.body.projects.find(
                (p) => p.id === project1.id
            );
            expect(projectWithArea.Area).toBeDefined();
            expect(projectWithArea.Area.name).toBe(area.name);
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/projects');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                description: 'Test Description',
                user_id: user.id,
                area_id: area.id,
            });
        });

        it('should get project by uid-slug format', async () => {
            // Create a slug from the project UID and name
            const sluggedName = project.name.toLowerCase().replace(/\s+/g, '-');
            const uidSlug = `${project.uid}-${sluggedName}`;

            const response = await agent.get(`/api/project/${uidSlug}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(project.id);
            expect(response.body.name).toBe(project.name);
            expect(response.body.description).toBe(project.description);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent.get(
                '/api/project/nonexistent-uid-slug'
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found');
        });

        it("should not allow access to other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/project/${otherProject.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found');
        });

        it("should return 403 for other user's projects when accessed by uid-slug", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other2@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Secret Project',
                user_id: otherUser.id,
            });

            // Build proper uid-slug
            const sluggedName = otherProject.name
                .toLowerCase()
                .replace(/\s+/g, '-');
            const uidSlug = `${otherProject.uid}-${sluggedName}`;

            const response = await agent.get(`/api/project/${uidSlug}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                `/api/project/${project.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                description: 'Test Description',
                state: 'idea',
                priority: 0,
                user_id: user.id,
            });
        });

        it('should update project', async () => {
            const updateData = {
                name: 'Updated Project',
                description: 'Updated Description',
                state: 'in_progress',
                priority: 2,
            };

            const response = await agent
                .patch(`/api/project/${project.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.description).toBe(updateData.description);
            expect(response.body.state).toBe(updateData.state);
            expect(response.body.priority).toBe(updateData.priority);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent
                .patch('/api/project/nonexistentuid')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it("should not allow updating other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/project/${otherProject.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/project/${project.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/project/:id', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
            });
        });

        it('should delete project', async () => {
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();
        });

        it('should return 404 for non-existent project', async () => {
            const response = await agent.delete('/api/project/nonexistentuid');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Project not found.');
        });

        it("should not allow deleting other user's projects", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherProject = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const response = await agent.delete(
                `/api/project/${otherProject.uid}`
            );

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/project/${project.uid}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should delete project with associated tasks (orphan tasks)', async () => {
            // Create tasks associated with the project
            const task1 = await Task.create({
                name: 'Task 1',
                user_id: user.id,
                project_id: project.id,
                status: 0, // not_started
            });

            const task2 = await Task.create({
                name: 'Task 2',
                user_id: user.id,
                project_id: project.id,
                status: 2, // done/completed
            });

            // Delete the project
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();

            // Verify tasks are orphaned (project_id set to null) but still exist
            const orphanedTask1 = await Task.findByPk(task1.id);
            const orphanedTask2 = await Task.findByPk(task2.id);

            expect(orphanedTask1).not.toBeNull();
            expect(orphanedTask1.project_id).toBeNull();
            expect(orphanedTask1.name).toBe('Task 1');

            expect(orphanedTask2).not.toBeNull();
            expect(orphanedTask2.project_id).toBeNull();
            expect(orphanedTask2.name).toBe('Task 2');
        });

        it('should delete project with completed tasks only', async () => {
            // Create only completed tasks associated with the project
            const completedTask = await Task.create({
                name: 'Completed Task',
                user_id: user.id,
                project_id: project.id,
                status: 2, // done/completed
            });

            // Delete the project
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();

            // Verify completed task is orphaned but still exists
            const orphanedTask = await Task.findByPk(completedTask.id);
            expect(orphanedTask).not.toBeNull();
            expect(orphanedTask.project_id).toBeNull();
            expect(orphanedTask.status).toBe(2); // Still completed
        });

        it('should delete project with mixed status tasks', async () => {
            // Create tasks with different statuses
            const notStartedTask = await Task.create({
                name: 'Not Started Task',
                user_id: user.id,
                project_id: project.id,
                status: 0, // not_started
            });

            const inProgressTask = await Task.create({
                name: 'In Progress Task',
                user_id: user.id,
                project_id: project.id,
                status: 1, // in_progress
            });

            const completedTask = await Task.create({
                name: 'Completed Task',
                user_id: user.id,
                project_id: project.id,
                status: 2, // done/completed
            });

            // Delete the project
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();

            // Verify all tasks are orphaned but still exist with their original statuses
            const tasks = await Task.findAll({
                where: {
                    id: [
                        notStartedTask.id,
                        inProgressTask.id,
                        completedTask.id,
                    ],
                },
            });

            expect(tasks).toHaveLength(3);

            const taskById = {};
            tasks.forEach((task) => {
                taskById[task.id] = task;
                expect(task.project_id).toBeNull(); // All should be orphaned
            });

            expect(taskById[notStartedTask.id].status).toBe(0);
            expect(taskById[inProgressTask.id].status).toBe(1);
            expect(taskById[completedTask.id].status).toBe(2);
        });

        it('should delete project with associated notes (orphan notes)', async () => {
            // Create notes associated with the project
            const note1 = await Note.create({
                title: 'Note 1',
                content: 'Content for note 1',
                user_id: user.id,
                project_id: project.id,
            });

            const note2 = await Note.create({
                title: 'Note 2',
                content: 'Content for note 2',
                user_id: user.id,
                project_id: project.id,
            });

            const note3 = await Note.create({
                title: 'Note 3',
                content: 'Content for note 3',
                user_id: user.id,
                project_id: project.id,
            });

            // Delete the project
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();

            // Verify notes are orphaned (project_id set to null) but still exist
            const orphanedNote1 = await Note.findByPk(note1.id);
            const orphanedNote2 = await Note.findByPk(note2.id);
            const orphanedNote3 = await Note.findByPk(note3.id);

            expect(orphanedNote1).not.toBeNull();
            expect(orphanedNote1.project_id).toBeNull();
            expect(orphanedNote1.title).toBe('Note 1');
            expect(orphanedNote1.content).toBe('Content for note 1');

            expect(orphanedNote2).not.toBeNull();
            expect(orphanedNote2.project_id).toBeNull();
            expect(orphanedNote2.title).toBe('Note 2');

            expect(orphanedNote3).not.toBeNull();
            expect(orphanedNote3.project_id).toBeNull();
            expect(orphanedNote3.title).toBe('Note 3');
        });

        it('should delete project and its pins are cleaned up by CASCADE', async () => {
            // Pin the project first
            await sequelize.query(
                'INSERT INTO project_pins (project_id, user_id, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                { replacements: [project.id, user.id] }
            );

            const response = await agent.delete(`/api/project/${project.uid}`);
            expect(response.status).toBe(200);

            // Verify pin was cleaned up by CASCADE
            const [pins] = await sequelize.query(
                'SELECT * FROM project_pins WHERE project_id = ?',
                { replacements: [project.id] }
            );
            expect(pins.length).toBe(0);
        });

        it('should delete project with both tasks and notes (orphan both)', async () => {
            // Create tasks associated with the project
            const task = await Task.create({
                name: 'Task with project',
                user_id: user.id,
                project_id: project.id,
                status: 0,
            });

            // Create notes associated with the project
            const note = await Note.create({
                title: 'Note with project',
                content: 'This note belongs to a project',
                user_id: user.id,
                project_id: project.id,
            });

            // Delete the project
            const response = await agent.delete(`/api/project/${project.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Project successfully deleted');

            // Verify project is deleted
            const deletedProject = await Project.findByPk(project.id);
            expect(deletedProject).toBeNull();

            // Verify task is orphaned but still exists
            const orphanedTask = await Task.findByPk(task.id);
            expect(orphanedTask).not.toBeNull();
            expect(orphanedTask.project_id).toBeNull();
            expect(orphanedTask.name).toBe('Task with project');

            // Verify note is orphaned but still exists
            const orphanedNote = await Note.findByPk(note.id);
            expect(orphanedNote).not.toBeNull();
            expect(orphanedNote.project_id).toBeNull();
            expect(orphanedNote.title).toBe('Note with project');
            expect(orphanedNote.content).toBe('This note belongs to a project');
        });
    });

    describe('POST /api/project/:uid/pin', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Pinnable Project',
                user_id: user.id,
            });
        });

        it('should pin a project', async () => {
            const response = await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(200);
            expect(response.body.pin_to_sidebar).toBe(true);
        });

        it('should unpin a project', async () => {
            // Pin first
            await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            // Then unpin
            const response = await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: false });

            expect(response.status).toBe(200);
            expect(response.body.pin_to_sidebar).toBe(false);
        });

        it('should enforce max 5 pinned projects', async () => {
            // Create and pin 5 projects
            for (let i = 0; i < 5; i++) {
                const p = await Project.create({
                    name: `Pin Project ${i}`,
                    user_id: user.id,
                });
                await agent
                    .post(`/api/project/${p.uid}/pin`)
                    .send({ pinned: true });
            }

            // Try to pin a 6th
            const response = await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                'Maximum of 5 pinned projects allowed.'
            );
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(401);
        });

        it('should allow pinning the same project twice (idempotent)', async () => {
            await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            const response = await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(200);
            expect(response.body.pin_to_sidebar).toBe(true);
        });

        it('should allow re-pinning when at max limit (idempotent)', async () => {
            // Pin 5 projects including the test project
            const projects = [project];
            for (let i = 0; i < 4; i++) {
                projects.push(
                    await Project.create({
                        name: `Pin ${i}`,
                        user_id: user.id,
                    })
                );
            }
            for (const p of projects) {
                await agent
                    .post(`/api/project/${p.uid}/pin`)
                    .send({ pinned: true });
            }

            // Re-pin the first one — should succeed (idempotent, not a new pin)
            const response = await agent
                .post(`/api/project/${project.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(200);
            expect(response.body.pin_to_sidebar).toBe(true);
        });
    });

    describe('Per-user pin isolation', () => {
        let userB, agentB, sharedProject;

        beforeEach(async () => {
            // Create User B
            userB = await createTestUser({
                email: 'userb@example.com',
            });
            agentB = request.agent(app);
            await agentB.post('/api/login').send({
                email: 'userb@example.com',
                password: 'password123',
            });

            // Create a project owned by User A
            sharedProject = await Project.create({
                name: 'Shared Project',
                user_id: user.id,
            });

            // Share with User B (ro access)
            await Permission.create({
                user_id: userB.id,
                granted_by_user_id: user.id,
                resource_type: 'project',
                resource_uid: sharedProject.uid,
                access_level: 'ro',
            });
        });

        it('should isolate pin state between users', async () => {
            // User A pins the shared project
            const pinResponse = await agent
                .post(`/api/project/${sharedProject.uid}/pin`)
                .send({ pinned: true });
            expect(pinResponse.status).toBe(200);
            expect(pinResponse.body.pin_to_sidebar).toBe(true);

            // User A sees it pinned
            const userAProjects = await agent.get(
                '/api/projects?pin_to_sidebar=true'
            );
            expect(userAProjects.body.projects.length).toBe(1);
            expect(userAProjects.body.projects[0].id).toBe(sharedProject.id);

            // User B does NOT see it pinned
            const userBProjects = await agentB.get(
                '/api/projects?pin_to_sidebar=true'
            );
            expect(userBProjects.body.projects.length).toBe(0);
        });

        it('should allow both users to pin independently', async () => {
            // Both users pin the project
            await agent
                .post(`/api/project/${sharedProject.uid}/pin`)
                .send({ pinned: true });
            await agentB
                .post(`/api/project/${sharedProject.uid}/pin`)
                .send({ pinned: true });

            // User A unpins
            await agent
                .post(`/api/project/${sharedProject.uid}/pin`)
                .send({ pinned: false });

            // User A sees it unpinned
            const userADetail = await agent.get(
                `/api/project/${sharedProject.uid}`
            );
            expect(userADetail.body.pin_to_sidebar).toBe(false);

            // User B still sees it pinned
            const userBDetail = await agentB.get(
                `/api/project/${sharedProject.uid}`
            );
            expect(userBDetail.body.pin_to_sidebar).toBe(true);
        });

        it('should allow RO user on shared project to pin', async () => {
            const response = await agentB
                .post(`/api/project/${sharedProject.uid}/pin`)
                .send({ pinned: true });

            expect(response.status).toBe(200);
            expect(response.body.pin_to_sidebar).toBe(true);
        });
    });

    describe('GET /api/projects with pin_to_sidebar filter', () => {
        let pinnedProject, unpinnedProject;

        beforeEach(async () => {
            pinnedProject = await Project.create({
                name: 'Pinned Project',
                user_id: user.id,
            });
            unpinnedProject = await Project.create({
                name: 'Unpinned Project',
                user_id: user.id,
            });

            // Pin only the first project
            await agent
                .post(`/api/project/${pinnedProject.uid}/pin`)
                .send({ pinned: true });
        });

        it('should filter to only pinned projects', async () => {
            const response = await agent.get(
                '/api/projects?pin_to_sidebar=true'
            );

            expect(response.status).toBe(200);
            expect(response.body.projects.length).toBe(1);
            expect(response.body.projects[0].id).toBe(pinnedProject.id);
            expect(response.body.projects[0].pin_to_sidebar).toBe(true);
        });

        it('should filter to only unpinned projects', async () => {
            const response = await agent.get(
                '/api/projects?pin_to_sidebar=false'
            );

            expect(response.status).toBe(200);
            expect(response.body.projects.length).toBe(1);
            expect(response.body.projects[0].id).toBe(unpinnedProject.id);
            expect(response.body.projects[0].pin_to_sidebar).toBe(false);
        });

        it('should return all projects with pin state when no filter', async () => {
            const response = await agent.get('/api/projects');

            expect(response.status).toBe(200);
            expect(response.body.projects.length).toBe(2);

            const pinned = response.body.projects.find(
                (p) => p.id === pinnedProject.id
            );
            const unpinned = response.body.projects.find(
                (p) => p.id === unpinnedProject.id
            );
            expect(pinned.pin_to_sidebar).toBe(true);
            expect(unpinned.pin_to_sidebar).toBe(false);
        });
    });
});
