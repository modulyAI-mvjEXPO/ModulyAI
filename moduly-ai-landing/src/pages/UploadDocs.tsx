import { useState } from 'react';
import { FileUpload } from '../components/FileUpload';
import './UploadDocs.css';

const MOCK_UPLOADS = [
    {
        id: 1,
        title: 'Data Structures - Trees',
        meta: 'Handwritten • 2.4 MB',
        status: 'Cloud',
        date: 'Uploaded on Oct 24, 2023',
        icon: 'description',
        color: 'blue'
    },
    {
        id: 2,
        title: 'OS Deadlock Mindmap',
        meta: 'Mind Map • 1.1 MB',
        status: 'Cloud',
        date: 'Uploaded on Oct 20, 2023',
        icon: 'psychology',
        color: 'purple'
    },
    {
        id: 3,
        title: '2022 DBMS Question Paper',
        meta: 'PYQs • 850 KB',
        status: 'Processing',
        date: 'Uploaded on Oct 18, 2023',
        icon: 'quiz',
        color: 'orange'
    },
    {
        id: 4,
        title: 'Computer Networks Summary',
        meta: 'Summarized • 3.2 MB',
        status: 'Cloud',
        date: 'Uploaded on Sep 30, 2023',
        icon: 'article',
        color: 'teal'
    }
];

export function UploadDocs() {
    const [uploads, setUploads] = useState(MOCK_UPLOADS);

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
                            <FileUpload />
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
