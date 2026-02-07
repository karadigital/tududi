import { Workspace } from '../entities/Workspace';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export const fetchWorkspaces = async (): Promise<Workspace[]> => {
    const response = await fetch(getApiPath('workspaces'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch workspaces.');
    return await response.json();
};

export const fetchWorkspace = async (uid: string): Promise<Workspace> => {
    const response = await fetch(getApiPath(`workspaces/${uid}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch workspace.');
    return await response.json();
};

export const createWorkspace = async (
    data: Partial<Workspace>
): Promise<Workspace> => {
    const response = await fetch(getApiPath('workspace'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to create workspace.');
    return await response.json();
};

export const updateWorkspace = async (
    uid: string,
    data: Partial<Workspace>
): Promise<Workspace> => {
    const response = await fetch(getApiPath(`workspace/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to update workspace.');
    return await response.json();
};

export const deleteWorkspace = async (uid: string): Promise<void> => {
    const response = await fetch(getApiPath(`workspace/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to delete workspace.');
};

export const saveWorkspace = async (
    workspaceData: Partial<Workspace>,
    reloadFn: () => Promise<void>
): Promise<void> => {
    if (workspaceData.uid) {
        await updateWorkspace(workspaceData.uid, { name: workspaceData.name });
    } else {
        await createWorkspace({ name: workspaceData.name });
    }
    await reloadFn();
};
