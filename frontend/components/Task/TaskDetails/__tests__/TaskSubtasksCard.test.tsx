import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskSubtasksCard from '../TaskSubtasksCard';
import { Task } from '../../../../entities/Task';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue,
    }),
}));

// Mock TaskPriorityIcon
jest.mock('../../TaskPriorityIcon', () => ({
    __esModule: true,
    default: ({ onToggleCompletion }: { onToggleCompletion: () => void }) => (
        <button data-testid="priority-icon" onClick={onToggleCompletion}>
            Priority Icon
        </button>
    ),
}));

// Mock TaskSubtasksSection
jest.mock('../../TaskForm/TaskSubtasksSection', () => ({
    __esModule: true,
    default: () => (
        <div data-testid="task-subtasks-section">Task Subtasks Section</div>
    ),
}));

describe('TaskSubtasksCard - Inline Subtask Creation', () => {
    const mockTask: Task = {
        id: 1,
        uid: 'task-uid-1',
        name: 'Test Task',
        status: 'not_started',
        priority: 'medium',
        today: false,
    } as Task;

    const mockSubtask: Task = {
        id: 2,
        uid: 'subtask-uid-1',
        name: 'Test Subtask',
        status: 'not_started',
        priority: 'low',
        today: false,
        parent_task_id: 1,
    } as Task;

    const defaultProps = {
        task: mockTask,
        subtasks: [] as Task[],
        isEditing: false,
        editedSubtasks: [] as Task[],
        onSubtasksChange: jest.fn(),
        onStartEdit: jest.fn(),
        onSave: jest.fn(),
        onCancel: jest.fn(),
        onToggleSubtaskCompletion: jest.fn().mockResolvedValue(undefined),
        onCreateSubtask: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Add Subtask Button', () => {
        it('renders "Add subtask" button when not in adding mode', () => {
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            expect(addButton).toBeInTheDocument();
            expect(screen.getByText('Add subtask')).toBeInTheDocument();
        });

        it('does not render add button when onCreateSubtask is not provided', () => {
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={undefined}
                />
            );

            expect(
                screen.queryByTestId('add-subtask-button')
            ).not.toBeInTheDocument();
        });

        it('clicking button shows input and hides button', () => {
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            expect(
                screen.getByTestId('inline-subtask-input')
            ).toBeInTheDocument();
            expect(
                screen.queryByTestId('add-subtask-button')
            ).not.toBeInTheDocument();
        });
    });

    describe('Inline Input Behavior', () => {
        it('input is auto-focused when shown', async () => {
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            // Focus happens asynchronously via setTimeout
            await waitFor(() => {
                expect(document.activeElement).toBe(input);
            });
        });

        it('shows placeholder text', () => {
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            expect(input).toHaveAttribute(
                'placeholder',
                'Type subtask and press Enter'
            );
        });

        it('Enter with text calls onCreateSubtask', async () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.change(input, { target: { value: 'New Subtask' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                expect(mockCreateSubtask).toHaveBeenCalledWith('New Subtask');
            });
        });

        it('Enter with empty input does not call onCreateSubtask', () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(mockCreateSubtask).not.toHaveBeenCalled();
        });

        it('Enter with whitespace-only input does not call onCreateSubtask', () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            expect(mockCreateSubtask).not.toHaveBeenCalled();
        });

        it('Escape closes input and shows button', () => {
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.change(input, { target: { value: 'Some text' } });
            fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

            expect(
                screen.queryByTestId('inline-subtask-input')
            ).not.toBeInTheDocument();
            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();
        });

        it('blur closes input when empty', () => {
            jest.useFakeTimers();
            render(<TaskSubtasksCard {...defaultProps} />);

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.blur(input);

            // Run the setTimeout in handleBlur
            act(() => {
                jest.advanceTimersByTime(200);
            });

            expect(
                screen.queryByTestId('inline-subtask-input')
            ).not.toBeInTheDocument();
            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();

            jest.useRealTimers();
        });

        it('input clears after successful creation', async () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId(
                'inline-subtask-input'
            ) as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'New Subtask' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                expect(mockCreateSubtask).toHaveBeenCalled();
            });

            // Input should be cleared but still visible
            await waitFor(() => {
                const newInput = screen.getByTestId(
                    'inline-subtask-input'
                ) as HTMLInputElement;
                expect(newInput.value).toBe('');
            });
        });

        it('input stays visible after creation for rapid entry', async () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.change(input, { target: { value: 'First Subtask' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                expect(mockCreateSubtask).toHaveBeenCalledWith('First Subtask');
            });

            // Input should still be visible for adding more subtasks
            expect(
                screen.getByTestId('inline-subtask-input')
            ).toBeInTheDocument();
        });

        it('input remains focused after subtasks list updates', async () => {
            const mockCreateSubtask = jest.fn().mockResolvedValue(undefined);
            const { rerender } = render(
                <TaskSubtasksCard
                    {...defaultProps}
                    subtasks={[]}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            // Click add button and type
            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            const input = screen.getByTestId('inline-subtask-input');
            fireEvent.change(input, { target: { value: 'New Subtask' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                expect(mockCreateSubtask).toHaveBeenCalledWith('New Subtask');
            });

            // Simulate parent updating subtasks prop (as would happen after API call)
            const newSubtask: Task = {
                id: 100,
                uid: 'new-subtask-uid',
                name: 'New Subtask',
                status: 'not_started',
                priority: 'low',
                today: false,
                parent_task_id: 1,
            } as Task;

            rerender(
                <TaskSubtasksCard
                    {...defaultProps}
                    subtasks={[newSubtask]}
                    onCreateSubtask={mockCreateSubtask}
                />
            );

            // Input should still be focused after the re-render
            await waitFor(() => {
                const newInput = screen.getByTestId('inline-subtask-input');
                expect(document.activeElement).toBe(newInput);
            });
        });
    });

    describe('Empty State', () => {
        it('empty state shows add subtask button when onCreateSubtask is provided', () => {
            render(<TaskSubtasksCard {...defaultProps} subtasks={[]} />);

            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();
            expect(screen.getByText('Add subtask')).toBeInTheDocument();
        });

        it('empty state falls back to legacy behavior when onCreateSubtask is not provided', () => {
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    subtasks={[]}
                    onCreateSubtask={undefined}
                />
            );

            // Should show the click-to-edit area
            expect(screen.getByText('Add subtasks')).toBeInTheDocument();
        });
    });

    describe('With Existing Subtasks', () => {
        it('renders existing subtasks with add button below', () => {
            render(
                <TaskSubtasksCard {...defaultProps} subtasks={[mockSubtask]} />
            );

            expect(screen.getByText('Test Subtask')).toBeInTheDocument();
            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();
        });

        it('inline input appears after subtask list when adding', () => {
            render(
                <TaskSubtasksCard {...defaultProps} subtasks={[mockSubtask]} />
            );

            const addButton = screen.getByTestId('add-subtask-button');
            fireEvent.click(addButton);

            expect(screen.getByText('Test Subtask')).toBeInTheDocument();
            expect(
                screen.getByTestId('inline-subtask-input')
            ).toBeInTheDocument();
        });
    });

    describe('Header Mode', () => {
        it('renders add button in header mode when empty', () => {
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    subtasks={[]}
                    showHeader={true}
                />
            );

            expect(screen.getByText('Subtasks')).toBeInTheDocument();
            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();
        });

        it('renders add button with subtasks in header mode', () => {
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    subtasks={[mockSubtask]}
                    showHeader={true}
                />
            );

            expect(screen.getByText('Subtasks')).toBeInTheDocument();
            expect(screen.getByText('Test Subtask')).toBeInTheDocument();
            expect(
                screen.getByTestId('add-subtask-button')
            ).toBeInTheDocument();
        });
    });

    describe('Editing Mode', () => {
        it('does not show inline add input when in editing mode', () => {
            render(
                <TaskSubtasksCard
                    {...defaultProps}
                    isEditing={true}
                    editedSubtasks={[mockSubtask]}
                />
            );

            // Should show the TaskSubtasksSection for editing
            expect(
                screen.getByTestId('task-subtasks-section')
            ).toBeInTheDocument();
            expect(
                screen.queryByTestId('add-subtask-button')
            ).not.toBeInTheDocument();
        });
    });
});
