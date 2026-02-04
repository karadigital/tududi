import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchWorkspace } from '../../utils/workspacesService';
import { Workspace } from '../../entities/Workspace';
import { useTranslation } from 'react-i18next';
import Projects from '../Projects';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';

const WorkspaceDetail: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const loadWorkspace = async () => {
            if (!uid) {
                setIsError(true);
                setIsLoading(false);
                return;
            }

            try {
                const data = await fetchWorkspace(uid);
                setWorkspace(data);
            } catch (error) {
                console.error('Failed to fetch workspace:', error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadWorkspace();
    }, [uid]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    if (isError || !workspace) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    {t('workspaces.notFound', 'Workspace not found.')}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="px-2 sm:px-4 lg:px-6 pt-4">
                <div className="flex items-center mb-4">
                    <Link
                        to="/workspaces"
                        className="mr-3 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </Link>
                    <h2 className="text-2xl font-light text-gray-900 dark:text-white">
                        {workspace.name}
                    </h2>
                </div>
            </div>
            <Projects workspaceUid={workspace.uid} />
        </div>
    );
};

export default WorkspaceDetail;
