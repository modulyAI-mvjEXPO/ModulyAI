import { useState, useEffect } from 'react';
import { FileUpload } from '../components/FileUpload';
import type { UploadedFile } from '../components/FileUpload';
import './UploadDocs.css';


const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

function getFileMeta(filename: string, sizeBytes: number) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const sizeStr = sizeBytes < 1024 * 1024
        ? `${(sizeBytes / 1024).toFixed(1)} KB`
        : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return { icon: 'image', color: 'teal', meta: sizeStr };
    if (['mp4', 'mov', 'avi'].includes(ext)) return { icon: 'videocam', color: 'purple', meta: sizeStr };
    if (ext === 'pdf') return { icon: 'picture_as_pdf', color: 'orange', meta: sizeStr };
    return { icon: 'description', color: 'blue', meta: sizeStr };
}

export function UploadDocs() {
    const [uploads, setUploads] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        const fetchUploads = async () => {
            try {
                const res = await fetch(`${BACKEND}/list-files`);
                if (!res.ok) throw new Error('Failed to fetch uploads');
                const { files } = await res.json();
                const mapped: UploadedFile[] = files.map((f: { filename: string; size: number; lastModified: string }, i: number) => {
                    const { icon, color, meta } = getFileMeta(f.filename, f.size);
                    const date = new Date(f.lastModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    // Strip timestamp prefix from display name (e.g. "1773205963396-foo.pdf" → "foo.pdf")
                    const title = f.filename.replace(/^\d+-/, '');
                    return { id: i + 1, title, meta, status: 'Cloud', date: `Uploaded on ${date}`, icon, color, filename: f.filename };
                });
                setUploads(mapped.reverse()); // newest first
            } catch (e) {
                setFetchError('Could not load uploads. Is the backend running?');
            } finally {
                setLoading(false);
            }
        };
        fetchUploads();
    }, []);

    const handleUploadSuccess = (newFile: UploadedFile) => {
        setUploads(prev => [newFile, ...prev]);
    };

    const handleRemove = (id: number) => {
        setUploads(uploads.filter(u => u.id !== id));
    };

    return (
        <div className="ud-shell">
            <div className="ud-container">

                {/* Header Section */}
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
                    {/* Form Side */}
                    <div className="ud-col-left">
                        <div className="ud-card">
                            <h2 className="ud-card-title">
                                <span className="material-icons-outlined">cloud_upload</span>
                                New Upload
                            </h2>
                            <FileUpload onUploadSuccess={handleUploadSuccess} />
                        </div>
                    </div>

                    {/* List Side */}
                    <div className="ud-col-right">
                        <div className="ud-card ud-list-card">
                            <div className="ud-list-header">
                                <h2 className="ud-list-title">
                                    <span className="material-icons-outlined ud-icon-gray">history</span>
                                    Your Uploads
                                </h2>
                                <span className="ud-list-total">Total: {uploads.length}</span>
                            </div>

                            <div className="ud-list-items">
                                {loading && (
                                    <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                                        Loading uploads...
                                    </p>
                                )}
                                {!loading && fetchError && (
                                    <p style={{ textAlign: 'center', padding: '20px', color: 'salmon' }}>
                                        {fetchError}
                                    </p>
                                )}
                                {!loading && !fetchError && uploads.length === 0 && (
                                    <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                                        No uploads yet. Upload your first file!
                                    </p>
                                )}
                                {uploads.map(item => (
                                    <div key={item.id} className="ud-item">
                                        <div className="ud-item-top">
                                            <div className="ud-item-info">
                                                <div className={`ud-item-icon ud-item-icon--${item.color}`}>
                                                    <span className="material-icons-outlined">{item.icon}</span>
                                                </div>
                                                <div>
                                                    <h3 className="ud-item-title">{item.title}</h3>
                                                    <p className="ud-item-meta">{item.meta}</p>
                                                </div>
                                            </div>
                                            <span className={`ud-badge ${item.status === 'Cloud' ? 'ud-badge--cloud' : 'ud-badge--processing'}`}>
                                                {item.status}
                                            </span>
                                        </div>

                                        <div className="ud-item-bottom">
                                            <span className="ud-item-date">{item.date}</span>
                                            <button
                                                className="ud-item-action"
                                                onClick={() => handleRemove(item.id)}
                                            >
                                                <span className="material-icons-outlined">delete</span>
                                                {item.status === 'Cloud' ? 'Request Removal' : 'Cancel Upload'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="ud-footer">
                    © 2023 MODULY AI. Built for VTU Project Expo.
                </footer>
            </div>
        </div>
    );
}
