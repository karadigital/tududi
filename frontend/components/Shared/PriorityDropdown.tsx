import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { PriorityType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';
import {
    PRIORITIES,
    normalizePriority,
    canSetCriticalPriority,
} from '../../config/priorityConfig';

interface PriorityDropdownProps {
    value: PriorityType;
    onChange: (value: PriorityType) => void;
    dueDate?: string | null;
    assignedToUserId?: number | null;
    onValidationError?: (message: string) => void;
}

const PriorityDropdown: React.FC<PriorityDropdownProps> = ({
    value,
    onChange,
    dueDate,
    assignedToUserId,
    onValidationError,
}) => {
    const { t } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
        width: 0,
        openUpward: false,
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = 120;

            const openUpward =
                spaceAbove > spaceBelow && spaceBelow < menuHeight;

            setPosition({
                top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                openUpward,
            });
        }
        setIsOpen(!isOpen);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            menuRef.current &&
            !menuRef.current.contains(event.target as Node)
        ) {
            setIsOpen(false);
        }
    };

    const handleSelect = (priority: PriorityType) => {
        // Validate critical priority requirements
        if (priority === 'critical') {
            if (!canSetCriticalPriority(dueDate, assignedToUserId)) {
                const errorMessage = t(
                    'errors.critical_requires_fields',
                    'Critical tasks must have a due date and assignee'
                );
                if (onValidationError) {
                    onValidationError(errorMessage);
                }
                setIsOpen(false);
                return; // Block selection
            }
        }

        onChange(priority);
        setIsOpen(false);
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedConfig = normalizePriority(value);

    return (
        <div
            ref={dropdownRef}
            data-testid="priority-dropdown"
            data-state={isOpen ? 'open' : 'closed'}
            className="relative inline-block text-left w-full"
        >
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    <selectedConfig.icon
                        className={`w-5 h-5 ${selectedConfig.iconClass} ${selectedConfig.iconClassDark}`}
                    />
                    <span>
                        {t(
                            selectedConfig.labelKey,
                            selectedConfig.defaultLabel
                        )}
                    </span>
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                    >
                        {PRIORITIES.map((priority) => (
                            <button
                                key={priority.key}
                                onClick={() =>
                                    handleSelect(priority.value as PriorityType)
                                }
                                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md last:rounded-b-md"
                                data-testid={`priority-option-${priority.key}`}
                                title={t(
                                    priority.labelKey,
                                    priority.defaultLabel
                                )}
                            >
                                <priority.icon
                                    className={`w-5 h-5 ${priority.iconClass} ${priority.iconClassDark}`}
                                />
                                <span>
                                    {t(
                                        priority.labelKey,
                                        priority.defaultLabel
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default PriorityDropdown;
