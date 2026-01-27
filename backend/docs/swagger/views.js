/**
 * @swagger
 * components:
 *   schemas:
 *     View:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier
 *         uid:
 *           type: string
 *           description: Unique identifier string
 *         user_id:
 *           type: integer
 *           description: ID of the user who owns this view
 *         name:
 *           type: string
 *           description: View name
 *         search_query:
 *           type: string
 *           description: Search query for the view
 *         filters:
 *           type: array
 *           items:
 *             type: string
 *           description: Filter criteria
 *         priority:
 *           type: string
 *           description: Priority filter
 *         due:
 *           type: string
 *           description: Due date filter
 *         defer:
 *           type: string
 *           description: Defer until filter
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tag filters
 *         extras:
 *           type: array
 *           items:
 *             type: string
 *           description: Extra filters (recurring, overdue, has_content, etc.)
 *         recurring:
 *           type: string
 *           description: Recurring filter
 *         is_pinned:
 *           type: boolean
 *           description: Whether the view is pinned to sidebar
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/views:
 *   get:
 *     summary: Get all views
 *     description: Get all custom views for the current user, ordered by pinned status and creation date
 *     tags: [Views]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of views
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/View'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/views/pinned:
 *   get:
 *     summary: Get pinned views
 *     description: Get pinned views for sidebar display
 *     tags: [Views]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pinned views
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/View'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/views/{identifier}:
 *   get:
 *     summary: Get view by UID
 *     description: Get a specific view by its UID
 *     tags: [Views]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: View UID
 *     responses:
 *       200:
 *         description: View details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/View'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: View not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/views:
 *   post:
 *     summary: Create view
 *     description: Create a new custom view with filters
 *     tags: [Views]
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
 *                 description: View name
 *                 example: "High Priority Tasks"
 *               search_query:
 *                 type: string
 *                 description: Search query
 *               filters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Entity type filters (Task, Project, etc.)
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Priority filter
 *               due:
 *                 type: string
 *                 enum: [today, tomorrow, next_week, next_month]
 *                 description: Due date filter
 *               defer:
 *                 type: string
 *                 enum: [today, tomorrow, next_week, next_month]
 *                 description: Defer until filter
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tag name filters
 *               extras:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Extra filters (recurring, overdue, has_content, deferred, has_tags, assigned_to_project)
 *               recurring:
 *                 type: string
 *                 enum: [recurring, non_recurring, instances]
 *                 description: Recurring filter
 *     responses:
 *       201:
 *         description: View created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/View'
 *       400:
 *         description: Invalid request (name is required)
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/views/{identifier}:
 *   patch:
 *     summary: Update view
 *     description: Update an existing view
 *     tags: [Views]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: View UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: View name
 *               search_query:
 *                 type: string
 *                 description: Search query
 *               filters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Entity type filters
 *               priority:
 *                 type: string
 *                 description: Priority filter
 *               due:
 *                 type: string
 *                 description: Due date filter
 *               defer:
 *                 type: string
 *                 description: Defer until filter
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tag filters
 *               extras:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Extra filters
 *               recurring:
 *                 type: string
 *                 description: Recurring filter
 *               is_pinned:
 *                 type: boolean
 *                 description: Whether the view is pinned
 *     responses:
 *       200:
 *         description: View updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/View'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: View not found
 */

/**
 * @swagger
 * /api/views/{identifier}:
 *   delete:
 *     summary: Delete view
 *     description: Delete a custom view
 *     tags: [Views]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: View UID
 *     responses:
 *       200:
 *         description: View deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "View successfully deleted"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: View not found
 */
