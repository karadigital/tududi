import React, { useState, useEffect, useCallback } from 'react';
import { Link, Location } from 'react-router-dom';
import {
    FolderIcon,
    PlusCircleIcon,
    ChevronRightIcon,
    StarIcon as StarOutline,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import { toggleProjectPin } from '../../utils/projectsService';
import { Project } from '../../entities/Project';

const STORAGE_KEY = 'sidebar_projects_expanded';
const MAX_PINNED = 5;
const MAX_RECENT = 10;

interface SidebarProjectsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openProjectModal: () => void;
}

const getProjectSlug = (project: Project): string => {
    if (!project.uid) return `/project/${project.id}`;
    const slug = project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `/project/${project.uid}-${slug}`;
};

const SidebarProjects: React.FC<SidebarProjectsProps> = ({
    handleNavClick,
    location,
    openProjectModal,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { projects, updateProjectInStore } = useStore(
        (s) => s.projectsStore
    );

    const [isExpanded, setIsExpanded] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, String(isExpanded));
        } catch {
            // localStorage unavailable
        }
    }, [isExpanded]);

    const starred = projects
        .filter((p) => p.pin_to_sidebar)
        .sort(
            (a, b) =>
                new Date(b.updated_at || 0).getTime() -
                new Date(a.updated_at || 0).getTime()
        );

    const recent = projects
        .filter((p) => !p.pin_to_sidebar)
        .sort(
            (a, b) =>
                new Date(b.updated_at || 0).getTime() -
                new Date(a.updated_at || 0).getTime()
        )
        .slice(0, MAX_RECENT);

    const handleTogglePin = useCallback(
        async (e: React.MouseEvent, project: Project) => {
            e.preventDefault();
            e.stopPropagation();

            const newPinned = !project.pin_to_sidebar;

            if (newPinned && starred.length >= MAX_PINNED) {
                showErrorToast(t('sidebar.maxPinnedProjects'));
                return;
            }

            // Optimistic update
            updateProjectInStore({ ...project, pin_to_sidebar: newPinned });

            try {
                await toggleProjectPin(project.uid!, newPinned);
                showSuccessToast(
                    t(
                        newPinned
                            ? 'sidebar.projectPinned'
                            : 'sidebar.projectUnpinned'
                    )
                );
            } catch {
                // Revert on failure
                updateProjectInStore({
                    ...project,
                    pin_to_sidebar: !newPinned,
                });
                showErrorToast(t('errors.generic', 'Something went wrong'));
            }
        },
        [starred.length, updateProjectInStore, showSuccessToast, showErrorToast, t]
    );

    const isActiveRoute = (path: string) =>
        location.pathname.startsWith(path)
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';

    const renderProjectItem = (project: Project) => {
        const slug = getProjectSlug(project);
        const isActive = location.pathname === slug;
        const isPinned = project.pin_to_sidebar;

        return (
            <li key={project.uid || project.id}>
                <Link
                    to={slug}
                    onClick={() =>
                        handleNavClick(
                            slug,
                            project.name,
                            <FolderIcon className="h-4 w-4" />
                        )
                    }
                    className={`group/item flex items-center justify-between pl-8 pr-4 py-1.5 text-sm rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        isActive
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400'
                    }`}
                >
                    <span className="truncate">{project.name}</span>
                    <button
                        onClick={(e) => handleTogglePin(e, project)}
                        className={`flex-shrink-0 ml-1 ${
                            isPinned
                                ? 'text-yellow-500'
                                : 'text-gray-400 opacity-0 group-hover/item:opacity-100'
                        } hover:text-yellow-500 transition-opacity`}
                        aria-label={
                            isPinned ? 'Unpin project' : 'Pin project'
                        }
                    >
                        {isPinned ? (
                            <StarSolid className="h-3.5 w-3.5" />
                        ) : (
                            <StarOutline className="h-3.5 w-3.5" />
                        )}
                    </button>
                </Link>
            </li>
        );
    };

    return (
        <ul className="flex flex-col space-y-1 mt-4">
            {/* Header row */}
            <li
                className={`flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveRoute('/projects')}`}
                onClick={() => setIsExpanded((prev) => !prev)}
            >
                <span className="flex items-center">
                    <ChevronRightIcon
                        className={`h-3.5 w-3.5 mr-1.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                        }`}
                    />
                    <FolderIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.projects')}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        openProjectModal();
                    }}
                    className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                    aria-label={t('sidebar.addProjectAriaLabel', 'Add Project')}
                    title={t('sidebar.addProjectTitle', 'Add Project')}
                >
                    <PlusCircleIcon className="h-5 w-5" />
                </button>
            </li>

            {/* Expanded project list */}
            {isExpanded && (
                <>
                    {/* Starred projects */}
                    {starred.map(renderProjectItem)}

                    {/* Separator between starred and recent */}
                    {starred.length > 0 && recent.length > 0 && (
                        <li className="mx-8 border-t border-gray-200 dark:border-gray-700" />
                    )}

                    {/* Recent projects */}
                    {recent.map(renderProjectItem)}

                    {/* Empty state */}
                    {starred.length === 0 && recent.length === 0 && (
                        <li className="pl-8 pr-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic">
                            No projects yet
                        </li>
                    )}

                    {/* View all link */}
                    {projects.length > 0 && (
                        <li>
                            <Link
                                to="/projects"
                                onClick={() =>
                                    handleNavClick(
                                        '/projects',
                                        'Projects',
                                        <FolderIcon className="h-5 w-5" />
                                    )
                                }
                                className="block pl-8 pr-4 py-1.5 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                                {t('sidebar.viewAllProjects', 'View all')} &rarr;
                            </Link>
                        </li>
                    )}
                </>
            )}
        </ul>
    );
};

export default SidebarProjects;
