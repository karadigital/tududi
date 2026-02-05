import React from 'react';
import { Location } from 'react-router-dom';
import {
    RectangleStackIcon,
    PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface SidebarWorkspacesProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openWorkspaceModal: () => void;
}

const SidebarWorkspaces: React.FC<SidebarWorkspacesProps> = ({
    handleNavClick,
    location,
    openWorkspaceModal,
}) => {
    const { t } = useTranslation();
    const isActiveWorkspace = () => {
        return location.pathname.startsWith('/workspaces')
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1 mt-4">
                <li
                    className={`flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveWorkspace()}`}
                    onClick={() =>
                        handleNavClick(
                            '/workspaces',
                            'Workspaces',
                            <RectangleStackIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    <span className="flex items-center">
                        <RectangleStackIcon className="h-5 w-5 mr-2" />
                        {t('sidebar.workspaces')}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openWorkspaceModal();
                        }}
                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addWorkspaceAriaLabel')}
                        title={t('sidebar.addWorkspaceTitle')}
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
            </ul>
        </>
    );
};

export default SidebarWorkspaces;
