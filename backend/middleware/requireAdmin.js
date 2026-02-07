const { User } = require('../models');
const { isAdmin } = require('../services/rolesService');
const { getAuthenticatedUserId } = require('../utils/request-utils');

async function requireAdmin(req, res, next) {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        const user = await User.findByPk(userId, { attributes: ['uid'] });
        if (!user)
            return res.status(401).json({ error: 'Authentication required' });

        const admin = await isAdmin(user.uid);
        if (!admin) return res.status(403).json({ error: 'Forbidden' });
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { requireAdmin };
