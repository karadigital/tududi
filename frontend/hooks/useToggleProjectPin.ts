import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useToast } from '../components/Shared/ToastContext';
import { toggleProjectPin } from '../utils/projectsService';
import { Project } from '../entities/Project';

const MAX_PINNED = 5;

export function useToggleProjectPin() {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const { updateProjectInStore } = useStore((s) => s.projectsStore);

    const togglePin = async (e: React.MouseEvent, project: Project) => {
        e.preventDefault();
        e.stopPropagation();

        const newPinned = !project.pin_to_sidebar;

        if (newPinned) {
            const pinnedCount = useStore
                .getState()
                .projectsStore.projects.filter((p) => p.pin_to_sidebar).length;
            if (pinnedCount >= MAX_PINNED) {
                showErrorToast(
                    t(
                        'sidebar.maxPinnedProjects',
                        'You can pin up to 5 projects. Unpin one to make room.'
                    )
                );
                return;
            }
        }

        updateProjectInStore({ ...project, pin_to_sidebar: newPinned });

        try {
            await toggleProjectPin(project.uid!, newPinned);
        } catch {
            updateProjectInStore({ ...project, pin_to_sidebar: !newPinned });
            showErrorToast(t('errors.generic', 'Something went wrong'));
        }
    };

    return { togglePin };
}
