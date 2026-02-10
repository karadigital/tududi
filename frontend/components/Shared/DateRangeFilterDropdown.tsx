import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronDownIcon,
    XMarkIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';

type DateField = 'due_date' | 'created_at' | 'completed_at';

interface DateRangeFilterDropdownProps {
    dateField: DateField;
    dateFrom: string;
    dateTo: string;
    onDateFieldChange: (field: DateField) => void;
    onDateFromChange: (date: string) => void;
    onDateToChange: (date: string) => void;
    onClear: () => void;
    className?: string;
}

const DateRangeFilterDropdown: React.FC<DateRangeFilterDropdownProps> = ({
    dateField,
    dateFrom,
    dateTo,
    onDateFieldChange,
    onDateFromChange,
    onDateToChange,
    onClear,
    className = '',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const hasActiveFilter = dateFrom !== '' || dateTo !== '';

    const dateFieldOptions: { value: DateField; label: string }[] = [
        {
            value: 'due_date',
            label: t('tasks.dateFilter.dueDate', 'Due date'),
        },
        {
            value: 'created_at',
            label: t('tasks.dateFilter.createdAt', 'Created'),
        },
        {
            value: 'completed_at',
            label: t('tasks.dateFilter.completedAt', 'Completed'),
        },
    ];

    const getFieldLabel = (field: DateField) => {
        return dateFieldOptions.find((o) => o.value === field)?.label || '';
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    };

    const getTriggerLabel = () => {
        if (!hasActiveFilter) {
            return t('tasks.dateFilter.label', 'Date');
        }
        const fieldLabel = getFieldLabel(dateField);
        if (dateFrom && dateTo) {
            return `${fieldLabel}: ${formatDate(dateFrom)} \u2013 ${formatDate(dateTo)}`;
        }
        if (dateFrom) {
            return `${fieldLabel}: ${t('tasks.dateFilter.from', 'from')} ${formatDate(dateFrom)}`;
        }
        return `${fieldLabel}: ${t('tasks.dateFilter.to', 'to')} ${formatDate(dateTo)}`;
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <CalendarDaysIcon className="h-4 w-4 mr-2" />
                <span>{getTriggerLabel()}</span>
                {hasActiveFilter ? (
                    <XMarkIcon
                        className="h-4 w-4 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                    />
                ) : (
                    <ChevronDownIcon
                        className={`h-4 w-4 ml-2 transition-transform ${
                            isOpen ? 'transform rotate-180' : ''
                        }`}
                    />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                    <div className="p-3 space-y-3">
                        {/* Date Field Selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t('tasks.dateFilter.field', 'Filter by')}
                            </label>
                            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                                {dateFieldOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            onDateFieldChange(option.value)
                                        }
                                        className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                                            dateField === option.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* From Date */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t('tasks.dateFilter.from', 'From')}
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) =>
                                    onDateFromChange(e.target.value)
                                }
                                max={dateTo || undefined}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* To Date */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t('tasks.dateFilter.to', 'To')}
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => onDateToChange(e.target.value)}
                                min={dateFrom || undefined}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Clear Button Footer */}
                    {hasActiveFilter && (
                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                            <button
                                type="button"
                                onClick={() => {
                                    onClear();
                                    setIsOpen(false);
                                }}
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

export default DateRangeFilterDropdown;
