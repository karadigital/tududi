import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    TrashIcon,
    PaperAirplaneIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchActivitySummary,
    fetchActivityTrends,
    fetchReportRecipients,
    addReportRecipient,
    updateReportRecipient,
    deleteReportRecipient,
    previewActivityReport,
    sendActivityReport,
    ActivityResponse,
    TrendEntry,
    ReportRecipient,
    ActivityUser,
} from '../../utils/activityService';

type TabType = 'trends' | 'daily';
type DatePreset = '1' | '7' | '30' | '0';
type StatusFilter = 'all' | 'active' | 'passive' | 'inactive';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatTime(dateStr: string | null): string {
    if (!dateStr) return '\u2014';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatActionSummary(counts: Record<string, number>): string {
    if (!counts || Object.keys(counts).length === 0) return '\u2014';
    const parts: string[] = [];
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

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = {
        active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        passive:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        inactive:
            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    return (
        <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.inactive}`}
        >
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const AdminActivityPage: React.FC<{ isAdmin?: boolean }> = ({
    isAdmin = true,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('trends');

    // Trends tab state
    const [preset, setPreset] = useState<DatePreset>('7');
    const [trends, setTrends] = useState<TrendEntry[]>([]);
    const [summary, setSummary] = useState<ActivityResponse | null>(null);
    const [loadingTrends, setLoadingTrends] = useState(true);

    // Daily tab state
    const [dailyDate, setDailyDate] = useState(formatDate(new Date()));
    const [dailyData, setDailyData] = useState<ActivityResponse | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [loadingDaily, setLoadingDaily] = useState(false);

    // Recipients state
    const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
    const [newRecipientEmail, setNewRecipientEmail] = useState('');
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Report send state
    const [reportDate, setReportDate] = useState(formatDate(new Date()));
    const [reportHtml, setReportHtml] = useState<string | null>(null);

    // Load trends
    const loadTrends = useCallback(async () => {
        setLoadingTrends(true);
        try {
            const days = parseInt(preset, 10);
            const trendData = await fetchActivityTrends(days);
            setTrends(trendData);

            // Also load summary for latest day
            const today = formatDate(new Date());
            const start =
                days === 0
                    ? '2020-01-01'
                    : formatDate(
                          new Date(
                              Date.now() - (days - 1) * 24 * 60 * 60 * 1000
                          )
                      );
            const summaryData = await fetchActivitySummary(start, today);
            setSummary(summaryData);
        } catch {
            showErrorToast(
                t('admin.activity.failedToLoad', 'Failed to load activity data')
            );
        } finally {
            setLoadingTrends(false);
        }
    }, [preset, t, showErrorToast]);

    useEffect(() => {
        if (activeTab === 'trends') loadTrends();
    }, [activeTab, loadTrends]);

    // Load daily data
    const loadDaily = useCallback(async () => {
        setLoadingDaily(true);
        try {
            const data = await fetchActivitySummary(dailyDate, dailyDate);
            setDailyData(data);
        } catch {
            showErrorToast(
                t('admin.activity.failedToLoad', 'Failed to load activity data')
            );
        } finally {
            setLoadingDaily(false);
        }
    }, [dailyDate, t, showErrorToast]);

    useEffect(() => {
        if (activeTab === 'daily') loadDaily();
    }, [activeTab, loadDaily]);

    // Load recipients
    const loadRecipients = useCallback(async () => {
        if (!isAdmin) return;
        setLoadingRecipients(true);
        try {
            const data = await fetchReportRecipients();
            setRecipients(data);
        } catch {
            // Non-admin users may get 403 — ignore
        } finally {
            setLoadingRecipients(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        loadRecipients();
    }, [loadRecipients]);

    const handleAddRecipient = async () => {
        if (!newRecipientEmail.includes('@')) return;
        try {
            await addReportRecipient(newRecipientEmail);
            setNewRecipientEmail('');
            await loadRecipients();
            showSuccessToast(
                t('admin.activity.recipientAdded', 'Recipient added')
            );
        } catch {
            showErrorToast(
                t(
                    'admin.activity.failedToAddRecipient',
                    'Failed to add recipient'
                )
            );
        }
    };

    const handleToggleRecipient = async (id: number, enabled: boolean) => {
        try {
            await updateReportRecipient(id, { enabled: !enabled });
            await loadRecipients();
        } catch {
            showErrorToast(
                t(
                    'admin.activity.failedToUpdateRecipient',
                    'Failed to update recipient'
                )
            );
        }
    };

    const handleDeleteRecipient = async (id: number) => {
        try {
            await deleteReportRecipient(id);
            await loadRecipients();
            showSuccessToast(
                t('admin.activity.recipientRemoved', 'Recipient removed')
            );
        } catch {
            showErrorToast(
                t(
                    'admin.activity.failedToDeleteRecipient',
                    'Failed to delete recipient'
                )
            );
        }
    };

    const handlePreviewReport = async () => {
        try {
            const result = await previewActivityReport(reportDate);
            setReportHtml(result.html);
        } catch {
            showErrorToast(
                t(
                    'admin.activity.failedToPreview',
                    'Failed to generate preview'
                )
            );
        }
    };

    const handleSendReport = async () => {
        try {
            const result = await sendActivityReport(reportDate);
            setReportHtml(null);
            showSuccessToast(result.message);
        } catch {
            showErrorToast(
                t('admin.activity.failedToSendReport', 'Failed to send report')
            );
        }
    };

    // Filter users for daily tab
    const filteredUsers: ActivityUser[] = dailyData
        ? dailyData.users.filter(
              (u) => statusFilter === 'all' || u.status === statusFilter
          )
        : [];

    return (
        <div className="mx-auto max-w-6xl p-4">
            <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                {t('admin.activity.title', 'User Activity')}
            </h1>

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <button
                    onClick={() => setActiveTab('trends')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'trends'
                            ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('admin.activity.trends', 'Trends Overview')}
                </button>
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'daily'
                            ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('admin.activity.dailyUsers', 'Daily User List')}
                </button>
            </div>

            {/* Trends Tab */}
            {activeTab === 'trends' && (
                <div>
                    {/* Date presets */}
                    <div className="mb-4 flex gap-2">
                        {[
                            {
                                value: '1',
                                label: t('admin.activity.today', 'Today'),
                            },
                            {
                                value: '7',
                                label: t('admin.activity.7days', '7 Days'),
                            },
                            {
                                value: '30',
                                label: t('admin.activity.30days', '30 Days'),
                            },
                            {
                                value: '0',
                                label: t('admin.activity.allTime', 'All Time'),
                            },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setPreset(value as DatePreset)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                    preset === value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Summary cards */}
                    {summary && (
                        <div className="mb-6 grid grid-cols-3 gap-4">
                            <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/30">
                                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                                    {summary.summary.active}
                                </div>
                                <div className="text-sm text-green-600 dark:text-green-400">
                                    {t('admin.activity.active', 'Active')}
                                </div>
                            </div>
                            <div className="rounded-lg bg-yellow-50 p-4 text-center dark:bg-yellow-900/30">
                                <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                                    {summary.summary.passive}
                                </div>
                                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                    {t('admin.activity.passive', 'Passive')}
                                </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50">
                                <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                                    {summary.summary.inactive}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('admin.activity.inactive', 'Inactive')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trend chart */}
                    {loadingTrends ? (
                        <div className="py-12 text-center text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : trends.length > 0 ? (
                        <div className="mb-8 rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={trends}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-gray-200 dark:stroke-gray-600"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12 }}
                                        className="fill-gray-500"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        className="fill-gray-500"
                                    />
                                    <Tooltip />
                                    <Legend />
                                    <Bar
                                        dataKey="active"
                                        fill="#22c55e"
                                        name={t(
                                            'admin.activity.active',
                                            'Active'
                                        )}
                                    />
                                    <Bar
                                        dataKey="passive"
                                        fill="#eab308"
                                        name={t(
                                            'admin.activity.passive',
                                            'Passive'
                                        )}
                                    />
                                    <Bar
                                        dataKey="inactive"
                                        fill="#9ca3af"
                                        name={t(
                                            'admin.activity.inactive',
                                            'Inactive'
                                        )}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">
                            {t('admin.activity.noData', 'No activity data yet')}
                        </div>
                    )}

                    {/* Recipients section (admin only) */}
                    {isAdmin && (
                        <div className="mt-8 rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {t(
                                        'admin.activity.reportRecipients',
                                        'Report Recipients'
                                    )}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={(e) =>
                                            setReportDate(e.target.value)
                                        }
                                        className="rounded-md border px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    />
                                    <button
                                        onClick={handlePreviewReport}
                                        className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                                    >
                                        <EyeIcon className="h-4 w-4" />
                                        {t(
                                            'admin.activity.previewReport',
                                            'Preview Report'
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Add recipient */}
                            <div className="mb-4 flex gap-2">
                                <input
                                    type="email"
                                    value={newRecipientEmail}
                                    onChange={(e) =>
                                        setNewRecipientEmail(e.target.value)
                                    }
                                    placeholder={t(
                                        'admin.activity.addRecipientPlaceholder',
                                        'Enter email address'
                                    )}
                                    className="flex-1 rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                            handleAddRecipient();
                                    }}
                                />
                                <button
                                    onClick={handleAddRecipient}
                                    className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            </div>

                            {/* Recipient list */}
                            {loadingRecipients ? null : recipients.length >
                              0 ? (
                                <ul className="divide-y dark:divide-gray-700">
                                    {recipients.map((r) => (
                                        <li
                                            key={r.id}
                                            className="flex items-center justify-between py-2"
                                        >
                                            <span
                                                className={`text-sm ${r.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}
                                            >
                                                {r.email}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={r.enabled}
                                                        onChange={() =>
                                                            handleToggleRecipient(
                                                                r.id,
                                                                r.enabled
                                                            )
                                                        }
                                                        className="peer sr-only"
                                                    />
                                                    <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-gray-600"></div>
                                                </label>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteRecipient(
                                                            r.id
                                                        )
                                                    }
                                                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    {t(
                                        'admin.activity.noRecipients',
                                        'No recipients configured'
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Daily Tab */}
            {activeTab === 'daily' && (
                <div>
                    {/* Date picker and filter */}
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                        <input
                            type="date"
                            value={dailyDate}
                            onChange={(e) => setDailyDate(e.target.value)}
                            className="rounded-md border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                        <div className="flex gap-1">
                            {(
                                [
                                    'all',
                                    'active',
                                    'passive',
                                    'inactive',
                                ] as StatusFilter[]
                            ).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                        statusFilter === s
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User table */}
                    {loadingDaily ? (
                        <div className="py-12 text-center text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-800">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.name', 'Name')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t('admin.activity.email', 'Email')}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t(
                                                'admin.activity.status',
                                                'Status'
                                            )}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t(
                                                'admin.activity.firstSeen',
                                                'First Seen'
                                            )}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t(
                                                'admin.activity.lastSeen',
                                                'Last Seen'
                                            )}
                                        </th>
                                        <th className="px-4 py-3">
                                            {t(
                                                'admin.activity.actions',
                                                'Actions'
                                            )}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {filteredUsers.map((u) => (
                                        <tr
                                            key={u.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                {u.name
                                                    ? `${u.name}${u.surname ? ` ${u.surname}` : ''}`
                                                    : '\u2014'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {u.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status={u.status}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatTime(u.first_seen_at)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatTime(u.last_seen_at)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {formatActionSummary(
                                                    u.action_counts
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-gray-500"
                                            >
                                                {t(
                                                    'admin.activity.noUsersFound',
                                                    'No users found'
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Report preview modal */}
            {reportHtml && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl">
                        <div className="sticky top-0 flex items-center justify-between border-b bg-gray-50 px-4 py-3">
                            <h3 className="font-semibold text-gray-900">
                                {t(
                                    'admin.activity.reportPreview',
                                    'Report Preview'
                                )}
                            </h3>
                            <button
                                onClick={() => setReportHtml(null)}
                                className="rounded p-1 text-gray-500 hover:bg-gray-200"
                            >
                                &times;
                            </button>
                        </div>
                        <div
                            className="bg-white p-4 text-gray-900"
                            dangerouslySetInnerHTML={{
                                __html: reportHtml,
                            }}
                        />
                        <div className="sticky bottom-0 flex justify-end border-t bg-gray-50 px-4 py-3">
                            <button
                                onClick={handleSendReport}
                                className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                            >
                                <PaperAirplaneIcon className="h-4 w-4" />
                                {t(
                                    'admin.activity.sendToRecipients',
                                    'Send to Recipients'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminActivityPage;
