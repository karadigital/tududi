import React from 'react';
import { PriorityType } from '../../../entities/Task';
import PriorityDropdown from '../../Shared/PriorityDropdown';

interface TaskPrioritySectionProps {
    value: PriorityType;
    onChange: (value: PriorityType) => void;
    dueDate?: string | null;
    assignedToUserId?: number | null;
    onValidationError?: (message: string) => void;
}

const TaskPrioritySection: React.FC<TaskPrioritySectionProps> = ({
    value,
    onChange,
    dueDate,
    assignedToUserId,
    onValidationError,
}) => {
    return (
        <PriorityDropdown
            value={value}
            onChange={onChange}
            dueDate={dueDate}
            assignedToUserId={assignedToUserId}
            onValidationError={onValidationError}
        />
    );
};

export default TaskPrioritySection;
