import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkspaceDetail from '../WorkspaceDetail';
import { fetchWorkspace } from '../../../utils/workspacesService';
import { Workspace } from '../../../entities/Workspace';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

// Mock workspacesService so loadWorkspace does not hit the network
jest.mock('../../../utils/workspacesService', () => ({
    fetchWorkspace: jest.fn(),
}));

// Mock projectsService (WorkspaceDetail imports from it)
jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
    updateProject: jest.fn(),
    fetchProjects: jest.fn().mockResolvedValue([]),
}));

// Mock ToastContext
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

// Mock child components to simplify rendering
jest.mock('../../Projects', () => {
    return function MockProjects() {
        return <div data-testid="projects-list" />;
    };
});

jest.mock('../../Project/ProjectModal', () => {
    return function MockProjectModal() {
        return null;
    };
});

const renderWithRoute = (uid: string) =>
    render(
        <MemoryRouter initialEntries={[`/workspaces/${uid}`]}>
            <Routes>
                <Route path="/workspaces/:uid" element={<WorkspaceDetail />} />
            </Routes>
        </MemoryRouter>
    );

describe('WorkspaceDetail owner display', () => {
    beforeEach(() => {
        (fetchWorkspace as jest.Mock).mockReset();
    });

    it('renders owner email under the workspace name', async () => {
        const workspace: Workspace = {
            uid: 'abc',
            name: 'Gamma',
            owner_email: 'gamma@example.com',
        };
        (fetchWorkspace as jest.Mock).mockResolvedValue(workspace);

        renderWithRoute('abc');

        expect(await screen.findByText('Gamma')).toBeInTheDocument();
        expect(
            await screen.findByText('gamma@example.com')
        ).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', async () => {
        const workspace: Workspace = {
            uid: 'def',
            name: 'Delta',
        };
        (fetchWorkspace as jest.Mock).mockResolvedValue(workspace);

        renderWithRoute('def');

        expect(await screen.findByText('Delta')).toBeInTheDocument();
        expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
});
