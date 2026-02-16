import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UserGroupIcon,
    UserPlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Area, AreaMember, AreaSubscriber } from '../../entities/Area';
import {
    addAreaMember,
    removeAreaMember,
    updateAreaMemberRole,
    getAreaSubscribers,
    addAreaSubscriber,
    removeAreaSubscriber,
} from '../../utils/areasService';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';
import { useToast } from '../Shared/ToastContext';
import UserAvatar from '../Shared/UserAvatar';
import ConfirmDialog from '../Shared/ConfirmDialog';

interface AreaMembersProps {
    area: Area;
    currentUserUid: string;
    onUpdate?: (members: AreaMember[]) => void;
    readOnly?: boolean;
}

const AreaMembers: React.FC<AreaMembersProps> = ({
    area,
    currentUserUid,
    onUpdate,
    readOnly = false,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [showManageModal, setShowManageModal] = useState(false);
    const [allUsers, setAllUsers] = useState<AreaMember[]>([]);
    const [members, setMembers] = useState<AreaMember[]>(area.Members || []);
    const [loading, setLoading] = useState(false);
    const [subscribers, setSubscribers] = useState<AreaSubscriber[]>([]);
    const [showRetroactiveDropdown, setShowRetroactiveDropdown] = useState<
        number | null
    >(null);
    const [showAdminWarning, setShowAdminWarning] = useState<{
        userId: number;
        action: 'demote' | 'remove';
        userName: string;
    } | null>(null);

    // Support both snake_case (areas_members) and PascalCase (AreasMember) from API
    const getRole = (m: AreaMember) =>
        m.areas_members?.role || (m as any).AreasMember?.role;

    const departmentAdmins = members.filter((m) => getRole(m) === 'admin');
    const regularMembers = members.filter((m) => getRole(m) === 'member');

    useEffect(() => {
        setMembers(area.Members || []);
    }, [area.Members]);

    useEffect(() => {
        if (showManageModal) {
            fetchAllUsers();
        }
    }, [showManageModal]);

    useEffect(() => {
        if (showManageModal && area.uid) {
            fetchSubscribers();
        }
    }, [showManageModal]);

    const fetchSubscribers = async () => {
        if (!area.uid) return;
        try {
            const subs = await getAreaSubscribers(area.uid);
            setSubscribers(subs);
        } catch (err) {
            console.error('Error fetching subscribers:', err);
        }
    };

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

    const handleAddMember = async (
        userId: number,
        role: 'member' | 'admin' = 'member'
    ) => {
        if (!area.uid) return;

        setLoading(true);
        const user = allUsers.find((u) => u.id === userId);
        const userName = user?.name || user?.email || 'User';

        try {
            const updatedMembers = await addAreaMember(area.uid, userId, role);
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
            showSuccessToast(
                t(
                    'area.member_added',
                    '{{name}} has been added to the department',
                    { name: userName }
                )
            );
        } catch (err: any) {
            console.error('Error adding member:', err);
            if (
                err.message ===
                    'User is already a member of another department' &&
                err.departmentName
            ) {
                showErrorToast(
                    t(
                        'area.already_in_department',
                        'This user is already in department {{dept_name}}. Remove them from their current department before adding them here.',
                        { dept_name: err.departmentName }
                    )
                );
            } else {
                showErrorToast(
                    err.message ||
                        t('area.add_member_failed', 'Failed to add member')
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!area.uid) return;

        setLoading(true);
        const user = allUsers.find((u) => u.id === userId);
        const userName = user?.name || user?.email || 'User';

        try {
            const updatedMembers = await removeAreaMember(area.uid, userId);
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
            showSuccessToast(
                t(
                    'area.member_removed',
                    '{{name}} has been removed from the department',
                    { name: userName }
                )
            );
        } catch (err: any) {
            console.error('Error removing member:', err);
            const errorMessage = err.message
                ? `${t('area.remove_member_failed', 'Failed to remove member')}: ${err.message}`
                : t('area.remove_member_failed', 'Failed to remove member');
            showErrorToast(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (
        userId: number,
        newRole: 'member' | 'admin'
    ) => {
        if (!area.uid) return;

        setLoading(true);

        try {
            const updatedMembers = await updateAreaMemberRole(
                area.uid,
                userId,
                newRole
            );
            setMembers(updatedMembers);
            if (onUpdate) {
                onUpdate(updatedMembers);
            }
        } catch (err: any) {
            console.error('Error updating role:', err);
            const errorMessage = err.message
                ? `${t('area.update_role_failed', 'Failed to update role')}: ${err.message}`
                : t('area.update_role_failed', 'Failed to update role');
            showErrorToast(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSubscriber = async (
        userId: number,
        retroactive: boolean
    ) => {
        if (!area.uid) return;
        setLoading(true);
        try {
            const updatedSubs = await addAreaSubscriber(
                area.uid,
                userId,
                retroactive
            );
            setSubscribers(updatedSubs);
            setShowRetroactiveDropdown(null);
            showSuccessToast(t('area.subscriber_added', 'Subscriber added'));
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('area.add_subscriber_failed', 'Failed to add subscriber')
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSubscriber = async (userId: number) => {
        if (!area.uid) return;
        setLoading(true);
        try {
            const updatedSubs = await removeAreaSubscriber(area.uid, userId);
            setSubscribers(updatedSubs);
            showSuccessToast(
                t('area.subscriber_removed', 'Subscriber removed')
            );
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t(
                        'area.remove_subscriber_failed',
                        'Failed to remove subscriber'
                    )
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChangeWithWarning = (
        userId: number,
        newRole: 'member' | 'admin'
    ) => {
        if (newRole === 'member') {
            const sub = subscribers.find(
                (s) =>
                    s.id === userId &&
                    s.AreasSubscriber?.source === 'admin_role'
            );
            if (sub) {
                const userName = sub.name || sub.email;
                setShowAdminWarning({
                    userId,
                    action: 'demote',
                    userName,
                });
                return;
            }
        }
        handleChangeRole(userId, newRole);
    };

    const handleRemoveWithWarning = (userId: number) => {
        const member = members.find((m) => m.id === userId);
        if (member && getRole(member) === 'admin') {
            const sub = subscribers.find(
                (s) =>
                    s.id === userId &&
                    s.AreasSubscriber?.source === 'admin_role'
            );
            if (sub) {
                const userName = member.name || member.email;
                setShowAdminWarning({
                    userId,
                    action: 'remove',
                    userName,
                });
                return;
            }
        }
        handleRemoveMember(userId);
    };

    const confirmAdminWarning = async () => {
        if (!showAdminWarning) return;
        if (showAdminWarning.action === 'demote') {
            await handleChangeRole(showAdminWarning.userId, 'member');
        } else {
            await handleRemoveMember(showAdminWarning.userId);
        }
        // Refresh subscribers after role/removal change
        await fetchSubscribers();
        setShowAdminWarning(null);
    };

    const renderMemberBadge = (member: AreaMember) => (
        <div
            key={member.uid}
            className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1"
        >
            <UserAvatar
                avatarImage={member.avatar_image}
                name={member.name}
                email={member.email}
                size="sm"
            />
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
                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => setShowManageModal(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                    >
                        <UserPlusIcon className="h-4 w-4" />
                        <span>{t('area.manage_members', 'Manage')}</span>
                    </button>
                )}
            </div>

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
                                        (m) => m.uid === user.uid
                                    );
                                    const isMember = !!member;
                                    const role = member
                                        ? getRole(member) || 'member'
                                        : 'member';
                                    const isCurrentUser =
                                        user.uid === currentUserUid;

                                    return (
                                        <div
                                            key={user.uid}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <UserAvatar
                                                    avatarImage={
                                                        user.avatar_image
                                                    }
                                                    name={user.name}
                                                    email={user.email}
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.name ||
                                                            user.email}
                                                        {isCurrentUser && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                (
                                                                {t(
                                                                    'common.you',
                                                                    'You'
                                                                )}
                                                                )
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
                                                            handleRoleChangeWithWarning(
                                                                user.id,
                                                                e.target
                                                                    .value as
                                                                    | 'member'
                                                                    | 'admin'
                                                            )
                                                        }
                                                        disabled={loading}
                                                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="member">
                                                            {t(
                                                                'area.role_member',
                                                                'Member'
                                                            )}
                                                        </option>
                                                        <option value="admin">
                                                            {t(
                                                                'area.role_admin',
                                                                'Admin'
                                                            )}
                                                        </option>
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        isMember
                                                            ? handleRemoveWithWarning(
                                                                  user.id
                                                              )
                                                            : handleAddMember(
                                                                  user.id,
                                                                  'member'
                                                              )
                                                    }
                                                    disabled={loading}
                                                    className={`px-3 py-1 text-sm rounded ${
                                                        isMember
                                                            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
                                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {isMember
                                                        ? t(
                                                              'common.remove',
                                                              'Remove'
                                                          )
                                                        : t(
                                                              'common.add',
                                                              'Add'
                                                          )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Subscribers section */}
                            <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                                <div className="mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {t('area.subscribers', 'Subscribers')}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            'area.subscribers_subtitle',
                                            'These users are automatically subscribed to new tasks in this department'
                                        )}
                                    </p>
                                </div>

                                {/* Current subscribers */}
                                <div className="space-y-2 mb-3">
                                    {subscribers.map((sub) => {
                                        const source =
                                            sub.AreasSubscriber?.source;
                                        const isAdminSource =
                                            source === 'admin_role';

                                        return (
                                            <div
                                                key={sub.uid}
                                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <UserAvatar
                                                        avatarImage={
                                                            sub.avatar_image
                                                        }
                                                        name={sub.name}
                                                        email={sub.email}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {sub.name ||
                                                                sub.email}
                                                        </p>
                                                        <span
                                                            className={`text-xs px-1.5 py-0.5 rounded ${
                                                                isAdminSource
                                                                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                                                    : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                                            }`}
                                                        >
                                                            {isAdminSource
                                                                ? t(
                                                                      'area.source_admin',
                                                                      'Admin'
                                                                  )
                                                                : t(
                                                                      'area.source_manual',
                                                                      'Manual'
                                                                  )}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!readOnly &&
                                                    !isAdminSource && (
                                                        <button
                                                            onClick={() =>
                                                                handleRemoveSubscriber(
                                                                    sub.id
                                                                )
                                                            }
                                                            disabled={loading}
                                                            className="px-3 py-1 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 disabled:opacity-50"
                                                        >
                                                            {t(
                                                                'common.remove',
                                                                'Remove'
                                                            )}
                                                        </button>
                                                    )}
                                            </div>
                                        );
                                    })}
                                    {subscribers.length === 0 && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {t(
                                                'area.no_subscribers',
                                                'No subscribers'
                                            )}
                                        </p>
                                    )}
                                </div>

                                {/* Add subscriber */}
                                {!readOnly && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {t(
                                                'area.add_subscriber',
                                                'Add subscriber'
                                            )}
                                        </p>
                                        {allUsers
                                            .filter(
                                                (u) =>
                                                    !subscribers.some(
                                                        (s) => s.uid === u.uid
                                                    )
                                            )
                                            .map((user) => (
                                                <div
                                                    key={user.uid}
                                                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <UserAvatar
                                                            avatarImage={
                                                                user.avatar_image
                                                            }
                                                            name={user.name}
                                                            email={user.email}
                                                            size="sm"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-200">
                                                            {user.name ||
                                                                user.email}
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        {showRetroactiveDropdown ===
                                                        user.id ? (
                                                            <div className="flex items-center space-x-1">
                                                                <button
                                                                    onClick={() =>
                                                                        handleAddSubscriber(
                                                                            user.id,
                                                                            false
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        loading
                                                                    }
                                                                    className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 disabled:opacity-50"
                                                                >
                                                                    {t(
                                                                        'area.future_only',
                                                                        'Future tasks only'
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        handleAddSubscriber(
                                                                            user.id,
                                                                            true
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        loading
                                                                    }
                                                                    className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 disabled:opacity-50"
                                                                >
                                                                    {t(
                                                                        'area.all_tasks',
                                                                        'All existing + future'
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        setShowRetroactiveDropdown(
                                                                            null
                                                                        )
                                                                    }
                                                                    className="px-1 py-1 text-xs text-gray-500 hover:text-gray-700"
                                                                >
                                                                    <XMarkIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    setShowRetroactiveDropdown(
                                                                        user.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    loading
                                                                }
                                                                className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 disabled:opacity-50"
                                                            >
                                                                {t(
                                                                    'common.add',
                                                                    'Add'
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
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
                    {showAdminWarning && (
                        <ConfirmDialog
                            title={t(
                                'area.admin_warning_title',
                                'Remove subscriber?'
                            )}
                            message={t(
                                'area.admin_warning_message',
                                "Removing {{name}} as department admin will also remove them from the auto-subscribers list. They will keep existing task subscriptions but won't be auto-subscribed to new tasks. Continue?",
                                {
                                    name: showAdminWarning.userName,
                                }
                            )}
                            onConfirm={confirmAdminWarning}
                            onCancel={() => setShowAdminWarning(null)}
                            confirmButtonText={t('common.continue', 'Continue')}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default AreaMembers;
