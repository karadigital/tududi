# Workspace Feature Design

## Overview

A workspace is a collection of projects — similar to a tag but with its own entity. Workspaces are independent of areas/departments. Any authenticated user can create and manage workspaces. Visibility is derived: a user sees a workspace only if they have access to at least one project within it.

## Data Model

### New Table: `workspaces`

| Column       | Type    | Constraints                        |
|--------------|---------|------------------------------------|
| `id`         | INTEGER | PK, auto-increment                 |
| `uid`        | STRING  | NOT NULL, unique, indexed          |
| `name`       | STRING  | NOT NULL                           |
| `creator`    | INTEGER | FK → users.id, CASCADE             |
| `created_at` | DATE    | NOT NULL, default CURRENT_TIMESTAMP|
| `updated_at` | DATE    | NOT NULL, default CURRENT_TIMESTAMP|

### Projects Table Change

Add column: `workspace_id` (INTEGER, FK → workspaces.id, nullable, SET NULL on delete)

A project belongs to 0 or 1 workspace. Deleting a workspace orphans its projects.

## API Endpoints

### Workspace CRUD

| Method   | Path                      | Description                                              |
|----------|---------------------------|----------------------------------------------------------|
| `GET`    | `/api/v1/workspaces`      | List workspaces (only where user has ≥1 project access)  |
| `GET`    | `/api/v1/workspaces/:uid` | Get workspace with its projects                          |
| `POST`   | `/api/v1/workspace`       | Create workspace (any authenticated user)                |
| `PATCH`  | `/api/v1/workspace/:uid`  | Update workspace name                                    |
| `DELETE` | `/api/v1/workspace/:uid`  | Delete workspace (sets projects' workspace_id to NULL)   |

### Existing Endpoint Changes

- `GET /api/v1/projects` — accepts optional `workspace` (uid) query param to filter
- `POST /api/v1/project` and `PATCH /api/v1/project/:uid` — accept optional `workspace_id` field
- `GET /api/v1/tasks` — task serialization includes `Project.Workspace` data (name, uid)

## Frontend

### Routing

| Path                | Component              | Description                                       |
|---------------------|------------------------|---------------------------------------------------|
| `/workspaces`       | `Workspaces.tsx`       | List page — accessible workspaces                 |
| `/workspaces/:uid`  | `WorkspaceDetail.tsx`  | Projects list filtered by workspace               |

### Sidebar

New `SidebarWorkspaces.tsx` component:
- Placed between Projects and Departments sections
- Shows "Workspaces" label with icon, clickable → `/workspaces`
- "+" button opens workspace creation modal
- Active state when path starts with `/workspaces`
- Follows exact pattern of `SidebarProjects.tsx`

### Workspace List Page

- Fetches `GET /workspaces`
- Displays workspace cards/rows with name
- Click → `/workspaces/:uid`
- Create/edit/delete actions

### Workspace Detail Page

- Reuses existing Projects list component
- Passes `workspace=:uid` filter to projects fetch
- Header shows workspace name

### Zustand Store

New `workspacesStore` slice:
```typescript
interface WorkspacesStore {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  isError: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (isError: boolean) => void;
}
```

### Task Grouping (All Tasks Page)

Two new options in the `groupBy` dropdown:

1. **"Workspace"** (`groupBy: 'workspace'`)
   - Groups tasks by their project's workspace
   - "No workspace" group for tasks without one
   - Group header: workspace name + task count

2. **"Workspace & Project"** (`groupBy: 'workspace_project'`)
   - Two-level grouping: workspace → project
   - Project subgroup headers prefixed with 4 spaces ("    ")
   - "No workspace" group for tasks without one, subgrouped by project

Data source: workspace info enriched in task API response via `Project.Workspace` include.

### Component Reuse

- Workspace detail page reuses the Projects list component (filtered)
- Task grouping reuses `GroupedTaskList.tsx` with new grouping branches
- Sidebar section follows `SidebarProjects.tsx` pattern exactly
- Modal for create/edit follows existing modal patterns

## Access Control

- **Create/edit/delete workspaces:** Any authenticated user
- **Workspace visibility:** Derived from project access — user sees a workspace if they can access ≥1 project in it
- **Assign projects to workspace:** Via project create/edit (workspace_id field)

## Commit Prefixes

- `[ASID-854]` — Workspace sidebar
- `[ASID-857]` — Workspace project list page (detail page)
- `[ASID-858]` — All other workspace commits (model, API, task grouping, etc.)
