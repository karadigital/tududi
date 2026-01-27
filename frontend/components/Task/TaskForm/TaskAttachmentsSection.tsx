import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Attachment } from '../../../entities/Attachment';
import {
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    validateFile,
    formatFileSize,
} from '../../../utils/attachmentsService';
import { useToast } from '../../Shared/ToastContext';
import AttachmentListItem from '../../Shared/AttachmentListItem';
import AttachmentPreview from '../../Shared/AttachmentPreview';
import FileIcon from '../../Shared/FileIcon';

// Interface for pending files (not yet uploaded)
export interface PendingFile {
    id: string;
    file: File;
    preview?: string;
}

interface TaskAttachmentsSectionProps {
    // For existing tasks - immediate upload mode
    taskUid?: string;
    attachments?: Attachment[];
    onAttachmentsChange?: (attachments: Attachment[]) => void;
    // For new tasks - pending mode
    pendingFiles?: PendingFile[];
    onPendingFilesChange?: React.Dispatch<React.SetStateAction<PendingFile[]>>;
    disabled?: boolean;
}

const TaskAttachmentsSection: React.FC<TaskAttachmentsSectionProps> = ({
    taskUid,
    attachments = [],
    onAttachmentsChange,
    pendingFiles = [],
    onPendingFilesChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
        useState<Attachment | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine if we're in pending mode (no taskUid = new task)
    const isPendingMode = !taskUid;
    const totalCount = isPendingMode ? pendingFiles.length : attachments.length;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await processFile(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const processFile = async (file: File) => {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            showErrorToast(validation.error || 'Invalid file');
            return;
        }

        // Check attachment limit
        if (totalCount >= 20) {
            showErrorToast(
                t(
                    'task.attachments.limitReached',
                    'Maximum 20 attachments allowed per task'
                )
            );
            return;
        }

        if (isPendingMode) {
            // Pending mode: stage file locally
            addPendingFile(file);
        } else {
            // Immediate upload mode
            await uploadFile(file);
        }
    };

    const addPendingFile = (file: File) => {
        if (!onPendingFilesChange) return;

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const newFile: PendingFile = {
                    id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    file,
                    preview: ev.target?.result as string,
                };
                // Use functional update to avoid race conditions with concurrent file adds
                onPendingFilesChange((prev) => [...prev, newFile]);
            };
            reader.readAsDataURL(file);
        } else {
            const newFile: PendingFile = {
                id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
            };
            // Use functional update to avoid race conditions with concurrent file adds
            onPendingFilesChange((prev) => [...prev, newFile]);
        }
    };

    const uploadFile = async (file: File) => {
        if (!taskUid || !onAttachmentsChange) return;

        setUploading(true);
        try {
            const newAttachment = await uploadAttachment(taskUid, file);
            onAttachmentsChange([...attachments, newAttachment]);
            showSuccessToast(
                t(
                    'task.attachments.uploadSuccess',
                    'File uploaded successfully'
                )
            );
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t('task.attachments.uploadError', 'Failed to upload file')
            );
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAttachment = async (attachment: Attachment) => {
        if (!taskUid || !onAttachmentsChange) return;

        try {
            await deleteAttachment(taskUid, attachment.uid);
            onAttachmentsChange(
                attachments.filter((a) => a.uid !== attachment.uid)
            );
            showSuccessToast(
                t(
                    'task.attachments.deleteSuccess',
                    'Attachment deleted successfully'
                )
            );
            if (previewAttachment?.uid === attachment.uid) {
                setPreviewAttachment(null);
            }
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t(
                        'task.attachments.deleteError',
                        'Failed to delete attachment'
                    )
            );
        }
    };

    const handleDeletePendingFile = (fileId: string) => {
        if (!onPendingFilesChange) return;
        // Use functional update to avoid race conditions
        onPendingFilesChange((prev) => prev.filter((f) => f.id !== fileId));
    };

    const handleDownload = (attachment: Attachment) => {
        downloadAttachment(attachment.uid);
    };

    const handlePreview = (attachment: Attachment) => {
        setPreviewAttachment(
            previewAttachment?.uid === attachment.uid ? null : attachment
        );
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (disabled) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    return (
        <div className="space-y-3">
            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    disabled
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                        : dragActive
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer'
                }`}
                onClick={() => !disabled && fileInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={disabled || uploading}
                    accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.xls,.xlsx,.csv,.zip"
                />
                <CloudArrowUpIcon className="h-10 w-10 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {uploading
                        ? t('task.attachments.uploading', 'Uploading...')
                        : t(
                              'task.attachments.clickToUpload',
                              'Click to upload or drag and drop'
                          )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'task.attachments.allowedTypes',
                        'PDF, DOC, DOCX, TXT, MD, Images, XLS, XLSX, CSV, ZIP (max 10MB)'
                    )}
                </p>
                {isPendingMode && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        {t(
                            'task.attachments.pendingUploadNote',
                            'Files will be uploaded when task is saved'
                        )}
                    </p>
                )}
            </div>

            {/* Attachments List - for existing tasks */}
            {!isPendingMode && attachments.length > 0 && (
                <div className="space-y-2">
                    {attachments.map((attachment) => (
                        <div key={attachment.uid}>
                            <AttachmentListItem
                                attachment={attachment}
                                onDelete={handleDeleteAttachment}
                                onDownload={handleDownload}
                                onPreview={handlePreview}
                                showPreview={true}
                            />
                            {previewAttachment?.uid === attachment.uid && (
                                <div className="mt-2">
                                    <AttachmentPreview
                                        attachment={attachment}
                                        maxHeight="300px"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Files List - for new tasks */}
            {isPendingMode && pendingFiles.length > 0 && (
                <div className="space-y-2">
                    {pendingFiles.map((pendingFile) => (
                        <div
                            key={pendingFile.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                {pendingFile.preview ? (
                                    <img
                                        src={pendingFile.preview}
                                        alt={pendingFile.file.name}
                                        className="h-10 w-10 object-cover rounded"
                                    />
                                ) : (
                                    <FileIcon
                                        mimeType={pendingFile.file.type}
                                        className="h-10 w-10 text-gray-400"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {pendingFile.file.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(pendingFile.file.size)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    handleDeletePendingFile(pendingFile.id)
                                }
                                className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                aria-label={t('common.remove', 'Remove')}
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Counter */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t('task.attachments.count', '{{count}} / 20 files', {
                    count: totalCount,
                })}
            </p>
        </div>
    );
};

export default TaskAttachmentsSection;
