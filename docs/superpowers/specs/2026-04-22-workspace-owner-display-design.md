# Workspace Owner Display — Design

**Date:** 2026-04-22
**Status:** Approved (pending user review of this spec)

## Problem

Workspace names may be similar or duplicated across operational usage. Users cannot distinguish which workspace is which without opening the detail page. Misassignment risk on project-related surfaces.

## Goal

Show the workspace owner (the user who created it) alongside the workspace name on every surface where a workspace appears in project-related UI, so users can disambiguate at a glance.

## Non-goals

- Changing who is considered the "owner" (stays = `Workspace.creator` FK).
- Changing sort or search behavior (still keyed on workspace name only).
- Adding owner fields to workspace editing, permissions, or sharing flows.
- Handling empty workspace names (DB enforces `NOT NULL`; not a real case).

## Acceptance criteria (from user)

1. Workspace display shows owner name together with workspace name in all three target surfaces (see Scope).
2. Format:
   - Stacked on list cards and detail header: `Workspace Name` / `Owner Email`.
   - Inline on `ProjectBanner` badge: `Workspace Name · owner@email.com`.
3. Uses actual stored owner value (User.email), not a row index or placeholder.
4. If owner email is unavailable due to system failure, workspace name still renders; action not blocked; error logged to console (no visible user message).
5. Sorting and searching behavior on workspace lists continues to work using workspace name.
6. Existing workspace data is unchanged (no migration needed).

## Decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | Owner name source = `User.email` only | User picked B over `name+surname`, name-with-fallback, other |
| D2 | Surfaces in scope: Workspaces list, WorkspaceDetail header, ProjectBanner badge | User confirmed "That's it" |
| D3 | Banner layout: inline with `·` separator | User picked B over stacked/secondary-text/tooltip |
| D4 | Empty workspace name AC: dropped | User picked C (not a real case) |
| D5 | Error fallback: `console.log` only, no visible message | User said "Add to console log" |
| D6 | Backend approach: raw SQL JOIN (existing pattern) | User picked A over full ORM conversion or frontend join |

## Architecture

Workspace payload gains one new field: `owner_email: string | null`.

Populated server-side using the existing Sequelize association `Workspace.belongsTo(User, { foreignKey: 'creator', as: 'Creator' })` (in `backend/models/index.js`). No new associations, no migration.

Flatten server-side so frontend never sees `Creator` nesting — consistent shape across all endpoints that return a workspace (standalone list, detail, and nested inside a project).

Data flow:

```
DB: workspaces.creator → users.id
      │
      ▼
Backend routes: JOIN / include users, select email as owner_email
      │
      ▼
Response: { uid, name, owner_email, is_creator, my_project_count, ... }
      │
      ▼
Frontend Workspace entity: owner_email?: string
      │
      ▼
Render surfaces: Workspaces.tsx · WorkspaceDetail.tsx · ProjectBanner.tsx
```

## Backend changes

### `backend/routes/workspaces.js`

**`GET /workspaces`** — raw SQL, both conditional branches (with and without `safeMemberIds`):

Add `LEFT JOIN users u ON u.id = w.creator` and select `u.email AS owner_email`.

Example (non-member branch):
```sql
SELECT w.uid, w.name, w.creator, w.created_at,
       u.email AS owner_email,
       (SELECT COUNT(*) FROM projects
        WHERE projects.workspace_id = w.id
        AND projects.user_id = :userId) AS my_project_count
FROM workspaces w
LEFT JOIN users u ON u.id = w.creator
WHERE w.id IN (:workspaceIds)
ORDER BY w.name ASC
```

The map step that produces `is_creator` preserves `owner_email` in the returned object.

**`GET /workspaces/:uid`** — Sequelize `findOne`:

```js
include: [{ model: User, as: 'Creator', attributes: ['email'] }]
```

Flatten before responding so shape is `{ ..., owner_email: workspace.Creator?.email ?? null }`.

### `backend/routes/projects.js`

Every `include: { model: Workspace }` is extended:

```js
include: {
    model: Workspace,
    include: [{ model: User, as: 'Creator', attributes: ['email'] }],
}
```

Before serializing the project response, flatten `project.Workspace.Creator.email` → `project.Workspace.owner_email` and strip `Creator` from the payload. Locations: lines around 299, 509, 805 (and any other project read paths).

Rationale for `LEFT JOIN` and optional-chain flattening: creator FK is NOT NULL, but defense-in-depth against orphan rows keeps the workspace visible with `owner_email = null` rather than hiding it.

## Frontend changes

### `frontend/entities/Workspace.ts`

```ts
export interface Workspace {
    id?: number;
    uid?: string;
    name: string;
    owner_email?: string;
    is_creator?: boolean;
    my_project_count?: number;
    created_at?: string;
    updated_at?: string;
}
```

Wherever `project.Workspace` is typed, ensure `owner_email` propagates (should inherit via shared type, but verify in `frontend/entities/Project.ts`).

### Render surface 1 — `Workspaces.tsx` (list cards)

Replace the single-line `{workspace.name}` with a stacked block:
```tsx
<div className="flex flex-col">
    <span className="font-medium">{workspace.name}</span>
    {workspace.owner_email && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {workspace.owner_email}
        </span>
    )}
</div>
```

### Render surface 2 — `WorkspaceDetail.tsx` (header)

Same stacked treatment: name stays as the primary heading, email renders as a subdued subtitle directly beneath.

### Render surface 3 — `ProjectBanner.tsx` (inline badge)

Badge stays single-line. Append `· owner_email` when present:
```tsx
{project.Workspace!.name}
{project.Workspace!.owner_email && (
    <>{` · ${project.Workspace!.owner_email}`}</>
)}
```

### Missing-owner handling (all 3 surfaces)

When `owner_email` is missing/null: render workspace name only, log once to console:
```ts
console.log('Workspace owner email unavailable', { uid: workspace.uid });
```
No toast, no inline error text, no blocked action.

## Error handling summary

| Case | Behavior |
|------|----------|
| DB error fetching workspaces | Existing 500 + existing error toast; no new handling |
| Orphan `creator` FK (should not happen) | `LEFT JOIN` keeps workspace visible with `owner_email = null`; frontend omits email; `console.log` |
| `project.Workspace` null (project with no workspace) | Existing `{project.Workspace && (...)}` guard continues to work |

## Testing

### Backend (`backend/tests/integration/workspaces.test.js`)

- `GET /workspaces` returns `owner_email` equal to creator's email for each workspace in both branches (with and without `safeMemberIds`).
- `GET /workspaces/:uid` returns `owner_email` equal to creator's email.
- Sort assertion: response is still ordered by `name ASC` after the JOIN.

### Backend (`backend/tests/integration/projects.test.js` or equivalent)

- `GET /projects` and `GET /projects/:uid` return `project.Workspace.owner_email` when a workspace is attached.
- No `Creator` key leaks into serialized response.

### Frontend

- `Workspaces.tsx`: renders email under name when `owner_email` present; renders only name when missing without crashing.
- `WorkspaceDetail.tsx`: same two cases.
- `ProjectBanner.tsx`: renders `Name · email` when present, just `Name` when missing.
- Existing snapshot tests updated if they include workspace rendering.

### E2E

None. Pure display change; existing flows unaffected.

### Flake note

`workspaces.test.js` is flaky in parallel (per project memory). Co-locate new assertions in the existing file and use the isolation workaround already in place.

## Rollout

- No migration; no data backfill.
- Change is additive on the API (new optional field); old clients unaffected.
- Feature-flag not required.

## Done criteria

- Owner email visibly rendered beside workspace name on all three surfaces.
- Users can distinguish similar workspace names without opening detail pages.
- Existing workspace data unchanged.
- Sorting and searching behavior verified unchanged.
- Tests pass (`npm test` and `npm run frontend:test`).
- Lint + format clean.
