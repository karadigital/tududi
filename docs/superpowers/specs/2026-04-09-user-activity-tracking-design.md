# User Activity Tracking & Daily Report

**Date:** 2026-04-09
**Status:** Draft

## Overview

Track daily user activity in Tududi, classifying users as **active** (performed write operations on tasks or related resources), **passive** (visited the app but performed no write operations), or **inactive** (did not visit at all). Provide an admin dashboard for viewing activity trends and a daily email report sent to configurable recipients.

## Data Model

### UserActivity

One record per user per day. "Inactive" is the absence of a record.

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER, PK | Auto-increment |
| `user_id` | INTEGER, FK → User | The tracked user |
| `date` | DATEONLY | Activity date (e.g., `2026-04-09`) |
| `activity_type` | ENUM(`passive`, `active`) | Starts as `passive`, upgrades to `active` on write actions |
| `first_seen_at` | DATE | Timestamp of first request that day |
| `last_seen_at` | DATE | Timestamp of most recent request that day |
| `action_counts` | JSON | Breakdown: `{ tasks_created: 0, tasks_updated: 0, tasks_completed: 0, projects_created: 0, projects_updated: 0, areas_created: 0, areas_updated: 0, notes_created: 0, notes_updated: 0, tags_created: 0, tags_updated: 0 }` |

**Constraints:**
- Unique on `(user_id, date)`
- Indexes on `date` and `user_id`

### ActivityReportRecipient

Configurable email recipients for the daily report, managed through the admin UI.

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER, PK | Auto-increment |
| `email` | STRING, NOT NULL | Recipient email address |
| `enabled` | BOOLEAN, default `true` | Whether to send to this recipient |
| `added_by` | INTEGER, FK → User (SET NULL) | Admin who added it |
| `created_at` | DATE | Auto-managed |
| `updated_at` | DATE | Auto-managed |

## Middleware: Activity Tracker

**File:** `backend/middleware/activityTracker.js`

Runs after `requireAuth` on all authenticated routes. On every request:

1. Get today's date in the user's timezone (fall back to UTC).
2. Look up existing `UserActivity` record for `(user_id, date)` — using in-memory cache first.
3. If no record exists → create with `activity_type: 'passive'`, set `first_seen_at`.
4. Update `last_seen_at` on every request.
5. If the request is a write operation (POST/PUT/DELETE) on a tracked resource → upgrade `activity_type` to `active` and increment the relevant `action_counts` field.

### Tracked Resources

Write operations (POST/PUT/DELETE) on these route prefixes trigger `active` classification:

- `/api/v1/tasks`
- `/api/v1/projects`
- `/api/v1/areas`
- `/api/v1/notes`
- `/api/v1/tags`

### Performance

- **In-memory cache** (Map) keyed by `userId:date` stores the current `activity_type` to minimize DB lookups.
- DB writes occur when:
  - First request of the day (create record)
  - First write operation of the day (upgrade passive → active)
  - Incrementing `action_counts` — debounced/batched, flushing every ~60 seconds
- Cache entries expire after 24 hours or on daily reset.

## Admin API Endpoints

All endpoints require authentication. Activity data endpoints require admin role OR the user's email being in the report recipients list.

### Activity Data

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/activity` | Activity summary for a date range. Query params: `startDate`, `endDate`. Returns per-day counts + user list with statuses. |
| `GET` | `/api/v1/admin/activity/trends` | Trend data for charting. Query param: `days` (default 30). Returns `[{ date, active, passive, inactive }]`. |

### Report Recipients (admin-only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/activity-report/recipients` | List all configured recipients |
| `POST` | `/api/v1/admin/activity-report/recipients` | Add a recipient `{ email }` |
| `PUT` | `/api/v1/admin/activity-report/recipients/:id` | Update (enable/disable) |
| `DELETE` | `/api/v1/admin/activity-report/recipients/:id` | Remove a recipient |

### Manual Report Trigger (admin-only)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/activity-report/send` | Send the report now. Optional `{ date }` param, defaults to yesterday. |

## Frontend: Admin Activity Dashboard

### Access Control

Visible to:
- All admin users (`is_admin: true`)
- Any user whose email is in the `ActivityReportRecipient` list

Navigation: "Activity" tab in the admin section.

### Tab 1: Trends Overview

- **Date range picker** with quick presets: Today, 7 Days, 30 Days, All Time
- **Summary cards** (for the latest day in the range):
  - Active users (green)
  - Passive users (yellow)
  - Inactive users (gray)
- **Trend chart:** Bar or line chart showing daily active/passive/inactive counts over the selected range
- **Report Recipients section** (admin-only, hidden for non-admin recipients):
  - List of email addresses with enable/disable toggles and delete buttons
  - "Add recipient" input + button

### Tab 2: Daily User List

- **Single date picker** (defaults to today)
- **Status filter:** All / Active / Passive / Inactive
- **User table:**
  - Name, Email, Status badge, First Seen (time), Last Seen (time), Action Summary (e.g., "3 tasks, 1 project")
  - Inactive users show "—" for time and action columns
  - Sortable by columns

## Daily Email Report

### Scheduling

- **Library:** `node-cron` running inside the Express process
- **Schedule:** 8:00 AM `Australia/Sydney` daily (handles DST automatically)
- **Reports on:** Previous day's activity (e.g., report sent April 9th covers April 8th)

### Email Content (HTML)

- **Subject:** `Tududi Activity Report — YYYY-MM-DD`
- **Summary section:**
  - Total users, Active count, Passive count, Inactive count
  - Comparison with the day before (e.g., "+2 active vs previous day")
- **User breakdown table:**
  - Name, Email, Status, Actions performed
  - Sorted: Active first, then Passive, then Inactive
- **Footer:** Link to the admin activity dashboard

### Recipients

All enabled entries in the `ActivityReportRecipient` table.

### Error Handling

If email sending fails, log the error via `logService`. No retry — the next day's scheduled report runs as normal. The manual trigger endpoint returns the error to the caller.

## Dependencies

- `node-cron` — new dependency for scheduling the daily report
- `moment-timezone` — already in use, needed for Sydney timezone cron logic
- `recharts` — already installed, used for the trend chart

## Out of Scope

- Push notifications for the activity report
- Activity tracking for unauthenticated users
- Real-time activity dashboard (WebSocket)
- Configurable report schedule via UI (uses fixed 8 AM Sydney)
- Weekly/monthly aggregated reports
