# Task.Subemo User Guide

## Introduction

Task.Subemo is a task management application that helps teams organize work across departments, projects, and workspaces. You can create tasks, assign them to team members, group them into projects, and use departments to manage team-level visibility and permissions.

## Core Concepts

### Departments

A department represents departments inside Subemo. Each department have **admins** and **members**.

- Departments own projects — when you assign a project to a department, all department admins can see and manage it.
- Each user can only belong to **one department at a time**. If you need to move someone to a different department, they must be removed from their current one first.
- Department admins are automatically subscribed to the department tasks, which means they receive notifications and can see tasks created by department members.

### Workspaces

A workspace is a top-level container for organizing projects. You create a workspace to group related projects together — for example, by client, initiative, or product line.

- You can see any workspace you created, that contains projects you have access to, or that contains projects accessible through your department admin role.
- Projects inside a workspace are not automatically visible to everyone — access depends on the project's department, and your task assignments.

### Projects

A project is a collection of tasks. Projects can optionally belong to a department and/or a workspace.

- If a project belongs to a department, all admins of that department have full access to it.
- You can see a project if you own it, have tasks in it, are subscribed to tasks in it, or if it belongs to a department where you are an admin.

### Tasks

A task is an individual work item. Tasks can belong to a project and be assigned to a specific user.

- Tasks support subtasks (nested child tasks), attachments, and recurrence (repeating on a schedule).
- You can see a task if you created it, are assigned to it, are subscribed to it, or have access through its parent project.
- Only the task owner or a system admin can delete a task.

## Subscribers

Subscribing connects you to a task so you can follow its activity.

### Department Subscribers

When a user subscribes to a department, they are automatically subscribed to new tasks created by members of that department. This helps department admins and interested stakeholders stay informed without needing to be assigned to every task.

- Department admins are **automatically subscribed** when they are added or promoted to the admin role.
- If an admin is demoted to member, their auto-subscription is removed (manual subscriptions are kept).
- Anyone with permission can also be manually added as a subscriber.

### Task Subscribers

When you subscribe to a task, you gain read-only access to it and its parent project. Subscribing is useful when you need visibility into a task without being responsible for completing it.

- Subscribing to a task also gives you read-only access to the project that task belongs to, including all other tasks in that project.
- You can unsubscribe from any task at any time, even if you were auto-subscribed.

## Entity Relationships

```
Workspace
  └── Project (optional workspace assignment)
        ├── belongs to Department (optional)
        └── Task
              ├── assigned to User (optional)
              ├── has Subtasks (child tasks)
              └── has Subscribers (users following the task)

Department
  ├── Owner (the user who created it)
  ├── Admins (manage members and projects)
  ├── Members (belong to the department)
  ├── Projects (department's projects)
  └── Subscribers (notified about new member tasks)

User
  ├── owns Tasks, Projects, Departments, Workspaces
  ├── is assigned to Tasks
  ├── is a member of one Department (max)
  └── subscribes to Tasks and Departments
```

## Roles and Permissions

### Department Roles

| Capability                        | Owner | Admin | Member |
| --------------------------------- | ----- | ----- | ------ |
| View department                   | Yes   | Yes   | Yes    |
| View all department projects      | Yes   | Yes   | No     |
| Edit department projects          | Yes   | Yes   | No     |
| View department members' tasks    | Yes   | Yes   | No     |
| Add or remove members             | Yes   | Yes   | No     |
| Change member roles               | Yes   | Yes   | No     |
| Manage department subscribers     | Yes   | Yes   | No     |
| Auto-subscribed to department     | No    | Yes   | No     |
| Delete the department             | Yes   | Yes   | No     |
| Transfer ownership (system admin) | —     | —     | —      |

> **Note:** The department owner is not listed in the members table — they are identified by the department's ownership record. Department admins have the same management capabilities as the owner, except they cannot delete the department.

### Project Access

| Relationship to Project                                  | Access Level      |
| -------------------------------------------------------- | ----------------- |
| You created the project                                  | Full (read/write) |
| You are an admin of the project's department             | Full (read/write) |
| You own or are assigned to a task in the project         | Full (read/write) |
| You are a dept admin whose members have tasks in project | Full (read/write) |
| You are subscribed to a task in the project              | Read-only         |
| The project was shared with you directly                 | Per share level   |
| System admin                                             | Full (admin)      |
| None of the above                                        | No access         |

### Task Access

| Relationship to Task                                    | Access Level      |
| ------------------------------------------------------- | ----------------- |
| You created the task                                    | Full (read/write) |
| You are assigned to the task                            | Full (read/write) |
| You are a dept admin and the task owner is in your dept | Read-only         |
| You have access through the parent project              | Inherited         |
| The task was shared with you directly                   | Per share level   |
| System admin                                            | Full (read/write) |
| None of the above                                       | No access         |

> **Inherited access:** If you can access a task's parent project, you get the same access level for the task. For example, if you have read-only access to the project (via subscription), you also get read-only access to tasks in that project.

## Important Rules

### Single-Department Membership

A user can only be a member of one department at a time. If you try to add someone who already belongs to another department, you will see an error. They must be removed from their current department before joining a new one.

### Ownership Transfer

If a system admin removes the owner of a department, ownership is automatically transferred to the admin who performed the removal. This ensures the department always has an owner.

### Auto-Subscription for Department Admins

When a user is added to a department as an admin (or promoted from member to admin), they are automatically subscribed to the department. This means they will be notified about new tasks created by department members. If an admin is later demoted to member, the automatic subscription is removed.

### System Admin Overrides

System admins have elevated access across the application:

- They can see and manage all workspaces, projects, and departments.
- For tasks, system admins get full read/write access (but not admin-level, to keep behavior consistent).
- System admins can transfer department ownership by removing the current owner.
- System admins can delete any task or project, regardless of ownership.
