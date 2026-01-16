import {
    XMarkIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    FireIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { PriorityType } from '../entities/Task';

export interface PriorityConfig {
    value: PriorityType;
    numericValue: number;
    key: string;
    labelKey: string;
    defaultLabel: string;
    shortLabel: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    iconClass: string;
    iconClassDark: string;
    borderClass: string;
    textClass: string;
    bgClass: string;
    bgActiveClass: string;
}

/**
 * Single source of truth for all priority definitions.
 * Adding a new priority only requires updating this array.
 */
export const PRIORITIES: PriorityConfig[] = [
    {
        value: null,
        numericValue: -1,
        key: 'none',
        labelKey: 'priority.none',
        defaultLabel: 'None',
        shortLabel: '-',
        icon: XMarkIcon,
        iconClass: 'text-gray-400',
        iconClassDark: 'dark:text-gray-500',
        borderClass: 'border-gray-300 dark:border-gray-600',
        textClass: 'text-gray-600 dark:text-gray-300',
        bgClass: 'bg-gray-200 dark:bg-gray-700',
        bgActiveClass: 'bg-gray-300 dark:bg-gray-600',
    },
    {
        value: 'low',
        numericValue: 0,
        key: 'low',
        labelKey: 'priority.low',
        defaultLabel: 'Low',
        shortLabel: 'L',
        icon: ArrowDownIcon,
        iconClass: 'text-blue-500',
        iconClassDark: 'dark:text-blue-400',
        borderClass: 'border-blue-500 dark:border-blue-400',
        textClass: 'text-blue-600 dark:text-blue-300',
        bgClass: 'bg-blue-100 dark:bg-blue-900/30',
        bgActiveClass: 'bg-blue-500 dark:bg-blue-600',
    },
    {
        value: 'medium',
        numericValue: 1,
        key: 'medium',
        labelKey: 'priority.medium',
        defaultLabel: 'Medium',
        shortLabel: 'M',
        icon: ArrowUpIcon,
        iconClass: 'text-yellow-500',
        iconClassDark: 'dark:text-yellow-400',
        borderClass: 'border-yellow-500 dark:border-yellow-400',
        textClass: 'text-yellow-600 dark:text-yellow-300',
        bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
        bgActiveClass: 'bg-yellow-500 dark:bg-yellow-600',
    },
    {
        value: 'high',
        numericValue: 2,
        key: 'high',
        labelKey: 'priority.high',
        defaultLabel: 'High',
        shortLabel: 'H',
        icon: FireIcon,
        iconClass: 'text-red-500',
        iconClassDark: 'dark:text-red-400',
        borderClass: 'border-red-500 dark:border-red-400',
        textClass: 'text-red-600 dark:text-red-300',
        bgClass: 'bg-red-100 dark:bg-red-900/30',
        bgActiveClass: 'bg-red-500 dark:bg-red-600',
    },
    {
        value: 'critical',
        numericValue: 3,
        key: 'critical',
        labelKey: 'priority.critical',
        defaultLabel: 'Critical',
        shortLabel: '!',
        icon: ExclamationTriangleIcon,
        iconClass: 'text-red-600',
        iconClassDark: 'dark:text-red-500',
        borderClass: 'border-red-600 dark:border-red-500',
        textClass: 'text-red-700 dark:text-red-400',
        bgClass: 'bg-red-200 dark:bg-red-900/40',
        bgActiveClass: 'bg-red-600 dark:bg-red-700',
    },
];

/**
 * Get priority config by string value (e.g., 'low', 'high', 'critical')
 */
export const getPriorityByValue = (
    value: PriorityType
): PriorityConfig | undefined => {
    return PRIORITIES.find((p) => p.value === value);
};

/**
 * Get priority config by numeric value (e.g., 0, 1, 2, 3)
 */
export const getPriorityByNumeric = (
    numericValue: number
): PriorityConfig | undefined => {
    return PRIORITIES.find((p) => p.numericValue === numericValue);
};

/**
 * Normalize priority to PriorityConfig - handles both string and numeric values
 */
export const normalizePriority = (
    priority: PriorityType | number | undefined
): PriorityConfig => {
    if (priority === null || priority === undefined) {
        return PRIORITIES[0]; // None
    }

    if (typeof priority === 'number') {
        return getPriorityByNumeric(priority) || PRIORITIES[0];
    }

    return getPriorityByValue(priority) || PRIORITIES[0];
};

/**
 * Get the icon component for a priority
 */
export const getPriorityIcon = (
    priority: PriorityType | number | undefined
): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
    return normalizePriority(priority).icon;
};

/**
 * Get the icon class (color) for a priority
 */
export const getPriorityIconClass = (
    priority: PriorityType | number | undefined
): string => {
    const config = normalizePriority(priority);
    return `${config.iconClass} ${config.iconClassDark}`;
};

/**
 * Get the label for a priority (requires translation function)
 */
export const getPriorityLabel = (
    priority: PriorityType | number | undefined,
    t?: (key: string, defaultValue: string) => string
): string => {
    const config = normalizePriority(priority);
    if (t) {
        return t(config.labelKey, config.defaultLabel);
    }
    return config.defaultLabel;
};

/**
 * Get priority label by numeric value only (for non-React contexts)
 */
export const getPriorityLabelByNumeric = (numericValue: number): string => {
    const config = getPriorityByNumeric(numericValue);
    return config?.defaultLabel || `Priority ${numericValue}`;
};

/**
 * Check if a task can have critical priority
 * Critical tasks require both a due date and an assignee
 */
export const canSetCriticalPriority = (
    dueDate: string | null | undefined,
    assignedToUserId: number | null | undefined
): boolean => {
    return Boolean(dueDate && assignedToUserId);
};

/**
 * Get all selectable priorities (excludes none if needed)
 */
export const getSelectablePriorities = (
    includeNone: boolean = true
): PriorityConfig[] => {
    return includeNone ? PRIORITIES : PRIORITIES.slice(1);
};
