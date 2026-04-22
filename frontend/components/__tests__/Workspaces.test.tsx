import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Workspaces from '../Workspaces';
import { useStore } from '../../store/useStore';
import { Workspace } from '../../entities/Workspace';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
    }),
}));

// Mock workspacesService so loadWorkspaces does not hit the network
jest.mock('../../utils/workspacesService', () => ({
    fetchWorkspaces: jest.fn().mockResolvedValue([]),
    deleteWorkspace: jest.fn(),
    saveWorkspace: jest.fn(),
}));

// Mock ToastContext
jest.mock('../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

// Mock child components to simplify rendering
jest.mock('../Shared/ConfirmDialog', () => {
    return function MockConfirmDialog() {
        return null;
    };
});

jest.mock('../Workspace/WorkspaceModal', () => {
    return function MockWorkspaceModal() {
        return null;
    };
});

const seedWorkspaces = (workspaces: Workspace[]) => {
    useStore.setState((state) => ({
        workspacesStore: {
            ...state.workspacesStore,
            workspaces,
            hasLoaded: true,
            isLoading: false,
            isError: false,
        },
    }));
};

describe('Workspaces list owner display', () => {
    beforeEach(() => {
        // Reset store between tests
        seedWorkspaces([]);
    });

    it('renders workspace name and owner email stacked', () => {
        seedWorkspaces([
            {
                uid: 'ws-alpha',
                name: 'Alpha',
                owner_email: 'alice@example.com',
            },
        ]);

        render(
            <MemoryRouter>
                <Workspaces />
            </MemoryRouter>
        );

        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', () => {
        seedWorkspaces([
            {
                uid: 'ws-beta',
                name: 'Beta',
            },
        ]);

        render(
            <MemoryRouter>
                <Workspaces />
            </MemoryRouter>
        );

        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
});
