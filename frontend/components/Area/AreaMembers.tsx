import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserGroupIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Area, AreaMember } from '../../entities/Area';
import {
    addAreaMember,
    removeAreaMember,
    updateAreaMemberRole,
} from '../../utils/areasService';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';

interface AreaMembersProps {
    area: Area;
    currentUserId: number;
    onUpdate?: (members: AreaMember[]) => void;
}

const AreaMembers: React.FC<AreaMembersProps> = ({
    area,
    currentUserId,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [showManageModal, setShowManageModal] = useState(false);
    const [allUsers, setAllUsers] = useState<AreaMember[]>([]);
    const [members, setMembers] = useState<AreaMember[]>(area.Members || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const departmentAdmins = members.filter(
        (m) => m.areas_members?.role === 'admin'
    );
    const regularMembers = members.filter(
        (m) => m.areas_members?.role === 'member'
    );

    useEffect(() => {
        setMembers(area.Members || []);
    }, [area.Members]);

    useEffect(() => {
        if (showManageModal) {
            fetchAllUsers();
        }
    }, [showManageModal]);

    const fetchAllUsers = async () => {
        try {
            const response = await fetch(getApiPath('users'), {
                credentials: 'include',
                headers: getDefaultHeaders(),
            });

            if (response.ok) {
                const users = await response.json();
                setAllUsers(users);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const handleAddMember = async (userId: number, role: 'member' | 'admin' = 'member') => {
        if (!area.uid) return;

        setLoading(true);
        setError(null);

        try {
            const updatedMembers = await addAreaMember(area.uid, userId, role);
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
        } catch (err: any) {
            console.error('Error adding member:', err);
            console.error('Error details:', {
                message: err.message,
                response: err.response,
                status: err.status
            });
            setError(err.message || 'Failed to add member');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!area.uid) return;

        setLoading(true);
        setError(null);

        try {
            const updatedMembers = await removeAreaMember(area.uid, userId);
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to remove member');
            console.error('Error removing member:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (userId: number, newRole: 'member' | 'admin') => {
        if (!area.uid) return;

        setLoading(true);
        setError(null);

        try {
            const updatedMembers = await updateAreaMemberRole(area.uid, userId, newRole);
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update role');
            console.error('Error updating role:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderMemberBadge = (member: AreaMember) => (
        <div
            key={member.id}
            className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1"
        >
            {member.avatar_image ? (
                <img
                    src={getApiPath(member.avatar_image)}
                    alt={member.name || member.email}
                    className="h-6 w-6 rounded-full object-cover"
                />
            ) : (
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                    {(member.name || member.email)[0].toUpperCase()}
                </div>
            )}
            <span className="text-sm text-gray-700 dark:text-gray-200">
                {member.name || member.email}
            </span>
        </div>
    );

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <UserGroupIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('area.members', 'Members')}
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => setShowManageModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                >
                    <UserPlusIcon className="h-4 w-4" />
                    <span>{t('area.manage_members', 'Manage')}</span>
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Members list */}
            <div className="space-y-3">
                {/* Department Admins */}
                {departmentAdmins.length > 0 && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {t('area.department_admins', 'Department Admins')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {departmentAdmins.map(renderMemberBadge)}
                        </div>
                    </div>
                )}

                {/* Regular Members */}
                {regularMembers.length > 0 && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {t('area.regular_members', 'Members')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {regularMembers.map(renderMemberBadge)}
                        </div>
                    </div>
                )}

                {/* No members message */}
                {members.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('area.no_members', 'No members')}
                    </p>
                )}
            </div>

            {/* Manage members modal */}
            {showManageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('area.manage_members', 'Manage Members')}
                            </h3>
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-4 overflow-y-auto flex-1">
                            <div className="space-y-2">
                                {allUsers.map((user) => {
                                    const member = members.find(
                                        (m) => m.id === user.id
                                    );
                                    const isMember = !!member;
                                    const role = member?.areas_members?.role || 'member';
                                    const isCurrentUser = user.id === currentUserId;

                                    return (
                                        <div
                                            key={user.id}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {user.avatar_image ? (
                                                    <img
                                                        src={getApiPath(user.avatar_image)}
                                                        alt={user.name || user.email}
                                                        className="h-8 w-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
                                                        {(user.name || user.email)[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.name || user.email}
                                                        {isCurrentUser && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                ({t('common.you', 'You')})
                                                            </span>
                                                        )}
                                                    </p>
                                                    {user.name && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {isMember && (
                                                    <select
                                                        value={role}
                                                        onChange={(e) =>
                                                            handleChangeRole(
                                                                user.id,
                                                                e.target.value as 'member' | 'admin'
                                                            )
                                                        }
                                                        disabled={loading}
                                                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="member">
                                                            {t('area.role_member', 'Member')}
                                                        </option>
                                                        <option value="admin">
                                                            {t('area.role_admin', 'Admin')}
                                                        </option>
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        isMember
                                                            ? handleRemoveMember(user.id)
                                                            : handleAddMember(user.id, 'member')
                                                    }
                                                    disabled={loading}
                                                    className={`px-3 py-1 text-sm rounded ${
                                                        isMember
                                                            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
                                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {isMember
                                                        ? t('common.remove', 'Remove')
                                                        : t('common.add', 'Add')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            >
                                {t('common.done', 'Done')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AreaMembers;
