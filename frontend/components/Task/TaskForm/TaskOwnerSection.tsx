import React from 'react';
import { useTranslation } from 'react-i18next';
import SearchableUserDropdown from '../../Shared/SearchableUserDropdown';
import { transferTaskOwner } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';

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
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    const handleChange = async (userId: number | null) => {
        if (userId === null) return; // owner cannot be unset
        try {
            await transferTaskOwner(taskUid, userId);
            onTransferred(userId);
        } catch {
            showErrorToast(
                t('task.ownerTransferFailed', 'Failed to transfer task owner')
            );
        }
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
