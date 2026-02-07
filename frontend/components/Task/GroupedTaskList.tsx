import React, { useState, useMemo } from 'react';
import {
    ChevronRightIcon,
    ChevronDownIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { GroupedTasks } from '../../utils/tasksService';

interface GroupedTaskListProps {
    tasks: Task[];
    groupedTasks?: GroupedTasks | null;
    groupBy?:
        | 'none'
        | 'project'
        | 'assignee'
        | 'status'
        | 'involvement'
        | 'workspace'
        | 'workspace_project';
    currentUserUid?: string | null;
    onTaskUpdate: (task: Partial<Task>) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskCreate?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    showCompletedTasks?: boolean;
    searchQuery?: string;
}

interface TaskGroup {
    template: Task;
    instances: Task[];
}

interface ProjectGroup {
    key: string;
    projectId?: number;
    projectUid?: string;
    tasks: Task[];
    order: number;
}

interface AssigneeGroup {
    key: 'unassigned' | 'assigned_to_me' | 'assigned_to_others';
    label: string;
    tasks: Task[];
    order: number;
}

interface StatusGroup {
    key: 'not_started' | 'in_progress' | 'waiting' | 'done' | 'archived';
    label: string;
    tasks: Task[];
    order: number;
}

interface InvolvementGroup {
    key: 'assigned_to_me' | 'assigned_to_others' | 'subscribed';
    label: string;
    tasks: Task[];
    order: number;
}

interface WorkspaceGroup {
    key: string;
    workspaceName: string;
    tasks: Task[];
    order: number;
}

interface WorkspaceProjectGroup {
    key: string;
    workspaceName: string;
    projects: {
        key: string;
        projectName: string;
        tasks: Task[];
    }[];
    order: number;
}

const getFilteredTasks = (
    tasks: Task[],
    showCompletedTasks: boolean,
    searchQuery: string
): Task[] => {
    const filtered = showCompletedTasks
        ? tasks
        : tasks.filter((task) => {
              const isCompleted =
                  task.status === 'done' ||
                  task.status === 'archived' ||
                  task.status === 2 ||
                  task.status === 3;
              return !isCompleted;
          });

    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
        (task) =>
            (task.name || '').toLowerCase().includes(query) ||
            (task.note || '').toLowerCase().includes(query)
    );
};

const GroupedTaskList: React.FC<GroupedTaskListProps> = ({
    tasks,
    groupedTasks,
    groupBy = 'none',
    currentUserUid,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    showCompletedTasks = false,
    searchQuery = '',
}) => {
    const { t } = useTranslation();

    const [expandedRecurringGroups, setExpandedRecurringGroups] = useState<
        Set<number>
    >(new Set());

    // If we have day-based groupedTasks from API, use those instead of recurring groups
    const shouldUseDayGrouping =
        groupedTasks && Object.keys(groupedTasks).length > 0;

    // Group tasks by recurring template (legacy behavior)
    const { recurringGroups, standaloneTask } = useMemo(() => {
        if (shouldUseDayGrouping) {
            // For day grouping, we don't need recurring groups
            return { recurringGroups: [], standaloneTask: [] };
        }

        const filteredTasks = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        const groups = new Map<number, TaskGroup>();
        const standalone: Task[] = [];

        filteredTasks.forEach((task) => {
            if (task.recurring_parent_id) {
                // This is a recurring instance
                const parentId = task.recurring_parent_id;
                if (!groups.has(parentId)) {
                    // Find the template task in the current results
                    let template = filteredTasks.find((t) => t.id === parentId);

                    // If template not found in results, create a placeholder using the instance data
                    if (!template) {
                        // Create a virtual template task based on the instance
                        template = {
                            ...task,
                            id: parentId,
                            recurring_parent_id: null, // This makes it the template
                            due_date: null, // Templates don't have specific due dates
                            name: task.name, // Keep the same name
                            isVirtualTemplate: true, // Flag to identify virtual templates
                        } as Task & { isVirtualTemplate?: boolean };
                    }
                    groups.set(parentId, { template, instances: [] });
                }
                const group = groups.get(parentId);
                if (group) {
                    group.instances.push(task);
                }
            } else if (
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                // This is a recurring template - check if it has instances
                const instances = filteredTasks.filter(
                    (t) => t.recurring_parent_id === task.id
                );
                if (instances.length > 0) {
                    groups.set(task.id!, { template: task, instances });
                } else {
                    // Template without instances, show as standalone
                    standalone.push(task);
                }
            } else {
                // Regular task
                standalone.push(task);
            }
        });

        return {
            recurringGroups: Array.from(groups.values()),
            standaloneTask: standalone,
        };
    }, [tasks, showCompletedTasks, searchQuery, shouldUseDayGrouping]);

    // Filter grouped tasks for completed status and search query
    const filteredGroupedTasks = useMemo(() => {
        if (!shouldUseDayGrouping || !groupedTasks) return {};

        const filtered: GroupedTasks = {};
        Object.entries(groupedTasks).forEach(([groupName, groupTasks]) => {
            const result = getFilteredTasks(
                groupTasks,
                showCompletedTasks,
                searchQuery
            );
            if (result.length > 0) {
                filtered[groupName] = result;
            }
        });
        return filtered;
    }, [groupedTasks, showCompletedTasks, shouldUseDayGrouping, searchQuery]);

    // Group tasks by project when requested (only applies to standalone view)
    const groupedByProject = useMemo(() => {
        if (groupBy !== 'project') return null;

        const normalizeProjectId = (
            value: number | string | null | undefined
        ): number | undefined => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const parsed = Number(value);
                return Number.isNaN(parsed) ? undefined : parsed;
            }
            return undefined;
        };

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        const getGroupKey = (
            projectId?: number,
            projectUid?: string
        ): string => {
            if (projectId !== undefined && projectId !== null) {
                return `id-${projectId}`;
            }
            if (projectUid) {
                return `uid-${projectUid}`;
            }
            return 'no_project';
        };

        const byProject = new Map<string, ProjectGroup>();
        filteredBySearch.forEach((task) => {
            const resolvedProjectId =
                normalizeProjectId(task.project_id) ??
                normalizeProjectId(task.Project?.id);
            const resolvedProjectUid =
                task.project_uid || task.Project?.uid || undefined;

            const key = getGroupKey(resolvedProjectId, resolvedProjectUid);

            if (!byProject.has(key)) {
                byProject.set(key, {
                    key,
                    projectId: resolvedProjectId,
                    projectUid: resolvedProjectUid,
                    tasks: [],
                    order: byProject.size,
                });
            }
            byProject.get(key)!.tasks.push(task);
        });

        const groups = Array.from(byProject.values());
        groups.sort((a, b) => {
            if (a.key === 'no_project' && b.key !== 'no_project') {
                return -1;
            }
            if (b.key === 'no_project' && a.key !== 'no_project') {
                return 1;
            }
            return a.order - b.order;
        });

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery]);

    // Group tasks by assignee when requested (only applies to standalone view)
    const groupedByAssignee = useMemo(() => {
        if (groupBy !== 'assignee') return null;

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        // Categorize tasks into 3 groups
        const unassignedTasks: Task[] = [];
        const assignedToMeTasks: Task[] = [];
        const assignedToOthersTasks: Task[] = [];

        filteredBySearch.forEach((task) => {
            if (!task.assigned_to_user_id) {
                unassignedTasks.push(task);
            } else if (
                currentUserUid !== null &&
                task.AssignedTo?.uid === currentUserUid
            ) {
                assignedToMeTasks.push(task);
            } else {
                assignedToOthersTasks.push(task);
            }
        });

        // Build groups array (only include non-empty groups)
        const groups: AssigneeGroup[] = [];

        if (unassignedTasks.length > 0) {
            groups.push({
                key: 'unassigned',
                label: t('tasks.unassigned', 'Unassigned'),
                tasks: unassignedTasks,
                order: 0,
            });
        }

        if (assignedToMeTasks.length > 0) {
            groups.push({
                key: 'assigned_to_me',
                label: t('tasks.assignedToMe', 'Assigned to me'),
                tasks: assignedToMeTasks,
                order: 1,
            });
        }

        if (assignedToOthersTasks.length > 0) {
            groups.push({
                key: 'assigned_to_others',
                label: t('tasks.assignedToOthers', 'Assigned to others'),
                tasks: assignedToOthersTasks,
                order: 2,
            });
        }

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery, currentUserUid, t]);

    // Group tasks by status when requested
    const groupedByStatus = useMemo(() => {
        if (groupBy !== 'status') return null;

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        // Categorize tasks into 5 status groups
        const notStartedTasks: Task[] = [];
        const inProgressTasks: Task[] = [];
        const waitingTasks: Task[] = [];
        const doneTasks: Task[] = [];
        const archivedTasks: Task[] = [];

        filteredBySearch.forEach((task) => {
            if (task.status === 'not_started' || task.status === 0) {
                notStartedTasks.push(task);
            } else if (task.status === 'in_progress' || task.status === 1) {
                inProgressTasks.push(task);
            } else if (task.status === 'waiting' || task.status === 4) {
                waitingTasks.push(task);
            } else if (task.status === 'done' || task.status === 2) {
                doneTasks.push(task);
            } else if (task.status === 'archived' || task.status === 3) {
                archivedTasks.push(task);
            }
        });

        // Build groups array (only include non-empty groups)
        const groups: StatusGroup[] = [];

        if (inProgressTasks.length > 0) {
            groups.push({
                key: 'in_progress',
                label: t('task.status.inProgress', 'In Progress'),
                tasks: inProgressTasks,
                order: 0,
            });
        }

        if (notStartedTasks.length > 0) {
            groups.push({
                key: 'not_started',
                label: t('task.status.notStarted', 'Not Started'),
                tasks: notStartedTasks,
                order: 1,
            });
        }

        if (waitingTasks.length > 0) {
            groups.push({
                key: 'waiting',
                label: t('task.status.waiting', 'Waiting'),
                tasks: waitingTasks,
                order: 2,
            });
        }

        if (doneTasks.length > 0) {
            groups.push({
                key: 'done',
                label: t('task.status.done', 'Done'),
                tasks: doneTasks,
                order: 3,
            });
        }

        if (archivedTasks.length > 0) {
            groups.push({
                key: 'archived',
                label: t('task.status.archived', 'Archived'),
                tasks: archivedTasks,
                order: 4,
            });
        }

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery, t]);

    // Group tasks by involvement when requested
    // Note: Tasks CAN appear in multiple groups (e.g., assigned to me AND subscribed)
    const groupedByInvolvement = useMemo(() => {
        if (groupBy !== 'involvement') return null;

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        // Categorize tasks into 3 involvement groups
        // Note: A task CAN appear in multiple groups (intentional per design)
        const assignedToMeTasks: Task[] = [];
        const assignedToOthersTasks: Task[] = [];
        const subscribedTasks: Task[] = [];

        filteredBySearch.forEach((task) => {
            // Check if assigned to current user (using uid for consistency)
            if (
                currentUserUid !== null &&
                task.AssignedTo?.uid === currentUserUid
            ) {
                assignedToMeTasks.push(task);
            }

            // Check if assigned to someone else (not null/undefined and not current user)
            if (
                task.AssignedTo != null &&
                task.AssignedTo.uid !== currentUserUid
            ) {
                assignedToOthersTasks.push(task);
            }

            // Check if current user is a subscriber (using uid for consistency)
            if (task.Subscribers?.some((s) => s.uid === currentUserUid)) {
                subscribedTasks.push(task);
            }
        });

        // Always return all 3 groups (even if empty) for consistent UI
        const groups: InvolvementGroup[] = [
            {
                key: 'assigned_to_me',
                label: t('tasks.assignedToMe', 'Assigned to me'),
                tasks: assignedToMeTasks,
                order: 0,
            },
            {
                key: 'assigned_to_others',
                label: t('tasks.assignedToOthers', 'Assigned to others'),
                tasks: assignedToOthersTasks,
                order: 1,
            },
            {
                key: 'subscribed',
                label: t('tasks.subscribed', 'Subscribed'),
                tasks: subscribedTasks,
                order: 2,
            },
        ];

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery, currentUserUid, t]);

    // Group tasks by workspace when requested
    const groupedByWorkspace = useMemo(() => {
        if (groupBy !== 'workspace') return null;

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        const byWorkspace = new Map<string, WorkspaceGroup>();
        filteredBySearch.forEach((task) => {
            const workspace = task.Project?.Workspace;
            const key = workspace?.uid || 'no_workspace';
            const workspaceName = workspace?.name || '';

            if (!byWorkspace.has(key)) {
                byWorkspace.set(key, {
                    key,
                    workspaceName,
                    tasks: [],
                    order: byWorkspace.size,
                });
            }
            byWorkspace.get(key)!.tasks.push(task);
        });

        const groups = Array.from(byWorkspace.values());
        groups.sort((a, b) => {
            if (a.key === 'no_workspace' && b.key !== 'no_workspace') return -1;
            if (b.key === 'no_workspace' && a.key !== 'no_workspace') return 1;
            return a.order - b.order;
        });

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery]);

    // Group tasks by workspace and then by project within each workspace
    const groupedByWorkspaceProject = useMemo(() => {
        if (groupBy !== 'workspace_project') return null;

        const filteredBySearch = getFilteredTasks(
            tasks,
            showCompletedTasks,
            searchQuery
        );

        const byWorkspace = new Map<
            string,
            {
                key: string;
                workspaceName: string;
                projectMap: Map<
                    string,
                    { key: string; projectName: string; tasks: Task[] }
                >;
                order: number;
            }
        >();

        filteredBySearch.forEach((task) => {
            const workspace = task.Project?.Workspace;
            const wsKey = workspace?.uid || 'no_workspace';
            const wsName = workspace?.name || '';

            if (!byWorkspace.has(wsKey)) {
                byWorkspace.set(wsKey, {
                    key: wsKey,
                    workspaceName: wsName,
                    projectMap: new Map(),
                    order: byWorkspace.size,
                });
            }

            const wsGroup = byWorkspace.get(wsKey)!;
            const projectKey =
                task.Project?.uid ||
                task.Project?.id?.toString() ||
                'no_project';
            const projectName = task.Project?.name || '';

            if (!wsGroup.projectMap.has(projectKey)) {
                wsGroup.projectMap.set(projectKey, {
                    key: projectKey,
                    projectName,
                    tasks: [],
                });
            }
            wsGroup.projectMap.get(projectKey)!.tasks.push(task);
        });

        const groups: WorkspaceProjectGroup[] = Array.from(byWorkspace.values())
            .sort((a, b) => {
                if (a.key === 'no_workspace' && b.key !== 'no_workspace')
                    return -1;
                if (b.key === 'no_workspace' && a.key !== 'no_workspace')
                    return 1;
                return a.order - b.order;
            })
            .map((ws) => ({
                key: ws.key,
                workspaceName: ws.workspaceName,
                projects: Array.from(ws.projectMap.values()).sort((a, b) => {
                    // "No project" always comes first within each workspace
                    if (a.key === 'no_project' && b.key !== 'no_project')
                        return -1;
                    if (b.key === 'no_project' && a.key !== 'no_project')
                        return 1;
                    return 0;
                }),
                order: ws.order,
            }));

        return groups;
    }, [groupBy, tasks, showCompletedTasks, searchQuery]);

    const toggleRecurringGroup = (templateId: number) => {
        setExpandedRecurringGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) {
                newSet.delete(templateId);
            } else {
                newSet.add(templateId);
            }
            return newSet;
        });
    };

    const formatRecurrence = (recurrenceType: string) => {
        switch (recurrenceType) {
            case 'daily':
                return t('recurrence.daily', 'Daily');
            case 'weekly':
                return t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return t('recurrence.monthly', 'Monthly');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    const renderTaskItem = (task: Task) => (
        <div
            key={task.id}
            className="task-item-wrapper transition-all duration-200 ease-in-out"
        >
            <TaskItem
                task={task}
                onTaskUpdate={onTaskUpdate}
                onTaskCompletionToggle={onTaskCompletionToggle}
                onTaskDelete={onTaskDelete}
                projects={projects}
                hideProjectName={hideProjectName}
                onToggleToday={onToggleToday}
            />
        </div>
    );

    const renderGroupSection = (
        key: string,
        label: string,
        groupTasks: Task[],
        index: number,
        options?: { showEmptyState?: boolean }
    ) => (
        <div
            key={key}
            className={`space-y-1.5 pb-4 mb-2 border-b border-gray-200/50 dark:border-gray-800/60 last:border-b-0 ${index > 0 ? 'pt-4' : ''}`}
        >
            <div className="flex items-center justify-between px-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                <span className="truncate">{label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {groupTasks.length} {t('tasks.tasks', 'tasks')}
                </span>
            </div>
            {groupTasks.length > 0
                ? groupTasks.map(renderTaskItem)
                : options?.showEmptyState && (
                      <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
                          {t('tasks.noTasksInGroup', 'No tasks in this group')}
                      </div>
                  )}
        </div>
    );

    const renderGroupedContent = () => {
        if (groupBy === 'project' && groupedByProject) {
            return groupedByProject.map(
                (
                    { key, projectId, projectUid, tasks: projectTasks },
                    index
                ) => {
                    const matchingProject = projects.find((p) => {
                        if (
                            projectId !== undefined &&
                            projectId !== null &&
                            p.id === projectId
                        )
                            return true;
                        if (projectUid && p.uid === projectUid) return true;
                        return false;
                    });
                    const projectName =
                        matchingProject?.name ||
                        projectTasks[0]?.Project?.name ||
                        (key === 'no_project'
                            ? t('tasks.noProject', 'No project')
                            : t('tasks.unknownProject', 'Unknown project'));
                    return renderGroupSection(
                        key,
                        projectName,
                        projectTasks,
                        index
                    );
                }
            );
        }

        if (groupBy === 'status' && groupedByStatus) {
            return groupedByStatus.map(
                ({ key, label, tasks: statusTasks }, index) =>
                    renderGroupSection(key, label, statusTasks, index)
            );
        }

        if (groupBy === 'assignee' && groupedByAssignee) {
            return groupedByAssignee.map(
                ({ key, label, tasks: assigneeTasks }, index) =>
                    renderGroupSection(key, label, assigneeTasks, index)
            );
        }

        if (groupBy === 'involvement' && groupedByInvolvement) {
            return groupedByInvolvement.map(
                ({ key, label, tasks: involvementTasks }, index) =>
                    renderGroupSection(key, label, involvementTasks, index, {
                        showEmptyState: true,
                    })
            );
        }

        if (groupBy === 'workspace' && groupedByWorkspace) {
            return groupedByWorkspace.map(
                ({ key, workspaceName, tasks: workspaceTasks }, index) => {
                    const displayName =
                        key === 'no_workspace'
                            ? t('tasks.noWorkspace', 'No workspace')
                            : workspaceName;
                    return renderGroupSection(
                        key,
                        displayName,
                        workspaceTasks,
                        index
                    );
                }
            );
        }

        if (groupBy === 'workspace_project' && groupedByWorkspaceProject) {
            return groupedByWorkspaceProject.map(
                ({ key, workspaceName, projects: wsProjects }, index) => {
                    const displayName =
                        key === 'no_workspace'
                            ? t('tasks.noWorkspace', 'No workspace')
                            : `${t('tasks.workspacePrefix', 'Workspace')}: ${workspaceName}`;
                    return (
                        <div
                            key={key}
                            className={`space-y-1.5 pb-4 mb-2 border-b border-gray-200/50 dark:border-gray-800/60 last:border-b-0 ${index > 0 ? 'pt-4' : ''}`}
                        >
                            <div className="flex items-center justify-between px-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                                <span className="truncate">{displayName}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {wsProjects.reduce(
                                        (sum, p) => sum + p.tasks.length,
                                        0
                                    )}{' '}
                                    {t('tasks.tasks', 'tasks')}
                                </span>
                            </div>
                            {wsProjects.map(
                                ({
                                    key: pKey,
                                    projectName,
                                    tasks: projectTasks,
                                }) => (
                                    <div key={pKey} className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1 text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                                            <span className="truncate">
                                                {projectName
                                                    ? `${t('tasks.projectPrefix', 'Project')}: ${projectName}`
                                                    : t(
                                                          'tasks.noProject',
                                                          'No project'
                                                      )}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {projectTasks.length}
                                            </span>
                                        </div>
                                        {projectTasks.map(renderTaskItem)}
                                    </div>
                                )
                            )}
                        </div>
                    );
                }
            );
        }

        return standaloneTask.map(renderTaskItem);
    };

    // Render day-based grouping if available
    if (shouldUseDayGrouping) {
        return (
            <div className="task-board-container">
                {Object.keys(filteredGroupedTasks).length === 0 ? (
                    <div className="flex justify-center items-center mt-4">
                        <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                            <svg
                                className="h-20 w-20 text-gray-400 opacity-30 mb-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                />
                            </svg>
                            <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                                {t(
                                    'tasks.noTasksAvailable',
                                    'No tasks available.'
                                )}
                            </p>
                            <p className="text-base text-center text-gray-400 dark:text-gray-400">
                                {t(
                                    'tasks.blankSlateHint',
                                    'Start by creating a new task or changing your filters.'
                                )}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Responsive board layout */
                    <div className="pb-4">
                        {/* Mobile: Stack vertically, Desktop: Horizontal board */}
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
                            {Object.entries(filteredGroupedTasks).map(
                                ([groupName, dayTasks]) => {
                                    return (
                                        <div
                                            key={groupName}
                                            className="day-column w-full md:flex-1 md:min-w-64"
                                        >
                                            {/* Day column header */}
                                            <div className="pb-3 mb-4">
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                    {groupName}
                                                </h3>
                                            </div>

                                            {/* Day column tasks */}
                                            <div className="space-y-1.5">
                                                {dayTasks.map((task) => (
                                                    <div key={task.id}>
                                                        <TaskItem
                                                            task={task}
                                                            onTaskUpdate={
                                                                onTaskUpdate
                                                            }
                                                            onTaskCompletionToggle={
                                                                onTaskCompletionToggle
                                                            }
                                                            onTaskDelete={
                                                                onTaskDelete
                                                            }
                                                            projects={projects}
                                                            hideProjectName={
                                                                hideProjectName
                                                            }
                                                            onToggleToday={
                                                                onToggleToday
                                                            }
                                                            isUpcomingView={
                                                                true
                                                            }
                                                            showCompletedTasks={
                                                                showCompletedTasks
                                                            }
                                                        />
                                                    </div>
                                                ))}

                                                {/* Empty state for columns with no tasks */}
                                                {dayTasks.length === 0 && (
                                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                                        <p className="text-sm">
                                                            {t(
                                                                'tasks.noTasksScheduled',
                                                                'No tasks scheduled'
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Legacy: Render recurring task grouping
    return (
        <div className="task-list-container space-y-1.5">
            {renderGroupedContent()}

            {/* Grouped recurring tasks */}
            {recurringGroups.map((group) => {
                const isVirtualTemplate = (group.template as any)
                    .isVirtualTemplate;
                const isExpanded =
                    expandedRecurringGroups.has(group.template.id!) ||
                    isVirtualTemplate; // Auto-expand virtual templates

                return (
                    <div
                        key={group.template.id}
                        className="recurring-task-group mb-2"
                    >
                        {/* Show template only if it's not virtual */}
                        {!isVirtualTemplate && (
                            <div className="relative">
                                <div className="flex items-center">
                                    <div className="flex-1">
                                        <TaskItem
                                            task={group.template}
                                            onTaskUpdate={onTaskUpdate}
                                            onTaskCompletionToggle={
                                                onTaskCompletionToggle
                                            }
                                            onTaskDelete={onTaskDelete}
                                            projects={projects}
                                            hideProjectName={hideProjectName}
                                            onToggleToday={onToggleToday}
                                        />
                                    </div>
                                </div>

                                {/* Recurring instances count and expand button */}
                                {group.instances.length > 0 && (
                                    <button
                                        onClick={() =>
                                            toggleRecurringGroup(
                                                group.template.id!
                                            )
                                        }
                                        className="absolute top-3 right-3 flex items-center space-x-2 px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                        <ArrowPathIcon className="h-3 w-3" />
                                        <span>
                                            {group.instances.length}{' '}
                                            {t('task.upcoming', 'upcoming')}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronDownIcon className="h-3 w-3" />
                                        ) : (
                                            <ChevronRightIcon className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* For virtual templates, show a simple header */}
                        {isVirtualTemplate && group.instances.length > 0 && (
                            <div className="mb-2 flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <ArrowPathIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                    {group.template.name} -{' '}
                                    {formatRecurrence(
                                        group.template.recurrence_type!
                                    )}
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {group.instances.length}{' '}
                                    {t('task.upcoming', 'upcoming')}
                                </span>
                            </div>
                        )}

                        {/* Expanded instances */}
                        {isExpanded && group.instances.length > 0 && (
                            <div
                                className={`mt-2 space-y-1.5 border-l-2 border-blue-200 dark:border-blue-800 pl-4 ${!isVirtualTemplate ? 'ml-8' : 'ml-4'}`}
                            >
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                                    {formatRecurrence(
                                        group.template.recurrence_type!
                                    )}{' '}
                                    {t('recurrence.instances', 'instances')}
                                </div>
                                {group.instances
                                    .sort(
                                        (a, b) =>
                                            new Date(
                                                a.due_date || ''
                                            ).getTime() -
                                            new Date(b.due_date || '').getTime()
                                    )
                                    .map((instance) => (
                                        <div
                                            key={instance.id}
                                            className="opacity-75 hover:opacity-100 transition-opacity"
                                        >
                                            <TaskItem
                                                task={instance}
                                                onTaskUpdate={onTaskUpdate}
                                                onTaskCompletionToggle={
                                                    onTaskCompletionToggle
                                                }
                                                onTaskDelete={onTaskDelete}
                                                projects={projects}
                                                hideProjectName={
                                                    hideProjectName
                                                }
                                                onToggleToday={onToggleToday}
                                            />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {standaloneTask.length === 0 &&
                recurringGroups.length === 0 &&
                (!groupedByProject || groupedByProject.length === 0) &&
                (!groupedByAssignee || groupedByAssignee.length === 0) &&
                (!groupedByStatus || groupedByStatus.length === 0) &&
                (!groupedByInvolvement ||
                    groupedByInvolvement.every((g) => g.tasks.length === 0)) &&
                (!groupedByWorkspace || groupedByWorkspace.length === 0) &&
                (!groupedByWorkspaceProject ||
                    groupedByWorkspaceProject.length === 0) && (
                    <div className="flex justify-center items-center mt-4">
                        <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                            <svg
                                className="h-20 w-20 text-gray-400 opacity-30 mb-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                />
                            </svg>
                            <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                                {t(
                                    'tasks.noTasksAvailable',
                                    'No tasks available.'
                                )}
                            </p>
                            <p className="text-base text-center text-gray-400 dark:text-gray-400">
                                {t(
                                    'tasks.blankSlateHint',
                                    'Start by creating a new task or changing your filters.'
                                )}
                            </p>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default GroupedTaskList;
