import { Task } from '../entities/Task';

export type RecurrenceFilterValue = 'all' | 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Filters tasks by recurrence type.
 * - 'all': no filtering
 * - 'none': tasks with recurrence_type === 'none'
 * - 'daily': tasks with recurrence_type === 'daily'
 * - 'weekly': tasks with recurrence_type === 'weekly'
 * - 'monthly': tasks with recurrence_type starting with 'monthly' (includes monthly_weekday, monthly_last_day)
 */
export function filterTasksByRecurrence(
    tasks: Task[],
    recurrenceFilter: RecurrenceFilterValue
): Task[] {
    if (recurrenceFilter === 'all') {
        return tasks;
    }

    if (recurrenceFilter === 'monthly') {
        return tasks.filter((task) =>
            task.recurrence_type?.startsWith('monthly')
        );
    }

    return tasks.filter((task) => task.recurrence_type === recurrenceFilter);
}
