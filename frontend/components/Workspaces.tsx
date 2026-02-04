import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, PlusIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import WorkspaceModal from './Workspace/WorkspaceModal';
import { useToast } from './Shared/ToastContext';
import { useStore } from '../store/useStore';
import {
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
} from '../utils/workspacesService';
import { Workspace } from '../entities/Workspace';

const Workspaces: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const {
        workspaces,
        isLoading: loading,
        hasLoaded,
        loadWorkspaces,
    } = useStore((state) => state.workspacesStore);

    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] =
        useState<boolean>(false);
    const [selectedWorkspace, setSelectedWorkspace] =
        useState<Workspace | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [workspaceToDelete, setWorkspaceToDelete] =
        useState<Workspace | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!hasLoaded && !loading) {
            loadWorkspaces();
        }
    }, [hasLoaded, loading, loadWorkspaces]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }

            const target = event.target as HTMLElement;
            if (!target.closest('[data-workspace-dropdown]')) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleSaveWorkspace = async (workspaceData: Partial<Workspace>) => {
        try {
            if (workspaceData.uid) {
                await updateWorkspace(workspaceData.uid, {
                    name: workspaceData.name,
                });
            } else {
                await createWorkspace({ name: workspaceData.name });
            }
            await loadWorkspaces();
            setIsWorkspaceModalOpen(false);
            setSelectedWorkspace(null);
        } catch (error) {
            console.error('Error saving workspace:', error);
            showErrorToast(t('workspaces.errorSaving', 'Error saving workspace'));
        }
    };

    const handleEditWorkspace = (workspace: Workspace) => {
        setSelectedWorkspace(workspace);
        setIsWorkspaceModalOpen(true);
    };

    const openConfirmDialog = (workspace: Workspace) => {
        setWorkspaceToDelete(workspace);
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteWorkspace = async () => {
        if (!workspaceToDelete) return;

        useStore.getState().workspacesStore.setLoading(true);
        try {
            await deleteWorkspace(workspaceToDelete.uid!);
            const currentWorkspaces =
                useStore.getState().workspacesStore.workspaces;
            useStore
                .getState()
                .workspacesStore.setWorkspaces(
                    currentWorkspaces.filter(
                        (ws: Workspace) => ws.uid !== workspaceToDelete.uid
                    )
                );
            setIsConfirmDialogOpen(false);
            setWorkspaceToDelete(null);
            useStore.getState().workspacesStore.setError(false);
            showSuccessToast(
                t(
                    'workspaces.deletedSuccessfully',
                    'Workspace deleted successfully'
                )
            );
        } catch (error) {
            console.error('Error deleting workspace:', error);
            useStore.getState().workspacesStore.setError(true);
            showErrorToast(
                t(
                    'workspaces.failedToDelete',
                    'Failed to delete workspace.'
                )
            );
            setIsConfirmDialogOpen(false);
        } finally {
            useStore.getState().workspacesStore.setLoading(false);
        }
    };

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
        setWorkspaceToDelete(null);
    };

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                {/* Workspaces Header */}
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">
                        {t('workspaces.title', 'Workspaces')}
                    </h2>
                    <button
                        onClick={() => {
                            setSelectedWorkspace(null);
                            setIsWorkspaceModalOpen(true);
                        }}
                        className="ml-3 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none"
                        aria-label={t(
                            'workspaces.createWorkspace',
                            'Create workspace'
                        )}
                        data-testid="create-workspace-button"
                    >
                        <PlusIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Workspaces Grid */}
                {workspaces.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t(
                            'workspaces.noWorkspacesFound',
                            'No workspaces found.'
                        )}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {workspaces.map((workspace: Workspace) => (
                            <Link
                                key={workspace.uid}
                                to={`/workspaces/${workspace.uid}`}
                                className={`bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group hover:opacity-90 transition-opacity cursor-pointer ${
                                    dropdownOpen === workspace.uid
                                        ? 'z-50'
                                        : ''
                                }`}
                                style={{
                                    minHeight: '120px',
                                    maxHeight: '120px',
                                }}
                            >
                                {/* Workspace Content - Centered */}
                                <div className="p-4 flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <h3 className="text-lg font-light text-gray-900 dark:text-gray-100 line-clamp-2 uppercase">
                                            {workspace.name}
                                        </h3>
                                    </div>
                                </div>

                                {/* Three Dots Dropdown - Bottom Right */}
                                <div
                                    className="absolute bottom-2 right-2"
                                    data-workspace-dropdown="true"
                                >
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newDropdownState =
                                                dropdownOpen === workspace.uid
                                                    ? null
                                                    : workspace.uid!;

                                            if (newDropdownState !== null) {
                                                justOpenedRef.current = true;
                                            }
                                            setDropdownOpen(newDropdownState);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        aria-label={t(
                                            'workspaces.toggleDropdownMenu',
                                            'Toggle dropdown menu'
                                        )}
                                        data-testid={`workspace-dropdown-${workspace.uid}`}
                                    >
                                        <EllipsisVerticalIcon className="h-5 w-5" />
                                    </button>

                                    {dropdownOpen === workspace.uid && (
                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditWorkspace(
                                                        workspace
                                                    );
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                                data-testid={`workspace-edit-${workspace.uid}`}
                                            >
                                                {t(
                                                    'workspaces.edit',
                                                    'Edit'
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openConfirmDialog(
                                                        workspace
                                                    );
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                                data-testid={`workspace-delete-${workspace.uid}`}
                                            >
                                                {t(
                                                    'workspaces.delete',
                                                    'Delete'
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* WorkspaceModal */}
                {isWorkspaceModalOpen && (
                    <WorkspaceModal
                        isOpen={isWorkspaceModalOpen}
                        onClose={() => {
                            setIsWorkspaceModalOpen(false);
                            setSelectedWorkspace(null);
                        }}
                        onSave={handleSaveWorkspace}
                        workspace={selectedWorkspace}
                    />
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && workspaceToDelete && (
                    <ConfirmDialog
                        title={t(
                            'workspaces.deleteWorkspace',
                            'Delete Workspace'
                        )}
                        message={t(
                            'workspaces.deleteConfirmation',
                            `Are you sure you want to delete the workspace "${workspaceToDelete.name}"?`
                        )}
                        onConfirm={handleDeleteWorkspace}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default Workspaces;
