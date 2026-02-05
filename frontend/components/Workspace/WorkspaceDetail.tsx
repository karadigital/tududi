import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchWorkspace } from '../../utils/workspacesService';
import { Workspace } from '../../entities/Workspace';
import { Project } from '../../entities/Project';
import { useTranslation } from 'react-i18next';
import Projects from '../Projects';
import ProjectModal from '../Project/ProjectModal';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';
import {
    PlusIcon,
    FolderPlusIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import {
    createProject,
    updateProject,
    fetchProjects,
} from '../../utils/projectsService';
import { useToast } from '../Shared/ToastContext';

const WorkspaceDetail: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { uid } = useParams<{ uid: string }>();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const {
        projectsStore: { projects, setProjects },
        areasStore: { areas },
    } = useStore();

    useEffect(() => {
        const loadWorkspace = async () => {
            if (!uid) {
                setIsError(true);
                setIsLoading(false);
                return;
            }

            try {
                const data = await fetchWorkspace(uid);
                setWorkspace(data);
            } catch (error) {
                console.error('Failed to fetch workspace:', error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadWorkspace();
    }, [uid]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const unassignedProjects = projects.filter(
        (p) => !p.workspace_id && !p.Workspace
    );

    const handleCreateProject = async (projectData: Project) => {
        try {
            await createProject({
                ...projectData,
                workspace_uid: workspace?.uid,
            });
            const projectsData = await fetchProjects();
            setProjects(projectsData);
            setIsProjectModalOpen(false);
            showSuccessToast(t('success.projectCreated'));
        } catch (error) {
            console.error('Error creating project:', error);
            showErrorToast(t('errors.projectCreationFailed'));
        }
    };

    const handleAddExistingProject = async (project: Project) => {
        try {
            await updateProject(project.uid!, {
                workspace_uid: workspace?.uid,
            });
            const projectsData = await fetchProjects();
            setProjects(projectsData);
            setIsDropdownOpen(false);
        } catch (error) {
            console.error('Error assigning project:', error);
            showErrorToast(t('errors.projectSaveFailed'));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    if (isError || !workspace) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    {t('workspaces.notFound', 'Workspace not found.')}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="px-2 sm:px-4 lg:px-6 pt-4">
                <div className="flex items-center mb-4">
                    <Link
                        to="/workspaces"
                        className="mr-3 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </Link>
                    <h2 className="text-2xl font-light text-gray-900 dark:text-white">
                        {workspace.name}
                    </h2>
                </div>

                <div className="flex items-center gap-3 mb-4 px-2 sm:px-4 lg:px-6">
                    <button
                        onClick={() => setIsProjectModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <PlusIcon className="h-4 w-4" />
                        {t('workspaces.createNewProject')}
                    </button>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() =>
                                setIsDropdownOpen(!isDropdownOpen)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <FolderPlusIcon className="h-4 w-4" />
                            {t('workspaces.addExistingProject')}
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-700 shadow-lg rounded-md z-50 max-h-60 overflow-y-auto">
                                {unassignedProjects.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                        {t('workspaces.noAvailableProjects')}
                                    </div>
                                ) : (
                                    unassignedProjects.map((project) => (
                                        <button
                                            key={project.uid}
                                            onClick={() =>
                                                handleAddExistingProject(
                                                    project
                                                )
                                            }
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-md last:rounded-b-md"
                                        >
                                            {project.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Projects workspaceUid={workspace.uid} />

            {isProjectModalOpen && (
                <ProjectModal
                    isOpen={isProjectModalOpen}
                    onClose={() => setIsProjectModalOpen(false)}
                    onSave={handleCreateProject}
                    areas={areas}
                />
            )}
        </div>
    );
};

export default WorkspaceDetail;
