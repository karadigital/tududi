const express = require('express');
const router = express.Router();
const { User, UserActivity, ActivityReportRecipient } = require('../models');
const { requireAdmin } = require('../middleware/requireAdmin');
const { logError } = require('../services/logService');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

const EXCLUDED_DOMAIN = '@karadigital.co';
const isExcludedEmail = (email) => email && email.endsWith(EXCLUDED_DOMAIN);

// Middleware: allow admin OR report recipient
async function requireActivityAccess(req, res, next) {
    try {
        const userId = req.currentUser?.id;
        if (!userId)
            return res.status(401).json({ error: 'Authentication required' });

        // Check if admin
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (!user)
            return res.status(401).json({ error: 'Authentication required' });

        const { isAdmin } = require('../services/rolesService');
        const admin = await isAdmin(user.uid);
        if (admin) {
            req.isActivityAdmin = true;
            return next();
        }

        // Check if email is a report recipient
        const recipient = await ActivityReportRecipient.findOne({
            where: { email: user.email, enabled: true },
        });
        if (recipient) {
            req.isActivityAdmin = false;
            return next();
        }

        return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/activity - activity summary for date range
router.get('/admin/activity', requireActivityAccess, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res
                .status(400)
                .json({ error: 'startDate and endDate are required' });
        }

        // Get all users, excluding internal domain
        const allUsers = await User.findAll({
            attributes: ['id', 'email', 'name', 'surname'],
        });
        const reportUsers = allUsers.filter((u) => !isExcludedEmail(u.email));
        const reportUserIds = new Set(reportUsers.map((u) => u.id));
        const totalUsers = reportUsers.length;

        // Get activity records in range
        const activities = await UserActivity.findAll({
            where: {
                date: { [Op.between]: [startDate, endDate] },
            },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'email', 'name', 'surname'],
                },
            ],
            order: [['date', 'DESC']],
        });
        const filteredActivities = activities.filter((a) =>
            reportUserIds.has(a.user_id)
        );

        // Get the latest date in range that has data
        const latestDate =
            filteredActivities.length > 0
                ? filteredActivities[0].date
                : endDate;

        // Count for latest date
        const latestActivities = filteredActivities.filter(
            (a) => a.date === latestDate
        );
        const activeCount = latestActivities.filter(
            (a) => a.activity_type === 'active'
        ).length;
        const passiveCount = latestActivities.filter(
            (a) => a.activity_type === 'passive'
        ).length;
        // Note: totalUsers is the current count, not the historical count for this date
        const inactiveCount = totalUsers - activeCount - passiveCount;

        // Build user list for the latest date
        const users = reportUsers.map((u) => {
            const activity = latestActivities.find((a) => a.user_id === u.id);
            return {
                id: u.id,
                email: u.email,
                name: u.name,
                surname: u.surname,
                status: activity ? activity.activity_type : 'inactive',
                first_seen_at: activity?.first_seen_at || null,
                last_seen_at: activity?.last_seen_at || null,
                action_counts: activity?.action_counts || {},
            };
        });

        res.json({
            summary: {
                date: latestDate,
                total: totalUsers,
                active: activeCount,
                passive: passiveCount,
                inactive: inactiveCount,
            },
            users,
        });
    } catch (err) {
        logError('Error fetching activity:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/activity/trends - daily trend data
router.get(
    '/admin/activity/trends',
    requireActivityAccess,
    async (req, res) => {
        try {
            const days =
                req.query.days !== undefined
                    ? parseInt(req.query.days, 10)
                    : 30;
            if (Number.isNaN(days)) {
                return res
                    .status(400)
                    .json({ error: 'Invalid days parameter' });
            }

            // Exclude internal domain users
            const allUsers = await User.findAll({
                attributes: ['id', 'email'],
            });
            const reportUserIds = new Set(
                allUsers
                    .filter((u) => !isExcludedEmail(u.email))
                    .map((u) => u.id)
            );
            const totalUsers = reportUserIds.size;

            // If days === 0, treat as "all time" — no date filter
            let whereClause = {};
            if (days > 0) {
                const startDate = moment()
                    .subtract(days - 1, 'days')
                    .format('YYYY-MM-DD');
                whereClause = {
                    date: { [Op.gte]: startDate },
                };
            }

            const activities = await UserActivity.findAll({
                where: whereClause,
                attributes: ['date', 'activity_type', 'user_id'],
                order: [['date', 'ASC']],
            });
            const filteredActivities = activities.filter((a) =>
                reportUserIds.has(a.user_id)
            );

            // Group by date
            const byDate = {};
            for (const a of filteredActivities) {
                if (!byDate[a.date]) {
                    byDate[a.date] = { active: 0, passive: 0 };
                }
                if (a.activity_type === 'active') byDate[a.date].active++;
                else byDate[a.date].passive++;
            }

            const trends = Object.entries(byDate).map(([date, counts]) => ({
                date,
                active: counts.active,
                passive: counts.passive,
                // Note: totalUsers is the current count, not the historical count for this date
                inactive: totalUsers - counts.active - counts.passive,
            }));

            res.json(trends);
        } catch (err) {
            logError('Error fetching activity trends:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// --- Report Recipients CRUD (admin-only) ---

// GET /api/admin/activity-report/recipients
router.get(
    '/admin/activity-report/recipients',
    requireAdmin,
    async (req, res) => {
        try {
            const recipients = await ActivityReportRecipient.findAll({
                include: [
                    {
                        model: User,
                        as: 'AddedBy',
                        attributes: ['id', 'email', 'name'],
                    },
                ],
                order: [['created_at', 'ASC']],
            });
            res.json(recipients);
        } catch (err) {
            logError('Error fetching recipients:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /api/admin/activity-report/recipients
router.post(
    '/admin/activity-report/recipients',
    requireAdmin,
    async (req, res) => {
        try {
            const { email } = req.body;
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res
                    .status(400)
                    .json({ error: 'Valid email is required' });
            }

            const normalizedEmail = email.trim().toLowerCase();
            const userId = req.currentUser?.id;
            try {
                const recipient = await ActivityReportRecipient.create({
                    email: normalizedEmail,
                    added_by: userId,
                });
                res.status(201).json(recipient);
            } catch (createErr) {
                if (createErr.name === 'SequelizeUniqueConstraintError') {
                    return res
                        .status(409)
                        .json({ error: 'Recipient already exists' });
                }
                throw createErr;
            }
        } catch (err) {
            logError('Error adding recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// PUT /api/admin/activity-report/recipients/:id
router.put(
    '/admin/activity-report/recipients/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id))
                return res.status(400).json({ error: 'Invalid id' });

            const recipient = await ActivityReportRecipient.findByPk(id);
            if (!recipient)
                return res.status(404).json({ error: 'Recipient not found' });

            if (req.body.enabled !== undefined) {
                recipient.enabled = req.body.enabled;
            }
            if (req.body.email !== undefined) {
                if (
                    typeof req.body.email !== 'string' ||
                    !req.body.email.includes('@')
                ) {
                    return res
                        .status(400)
                        .json({ error: 'Valid email is required' });
                }
                recipient.email = req.body.email.trim().toLowerCase();
            }
            await recipient.save();
            res.json(recipient);
        } catch (err) {
            logError('Error updating recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// DELETE /api/admin/activity-report/recipients/:id
router.delete(
    '/admin/activity-report/recipients/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id))
                return res.status(400).json({ error: 'Invalid id' });

            const recipient = await ActivityReportRecipient.findByPk(id);
            if (!recipient)
                return res.status(404).json({ error: 'Recipient not found' });

            await recipient.destroy();
            res.status(204).send();
        } catch (err) {
            logError('Error deleting recipient:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /api/admin/activity-report/preview - generate report without sending
router.post(
    '/admin/activity-report/preview',
    requireAdmin,
    async (req, res) => {
        try {
            const {
                generateReportHtml,
            } = require('../services/activityReportService');
            const date = req.body.date || moment().format('YYYY-MM-DD');
            const html = await generateReportHtml(date);
            res.json({ date, html });
        } catch (err) {
            logError('Error generating report preview:', err);
            res.status(500).json({ error: 'Failed to generate preview' });
        }
    }
);

// POST /api/admin/activity-report/send - send report to recipients
router.post('/admin/activity-report/send', requireAdmin, async (req, res) => {
    try {
        const {
            sendDailyReport,
        } = require('../services/activityReportService');
        const date = req.body.date || moment().format('YYYY-MM-DD');
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res
                .status(400)
                .json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        const result = await sendDailyReport(date);
        res.json({
            message: `Report sent for ${result.date}`,
            ...result,
        });
    } catch (err) {
        logError('Error sending activity report:', err);
        res.status(500).json({ error: 'Failed to send report' });
    }
});

module.exports = router;
