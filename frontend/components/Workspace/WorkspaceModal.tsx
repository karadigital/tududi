import React, { useState, useEffect, useRef } from 'react';
import { Workspace } from '../../entities/Workspace';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { TrashIcon } from '@heroicons/react/24/outline';

interface WorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Workspace>) => Promise<void>;
    onDelete?: (workspaceUid: string) => Promise<void>;
    workspace?: Workspace | null;
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    workspace,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(workspace?.name || '');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const { showSuccessToast, showErrorToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setName(workspace?.name || '');
            setError(null);
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, workspace]);

    const handleCloseWithCheck = () => {
        if (hasUnsavedChangesRef.current()) {
            setShowDiscardDialog(true);
        } else {
            handleClose();
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                handleCloseWithCheck();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showDiscardDialog) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                handleCloseWithCheck();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, showDiscardDialog]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }

        if (!name.trim()) {
            setError(t('errors.workspaceNameRequired'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave({
                ...(workspace?.uid ? { uid: workspace.uid } : {}),
                name: name.trim(),
            });
            showSuccessToast(
                workspace?.uid
                    ? t('success.workspaceUpdated')
                    : t('success.workspaceCreated')
            );
            handleClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveWorkspace'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasUnsavedChanges = () => {
        if (!workspace) {
            return name.trim() !== '';
        }
        return name !== workspace.name;
    };

    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
        }, 300);
    };

    const handleDiscardChanges = () => {
        setShowDiscardDialog(false);
        handleClose();
    };

    const handleCancelDiscard = () => {
        setShowDiscardDialog(false);
    };

    const handleDeleteWorkspace = async () => {
        if (workspace?.uid && onDelete) {
            try {
                await onDelete(workspace.uid);
                handleClose();
            } catch (err) {
                setError((err as Error).message);
            }
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = () => {
        setShowDeleteConfirm(false);
        handleDeleteWorkspace();
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
            >
                <div className="h-full flex items-center justify-center sm:px-4 sm:py-4">
                    <div
                        ref={modalRef}
                        className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col h-full sm:min-h-[250px] sm:max-h-[90vh]">
                            <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{
                                            WebkitOverflowScrolling: 'touch',
                                        }}
                                    >
                                        <form
                                            className="h-full"
                                            onSubmit={handleSubmit}
                                        >
                                            <fieldset className="h-full flex flex-col">
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4 sm:rounded-t-lg">
                                                    <input
                                                        ref={nameInputRef}
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) =>
                                                            setName(
                                                                e.target.value
                                                            )
                                                        }
                                                        required
                                                        className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                                        placeholder={t(
                                                            'forms.workspaceNamePlaceholder'
                                                        )}
                                                        data-testid="workspace-name-input"
                                                    />
                                                </div>

                                                {error && (
                                                    <div className="text-red-500 px-4 mb-4">
                                                        {error}
                                                    </div>
                                                )}
                                            </fieldset>
                                        </form>
                                    </div>
                                </div>

                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-b-lg">
                                    <div className="flex items-center space-x-3">
                                        {workspace?.uid && onDelete && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteClick}
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                                title={t(
                                                    'common.delete',
                                                    'Delete'
                                                )}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCloseWithCheck}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                            isSubmitting
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                        }`}
                                        data-testid="workspace-save-button"
                                    >
                                        {isSubmitting
                                            ? t('modals.submitting')
                                            : workspace?.uid
                                              ? t('modals.updateWorkspace')
                                              : t('modals.createWorkspace')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={handleDiscardChanges}
                    onCancel={handleCancelDiscard}
                />
            )}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title={t(
                        'workspaces.deleteConfirmTitle',
                        'Delete workspace?'
                    )}
                    message={t(
                        'workspaces.deleteConfirmMessage',
                        'This will delete the workspace and remove it from all associated projects. This action cannot be undone.'
                    )}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}
        </>
    );
};

export default WorkspaceModal;
