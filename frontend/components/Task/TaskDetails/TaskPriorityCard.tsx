import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task, PriorityType } from '../../../entities/Task';
import {
    PRIORITIES,
    normalizePriority,
    canSetCriticalPriority,
} from '../../../config/priorityConfig';

interface TaskPriorityCardProps {
    task: Task;
    onUpdate: (priority: PriorityType) => Promise<void>;
}

const TaskPriorityCard: React.FC<TaskPriorityCardProps> = ({
    task,
    onUpdate,
}) => {
    const { t } = useTranslation();

    const handlePriorityClick = async (priority: PriorityType) => {
        await onUpdate(priority);
    };

    const currentPriority = normalizePriority(task.priority);
    const canSelectCritical = canSetCriticalPriority(
        task.due_date,
        task.assigned_to_user_id
    );

    const isSelected = (priorityValue: PriorityType) => {
        const config = normalizePriority(priorityValue);
        return currentPriority.key === config.key;
    };

    return (
        <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.priority', 'Priority')}
            </h4>
            <div className="grid grid-cols-5 gap-2">
                {PRIORITIES.map((priority) => {
                    const isCritical = priority.value === 'critical';
                    const isDisabled = isCritical && !canSelectCritical;
                    const selected = isSelected(priority.value);

                    return (
                        <button
                            key={priority.key}
                            type="button"
                            onClick={() => {
                                if (!isDisabled) {
                                    handlePriorityClick(priority.value);
                                }
                            }}
                            className={`w-full min-w-0 px-2 sm:px-3 py-2 text-sm font-medium rounded transition-colors ${
                                isDisabled
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    : selected
                                      ? `${priority.bgActiveClass} text-white`
                                      : `${priority.bgClass} ${priority.textClass} hover:opacity-80`
                            }`}
                            title={
                                isDisabled
                                    ? t(
                                          'errors.critical_requires_fields',
                                          'Critical tasks must have a due date and assignee'
                                      )
                                    : t(
                                          priority.labelKey,
                                          priority.defaultLabel
                                      )
                            }
                            disabled={isDisabled}
                        >
                            <span className="sm:hidden">
                                {priority.shortLabel}
                            </span>
                            <span className="hidden sm:inline">
                                {priority.key === 'medium'
                                    ? t('priority.medium', 'Med')
                                    : priority.key === 'critical'
                                      ? t('priority.critical', 'Crit')
                                      : t(
                                            priority.labelKey,
                                            priority.defaultLabel
                                        )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskPriorityCard;
