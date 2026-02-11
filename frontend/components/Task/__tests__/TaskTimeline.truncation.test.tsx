import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskTimeline from '../TaskTimeline';
import { TaskEvent } from '../../../entities/TaskEvent';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue || _key,
    }),
}));

// Mock taskEventService
const mockGetTaskTimeline = jest.fn();
jest.mock('../../../utils/taskEventService', () => ({
    getTaskTimeline: (...args: unknown[]) => mockGetTaskTimeline(...args),
    getEventTypeLabel: (type: string) => type,
    getPriorityLabel: (label: string) => label,
}));

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
    ClockIcon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} data-testid="clock-icon" />
    ),
    ExclamationTriangleIcon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} data-testid="exclamation-icon" />
    ),
    SparklesIcon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} data-testid="sparkles-icon" />
    ),
}));

// --- Factories ---

function createEvent(overrides: Partial<TaskEvent> = {}): TaskEvent {
    return {
        id: 1,
        task_id: 100,
        user_id: 1,
        event_type: 'created',
        created_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function createEvents(n: number): TaskEvent[] {
    return Array.from({ length: n }, (_, i) =>
        createEvent({
            id: i + 1,
            event_type: 'created',
            // Distinct timestamps — descending so sort keeps order
            created_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        })
    );
}

// --- Tests ---

describe('TaskTimeline — truncation props', () => {
    const TASK_UID = 'task-uid-1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all events when maxItems is not set', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        const { container } = render(<TaskTimeline taskUid={TASK_UID} />);

        await waitFor(() => {
            const items = container.querySelectorAll(
                '[data-testid="timeline-event"]'
            );
            expect(items).toHaveLength(10);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('renders only maxItems events when truncated', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        const { container } = render(
            <TaskTimeline taskUid={TASK_UID} maxItems={3} />
        );

        await waitFor(() => {
            const items = container.querySelectorAll(
                '[data-testid="timeline-event"]'
            );
            expect(items).toHaveLength(3);
        });
    });

    it('shows "+N more" text when truncated', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        render(<TaskTimeline taskUid={TASK_UID} maxItems={3} />);

        await waitFor(() => {
            expect(screen.getByText(/\+7/)).toBeInTheDocument();
        });
    });

    it('shows "View all" button when onViewAll is provided', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));
        const onViewAll = jest.fn();

        render(
            <TaskTimeline
                taskUid={TASK_UID}
                maxItems={3}
                onViewAll={onViewAll}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('View all')).toBeInTheDocument();
        });
    });

    it('does not show "View all" button when onViewAll is not provided', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        render(<TaskTimeline taskUid={TASK_UID} maxItems={3} />);

        await waitFor(() => {
            expect(screen.getByText(/\+7/)).toBeInTheDocument();
        });
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('calls onViewAll when "View all" button is clicked', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));
        const onViewAll = jest.fn();

        render(
            <TaskTimeline
                taskUid={TASK_UID}
                maxItems={3}
                onViewAll={onViewAll}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('View all')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('View all'));
        expect(onViewAll).toHaveBeenCalledTimes(1);
    });

    it('shows no footer when events equal maxItems', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(3));

        const { container } = render(
            <TaskTimeline taskUid={TASK_UID} maxItems={3} />
        );

        await waitFor(() => {
            const items = container.querySelectorAll(
                '[data-testid="timeline-event"]'
            );
            expect(items).toHaveLength(3);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('shows no footer when events fewer than maxItems', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(2));

        const { container } = render(
            <TaskTimeline taskUid={TASK_UID} maxItems={3} />
        );

        await waitFor(() => {
            const items = container.querySelectorAll(
                '[data-testid="timeline-event"]'
            );
            expect(items).toHaveLength(2);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('removes scroll container when truncated', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        const { container } = render(
            <TaskTimeline taskUid={TASK_UID} maxItems={3} />
        );

        await waitFor(() => {
            expect(screen.getByText(/\+7/)).toBeInTheDocument();
        });

        const scrollDiv = container.querySelector(
            '[data-testid="timeline-scroll-container"]'
        );
        expect(scrollDiv).not.toBeInTheDocument();
    });

    it('keeps scroll container when not truncated', async () => {
        mockGetTaskTimeline.mockResolvedValue(createEvents(10));

        const { container } = render(<TaskTimeline taskUid={TASK_UID} />);

        await waitFor(() => {
            const items = container.querySelectorAll(
                '[data-testid="timeline-event"]'
            );
            expect(items).toHaveLength(10);
        });

        const scrollDiv = container.querySelector(
            '[data-testid="timeline-scroll-container"]'
        );
        expect(scrollDiv).toBeInTheDocument();
    });
});
