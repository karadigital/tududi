const cron = require('node-cron');
const moment = require('moment-timezone');
const { User, UserActivity, ActivityReportRecipient } = require('../models');
const { sendEmail, isEmailEnabled } = require('./emailService');
const { logError, logInfo } = require('./logService');
const { Op } = require('sequelize');
const { getConfig } = require('../config/config');

const REPORT_TIMEZONE = 'Australia/Sydney';
// 8:00 AM Sydney time daily
const CRON_EXPRESSION = '0 8 * * *';

let cronJob = null;

async function getActivityDataForDate(dateStr) {
    const totalUsers = await User.count();

    const activities = await UserActivity.findAll({
        where: { date: dateStr },
        include: [
            {
                model: User,
                as: 'User',
                attributes: ['id', 'email', 'name', 'surname'],
            },
        ],
    });

    const activeUsers = activities.filter((a) => a.activity_type === 'active');
    const passiveUsers = activities.filter(
        (a) => a.activity_type === 'passive'
    );

    // Get all users for inactive list
    const activeUserIds = new Set(activities.map((a) => a.user_id));
    const allUsers = await User.findAll({
        attributes: ['id', 'email', 'name', 'surname'],
    });
    const inactiveUsers = allUsers.filter((u) => !activeUserIds.has(u.id));

    // Previous day comparison
    const prevDate = moment(dateStr).subtract(1, 'day').format('YYYY-MM-DD');
    const prevActivities = await UserActivity.findAll({
        where: { date: prevDate },
    });
    const prevActive = prevActivities.filter(
        (a) => a.activity_type === 'active'
    ).length;
    const prevPassive = prevActivities.filter(
        (a) => a.activity_type === 'passive'
    ).length;

    return {
        date: dateStr,
        total: totalUsers,
        active: {
            count: activeUsers.length,
            users: activeUsers,
            diff: activeUsers.length - prevActive,
        },
        passive: {
            count: passiveUsers.length,
            users: passiveUsers,
            diff: passiveUsers.length - prevPassive,
        },
        inactive: {
            count: inactiveUsers.length,
            users: inactiveUsers,
            diff:
                inactiveUsers.length - (totalUsers - prevActive - prevPassive),
        },
    };
}

function formatDiff(diff) {
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '0';
}

function formatActionCounts(counts) {
    if (!counts || Object.keys(counts).length === 0) return '\u2014';
    const parts = [];
    const taskActions =
        (counts.tasks_created || 0) +
        (counts.tasks_updated || 0) +
        (counts.tasks_deleted || 0);
    if (taskActions > 0)
        parts.push(`${taskActions} task${taskActions > 1 ? 's' : ''}`);
    const projectActions =
        (counts.projects_created || 0) +
        (counts.projects_updated || 0) +
        (counts.projects_deleted || 0);
    if (projectActions > 0)
        parts.push(`${projectActions} project${projectActions > 1 ? 's' : ''}`);
    const areaActions =
        (counts.areas_created || 0) +
        (counts.areas_updated || 0) +
        (counts.areas_deleted || 0);
    if (areaActions > 0)
        parts.push(`${areaActions} area${areaActions > 1 ? 's' : ''}`);
    const noteActions =
        (counts.notes_created || 0) +
        (counts.notes_updated || 0) +
        (counts.notes_deleted || 0);
    if (noteActions > 0)
        parts.push(`${noteActions} note${noteActions > 1 ? 's' : ''}`);
    const tagActions =
        (counts.tags_created || 0) +
        (counts.tags_updated || 0) +
        (counts.tags_deleted || 0);
    if (tagActions > 0)
        parts.push(`${tagActions} tag${tagActions > 1 ? 's' : ''}`);
    return parts.join(', ') || '\u2014';
}

function getUserDisplayName(user) {
    if (user.name && user.surname) return `${user.name} ${user.surname}`;
    if (user.name) return user.name;
    return user.email;
}

async function generateReportHtml(dateStr) {
    const data = await getActivityDataForDate(dateStr);
    const config = getConfig();
    const frontendUrl = config.frontendUrl || 'http://localhost:8080';

    const userRow = (user, status, actionCounts) => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${getUserDisplayName(user.User || user)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${(user.User || user).email}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;
                    background: ${status === 'Active' ? '#dcfce7' : status === 'Passive' ? '#fef9c3' : '#f3f4f6'};
                    color: ${status === 'Active' ? '#166534' : status === 'Passive' ? '#854d0e' : '#374151'};">
                    ${status}
                </span>
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${formatActionCounts(actionCounts)}</td>
        </tr>`;

    const activeRows = data.active.users
        .map((u) => userRow(u, 'Active', u.action_counts))
        .join('');
    const passiveRows = data.passive.users
        .map((u) => userRow(u, 'Passive', {}))
        .join('');
    const inactiveRows = data.inactive.users
        .map((u) => userRow(u, 'Inactive', {}))
        .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333;">
    <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
        Tududi Activity Report &mdash; ${data.date}
    </h1>

    <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="flex: 1; padding: 16px; background: #dcfce7; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #166534;">${data.active.count}</div>
            <div style="color: #166534;">Active</div>
            <div style="font-size: 12px; color: #166534; margin-top: 4px;">${formatDiff(data.active.diff)} vs prev day</div>
        </div>
        <div style="flex: 1; padding: 16px; background: #fef9c3; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #854d0e;">${data.passive.count}</div>
            <div style="color: #854d0e;">Passive</div>
            <div style="font-size: 12px; color: #854d0e; margin-top: 4px;">${formatDiff(data.passive.diff)} vs prev day</div>
        </div>
        <div style="flex: 1; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #374151;">${data.inactive.count}</div>
            <div style="color: #374151;">Inactive</div>
            <div style="font-size: 12px; color: #374151; margin-top: 4px;">${formatDiff(data.inactive.diff)} vs prev day</div>
        </div>
    </div>

    <p style="color: #6b7280;">Total users: ${data.total}</p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
            <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Status</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Actions</th>
            </tr>
        </thead>
        <tbody>
            ${activeRows}
            ${passiveRows}
            ${inactiveRows}
        </tbody>
    </table>

    <p style="margin-top: 24px; color: #9ca3af; font-size: 13px;">
        <a href="${frontendUrl}/admin/activity" style="color: #3b82f6;">View full dashboard</a>
    </p>
</body>
</html>`;
}

async function sendDailyReport(dateStr) {
    if (!dateStr) {
        // Report on yesterday (Sydney time)
        dateStr = moment
            .tz(REPORT_TIMEZONE)
            .subtract(1, 'day')
            .format('YYYY-MM-DD');
    }

    const recipients = await ActivityReportRecipient.findAll({
        where: { enabled: true },
    });

    if (recipients.length === 0) {
        logInfo('No activity report recipients configured, skipping');
        return { sent: 0, message: 'No recipients configured', date: dateStr };
    }

    const html = await generateReportHtml(dateStr);
    const subject = `Tududi Activity Report \u2014 ${dateStr}`;

    let sent = 0;
    let errors = 0;

    for (const recipient of recipients) {
        const result = await sendEmail({
            to: recipient.email,
            subject,
            html,
            text: `Tududi Activity Report for ${dateStr}. View the full report at your admin dashboard.`,
        });
        if (result.success) {
            sent++;
        } else {
            errors++;
            logError(
                new Error(
                    `Failed to send activity report to ${recipient.email}: ${result.reason}`
                )
            );
        }
    }

    logInfo(
        `Activity report for ${dateStr}: sent to ${sent}/${recipients.length} recipients`
    );
    return { sent, errors, total: recipients.length, date: dateStr };
}

function initializeActivityReportCron() {
    const config = getConfig();
    if (config.environment === 'test' || config.disableScheduler) {
        return;
    }

    cronJob = cron.schedule(
        CRON_EXPRESSION,
        async () => {
            logInfo('Running daily activity report cron job');
            try {
                await sendDailyReport();
            } catch (err) {
                logError(err, 'Activity report cron job failed');
            }
        },
        {
            scheduled: true,
            timezone: REPORT_TIMEZONE,
        }
    );

    logInfo(
        `Activity report cron scheduled: ${CRON_EXPRESSION} (${REPORT_TIMEZONE})`
    );
}

function stopActivityReportCron() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
}

module.exports = {
    generateReportHtml,
    sendDailyReport,
    initializeActivityReportCron,
    stopActivityReportCron,
};
