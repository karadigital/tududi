import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GroupedTaskList from '../GroupedTaskList';
import { Task } from '../../../entities/Task';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
    }),
}));

// Mock TaskItem to simplify testing
jest.mock('../TaskItem', () => {
    return function MockTaskItem({ task }: { task: Task }) {
        return (
            <div
                data-testid={`task-item-${task.id}`}
                data-task-name={task.name}
            >
                {task.name}
            </div>
        );
    };
});

// Helper to wrap component with router
const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Factory for creating test tasks
const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Test Task',
    status: 'not_started',
    completed_at: null,
    ...overrides,
});

// Helper to get a group section by its label
const getGroupSection = (label: string) => {
    const groupHeader = screen.getByText(label);
    // The header is in a flex div, which is inside the group container div
    return groupHeader.closest('.space-y-1\\.5') as HTMLElement;
};

// Helper to get task count text for a group
const getGroupTaskCount = (label: string): string => {
    const groupSection = getGroupSection(label);
    const countSpan = within(groupSection).getByText(/\d+ tasks/);
    return countSpan.textContent || '';
};

const defaultProps = {
    tasks: [] as Task[],
    groupBy: 'involvement' as const,
    currentUserId: 1,
    currentUserUid: 'user-1',
    onTaskUpdate: jest.fn(),
    onTaskDelete: jest.fn(),
    projects: [],
};

describe('GroupedTaskList - Involvement Grouping', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all three involvement groups even when empty', () => {
        renderWithRouter(<GroupedTaskList {...defaultProps} tasks={[]} />);

        // Check that all three group headers are rendered
        expect(screen.getByText('Assigned to me')).toBeInTheDocument();
        expect(screen.getByText('Assigned to others')).toBeInTheDocument();
        expect(screen.getByText('Subscribed')).toBeInTheDocument();

        // All groups should show "No tasks in this group" 3 times
        const emptyMessages = screen.getAllByText('No tasks in this group');
        expect(emptyMessages).toHaveLength(3);
    });

    it('groups task assigned to current user in "Assigned to me"', () => {
        const taskAssignedToMe = createTask({
            id: 1,
            name: 'My Assigned Task',
            assigned_to_user_id: 1, // Current user ID
        });

        renderWithRouter(
            <GroupedTaskList {...defaultProps} tasks={[taskAssignedToMe]} />
        );

        // Task should be in "Assigned to me" group
        expect(screen.getByTestId('task-item-1')).toBeInTheDocument();
        expect(screen.getByText('My Assigned Task')).toBeInTheDocument();

        // "Assigned to me" group should show "1 tasks"
        expect(getGroupTaskCount('Assigned to me')).toBe('1 tasks');
    });

    it('groups task assigned to others in "Assigned to others"', () => {
        const taskAssignedToOther = createTask({
            id: 2,
            name: 'Other Person Task',
            assigned_to_user_id: 99, // Different user ID
        });

        renderWithRouter(
            <GroupedTaskList {...defaultProps} tasks={[taskAssignedToOther]} />
        );

        // Task should be in "Assigned to others" group
        expect(screen.getByTestId('task-item-2')).toBeInTheDocument();
        expect(screen.getByText('Other Person Task')).toBeInTheDocument();

        // "Assigned to others" group should show "1 tasks"
        expect(getGroupTaskCount('Assigned to others')).toBe('1 tasks');
    });

    it('groups subscribed task in "Subscribed"', () => {
        const subscribedTask = createTask({
            id: 3,
            name: 'Subscribed Task',
            assigned_to_user_id: undefined, // Not assigned
            Subscribers: [{ id: 1, uid: 'user-1', email: 'test@example.com' }],
        });

        renderWithRouter(
            <GroupedTaskList {...defaultProps} tasks={[subscribedTask]} />
        );

        // Task should be in "Subscribed" group
        expect(screen.getByTestId('task-item-3')).toBeInTheDocument();
        expect(screen.getByText('Subscribed Task')).toBeInTheDocument();

        // "Subscribed" group should show "1 tasks"
        expect(getGroupTaskCount('Subscribed')).toBe('1 tasks');
    });

    it('shows task in multiple groups when both assigned and subscribed', () => {
        const taskAssignedAndSubscribed = createTask({
            id: 4,
            name: 'Assigned And Subscribed Task',
            assigned_to_user_id: 1, // Assigned to current user
            Subscribers: [{ id: 1, uid: 'user-1', email: 'test@example.com' }], // Also subscribed
        });

        renderWithRouter(
            <GroupedTaskList
                {...defaultProps}
                tasks={[taskAssignedAndSubscribed]}
            />
        );

        // Task should appear twice (once in "Assigned to me", once in "Subscribed")
        const taskItems = screen.getAllByTestId('task-item-4');
        expect(taskItems).toHaveLength(2);

        // "Assigned to me" should show 1 task
        expect(getGroupTaskCount('Assigned to me')).toBe('1 tasks');

        // "Subscribed" should show 1 task
        expect(getGroupTaskCount('Subscribed')).toBe('1 tasks');
    });

    it('does not show unassigned task not subscribed in any group', () => {
        const unassignedUnsubscribedTask = createTask({
            id: 5,
            name: 'Orphan Task',
            assigned_to_user_id: undefined, // Not assigned
            Subscribers: [], // Not subscribed
        });

        renderWithRouter(
            <GroupedTaskList
                {...defaultProps}
                tasks={[unassignedUnsubscribedTask]}
            />
        );

        // Task should not appear in any group
        expect(screen.queryByTestId('task-item-5')).not.toBeInTheDocument();
        expect(screen.queryByText('Orphan Task')).not.toBeInTheDocument();

        // All groups should show empty message
        const emptyMessages = screen.getAllByText('No tasks in this group');
        expect(emptyMessages).toHaveLength(3);
    });

    it('shows unassigned task in Subscribed if user is subscribed', () => {
        const unassignedButSubscribedTask = createTask({
            id: 6,
            name: 'Unassigned But Subscribed',
            assigned_to_user_id: undefined, // Not assigned
            Subscribers: [{ id: 1, uid: 'user-1', email: 'test@example.com' }], // Subscribed
        });

        renderWithRouter(
            <GroupedTaskList
                {...defaultProps}
                tasks={[unassignedButSubscribedTask]}
            />
        );

        // Task should appear only in "Subscribed" group
        expect(screen.getByTestId('task-item-6')).toBeInTheDocument();
        expect(
            screen.getByText('Unassigned But Subscribed')
        ).toBeInTheDocument();

        // Only "Subscribed" should have the task
        expect(getGroupTaskCount('Subscribed')).toBe('1 tasks');

        // "Assigned to me" and "Assigned to others" should be empty
        const emptyMessages = screen.getAllByText('No tasks in this group');
        expect(emptyMessages).toHaveLength(2);
    });
});
