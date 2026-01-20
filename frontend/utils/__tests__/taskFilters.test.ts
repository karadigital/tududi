import { filterTasksByRecurrence } from '../taskFilters';
import { Task } from '../../entities/Task';

// Helper to create minimal task objects for testing
const createTask = (overrides: Partial<Task> = {}): Task =>
    ({
        id: 1,
        uid: 'test-uid',
        name: 'Test Task',
        status: 'not_started',
        recurrence_type: 'none',
        ...overrides,
    }) as Task;

describe('filterTasksByRecurrence', () => {
    const tasks: Task[] = [
        createTask({ id: 1, name: 'No recurrence', recurrence_type: 'none' }),
        createTask({ id: 2, name: 'Daily task', recurrence_type: 'daily' }),
        createTask({ id: 3, name: 'Weekly task', recurrence_type: 'weekly' }),
        createTask({ id: 4, name: 'Monthly task', recurrence_type: 'monthly' }),
        createTask({
            id: 5,
            name: 'Monthly weekday',
            recurrence_type: 'monthly_weekday',
        }),
        createTask({
            id: 6,
            name: 'Monthly last day',
            recurrence_type: 'monthly_last_day',
        }),
    ];

    it('returns all tasks when filter array is empty', () => {
        const result = filterTasksByRecurrence(tasks, []);
        expect(result).toHaveLength(6);
        expect(result).toEqual(tasks);
    });

    it('returns only non-recurring tasks when filter is ["none"]', () => {
        const result = filterTasksByRecurrence(tasks, ['none']);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('No recurrence');
    });

    it('returns only daily tasks when filter is ["daily"]', () => {
        const result = filterTasksByRecurrence(tasks, ['daily']);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Daily task');
    });

    it('returns only weekly tasks when filter is ["weekly"]', () => {
        const result = filterTasksByRecurrence(tasks, ['weekly']);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Weekly task');
    });

    it('returns all monthly variants when filter is ["monthly"]', () => {
        const result = filterTasksByRecurrence(tasks, ['monthly']);
        expect(result).toHaveLength(3);
        expect(result.map((t) => t.name)).toEqual([
            'Monthly task',
            'Monthly weekday',
            'Monthly last day',
        ]);
    });

    it('returns daily and weekly tasks when filter is ["daily", "weekly"]', () => {
        const result = filterTasksByRecurrence(tasks, ['daily', 'weekly']);
        expect(result).toHaveLength(2);
        expect(result.map((t) => t.name)).toEqual([
            'Daily task',
            'Weekly task',
        ]);
    });

    it('returns non-recurring and monthly tasks when filter is ["none", "monthly"]', () => {
        const result = filterTasksByRecurrence(tasks, ['none', 'monthly']);
        expect(result).toHaveLength(4);
        expect(result.map((t) => t.name)).toEqual([
            'No recurrence',
            'Monthly task',
            'Monthly weekday',
            'Monthly last day',
        ]);
    });

    it('handles empty task array', () => {
        const result = filterTasksByRecurrence([], ['daily']);
        expect(result).toHaveLength(0);
    });

    it('handles tasks with undefined recurrence_type', () => {
        const tasksWithUndefined = [
            createTask({ id: 1, recurrence_type: undefined as any }),
            createTask({ id: 2, recurrence_type: 'daily' }),
        ];
        const result = filterTasksByRecurrence(tasksWithUndefined, ['daily']);
        expect(result).toHaveLength(1);
    });
});
