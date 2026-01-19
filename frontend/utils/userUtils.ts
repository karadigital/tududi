import { User } from '../entities/User';
import { Area } from '../entities/Area';

const CURRENT_USER_KEY = 'currentUser';

export const getCurrentUser = (): User | null => {
    try {
        const userJson = localStorage.getItem(CURRENT_USER_KEY);
        if (!userJson) return null;
        return JSON.parse(userJson) as User;
    } catch (error) {
        console.error('Error getting current user from localStorage:', error);
        return null;
    }
};

export const setCurrentUser = (user: User | null): void => {
    try {
        if (user) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    } catch (error) {
        console.error('Error setting current user in localStorage:', error);
    }
};

export const clearCurrentUser = (): void => {
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (error) {
        console.error('Error clearing current user from localStorage:', error);
    }
};

/**
 * Get the current user's role in an area
 * @returns 'admin' | 'member' | null (null if not a member)
 */
export const getAreaRole = (
    area: Area,
    userUid: string | null
): 'admin' | 'member' | null => {
    if (!userUid || !area.Members) return null;

    const membership = area.Members.find((m) => m.uid === userUid);
    if (!membership) return null;

    // Support both snake_case (areas_members) and PascalCase (AreasMember) from API
    const role =
        membership.areas_members?.role || (membership as any).AreasMember?.role;

    return role === 'admin' ? 'admin' : 'member';
};

/**
 * Check if user can edit an area (is system admin, area owner, or department admin)
 */
export const canEditArea = (
    area: Area,
    userUid: string | null,
    isSystemAdmin?: boolean
): boolean => {
    if (!userUid) return false;

    // System admins can edit any area
    if (isSystemAdmin) return true;

    const role = getAreaRole(area, userUid);
    return role === 'admin';
};
