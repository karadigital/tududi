import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AreaMembers from '../AreaMembers';
import {
    updateAreaMemberRole,
    getAreaSubscribers,
    addAreaSubscriber,
    removeAreaSubscriber,
} from '../../../utils/areasService';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string, opts?: any) =>
            defaultValue.replace(/\{\{(\w+)\}\}/g, (_, k) => opts?.[k] ?? _),
    }),
}));

// Mock areasService
jest.mock('../../../utils/areasService', () => ({
    addAreaMember: jest.fn(),
    removeAreaMember: jest.fn(),
    updateAreaMemberRole: jest.fn(),
    getAreaSubscribers: jest.fn().mockResolvedValue([]),
    addAreaSubscriber: jest.fn(),
    removeAreaSubscriber: jest.fn(),
}));

// Mock authUtils
jest.mock('../../../utils/authUtils', () => ({
    handleAuthResponse: jest.fn(),
    getDefaultHeaders: jest
        .fn()
        .mockReturnValue({ 'Content-Type': 'application/json' }),
}));

// Mock paths
jest.mock('../../../config/paths', () => ({
    getApiPath: jest.fn((path: string) => `/api/${path}`),
}));

// Mock ToastContext
const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: mockShowSuccessToast,
        showErrorToast: mockShowErrorToast,
    }),
}));

// Mock fetch for users endpoint
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
}) as jest.Mock;

const defaultArea = {
    uid: 'test-area-uid',
    name: 'Test Department',
    Members: [],
};

const defaultProps = {
    area: defaultArea,
    currentUserUid: 'current-user-uid',
    onUpdate: jest.fn(),
    readOnly: false,
};

describe('AreaMembers - Subscribers UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getAreaSubscribers as jest.Mock).mockResolvedValue([]);
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        });
    });

    const openModal = async () => {
        const manageButton = screen.getByText('Manage');
        fireEvent.click(manageButton);
        await waitFor(() => {
            expect(screen.getByText('Manage Members')).toBeInTheDocument();
        });
    };

    describe('Subscribers rendering', () => {
        it('renders subscribers section header when modal is open', async () => {
            render(<AreaMembers {...defaultProps} />);
            await openModal();

            expect(screen.getByText('Subscribers')).toBeInTheDocument();
            expect(
                screen.getByText(
                    'These users are automatically subscribed to new tasks in this department'
                )
            ).toBeInTheDocument();
        });

        it('displays subscriber list with correct source badges', async () => {
            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                {
                    id: 10,
                    uid: 'sub-uid-1',
                    email: 'manual@example.com',
                    name: 'Manual User',
                    AreasSubscriber: {
                        source: 'manual',
                        added_by: 1,
                        created_at: '2026-01-01',
                    },
                },
                {
                    id: 11,
                    uid: 'sub-uid-2',
                    email: 'admin@example.com',
                    name: 'Admin User',
                    AreasSubscriber: {
                        source: 'admin_role',
                        added_by: 1,
                        created_at: '2026-01-01',
                    },
                },
            ]);

            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                // Subscribers appear in both main view and modal
                expect(
                    screen.getAllByText('Manual User').length
                ).toBeGreaterThanOrEqual(1);
                expect(
                    screen.getAllByText('Admin User').length
                ).toBeGreaterThanOrEqual(1);
            });

            // "Manual" badge no longer shown; only "Admin" badge remains
            expect(screen.queryByText('Manual')).not.toBeInTheDocument();
            expect(screen.getByText('Admin')).toBeInTheDocument();
        });

        it('shows "No subscribers" when list is empty', async () => {
            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                expect(screen.getByText('No subscribers')).toBeInTheDocument();
            });
        });
    });

    describe('Add subscriber flow', () => {
        const userNotSubscribed = {
            id: 20,
            uid: 'user-uid-20',
            email: 'newuser@example.com',
            name: 'New User',
        };

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([userNotSubscribed]),
            });
            (getAreaSubscribers as jest.Mock).mockResolvedValue([]);
        });

        it('"Add" button shows retroactive dropdown', async () => {
            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                expect(screen.getAllByText('New User').length).toBeGreaterThan(
                    0
                );
            });

            // Find the Add button in the subscribers section (last Add button on the page)
            const addButtons = screen.getAllByText('Add');
            const subscriberAddButton = addButtons[addButtons.length - 1];
            fireEvent.click(subscriberAddButton);

            await waitFor(() => {
                expect(
                    screen.getByText('Future tasks only')
                ).toBeInTheDocument();
                expect(
                    screen.getByText('All existing + future')
                ).toBeInTheDocument();
            });
        });

        it('selecting "Future tasks only" calls addAreaSubscriber with retroactive=false', async () => {
            (addAreaSubscriber as jest.Mock).mockResolvedValue([]);

            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                expect(screen.getAllByText('New User').length).toBeGreaterThan(
                    0
                );
            });

            const addButtons = screen.getAllByText('Add');
            const subscriberAddButton = addButtons[addButtons.length - 1];
            fireEvent.click(subscriberAddButton);

            await waitFor(() => {
                expect(
                    screen.getByText('Future tasks only')
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Future tasks only'));

            await waitFor(() => {
                expect(addAreaSubscriber).toHaveBeenCalledWith(
                    'test-area-uid',
                    20,
                    false
                );
            });
        });

        it('selecting "All existing + future" calls addAreaSubscriber with retroactive=true', async () => {
            (addAreaSubscriber as jest.Mock).mockResolvedValue([]);

            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                expect(screen.getAllByText('New User').length).toBeGreaterThan(
                    0
                );
            });

            const addButtons = screen.getAllByText('Add');
            const subscriberAddButton = addButtons[addButtons.length - 1];
            fireEvent.click(subscriberAddButton);

            await waitFor(() => {
                expect(
                    screen.getByText('All existing + future')
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('All existing + future'));

            await waitFor(() => {
                expect(addAreaSubscriber).toHaveBeenCalledWith(
                    'test-area-uid',
                    20,
                    true
                );
            });
        });
    });

    describe('Remove subscriber', () => {
        it('remove button calls removeAreaSubscriber for manual subscribers', async () => {
            const manualSubscriber = {
                id: 30,
                uid: 'sub-uid-manual',
                email: 'manual@example.com',
                name: 'Manual Sub',
                AreasSubscriber: {
                    source: 'manual' as const,
                    added_by: 1,
                    created_at: '2026-01-01',
                },
            };

            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                manualSubscriber,
            ]);
            (removeAreaSubscriber as jest.Mock).mockResolvedValue([]);

            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                // Subscriber appears in both main view and modal
                expect(
                    screen.getAllByText('Manual Sub').length
                ).toBeGreaterThanOrEqual(1);
            });

            // The Remove button in subscribers section
            const removeButtons = screen.getAllByText('Remove');
            fireEvent.click(removeButtons[0]);

            await waitFor(() => {
                expect(removeAreaSubscriber).toHaveBeenCalledWith(
                    'test-area-uid',
                    30
                );
            });
        });

        it('admin-sourced subscriber has no remove button', async () => {
            const adminSubscriber = {
                id: 31,
                uid: 'sub-uid-admin',
                email: 'adminonly@example.com',
                name: 'Admin Only Sub',
                AreasSubscriber: {
                    source: 'admin_role' as const,
                    added_by: 1,
                    created_at: '2026-01-01',
                },
            };

            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                adminSubscriber,
            ]);

            render(<AreaMembers {...defaultProps} />);
            await openModal();

            await waitFor(() => {
                // Subscriber appears in both main view and modal
                expect(
                    screen.getAllByText('Admin Only Sub').length
                ).toBeGreaterThanOrEqual(1);
            });

            // There should be no Remove button in the subscribers section
            // (no members either, so no Remove buttons at all)
            expect(screen.queryByText('Remove')).not.toBeInTheDocument();
        });
    });

    describe('Read-only mode', () => {
        it('read-only mode hides add/remove controls', async () => {
            const manualSubscriber = {
                id: 40,
                uid: 'sub-uid-ro',
                email: 'readonly@example.com',
                name: 'ReadOnly Sub',
                AreasSubscriber: {
                    source: 'manual' as const,
                    added_by: 1,
                    created_at: '2026-01-01',
                },
            };

            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                manualSubscriber,
            ]);

            // In read-only mode the Manage button is hidden
            // So we cannot open the modal via the Manage button
            // Instead, verify that the Manage button is not rendered
            render(<AreaMembers {...defaultProps} readOnly={true} />);

            expect(screen.queryByText('Manage')).not.toBeInTheDocument();
        });
    });

    describe('Warning dialog', () => {
        const adminMember = {
            id: 50,
            uid: 'admin-member-uid',
            email: 'deptadmin@example.com',
            name: 'Dept Admin',
            areas_members: {
                role: 'admin' as const,
                created_at: '2026-01-01',
            },
        };

        const adminSubscriber = {
            id: 50,
            uid: 'admin-member-uid',
            email: 'deptadmin@example.com',
            name: 'Dept Admin',
            AreasSubscriber: {
                source: 'admin_role' as const,
                added_by: 1,
                created_at: '2026-01-01',
            },
        };

        it('warning dialog shown when changing admin role to member', async () => {
            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                adminSubscriber,
            ]);

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([adminMember]),
            });

            render(
                <AreaMembers
                    {...defaultProps}
                    area={{
                        ...defaultArea,
                        Members: [adminMember],
                    }}
                />
            );

            await openModal();

            await waitFor(() => {
                expect(
                    screen.getAllByText('Dept Admin').length
                ).toBeGreaterThan(0);
            });

            // Change role select to 'member'
            const roleSelect = screen.getByDisplayValue('Admin');
            fireEvent.change(roleSelect, { target: { value: 'member' } });

            await waitFor(() => {
                expect(
                    screen.getByText('Remove subscriber?')
                ).toBeInTheDocument();
                expect(
                    screen.getByText(
                        /Removing Dept Admin as department admin will also remove them from the auto-subscribers list/
                    )
                ).toBeInTheDocument();
            });
        });

        it('warning dialog confirm proceeds with role change', async () => {
            (getAreaSubscribers as jest.Mock).mockResolvedValue([
                adminSubscriber,
            ]);
            (updateAreaMemberRole as jest.Mock).mockResolvedValue([
                {
                    ...adminMember,
                    areas_members: { role: 'member', created_at: '2026-01-01' },
                },
            ]);

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([adminMember]),
            });

            render(
                <AreaMembers
                    {...defaultProps}
                    area={{
                        ...defaultArea,
                        Members: [adminMember],
                    }}
                />
            );

            await openModal();

            await waitFor(() => {
                expect(
                    screen.getAllByText('Dept Admin').length
                ).toBeGreaterThan(0);
            });

            const roleSelect = screen.getByDisplayValue('Admin');
            fireEvent.change(roleSelect, { target: { value: 'member' } });

            await waitFor(() => {
                expect(
                    screen.getByText('Remove subscriber?')
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(updateAreaMemberRole).toHaveBeenCalledWith(
                    'test-area-uid',
                    50,
                    'member'
                );
            });
        });
    });
});
