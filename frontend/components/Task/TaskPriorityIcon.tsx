import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import {
    normalizePriority,
    getPriorityLabel,
} from '../../config/priorityConfig';
import { PriorityType } from '../../entities/Task';

interface TaskPriorityIconProps {
    priority: string | number | undefined;
    status: string | number;
    onToggleCompletion?: () => void;
    testIdSuffix?: string;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({
    priority,
    status,
    onToggleCompletion,
    testIdSuffix = '',
}) => {
    const getPriorityText = () => {
        const config = normalizePriority(priority as PriorityType | number);
        if (config.value === null) {
            return ''; // No priority set
        }
        return `${getPriorityLabel(priority as PriorityType | number)} priority`;
    };

    const getIconColor = () => {
        if (
            status === 'done' ||
            status === 2 ||
            status === 'archived' ||
            status === 3
        )
            return 'text-green-500';

        const config = normalizePriority(priority as PriorityType | number);
        if (config.value === null) {
            return 'text-gray-300'; // No priority - use gray
        }
        return config.iconClass;
    };

    const colorClass = getIconColor();
    const priorityText = getPriorityText();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering TaskHeader onClick
        if (onToggleCompletion) {
            onToggleCompletion();
        }
    };

    if (
        status === 'done' ||
        status === 2 ||
        status === 'archived' ||
        status === 3
    ) {
        return (
            <CheckCircleIcon
                className={`${colorClass} cursor-pointer flex-shrink-0 self-center transition-all duration-300 ease-in-out animate-scale-in w-7 h-7 md:w-6 md:h-6`}
                style={{
                    marginLeft: '-2px',
                    marginRight: '-2px',
                }}
                onClick={handleClick}
                {...(priorityText && { title: priorityText })}
                role="checkbox"
                aria-checked="true"
                data-testid={`task-completion-checkbox${testIdSuffix}`}
            />
        );
    } else {
        return (
            <div
                className={`${colorClass} cursor-pointer border-2 border-current rounded-full flex-shrink-0 self-center transition-all duration-300 ease-in-out hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 w-6 h-6 md:w-5 md:h-5`}
                onClick={handleClick}
                {...(priorityText && { title: priorityText })}
                role="checkbox"
                aria-checked="false"
                data-testid={`task-completion-checkbox${testIdSuffix}`}
            />
        );
    }
};

export default TaskPriorityIcon;
