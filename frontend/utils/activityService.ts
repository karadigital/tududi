import { getApiPath } from '../config/paths';
import { handleAuthResponse } from './authUtils';

export interface ActivitySummary {
    date: string;
    total: number;
    active: number;
    passive: number;
    inactive: number;
}

export interface ActivityUser {
    id: number;
    email: string;
    name?: string;
    surname?: string;
    status: 'active' | 'passive' | 'inactive';
    first_seen_at: string | null;
    last_seen_at: string | null;
    action_counts: Record<string, number>;
}

export interface ActivityResponse {
    summary: ActivitySummary;
    users: ActivityUser[];
}

export interface TrendEntry {
    date: string;
    active: number;
    passive: number;
    inactive: number;
}

export interface ReportRecipient {
    id: number;
    email: string;
    enabled: boolean;
    added_by: number | null;
    created_at: string;
    updated_at: string;
    AddedBy?: { id: number; email: string; name?: string };
}

export const fetchActivitySummary = async (
    startDate: string,
    endDate: string
): Promise<ActivityResponse> => {
    const response = await fetch(
        getApiPath(`admin/activity?startDate=${startDate}&endDate=${endDate}`),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch activity data.');
    return await response.json();
};

export const fetchActivityTrends = async (
    days: number
): Promise<TrendEntry[]> => {
    const response = await fetch(
        getApiPath(`admin/activity/trends?days=${days}`),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch activity trends.');
    return await response.json();
};

export const fetchReportRecipients = async (): Promise<ReportRecipient[]> => {
    const response = await fetch(
        getApiPath('admin/activity-report/recipients'),
        {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to fetch recipients.');
    return await response.json();
};

export const addReportRecipient = async (
    email: string
): Promise<ReportRecipient> => {
    const response = await fetch(
        getApiPath('admin/activity-report/recipients'),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ email }),
        }
    );
    await handleAuthResponse(response, 'Failed to add recipient.');
    return await response.json();
};

export const updateReportRecipient = async (
    id: number,
    data: { enabled?: boolean; email?: string }
): Promise<ReportRecipient> => {
    const response = await fetch(
        getApiPath(`admin/activity-report/recipients/${id}`),
        {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(data),
        }
    );
    await handleAuthResponse(response, 'Failed to update recipient.');
    return await response.json();
};

export const deleteReportRecipient = async (id: number): Promise<void> => {
    const response = await fetch(
        getApiPath(`admin/activity-report/recipients/${id}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    await handleAuthResponse(response, 'Failed to delete recipient.');
};

export const sendActivityReport = async (
    date?: string
): Promise<{
    message: string;
    sent: number;
    errors: number;
    html?: string;
}> => {
    const response = await fetch(getApiPath('admin/activity-report/send'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(date ? { date } : {}),
    });
    await handleAuthResponse(response, 'Failed to send report.');
    return await response.json();
};
