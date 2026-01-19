import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface FilterOption {
    value: string;
    label: string;
}

interface MultiSelectFilterDropdownProps {
    options: FilterOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    emptyLabel: string;
    selectedLabel: string;
    icon?: React.ReactNode;
    className?: string;
}

const MultiSelectFilterDropdown: React.FC<MultiSelectFilterDropdownProps> = ({
    options,
    selectedValues,
    onChange,
    emptyLabel,
    selectedLabel,
    icon,
    className = '',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Toggle option selection
    const handleOptionToggle = (value: string) => {
        const newSelectedValues = selectedValues.includes(value)
            ? selectedValues.filter((v) => v !== value)
            : [...selectedValues, value];

        onChange(newSelectedValues);
    };

    // Clear all selections
    const handleClearAll = () => {
        onChange([]);
    };

    // Check if there are active filters
    const hasActiveFilters = selectedValues.length > 0;

    // Get label for trigger button
    const getTriggerLabel = () => {
        if (selectedValues.length === 0) {
            return emptyLabel;
        }
        return selectedLabel.replace(
            '{{count}}',
            selectedValues.length.toString()
        );
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                {icon && <span className="mr-2">{icon}</span>}
                <span>{getTriggerLabel()}</span>
                <ChevronDownIcon
                    className={`h-4 w-4 ml-2 transition-transform ${
                        isOpen ? 'transform rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-hidden">
                    {/* Options List */}
                    <div className="overflow-y-auto max-h-64">
                        {options.map((option) => {
                            const isSelected = selectedValues.includes(
                                option.value
                            );

                            return (
                                <label
                                    key={option.value}
                                    className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                            handleOptionToggle(option.value)
                                        }
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                    />
                                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    )}
                                </label>
                            );
                        })}
                    </div>

                    {/* Clear Button Footer - Only show when filters are active */}
                    {hasActiveFilters && (
                        <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-1"
                            >
                                {t('common.clear', 'Clear')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelectFilterDropdown;
