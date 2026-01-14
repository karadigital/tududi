import React from 'react';
import SearchableUserDropdown from '../../Shared/SearchableUserDropdown';

interface TaskAssigneeSectionProps {
    selectedUserId: number | null;
    onChange: (userId: number | null) => void;
    disabled?: boolean;
}

const TaskAssigneeSection: React.FC<TaskAssigneeSectionProps> = ({
    selectedUserId,
    onChange,
    disabled = false,
}) => {
    // Convert sync onChange to async for SearchableUserDropdown
    const handleChange = async (userId: number | null) => {
        onChange(userId);
    };

    return (
        <div className="space-y-2">
            <SearchableUserDropdown
                selectedUserId={selectedUserId}
                onChange={handleChange}
                disabled={disabled}
                className="w-full"
            />
        </div>
    );
};

export default TaskAssigneeSection;
