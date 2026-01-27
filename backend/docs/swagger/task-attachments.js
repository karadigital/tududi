/**
 * @swagger
 * components:
 *   schemas:
 *     TaskAttachment:
 *       type: object
 *       properties:
 *         uid:
 *           type: string
 *           description: Unique identifier for the attachment
 *         task_id:
 *           type: integer
 *           description: ID of the task this attachment belongs to
 *         user_id:
 *           type: integer
 *           description: ID of the user who uploaded the attachment
 *         original_filename:
 *           type: string
 *           description: Original name of the uploaded file
 *         stored_filename:
 *           type: string
 *           description: Name of the file as stored on disk
 *         file_size:
 *           type: integer
 *           description: Size of the file in bytes
 *         mime_type:
 *           type: string
 *           description: MIME type of the file
 *         file_path:
 *           type: string
 *           description: Relative path to the file
 *         file_url:
 *           type: string
 *           description: URL to access the file
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/upload/task-attachment:
 *   post:
 *     summary: Upload task attachment
 *     description: Upload a file attachment to a task. Maximum file size is 10MB, and each task can have up to 20 attachments.
 *     tags: [Task Attachments]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - taskUid
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *               taskUid:
 *                 type: string
 *                 description: UID of the task to attach the file to
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskAttachment'
 *       400:
 *         description: Invalid request (no file, task UID required, max attachments reached, or file type not allowed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Maximum 20 attachments allowed per task"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to upload to this task
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to upload attachment
 */

/**
 * @swagger
 * /api/tasks/{taskUid}/attachments:
 *   get:
 *     summary: List task attachments
 *     description: Get all attachments for a specific task
 *     tags: [Task Attachments]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskUid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *     responses:
 *       200:
 *         description: List of attachments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskAttachment'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to view this task
 *       404:
 *         description: Task not found
 *       500:
 *         description: Failed to fetch attachments
 */

/**
 * @swagger
 * /api/tasks/{taskUid}/attachments/{attachmentUid}:
 *   delete:
 *     summary: Delete task attachment
 *     description: Remove an attachment from a task
 *     tags: [Task Attachments]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskUid
 *         required: true
 *         schema:
 *           type: string
 *         description: Task UID
 *       - in: path
 *         name: attachmentUid
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment UID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Attachment deleted successfully"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to modify this task
 *       404:
 *         description: Task or attachment not found
 *       500:
 *         description: Failed to delete attachment
 */

/**
 * @swagger
 * /api/attachments/{attachmentUid}/download:
 *   get:
 *     summary: Download attachment
 *     description: Download an attachment file
 *     tags: [Task Attachments]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentUid
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment UID
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to download this file
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Failed to download attachment
 */
