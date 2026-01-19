import { Task } from '../entities/Task';

export type RecurrenceFilterValue = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Filters tasks by recurrence type.
 * - Empty array: no filtering (show all tasks)
 * - 'none': tasks with recurrence_type === 'none'
 * - 'daily': tasks with recurrence_type === 'daily'
 * - 'weekly': tasks with recurrence_type === 'weekly'
 * - 'monthly': tasks with recurrence_type starting with 'monthly' (includes monthly_weekday, monthly_last_day)
 */
export function filterTasksByRecurrence(
    tasks: Task[],
    recurrenceFilters: RecurrenceFilterValue[]
): Task[] {
    if (recurrenceFilters.length === 0) {
        return tasks; // Empty = show all
    }

    return tasks.filter((task) => {
        for (const filter of recurrenceFilters) {
            if (filter === 'monthly') {
                if (task.recurrence_type?.startsWith('monthly')) return true;
            } else if (task.recurrence_type === filter) {
                return true;
            }
        }
        return false;
    });
}
