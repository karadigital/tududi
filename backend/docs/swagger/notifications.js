/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier
 *         user_id:
 *           type: integer
 *           description: ID of the user this notification belongs to
 *         type:
 *           type: string
 *           description: Type of notification
 *           example: "task_due_soon"
 *         title:
 *           type: string
 *           description: Notification title
 *         message:
 *           type: string
 *           description: Notification message
 *         level:
 *           type: string
 *           enum: [info, warning, error]
 *           description: Severity level
 *         data:
 *           type: object
 *           description: Additional notification data
 *         read_at:
 *           type: string
 *           format: date-time
 *           description: When the notification was read
 *         dismissed_at:
 *           type: string
 *           format: date-time
 *           description: When the notification was dismissed
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications
 *     description: Get user's notifications with pagination and filtering options
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: includeRead
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *           default: "true"
 *         description: Whether to include read notifications
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 total:
 *                   type: integer
 *                   description: Total count of notifications
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to fetch notifications
 */

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Get the count of unread notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of unread notifications
 *                   example: 5
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to fetch unread count
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *                 message:
 *                   type: string
 *                   example: "Notification marked as read"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Failed to mark notification as read
 */

/**
 * @swagger
 * /api/notifications/{id}/unread:
 *   post:
 *     summary: Mark notification as unread
 *     description: Mark a specific notification as unread
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as unread
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *                 message:
 *                   type: string
 *                   example: "Notification marked as unread"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Failed to mark notification as unread
 */

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read
 *     description: Mark all notifications for the current user as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of notifications marked as read
 *                 message:
 *                   type: string
 *                   example: "Marked 5 notifications as read"
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to mark all notifications as read
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Dismiss notification
 *     description: Soft delete (dismiss) a notification
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification dismissed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notification dismissed successfully"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Failed to dismiss notification
 */
