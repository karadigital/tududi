import React from 'react';
import SearchableUserDropdown from '../../Shared/SearchableUserDropdown';
import { transferTaskOwner } from '../../../utils/tasksService';

interface TaskOwnerSectionProps {
    taskUid: string;
    selectedUserId: number | null;
    onTransferred: (newOwnerId: number) => void;
    disabled?: boolean;
}

const TaskOwnerSection: React.FC<TaskOwnerSectionProps> = ({
    taskUid,
    selectedUserId,
    onTransferred,
    disabled = false,
}) => {
    const handleChange = async (userId: number | null) => {
        if (userId === null) return; // owner cannot be unset
        await transferTaskOwner(taskUid, userId);
        onTransferred(userId);
    };

    return (
        <div className="space-y-2">
            <SearchableUserDropdown
                selectedUserId={selectedUserId}
                onChange={handleChange}
                disabled={disabled}
                className="w-full"
                fetchPath={`task/${encodeURIComponent(
                    taskUid
                )}/owner-candidates`}
                allowUnassigned={false}
            />
        </div>
    );
};

export default TaskOwnerSection;
