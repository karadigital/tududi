import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@heroicons/react/24/outline';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import TaskPriorityIcon from '../TaskPriorityIcon';
import { Task } from '../../../entities/Task';

interface TaskSubtasksCardProps {
    task: Task;
    subtasks: Task[];
    isEditing: boolean;
    editedSubtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onToggleSubtaskCompletion: (subtask: Task) => Promise<void>;
    onCreateSubtask?: (name: string) => Promise<void>;
    showHeader?: boolean;
    showFooterLink?: boolean;
    onNavigateToTab?: () => void;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({
    task,
    subtasks,
    isEditing,
    editedSubtasks,
    onSubtasksChange,
    onStartEdit,
    onSave,
    onCancel,
    onToggleSubtaskCompletion,
    onCreateSubtask,
    showHeader = false,
    showFooterLink = false,
    onNavigateToTab,
}) => {
    const { t } = useTranslation();
    const [isAddingSubtask, setIsAddingSubtask] = useState(false);
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const isAddingSubtaskRef = useRef(isAddingSubtask);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        isAddingSubtaskRef.current = isAddingSubtask;
    }, [isAddingSubtask]);

    // Auto-focus input when adding mode is activated or subtasks list changes
    useEffect(() => {
        if (isAddingSubtask && inputRef.current) {
            // Use setTimeout to ensure focus happens after React's render cycle
            // Check ref (not stale closure) to handle rapid Escape presses
            const timeoutId = setTimeout(() => {
                if (isAddingSubtaskRef.current && inputRef.current) {
                    inputRef.current.focus();
                }
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [isAddingSubtask, subtasks.length]);

    // Cleanup blur timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const handleAddSubtaskClick = () => {
        setIsAddingSubtask(true);
        setNewSubtaskName('');
    };

    const handleCancelAdd = () => {
        setIsAddingSubtask(false);
        setNewSubtaskName('');
    };

    const createSubtask = async () => {
        const trimmedName = newSubtaskName.trim();
        if (!trimmedName || !onCreateSubtask || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await onCreateSubtask(trimmedName);
            setNewSubtaskName('');
            // Focus will be restored by useEffect when subtasks.length changes
        } catch (error) {
            // Error is logged here; the upstream handler (onCreateSubtask) handles toast notifications
            console.error('Error creating subtask:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Ignore Enter during IME composition (for CJK language input)
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            createSubtask();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelAdd();
        }
    };

    const handleBlur = () => {
        // Use a small delay to allow click events on nearby elements to fire first
        blurTimeoutRef.current = setTimeout(() => {
            if (!newSubtaskName.trim()) {
                handleCancelAdd();
            }
        }, 150);
    };

    // Render the inline add subtask input row
    const renderInlineAddInput = () => (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="px-3 py-3 flex items-center space-x-3">
                {/* Dimmed checkbox placeholder for alignment */}
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 opacity-40" />
                <input
                    ref={inputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    placeholder={t(
                        'task.typeSubtaskPlaceholder',
                        'Type subtask and press Enter'
                    )}
                    aria-label={t('task.addSubtask', 'Add subtask')}
                    disabled={isSubmitting}
                    className="flex-1 text-base bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                    data-testid="inline-subtask-input"
                />
                {isSubmitting && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
            </div>
        </div>
    );

    // Render the add subtask button
    const renderAddSubtaskButton = () => {
        if (!onCreateSubtask) return null;
        return (
            <button
                onClick={handleAddSubtaskClick}
                className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                data-testid="add-subtask-button"
            >
                <PlusIcon className="h-4 w-4" />
                <span>{t('task.addSubtask', 'Add subtask')}</span>
            </button>
        );
    };

    // Render the subtask list content (used in both header and non-header modes)
    const renderSubtasksList = () => (
        <div className="space-y-0.5">
            {subtasks.map((subtask: Task, index) => (
                <div
                    key={subtask.id ?? index}
                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border transition-all duration-200 ${
                        subtask.status === 'in_progress' || subtask.status === 1
                            ? 'border-blue-500/60 dark:border-blue-600/60'
                            : 'border-gray-50 dark:border-gray-800'
                    }`}
                >
                    <div className="px-3 py-3 flex items-center space-x-3">
                        <TaskPriorityIcon
                            priority={subtask.priority}
                            status={subtask.status}
                            onToggleCompletion={() =>
                                onToggleSubtaskCompletion(subtask)
                            }
                        />
                        <span
                            onClick={onStartEdit}
                            className={`text-base flex-1 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                subtask.status === 'done' ||
                                subtask.status === 2 ||
                                subtask.status === 'archived' ||
                                subtask.status === 3
                                    ? 'text-gray-500 dark:text-gray-400'
                                    : 'text-gray-900 dark:text-gray-100'
                            }`}
                            title={t(
                                'task.clickToEditSubtasks',
                                'Click to edit subtasks'
                            )}
                        >
                            {subtask.name}
                        </span>
                    </div>
                </div>
            ))}
            {/* Inline add subtask input */}
            {isAddingSubtask && renderInlineAddInput()}
            {/* Add subtask button */}
            {!isAddingSubtask && onCreateSubtask && (
                <div className="mt-2">{renderAddSubtaskButton()}</div>
            )}
        </div>
    );

    // Render editing mode content
    const renderEditingContent = () => {
        if (!task.id) return null;
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-6">
                <TaskSubtasksSection
                    parentTaskId={task.id}
                    subtasks={editedSubtasks}
                    onSubtasksChange={onSubtasksChange}
                />
                <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex space-x-2">
                        <button
                            onClick={onSave}
                            className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                        >
                            {t('common.save', 'Save')}
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render empty state for non-header mode
    const renderEmptyState = () => {
        // If we have onCreateSubtask, show inline add UI
        if (onCreateSubtask) {
            return (
                <div className="space-y-2">
                    {isAddingSubtask ? (
                        renderInlineAddInput()
                    ) : (
                        <div className="py-4">{renderAddSubtaskButton()}</div>
                    )}
                </div>
            );
        }
        // Fallback to legacy click-to-edit behavior
        return (
            <div
                onClick={onStartEdit}
                className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                title={t(
                    'task.clickToEditSubtasks',
                    'Click to add or edit subtasks'
                )}
            >
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <PlusIcon className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm text-center">
                        {t('task.noSubtasksClickToAdd', 'Add subtasks')}
                    </span>
                </div>
            </div>
        );
    };

    // When showHeader is true, wrap content in a card with header
    if (showHeader) {
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('task.subtasks', 'Subtasks')}
                    </h4>
                    {onNavigateToTab && (
                        <button
                            onClick={onNavigateToTab}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            {t('task.viewAll', 'View all')} &rarr;
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    {isEditing ? (
                        renderEditingContent()
                    ) : subtasks.length > 0 ? (
                        <>
                            {renderSubtasksList()}
                            {/* Footer link */}
                            {showFooterLink && onNavigateToTab && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={onNavigateToTab}
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                    >
                                        {t('task.viewAllSubtasks', 'View all')}{' '}
                                        &rarr;
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Empty state for header mode with inline add */
                        <div>
                            {onCreateSubtask ? (
                                isAddingSubtask ? (
                                    renderInlineAddInput()
                                ) : (
                                    renderAddSubtaskButton()
                                )
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t(
                                        'task.noSubtasksYet',
                                        'No subtasks yet.'
                                    )}{' '}
                                    {onNavigateToTab && (
                                        <button
                                            onClick={onNavigateToTab}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                        >
                                            {t(
                                                'task.addSubtasks',
                                                'Add subtasks'
                                            )}{' '}
                                            &rarr;
                                        </button>
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Original behavior when showHeader is false
    return (
        <div className="space-y-2">
            {isEditing
                ? renderEditingContent()
                : subtasks.length > 0
                  ? renderSubtasksList()
                  : renderEmptyState()}
        </div>
    );
};

export default TaskSubtasksCard;
