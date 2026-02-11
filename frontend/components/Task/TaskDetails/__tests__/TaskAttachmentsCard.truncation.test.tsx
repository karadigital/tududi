import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskAttachmentsCard from '../TaskAttachmentsCard';
import { Attachment } from '../../../../entities/Attachment';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue || _key,
    }),
}));

// Mock attachmentsService
const mockFetchAttachments = jest.fn();
jest.mock('../../../../utils/attachmentsService', () => ({
    fetchAttachments: (...args: unknown[]) => mockFetchAttachments(...args),
    uploadAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
    downloadAttachment: jest.fn(),
    validateFile: jest.fn(() => ({ valid: true })),
    getAttachmentType: jest.fn(() => 'document'),
}));

// Mock ToastContext
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

// Mock AttachmentCard — render a simple div with testid
jest.mock('../../../Shared/AttachmentCard', () => ({
    __esModule: true,
    default: ({ attachment }: { attachment: Attachment }) => (
        <div data-testid="attachment-card">{attachment.original_filename}</div>
    ),
}));

// Mock ConfirmDialog and AttachmentPreview — render nothing
jest.mock('../../../Shared/ConfirmDialog', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../Shared/AttachmentPreview', () => ({
    __esModule: true,
    default: () => null,
}));

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
    CloudArrowUpIcon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} data-testid="cloud-icon" />
    ),
    PaperClipIcon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} data-testid="paperclip-icon" />
    ),
}));

// --- Factories ---

function createAttachment(overrides: Partial<Attachment> = {}): Attachment {
    return {
        id: 1,
        uid: 'att-uid-1',
        task_id: 100,
        user_id: 1,
        original_filename: 'file.pdf',
        stored_filename: 'stored.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        file_path: '/uploads/stored.pdf',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function createAttachments(n: number): Attachment[] {
    return Array.from({ length: n }, (_, i) =>
        createAttachment({
            id: i + 1,
            uid: `att-uid-${i + 1}`,
            original_filename: `file-${i + 1}.pdf`,
            stored_filename: `stored-${i + 1}.pdf`,
        })
    );
}

// --- Tests ---

describe('TaskAttachmentsCard — truncation props', () => {
    const TASK_UID = 'task-uid-1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders all attachments when maxItems is not set', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));

        render(<TaskAttachmentsCard taskUid={TASK_UID} />);

        await waitFor(() => {
            expect(screen.getAllByTestId('attachment-card')).toHaveLength(8);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('renders only maxItems attachments when truncated', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));

        render(<TaskAttachmentsCard taskUid={TASK_UID} maxItems={5} />);

        await waitFor(() => {
            expect(screen.getAllByTestId('attachment-card')).toHaveLength(5);
        });
    });

    it('shows "+N more" text when truncated', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));

        render(<TaskAttachmentsCard taskUid={TASK_UID} maxItems={5} />);

        await waitFor(() => {
            expect(screen.getByText(/\+3/)).toBeInTheDocument();
        });
    });

    it('shows "View all" button when onViewAll is provided', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));
        const onViewAll = jest.fn();

        render(
            <TaskAttachmentsCard
                taskUid={TASK_UID}
                maxItems={5}
                onViewAll={onViewAll}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('View all')).toBeInTheDocument();
        });
    });

    it('does not show "View all" button when onViewAll is not provided', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));

        render(<TaskAttachmentsCard taskUid={TASK_UID} maxItems={5} />);

        await waitFor(() => {
            expect(screen.getByText(/\+3/)).toBeInTheDocument();
        });
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('calls onViewAll when "View all" button is clicked', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(8));
        const onViewAll = jest.fn();

        render(
            <TaskAttachmentsCard
                taskUid={TASK_UID}
                maxItems={5}
                onViewAll={onViewAll}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('View all')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('View all'));
        expect(onViewAll).toHaveBeenCalledTimes(1);
    });

    it('shows no footer when attachments equal maxItems', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(5));

        render(<TaskAttachmentsCard taskUid={TASK_UID} maxItems={5} />);

        await waitFor(() => {
            expect(screen.getAllByTestId('attachment-card')).toHaveLength(5);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });

    it('shows no footer when attachments fewer than maxItems', async () => {
        mockFetchAttachments.mockResolvedValue(createAttachments(3));

        render(<TaskAttachmentsCard taskUid={TASK_UID} maxItems={5} />);

        await waitFor(() => {
            expect(screen.getAllByTestId('attachment-card')).toHaveLength(3);
        });
        expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
        expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });
});
