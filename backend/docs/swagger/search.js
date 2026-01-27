/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Universal search
 *     description: Search across tasks, projects, areas, notes, and tags with various filters. Results can be filtered by entity type, priority, due date, tags, and more.
 *     tags: [Search]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: "project documentation"
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: Comma-separated list of entity types to search (Task, Project, Area, Note, Tag)
 *         example: "Task,Project"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority level
 *       - in: query
 *         name: due
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, next_week, next_month]
 *         description: Filter by due date range
 *       - in: query
 *         name: defer
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, next_week, next_month]
 *         description: Filter by defer until date range
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tag names to filter by
 *         example: "work,urgent"
 *       - in: query
 *         name: recurring
 *         schema:
 *           type: string
 *           enum: [recurring, non_recurring, instances]
 *         description: Filter by recurrence type
 *       - in: query
 *         name: extras
 *         schema:
 *           type: string
 *         description: Comma-separated list of extra filters (recurring, overdue, has_content, deferred, has_tags, assigned_to_project)
 *         example: "overdue,has_tags"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *       - in: query
 *         name: excludeSubtasks
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: If 'true', exclude tasks that have a parent_task_id or recurring_parent_id
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [Task, Project, Area, Note, Tag]
 *                         description: Type of the result
 *                       id:
 *                         type: integer
 *                         description: Item ID
 *                       uid:
 *                         type: string
 *                         description: Item UID
 *                       name:
 *                         type: string
 *                         description: Item name or title
 *                       description:
 *                         type: string
 *                         description: Item description or content preview
 *                       priority:
 *                         type: string
 *                         description: Priority level (for tasks/projects)
 *                       status:
 *                         type: string
 *                         description: Status (for tasks/projects)
 *                 pagination:
 *                   type: object
 *                   description: Pagination info (only when limit/offset provided)
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total count of results
 *                     limit:
 *                       type: integer
 *                       description: Results per page
 *                     offset:
 *                       type: integer
 *                       description: Current offset
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more results
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Search failed
 */
