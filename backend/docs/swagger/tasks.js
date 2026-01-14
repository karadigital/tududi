/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Task management endpoints
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get tasks with filtering and grouping options
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [today, upcoming, completed, archived, all, next, inbox, someday, waiting]
 *         description: Filter tasks by type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, archived, active, done]
 *         description: Filter by task status
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, project]
 *         description: Group tasks by day or project
 *       - in: query
 *         name: order_by
 *         schema:
 *           type: string
 *           example: "created_at:desc"
 *         description: Sort order (field:direction). Allowed columns are created_at, updated_at, name, priority, status, due_date, assigned
 *       - in: query
 *         name: assigned_to_me
 *         schema:
 *           type: boolean
 *         description: If true, only return tasks assigned to the authenticated user
 *       - in: query
 *         name: assigned_by_me
 *         schema:
 *           type: boolean
 *         description: If true, only return tasks created by the authenticated user that are assigned to someone else
 *       - in: query
 *         name: maxDays
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Maximum number of days to expand recurring tasks (used with type=upcoming and groupBy=day)
 *       - in: query
 *         name: include_lists
 *         schema:
 *           type: boolean
 *         description: Include dashboard lists in the response
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of tasks to return (pagination)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of tasks to skip (pagination)
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter tasks by tag name
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter tasks by priority level
 *       - in: query
 *         name: include_instances
 *         schema:
 *           type: boolean
 *         description: Include recurring task instances
 *       - in: query
 *         name: client_side_filtering
 *         schema:
 *           type: boolean
 *         description: Enable client-side filtering (affects status filtering behavior)
 *     responses:
 *       200:
 *         description: List of tasks (use /api/tasks/metrics for dashboard statistics)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 groupedTasks:
 *                   type: object
 *                   description: Tasks grouped by day (only when groupBy=day)
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Task'
 *                 pagination:
 *                   type: object
 *                   description: Pagination metadata (only present when limit or offset parameters are used)
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of tasks matching the query
 *                     limit:
 *                       type: integer
 *                       description: Maximum number of tasks returned
 *                     offset:
 *                       type: integer
 *                       description: Number of tasks skipped
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more tasks beyond the current page
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/tasks/metrics:
 *   get:
 *     summary: Get task metrics and dashboard statistics (counts only)
 *     description: Returns only numeric counts and statistics. Use /api/tasks with filters to fetch actual task data.
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [today, upcoming, completed, archived, all, next, inbox, someday, waiting]
 *         description: Filter metrics by task type
 *     responses:
 *       200:
 *         description: Task metrics and statistics (counts only, no task arrays)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_open_tasks:
 *                   type: integer
 *                   description: Total number of open tasks
 *                 tasks_pending_over_month:
 *                   type: integer
 *                   description: Number of tasks pending for over a month
 *                 tasks_in_progress_count:
 *                   type: integer
 *                   description: Number of tasks currently in progress
 *                 tasks_due_today_count:
 *                   type: integer
 *                   description: Number of tasks due today
 *                 today_plan_tasks_count:
 *                   type: integer
 *                   description: Number of tasks in today's plan
 *                 suggested_tasks_count:
 *                   type: integer
 *                   description: Number of suggested tasks
 *                 tasks_completed_today_count:
 *                   type: integer
 *                   description: Number of tasks completed today
 *                 weekly_completions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                       dayName:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/task:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *                 example: "Complete project documentation"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               defer_until:
 *                 type: string
 *                 format: date-time
 *                 description: Date when task becomes actionable (defer date)
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               parent_task_id:
 *                 type: integer
 *                 description: ID of parent task (to create this as a subtask)
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                 description: Array of tag objects
 *               subtasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     priority:
 *                       type: string
 *                 description: Array of subtask objects to create with the task
 *               recurrence_type:
 *                 type: string
 *                 enum: [none, daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *               recurrence_interval:
 *                 type: integer
 *                 description: Interval for recurrence (e.g., every 2 days)
 *               recurrence_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: When to stop creating recurring instances
 *               recurrence_weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 description: Day of week for weekly recurrence (0=Sunday, 6=Saturday)
 *               recurrence_weekdays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 description: Multiple weekdays for weekly recurrence
 *               recurrence_month_day:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 31
 *                 description: Day of month for monthly recurrence
 *               recurrence_week_of_month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Week of month for monthly recurrence (1=first week, 5=last week)
 *               completion_based:
 *                 type: boolean
 *                 description: Whether recurrence is based on completion date (true) or due date (false)
 *               today:
 *                 type: boolean
 *                 description: Add task to today's plan
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/task/{id}:
 *   get:
 *     summary: Get a specific task by ID or UID
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 *
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Task name
 *               note:
 *                 type: string
 *                 description: Task description (Markdown supported)
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority
 *               status:
 *                 type: string
 *                 enum: [pending, completed, archived]
 *                 description: Task status
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *               defer_until:
 *                 type: string
 *                 format: date-time
 *                 description: Date when task becomes actionable (defer date)
 *               project_id:
 *                 type: integer
 *                 description: Associated project ID
 *               parent_task_id:
 *                 type: integer
 *                 description: ID of parent task (to move task as subtask, or null to remove parent)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                 description: Array of tag objects
 *               subtasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     priority:
 *                       type: string
 *                 description: Array of subtask objects to update
 *               today:
 *                 type: boolean
 *                 description: Add/remove task from today's plan
 *               recurrence_type:
 *                 type: string
 *                 enum: [none, daily, weekly, monthly, yearly]
 *                 description: Recurring pattern
 *               recurrence_interval:
 *                 type: integer
 *                 description: Interval for recurrence (e.g., every 2 days)
 *               recurrence_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: When to stop creating recurring instances
 *               recurrence_weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 description: Day of week for weekly recurrence (0=Sunday, 6=Saturday)
 *               recurrence_weekdays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 description: Multiple weekdays for weekly recurrence
 *               recurrence_month_day:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 31
 *                 description: Day of month for monthly recurrence
 *               recurrence_week_of_month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Week of month for monthly recurrence (1=first week, 5=last week)
 *               completion_based:
 *                 type: boolean
 *                 description: Whether recurrence is based on completion date (true) or due date (false)
 *               update_parent_recurrence:
 *                 type: boolean
 *                 description: When editing a recurring task instance, update the parent task's recurrence settings
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 *
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (integer) or UID (string)
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/task/{id}/subtasks:
 *   get:
 *     summary: Get subtasks of a parent task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent task ID or UID
 *     responses:
 *       200:
 *         description: List of subtasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Parent task not found (returns empty array)
 */

/**
 * @swagger
 * /api/task/{id}/next-iterations:
 *   get:
 *     summary: Calculate next iterations for a recurring task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *       - in: query
 *         name: startFromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for calculating iterations (optional)
 *     responses:
 *       200:
 *         description: List of next iterations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 iterations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       due_date:
 *                         type: string
 *                         format: date
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to get next iterations
 */

/**
 * @swagger
 * /api/task/{uid}/assign:
 *   post:
 *     summary: Assign a task to a user
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assigned_to_user_id
 *             properties:
 *               assigned_to_user_id:
 *                 type: integer
 *                 description: ID of the user to assign the task to
 *     responses:
 *       200:
 *         description: Task assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Bad request (e.g., missing assigned_to_user_id or invalid user)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not authorized to assign this task
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/task/{uid}/unassign:
 *   post:
 *     summary: Remove assignment from a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     responses:
 *       200:
 *         description: Task unassigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Bad request (e.g., task is not assigned)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not authorized to unassign this task
 *       404:
 *         description: Task not found
 */

/**
 * @swagger
 * /api/task/{uid}/subscribe:
 *   post:
 *     summary: Subscribe a user to task notifications
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID of the user to subscribe to task notifications
 *     responses:
 *       200:
 *         description: User subscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Bad request (e.g., user_id missing, user not found, or user already subscribed)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not authorized to modify task subscribers
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to subscribe to task
 */

/**
 * @swagger
 * /api/task/{uid}/unsubscribe:
 *   post:
 *     summary: Unsubscribe a user from task notifications
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID of the user to unsubscribe from task notifications
 *     responses:
 *       200:
 *         description: User unsubscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Bad request (e.g., user_id missing or user not subscribed to task)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to unsubscribe from task
 */

/**
 * @swagger
 * /api/task/{uid}/subscribers:
 *   get:
 *     summary: Get list of users subscribed to a task
 *     tags: [Tasks]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     responses:
 *       200:
 *         description: List of subscribers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscribers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       uid:
 *                         type: string
 *                       email:
 *                         type: string
 *                       name:
 *                         type: string
 *                       surname:
 *                         type: string
 *                       avatar_image:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to fetch subscribers
 */
