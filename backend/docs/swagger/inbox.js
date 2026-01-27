/**
 * @swagger
 * /api/inbox:
 *   get:
 *     summary: Get inbox items
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of inbox items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InboxItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/inbox:
 *   post:
 *     summary: Create a new inbox item
 *     tags: [Inbox]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Inbox item content
 *                 example: "Remember to call John"
 *               source:
 *                 type: string
 *                 description: Source of the item
 *                 example: "manual"
 *     responses:
 *       201:
 *         description: Inbox item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/inbox/{uid}:
 *   get:
 *     summary: Get inbox item by UID
 *     description: Retrieves a specific inbox item by its UID
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Inbox item UID
 *     responses:
 *       200:
 *         description: Inbox item details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid UID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inbox item not found
 */

/**
 * @swagger
 * /api/inbox/{uid}:
 *   patch:
 *     summary: Update inbox item
 *     description: Updates the content or status of an inbox item
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Inbox item UID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated content
 *               status:
 *                 type: string
 *                 enum: [added, processed, deleted]
 *                 description: Updated status
 *     responses:
 *       200:
 *         description: Inbox item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid request or UID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inbox item not found
 */

/**
 * @swagger
 * /api/inbox/{uid}:
 *   delete:
 *     summary: Delete inbox item
 *     description: Soft-deletes an inbox item by marking it as deleted
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Inbox item UID
 *     responses:
 *       200:
 *         description: Inbox item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inbox item successfully deleted"
 *       400:
 *         description: Invalid UID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inbox item not found
 */

/**
 * @swagger
 * /api/inbox/{uid}/process:
 *   patch:
 *     summary: Process inbox item
 *     description: Marks an inbox item as processed
 *     tags: [Inbox]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Inbox item UID
 *     responses:
 *       200:
 *         description: Inbox item processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InboxItem'
 *       400:
 *         description: Invalid UID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inbox item not found
 */

/**
 * @swagger
 * /api/inbox/analyze-text:
 *   post:
 *     summary: Analyze text
 *     description: Processes text using the inbox processing service to extract structured data like dates, priorities, and tags
 *     tags: [Inbox]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Text to analyze
 *                 example: "Call John tomorrow at 3pm #work !high"
 *     responses:
 *       200:
 *         description: Analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Extracted title
 *                 due_date:
 *                   type: string
 *                   format: date-time
 *                   description: Extracted due date
 *                 priority:
 *                   type: integer
 *                   description: Extracted priority level
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Extracted tags
 *       400:
 *         description: Content is required
 *       500:
 *         description: Internal server error
 */
