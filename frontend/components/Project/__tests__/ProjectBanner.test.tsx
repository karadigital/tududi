import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ProjectBanner from '../ProjectBanner';
import { Project } from '../../../entities/Project';

const tStub = ((key: string, fallback?: string) => fallback ?? key) as any;

const renderBanner = (project: Project) => {
    const editButtonRef = React.createRef<HTMLButtonElement>();
    return render(
        <MemoryRouter>
            <ProjectBanner
                project={project}
                areas={[]}
                t={tStub}
                getStateIcon={() => null}
                onDeleteClick={() => undefined}
                editButtonRef={editButtonRef}
            />
        </MemoryRouter>
    );
};

describe('ProjectBanner workspace badge', () => {
    it('renders workspace name and owner email inline with separator', () => {
        const project: Project = {
            uid: 'p1',
            name: 'Test Project',
            Workspace: {
                uid: 'w1',
                name: 'Acme',
                owner_email: 'owner@acme.com',
            },
        };

        renderBanner(project);

        expect(
            screen.getByText(/Acme\s*·\s*owner@acme\.com/)
        ).toBeInTheDocument();
    });

    it('renders only workspace name when owner_email is missing', () => {
        const project: Project = {
            uid: 'p2',
            name: 'Test Project',
            Workspace: { uid: 'w2', name: 'Beta' },
        };

        renderBanner(project);

        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    });
});
