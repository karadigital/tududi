/**
 * @swagger
 * /api/version:
 *   get:
 *     summary: Get API version
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: API version
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */

/**
 * @swagger
 * /api/current_user:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     language:
 *                       type: string
 *                     appearance:
 *                       type: string
 *                     timezone:
 *                       type: string
 *                     is_admin:
 *                       type: boolean
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login to the application
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     surname:
 *                       type: string
 *                     language:
 *                       type: string
 *                     appearance:
 *                       type: string
 *                     timezone:
 *                       type: string
 *                     is_admin:
 *                       type: boolean
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/logout:
 *   get:
 *     summary: Logout from the application
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       500:
 *         description: Could not log out
 */

/**
 * @swagger
 * /api/registration-status:
 *   get:
 *     summary: Get registration status
 *     description: Returns whether user registration is enabled on this instance
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Registration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                   description: Whether registration is enabled
 *                   example: true
 */

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register new user
 *     description: Creates a new unverified user account and sends a verification email. Registration must be enabled on the instance.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "newuser@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Password (minimum 6 characters)
 *                 example: "securepassword123"
 *     responses:
 *       201:
 *         description: Registration successful, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Registration successful. Please check your email to verify your account."
 *       400:
 *         description: Invalid request (missing fields, invalid email, password too short, or email already registered)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email already registered"
 *       404:
 *         description: Registration is not enabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Registration is not enabled"
 *       500:
 *         description: Failed to send verification email
 */

/**
 * @swagger
 * /api/verify-email:
 *   get:
 *     summary: Verify email address
 *     description: Verifies user email using the token from the verification email. Redirects to the login page with status.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       302:
 *         description: Redirects to login page with verification status
 *         headers:
 *           Location:
 *             description: Redirect URL with verification status query parameters
 *             schema:
 *               type: string
 *               example: "/login?verified=true"
 *       400:
 *         description: Verification token is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Verification token is required"
 */

/**
 * @swagger
 * /api/create-asid-user:
 *   post:
 *     summary: Create ASID user in tududi
 *     tags: [Authentication]
 *     security:
 *     - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     email:
 *                       type: string
 *                 token:
 *                   type: string
 *                   description: The plain API key. This value is only returned once.
 *                 apiKey:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
