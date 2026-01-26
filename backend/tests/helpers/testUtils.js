const bcrypt = require('bcrypt');
const { User, Role } = require('../../models');

const createTestUser = async (userData = {}) => {
    const defaultUser = {
        email: 'test@example.com',
        password_digest:
            '$2b$10$DPcA0XSvK9FT04mLyKGza.uHb8d.bESwP.XdQfQ47.sKVT4fYzbP.', // Pre-computed hash for 'password123'
        ...userData,
    };

    const user = await User.create(defaultUser);

    // Ensure the user has a non-admin role to prevent backfill-roles migration from making test users admins
    // Update or create the role entry
    if (userData.skipRole !== true) {
        try {
            const [role, created] = await Role.findOrCreate({
                where: { user_id: user.id },
                defaults: {
                    user_id: user.id,
                    is_admin: userData.is_admin || false,
                },
            });

            // If role already exists (created by migration), update it to match the requested admin status
            if (!created) {
                await role.update({ is_admin: userData.is_admin || false });
            }
        } catch (error) {
            // Continue even if role management fails (e.g., roles table doesn't exist yet)
        }
    }

    return user;
};

const authenticateUser = async (request, user) => {
    const response = await request.post('/api/login').send({
        email: user.email,
        password: 'password123',
    });

    return response.headers['set-cookie'];
};

module.exports = {
    createTestUser,
    authenticateUser,
};
