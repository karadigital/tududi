# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tududi is a self-hosted task management application built with:
- **Backend:** Node.js + Express + Sequelize (SQLite)
- **Frontend:** React 18 + TypeScript + Zustand + Tailwind CSS
- **Testing:** Jest (unit/integration) + Playwright (E2E)

## Common Commands

### Development
```bash
npm start                    # Start frontend (8080) + backend (3002) concurrently
npm run frontend:dev         # Frontend only with hot reload
npm run backend:dev          # Backend only with nodemon
```

### Testing
```bash
npm test                     # Backend tests
npm run frontend:test        # Frontend component tests
npm run test:ui              # E2E tests (Playwright headless)
npm run test:ui:headed       # E2E tests in browser
npm run test:ui:mode         # E2E tests with Playwright UI
npm run backend:test:unit    # Backend unit tests only
npm run backend:test:integration  # Backend integration tests only

# Run single test file
cd backend && cross-env NODE_ENV=test jest tests/integration/tasks.test.js
npm run frontend:test -- TaskItem.test.tsx

# Run single test case by name
cd backend && cross-env NODE_ENV=test jest -t "should create a task"
```

### Linting & Formatting

**MUST run `npm run lint:fix` and `npm run format:fix` before EVERY commit — no exceptions.**

```bash
npm run lint                 # Check ESLint + Prettier
npm run lint:fix             # Auto-fix linting issues
npm run format:fix           # Auto-format code
npm run pre-push             # Run before committing (lint + format)
npm run pre-release          # Full QA: lint + format + test + test:ui
```

### Database
```bash
npm run db:init              # Initialize database
npm run db:migrate           # Run migrations
npm run db:reset-and-seed    # Reset and seed dev data
npm run migration:create -- --name migration-name  # Create new migration
```

## Architecture

### Backend (`/backend`)
- **Routes:** `/backend/routes/` - Express route handlers (tasks/, projects.js, areas.js, notes.js, auth.js, workspaces.js, habits.js, inbox.js, admin.js, shares.js, search.js, etc.)
- **Models:** `/backend/models/` - Sequelize ORM models (User, Task, Project, Area, Note, Tag, Workspace, View, InboxItem, etc.)
- **Services:** `/backend/services/` - Business logic (taskScheduler.js, recurringTaskService.js, habitService.js)
- **Middleware:** `/backend/middleware/` - Auth, authorization, rate limiting, permission cache, query logging
- **Migrations:** `/backend/migrations/` - Database schema changes
- **Tests:** `/backend/tests/unit/` and `/backend/tests/integration/`

#### Task Routes Architecture (`/backend/routes/tasks/`)
The tasks route is modular with specialized subdirectories:
- `core/` - Serializers, builders, parsers, comparators
- `operations/` - Business logic (completion, recurring, subtasks, tags, parent-child, sorting, grouping)
- `queries/` - Query builders and metrics computation
- `middleware/` - Access control (requireTaskReadAccess, requireTaskWriteAccess)
- `utils/` - Validation, logging, constants

### Frontend (`/frontend`)
- **Components:** `/frontend/components/` - Organized by feature (Task/, Project/, Area/, Note/, Habits/, Admin/, Workspace/, Inbox/, Calendar/, Metrics/, Sidebar/, etc.)
- **Store:** `/frontend/store/useStore.ts` - Zustand for global state (tasks, projects, notes, tags)
- **Contexts:** `/frontend/contexts/` - React Context for UI state (modals, sidebar)
- **Entities:** `/frontend/entities/` - TypeScript interfaces
- **Hooks:** `/frontend/hooks/` - Custom hooks (useModalManager, useTasksData)
- **Tests:** Co-located as `*.test.tsx` files

### API Structure
- Base path: `/api/v1`
- Swagger docs: `/api-docs` (authenticated)
- Auth: Session cookies or Bearer token (personal API keys)

## Code Patterns

### Backend
- Async/await for all async operations
- Business logic in services, not routes
- Sequelize models for database access
- RESTful API conventions

### Frontend
- Functional components with hooks
- Zustand for async data state
- React Context for UI state
- TypeScript interfaces for props
- i18next for translations (25 languages)

### CRITICAL: Avatar Images
**ALWAYS wrap avatar_image paths with `getApiPath()` when rendering in img tags!**

```tsx
// ❌ WRONG - Will result in broken image links
<img src={user.avatar_image} alt="avatar" />

// ✅ CORRECT - Use getApiPath to construct full URL
import { getApiPath } from '../../../config/paths';
<img src={getApiPath(user.avatar_image)} alt="avatar" />
```

This applies to ALL user avatar displays including:
- Task owners (Owner.avatar_image)
- Assigned users (AssignedTo.avatar_image)
- Subscribers (Subscribers[].avatar_image)
- Profile avatars
- Any other user image references

**Also add `object-cover` class to prevent image distortion:**
```tsx
<img
  src={getApiPath(user.avatar_image)}
  alt="avatar"
  className="h-8 w-8 rounded-full object-cover"
/>
```

## Key Files
- `/backend/app.js` - Express app entry point
- `/frontend/App.tsx` - React router and auth state
- `/frontend/store/useStore.ts` - Centralized Zustand store
- `/webpack.config.js` - Webpack configuration (dev server on 8080, proxies to backend)

## Testing Notes
- Frontend tests use jsdom and React Testing Library
- Backend tests use separate test database (auto-created per Jest worker in `/tmp/`)
- E2E tests in `/e2e/` folder targeting Chromium/Firefox/WebKit
- Run `npm run pre-push` before committing

### Backend Test Helpers
Use helpers from `/backend/tests/helpers/testUtils.js`:
```javascript
const { createTestUser, authenticateUser } = require('../helpers/testUtils');

// Create user (password is always 'password123')
const user = await createTestUser({ email: 'test@example.com' });
const adminUser = await createTestUser({ email: 'admin@example.com', is_admin: true });

// Authenticate and get session cookie
const cookies = await authenticateUser(request, user);
await request.get('/api/v1/tasks').set('Cookie', cookies);
```

### E2E Test Credentials
Default credentials for E2E tests: `test@tududi.com` / `password123`

## Database Migrations
When changing schema:
1. Create migration: `npm run migration:create -- --name your-migration-name`
2. Edit migration in `/backend/migrations/`
3. Update corresponding model in `/backend/models/`
4. Test with `npm run db:migrate`
