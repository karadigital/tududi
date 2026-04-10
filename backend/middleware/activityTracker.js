const { UserActivity } = require('../models');
const moment = require('moment-timezone');
const { logError } = require('../services/logService');

// In-memory cache: Map<"userId:date", { activityType, actionCounts, dirty, lastFlush }>
const cache = new Map();
const FLUSH_INTERVAL_MS = 60000; // 60 seconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Route prefixes that count as "active" when written to (POST/PUT/DELETE)
// Write routes use singular (e.g., POST /task, PATCH /task/:uid)
// Read routes use plural (e.g., GET /tasks)
const TRACKED_RESOURCES = [
    '/tasks',
    '/task',
    '/projects',
    '/project',
    '/departments',
    '/notes',
    '/note',
    '/tags',
    '/tag',
];

// Map route prefix + method to action_counts key
function getActionKey(path, method) {
    // Normalize: strip /api/v1 or /api prefix
    const normalized = path.replace(/^\/api\/v1/, '').replace(/^\/api/, '');

    for (const prefix of TRACKED_RESOURCES) {
        if (normalized.startsWith(prefix)) {
            // Normalize to plural resource name for consistent action keys
            let resource = prefix.replace('/', '');
            resource = resource.replace('departments', 'areas');
            if (!resource.endsWith('s')) resource += 's';
            if (method === 'POST') return `${resource}_created`;
            if (method === 'PUT' || method === 'PATCH')
                return `${resource}_updated`;
            if (method === 'DELETE') return `${resource}_deleted`;
        }
    }
    return null;
}

function isWriteMethod(method) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function isTrackedWriteRequest(path, method) {
    if (!isWriteMethod(method)) return false;
    const normalized = path.replace(/^\/api\/v1/, '').replace(/^\/api/, '');
    return TRACKED_RESOURCES.some((prefix) => normalized.startsWith(prefix));
}

async function flushToDb(userId, dateStr, entry) {
    try {
        const [activity, created] = await UserActivity.findOrCreate({
            where: { user_id: userId, date: dateStr },
            defaults: {
                user_id: userId,
                date: dateStr,
                activity_type: entry.activityType,
                first_seen_at: entry.firstSeenAt,
                last_seen_at: entry.lastSeenAt,
                action_counts: entry.actionCounts,
            },
        });

        if (!created) {
            const updates = {
                last_seen_at: entry.lastSeenAt,
                action_counts: entry.actionCounts,
            };
            if (
                entry.activityType === 'active' &&
                activity.activity_type !== 'active'
            ) {
                updates.activity_type = 'active';
            }
            await activity.update(updates);
        }

        entry.dirty = false;
        entry.lastFlush = Date.now();
    } catch (err) {
        logError(err, 'Failed to flush activity to DB');
    }
}

// Periodic flush of dirty cache entries
let flushTimer = null;

function startFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(async () => {
        const now = Date.now();
        const toDelete = [];

        for (const [key, entry] of cache.entries()) {
            // Flush dirty entries
            if (entry.dirty) {
                const [userIdStr, dateStr] = key.split(':');
                await flushToDb(parseInt(userIdStr, 10), dateStr, entry);
            }
            // Expire old entries
            if (now - entry.createdAt > CACHE_TTL_MS) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            cache.delete(key);
        }
    }, FLUSH_INTERVAL_MS);

    // Don't block process exit
    if (flushTimer.unref) flushTimer.unref();
}

function stopFlushTimer() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}

async function activityTracker(req, res, next) {
    // Only track authenticated requests
    const userId = req.currentUser?.id;
    if (!userId) return next();

    // Skip auth/health routes
    const path = req.originalUrl || req.path;
    if (
        path.includes('/health') ||
        path.includes('/login') ||
        path.includes('/current_user')
    ) {
        return next();
    }

    const now = new Date();
    const userTimezone = req.currentUser?.timezone || 'UTC';
    const dateStr = moment.tz(now, userTimezone).format('YYYY-MM-DD');
    const cacheKey = `${userId}:${dateStr}`;
    const method = req.method;

    let entry = cache.get(cacheKey);

    if (!entry) {
        // First request of the day for this user
        entry = {
            activityType: 'passive',
            firstSeenAt: now,
            lastSeenAt: now,
            actionCounts: {},
            dirty: true,
            createdAt: Date.now(),
            lastFlush: 0,
        };
        cache.set(cacheKey, entry);

        // Immediately flush the first record (creates DB row)
        await flushToDb(userId, dateStr, entry);
    }

    entry.lastSeenAt = now;

    // Check if this is a tracked write operation
    if (isTrackedWriteRequest(path, method)) {
        entry.activityType = 'active';
        const actionKey = getActionKey(path, method);
        if (actionKey) {
            entry.actionCounts[actionKey] =
                (entry.actionCounts[actionKey] || 0) + 1;
        }
        entry.dirty = true;

        // Immediately flush on write operations for accuracy
        await flushToDb(userId, dateStr, entry);
    } else {
        entry.dirty = true;
    }

    next();
}

module.exports = {
    activityTracker,
    startFlushTimer,
    stopFlushTimer,
    // Exported for testing
    _cache: cache,
    _getActionKey: getActionKey,
    _isTrackedWriteRequest: isTrackedWriteRequest,
};
