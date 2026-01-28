// Note: Uses /departments URL paths (renamed from /areas for user-facing consistency)
import { Area, AreaMember } from '../entities/Area';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export const fetchAreas = async (): Promise<Area[]> => {
    const response = await fetch(getApiPath('departments'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch areas.');
    return await response.json();
};

export const fetchArea = async (areaUid: string): Promise<Area> => {
    const response = await fetch(getApiPath(`departments/${areaUid}`), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch area.');
    return await response.json();
};

export const createArea = async (areaData: Partial<Area>): Promise<Area> => {
    const response = await fetch(getApiPath('departments'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(response, 'Failed to create area.');
    return await response.json();
};

export const updateArea = async (
    areaUid: string,
    areaData: Partial<Area>
): Promise<Area> => {
    const response = await fetch(getApiPath(`departments/${areaUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(response, 'Failed to update area.');
    return await response.json();
};

export const deleteArea = async (areaUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`departments/${areaUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to delete area.');
};

export const getAreaMembers = async (
    areaUid: string
): Promise<AreaMember[]> => {
    const response = await fetch(getApiPath(`departments/${areaUid}/members`), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to fetch area members.');
    const data = await response.json();
    return data.members;
};

export const addAreaMember = async (
    areaUid: string,
    userId: number,
    role: 'member' | 'admin' = 'member'
): Promise<AreaMember[]> => {
    const response = await fetch(getApiPath(`departments/${areaUid}/members`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ user_id: userId, role }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || 'Failed to add area member');
        (error as any).departmentName = errorData.departmentName;
        throw error;
    }

    const data = await response.json();
    return data.members;
};

export const removeAreaMember = async (
    areaUid: string,
    userId: number
): Promise<AreaMember[]> => {
    const response = await fetch(
        getApiPath(`departments/${areaUid}/members/${userId}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        }
    );

    await handleAuthResponse(response, 'Failed to remove area member.');
    const data = await response.json();
    return data.members;
};

export const updateAreaMemberRole = async (
    areaUid: string,
    userId: number,
    role: 'member' | 'admin'
): Promise<AreaMember[]> => {
    const response = await fetch(
        getApiPath(`departments/${areaUid}/members/${userId}/role`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ role }),
        }
    );

    await handleAuthResponse(response, 'Failed to update area member role.');
    const data = await response.json();
    return data.members;
};
