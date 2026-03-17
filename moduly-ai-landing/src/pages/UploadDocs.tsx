import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DocumentStatus, DocumentRow } from '../lib/ai/types';
import { FileUpload } from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import './UploadDocs.css';

const STATUS_DISPLAY: Record<DocumentStatus, { readonly label: string; readonly icon: string; readonly badgeClass: string; readonly message?: string }> = {
    processing: {
        label: 'Processing',
        icon: 'hourglass_top',
        badgeClass: 'ud-badge--processing',
    },
    ready: {
        label: 'Ready',
        icon: 'check_circle',
        badgeClass: 'ud-badge--ready',
    },
    failed: {
        label: 'Failed',
        icon: 'error',
        badgeClass: 'ud-badge--failed',
        message: 'Processing failed. Please try re-uploading the document.',
    },
    no_text: {
        label: 'No Text',
        icon: 'image_not_supported',
        badgeClass: 'ud-badge--no-text',
        message: 'This appears to be a scanned PDF with no extractable text. Please upload a text-based PDF.',
    },
};

function getFileIcon(fileType: string): { icon: string; color: string } {
    if (fileType.startsWith('image/')) return { icon: 'image', color: 'teal' };
    if (fileType.startsWith('video/')) return { icon: 'videocam', color: 'purple' };
    if (fileType === 'application/pdf') return { icon: 'picture_as_pdf', color: 'orange' };
    return { icon: 'description', color: 'blue' };
}

function formatSize(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    return `Uploaded on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function UploadDocs({ user }: { user: User }) {
    const [documents, setDocuments] = useState<ReadonlyArray<DocumentRow>>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const userId = user.id;

    const fetchDocuments = useCallback(async () => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data as ReadonlyArray<DocumentRow>);
            setFetchError('');
        } catch (e) {
            console.error('Error fetching documents:', e);
            setFetchError('Could not load documents.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) fetchDocuments();
    }, [userId, fetchDocuments]);

    useEffect(() => {
        const hasProcessing = documents.some(doc => doc.status === 'processing');

        if (hasProcessing && !pollingRef.current) {
            pollingRef.current = setInterval(() => {
                fetchDocuments();
            }, 3000);
        } else if (!hasProcessing && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [documents, fetchDocuments]);

    const handleUploadSuccess = (_newFile: UploadedFile) => {
        fetchDocuments();
    };

    return (
        <div className="ud-shell">
            <div className="ud-container">

                <section className="ud-header-card">
                    <div className="ud-header-blob"></div>
                    <div className="ud-header-content">
                        <h1 className="ud-title">
                            Upload <span className="ud-title-highlight">Documents</span>
                        </h1>
                        <p className="ud-subtitle">
                            Contribute to the universal library. Upload your notes, PYQs, or summaries to help the community and earn reputation points. Ensure your documents are clear and legible.
                        </p>
                    </div>
                </section>

                <div className="ud-grid">
                    <div className="ud-col-left">
                        <div className="ud-card">
                            <h2 className="ud-card-title">
                                <span className="material-icons-outlined">cloud_upload</span>
                                New Upload
                            </h2>
                            {userId ? (
                                <FileUpload onUploadSuccess={handleUploadSuccess} userId={userId} />
                            ) : (
                                <p className="ud-auth-msg">
                                    Please sign in to upload documents.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="ud-col-right">
                        <div className="ud-card ud-list-card">
                            <div className="ud-list-header">
                                <h2 className="ud-list-title">
                                    <span className="material-icons-outlined ud-icon-gray">history</span>
                                    Your Uploads
                                </h2>
                                <span className="ud-list-total">Total: {documents.length}</span>
                            </div>

                            <div className="ud-list-items">
                                {loading && (
                                    <p className="ud-list-msg">
                                        Loading uploads...
                                    </p>
                                )}
                                {!loading && fetchError && (
                                    <p className="ud-list-msg ud-list-msg--error">
                                        {fetchError}
                                    </p>
                                )}
                                {!loading && !fetchError && documents.length === 0 && (
                                    <p className="ud-list-msg">
                                        No uploads yet. Upload your first file!
                                    </p>
                                )}
                                {documents.map(doc => {
                                    const { icon: fileIcon, color: fileColor } = getFileIcon(doc.file_type);
                                    const statusInfo = STATUS_DISPLAY[doc.status];

                                    return (
                                        <div key={doc.id} className="ud-item">
                                            <div className="ud-item-top">
                                                <div className="ud-item-info">
                                                    <div className={`ud-item-icon ud-item-icon--${fileColor}`}>
                                                        <span className="material-icons-outlined">{fileIcon}</span>
                                                    </div>
                                                    <div>
                                                        <h3 className="ud-item-title">{doc.title}</h3>
                                                        <p className="ud-item-meta">
                                                            {formatSize(doc.file_size)}
                                                            {doc.chunk_count > 0 && ` \u00B7 ${doc.chunk_count} chunks`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`ud-badge ${statusInfo.badgeClass}`}>
                                                    <span className="material-icons-outlined ud-badge-icon">{statusInfo.icon}</span>
                                                    {statusInfo.label}
                                                </span>
                                            </div>

                                            {statusInfo.message && (
                                                <p className="ud-item-status-msg">{statusInfo.message}</p>
                                            )}

                                            <div className="ud-item-bottom">
                                                <span className="ud-item-date">{formatDate(doc.created_at)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="ud-footer">
                    &copy; 2023 MODULY AI. Built for VTU Project Expo.
                </footer>
            </div>
        </div>
    );
}
