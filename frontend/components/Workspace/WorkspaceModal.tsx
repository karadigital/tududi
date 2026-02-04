import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Workspace } from '../../entities/Workspace';

interface WorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Workspace>) => void;
    workspace?: Workspace | null;
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
    isOpen,
    onClose,
    onSave,
    workspace,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(workspace?.name || '');
    const [isSaving, setIsSaving] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setName(workspace?.name || '');
    }, [workspace]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || isSaving) return;

        setIsSaving(true);
        try {
            await onSave({
                ...(workspace?.uid ? { uid: workspace.uid } : {}),
                name: name.trim(),
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {workspace?.uid
                        ? t('workspaces.editWorkspace', 'Edit Workspace')
                        : t('workspaces.newWorkspace', 'New Workspace')}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label
                            htmlFor="workspace-name"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            {t('workspaces.name', 'Name')}
                        </label>
                        <input
                            id="workspace-name"
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t(
                                'workspaces.namePlaceholder',
                                'Workspace name'
                            )}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || isSaving}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving
                                ? t('common.saving', 'Saving...')
                                : t('common.save', 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default WorkspaceModal;
