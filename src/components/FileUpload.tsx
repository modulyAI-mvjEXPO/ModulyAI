import { useState, useRef, useEffect, useMemo } from 'react';
import { College_COURSES, getSubjects, getAllSubjects, addCustomSubject } from '../lib/collegeData';
import type { Subject, SubjectWithContext } from '../lib/collegeData';


export interface UploadedFile {
    id: number;
    title: string;
    meta: string;
    status: string;
    date: string;
    icon: string;
    color: string;
    filename: string;
    documentId?: string;
}

interface FileUploadProps {
    onUploadSuccess: (file: UploadedFile) => void;
    userId: string;
}

function getFileIcon(filename: string): { icon: string; color: string } {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext ?? '')) return { icon: 'image', color: 'teal' };
    if (['mp4', 'mov', 'avi'].includes(ext ?? '')) return { icon: 'videocam', color: 'purple' };
    if (ext === 'pdf') return { icon: 'picture_as_pdf', color: 'orange' };
    return { icon: 'description', color: 'blue' };
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Subject Search Modal ───────────────────────────────────────────────── */

interface SubjectSearchModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (subject: SubjectWithContext) => void;
}

function SubjectSearchModal({ open, onClose, onSelect }: SubjectSearchModalProps) {
    const [query, setQuery] = useState('');
    const [customCode, setCustomCode] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addedMsg, setAddedMsg] = useState('');
    const [subjectVersion, setSubjectVersion] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const codeInputRef = useRef<HTMLInputElement>(null);

    const allSubjects = useMemo(() => getAllSubjects(), [subjectVersion]);

    const filtered = useMemo(() => {
        if (!query.trim()) return allSubjects;
        const q = query.toLowerCase();
        return allSubjects.filter(
            s =>
                s.name.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                s.courseShort.toLowerCase().includes(q)
        );
    }, [allSubjects, query]);

    const hasQuery = query.trim().length > 0;
    const noResults = hasQuery && filtered.length === 0;

    useEffect(() => {
        if (open) {
            setQuery('');
            setCustomCode('');
            setShowAddForm(false);
            setAddedMsg('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    // When no results appear, auto-show the add form
    useEffect(() => {
        if (noResults) {
            setShowAddForm(true);
            setTimeout(() => codeInputRef.current?.focus(), 100);
        } else {
            setShowAddForm(false);
            setCustomCode('');
            setAddedMsg('');
        }
    }, [noResults]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    const handleAddCustom = () => {
        const name = query.trim();
        const code = customCode.trim() || name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        if (!name) return;

        const entry = addCustomSubject(name, code);
        setAddedMsg(`"${name}" added!`);
        setSubjectVersion(v => v + 1); // refresh list
        setTimeout(() => {
            onSelect(entry);
            onClose();
        }, 600);
    };

    if (!open) return null;

    return (
        <div className="ud-modal-overlay" onClick={onClose}>
            <div className="ud-modal" onClick={e => e.stopPropagation()}>
                <div className="ud-modal-header">
                    <h3 className="ud-modal-title">
                        <span className="material-icons-outlined">search</span>
                        Search All Subjects
                    </h3>
                    <button className="ud-modal-close" onClick={onClose} title="Close">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>

                <div className="ud-modal-search-wrap">
                    <span className="material-icons-outlined ud-modal-search-icon">search</span>
                    <input
                        ref={inputRef}
                        className="ud-modal-search"
                        type="text"
                        placeholder="Type subject name, code, or stream..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="ud-modal-search-clear" onClick={() => setQuery('')} title="Clear">
                            <span className="material-icons-outlined">close</span>
                        </button>
                    )}
                </div>

                <p className="ud-modal-count">
                    {filtered.length} subject{filtered.length !== 1 ? 's' : ''} found
                </p>

                <div className="ud-modal-list">
                    {/* Add custom subject form */}
                    {showAddForm && hasQuery && (
                        <div className="ud-modal-add-custom">
                            {addedMsg ? (
                                <div className="ud-modal-added-msg">
                                    <span className="material-icons-outlined">check_circle</span>
                                    {addedMsg}
                                </div>
                            ) : (
                                <>
                                    <div className="ud-modal-add-header">
                                        <span className="material-icons-outlined">add_circle_outline</span>
                                        <div>
                                            <p className="ud-modal-add-title">Not found? Add it as a new subject</p>
                                            <p className="ud-modal-add-subtitle">
                                                Subject: <strong>{query.trim()}</strong>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ud-modal-add-form">
                                        <div className="ud-modal-add-field">
                                            <label className="ud-modal-add-label">Subject Code</label>
                                            <input
                                                ref={codeInputRef}
                                                className="ud-modal-add-input"
                                                type="text"
                                                placeholder="e.g. 22CS45, MATH101..."
                                                value={customCode}
                                                onChange={e => setCustomCode(e.target.value.toUpperCase())}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
                                            />
                                        </div>
                                        <button
                                            className="ud-modal-add-btn"
                                            onClick={handleAddCustom}
                                        >
                                            <span className="material-icons-outlined">add</span>
                                            Add &amp; Select
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {filtered.length === 0 && !hasQuery && (
                        <div className="ud-modal-empty">
                            <span className="material-icons-outlined">search_off</span>
                            <p>Start typing to search subjects.</p>
                        </div>
                    )}
                    {filtered.map(sub => (
                        <button
                            key={sub.code}
                            className="ud-modal-item"
                            onClick={() => { onSelect(sub); onClose(); }}
                        >
                            <div className="ud-modal-item-main">
                                <span className="ud-modal-item-name">{sub.name}</span>
                                <span className="ud-modal-item-code">{sub.code}</span>
                            </div>
                            <span className="ud-modal-item-stream">
                                {sub.isCustom ? '✦ Custom' : `${sub.courseShort} · Sem ${sub.semester}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Main FileUpload Component ──────────────────────────────────────────── */

export function FileUpload({ onUploadSuccess, userId }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);
    
    // New fields for structured storage
    const [course, setCourse] = useState('');
    const [year, setYear] = useState<number | ''>('');
    const [subjectCode, setSubjectCode] = useState('');
    const [subjectLabel, setSubjectLabel] = useState(''); // displayed name for "Other" picks
    const [docType, setDocType] = useState('');
    const [modules, setModules] = useState<string[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
    const [showSubjectModal, setShowSubjectModal] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (course && year) {
            setAvailableSubjects(getSubjects(course, year as number));
            setSubjectCode(''); // reset subject on course/year change
            setSubjectLabel('');
        } else {
            setAvailableSubjects([]);
        }
    }, [course, year]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setMessage('');
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
            setMessage('');
        }
    };

    const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__other__') {
            setShowSubjectModal(true);
        } else {
            setSubjectCode(val);
            const match = availableSubjects.find(s => s.code === val);
            setSubjectLabel(match ? match.name : '');
        }
    };

    const handleOtherSubjectSelect = (sub: SubjectWithContext) => {
        setSubjectCode(sub.code);
        setSubjectLabel(sub.name);
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file first.');
            return;
        }
        if (!subjectCode || !docType) {
            setMessage('Please select a subject and document type.');
            return;
        }

        // Netlify Functions have a ~6MB body limit; base64 adds ~33% overhead
        const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
        if (file.size > MAX_FILE_SIZE) {
            setMessage(`File is too large (${formatSize(file.size)}). Maximum allowed size is ${formatSize(MAX_FILE_SIZE)}.`);
            return;
        }

        setUploading(true);
        setMessage('');

        try {
            const backendBase = import.meta.env.VITE_BACKEND_URL || '';

            // Generate smart filename and folder path — NO random timestamp
            const ext = file.name.split('.').pop() || 'pdf';
            const cleanSubject = subjectCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const subjectName = subjectLabel
                ? subjectLabel.replace(/[^a-zA-Z0-9]/g, '_')
                : cleanSubject;

            const origBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const safeOrig = origBase.replace(/[^a-zA-Z0-9_-]/g, '_');

            const moduleStr = modules.length > 0
                ? `_Mod_${modules.map(m => m.replace(/\s+/g, '')).join('-')}`
                : '';
            const smartFilename = `${subjectName}${moduleStr}_${safeOrig}.${ext}`;

            const yearPart = year ? `year-${year}` : 'general';
            const finalKey = `source/${yearPart}/${cleanSubject}/${docType}/${smartFilename}`;

            const docTypeLabels: Record<string, string> = {
                notes: 'Notes',
                pyqs: 'PYQs',
                imp: 'Important Questions',
                assignment: 'Assignment',
                other: 'Other'
            };
            const displayTitle = `${subjectLabel || subjectCode} - ${docTypeLabels[docType] || docType}`;

            // Convert file to base64 to send it as JSON payload
            const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(f);
                reader.onload = () => {
                    let encoded = reader.result as string;
                    // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
                    encoded = encoded.split(',')[1] || '';
                    resolve(encoded);
                };
                reader.onerror = error => reject(error);
            });

            const base64Data = await toBase64(file);

            // Step 1 & 2: Upload through proxy to bypass browser SSL ERR_CERT_AUTHORITY_INVALID
            const backendResponse = await fetch(`${backendBase}/upload-to-utho`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: finalKey,
                    contentType: file.type || 'application/octet-stream',
                    base64Data
                }),
            });

            if (!backendResponse.ok) throw new Error('Failed to upload file to Utho via proxy');
            const { filename } = await backendResponse.json();

            // Step 3: Trigger document processing pipeline
            let documentId: string | undefined;
            try {
                const processResponse = await fetch(`${backendBase}/process-document`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: displayTitle,
                        filePath: filename,
                        fileType: file.type || 'application/octet-stream',
                        userId,
                        fileSize: file.size,
                    }),
                });
                if (processResponse.ok) {
                    const processData = await processResponse.json();
                    documentId = processData.documentId;
                } else {
                    console.error('Failed to trigger document processing');
                }
            } catch (processError) {
                console.error('Error triggering document processing:', processError);
            }

            // Step 4: Build the new upload entry and notify parent
            const { icon, color } = getFileIcon(file.name);
            const now = new Date();
            const dateStr = `Uploaded on ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

            onUploadSuccess({
                id: Date.now(),
                title: displayTitle,
                meta: formatSize(file.size),
                status: documentId ? 'Processing' : 'Cloud',
                date: dateStr,
                icon,
                color,
                filename,
                documentId,
            });

            setMessage('File uploaded successfully!');
            setFile(null);
            if (inputRef.current) inputRef.current.value = '';

        } catch (error) {
            console.error('Upload Error:', error);
            setMessage('Error uploading file. Check console for details.');
        } finally {
            setUploading(false);
        }
    };

    // Determine what appears in the subject selector display
    const subjectSelectValue = subjectCode
        ? (availableSubjects.some(s => s.code === subjectCode) ? subjectCode : '__other_selected__')
        : '';

    return (
        <div className="ud-form">
            <div className="ud-form-grid">
                <div>
                    <label className="ud-label">Course</label>
                    <select 
                        className="ud-select" 
                        title="Course"
                        value={course} onChange={e => setCourse(e.target.value)} disabled={uploading}>
                        <option value="">Select Course</option>
                        {College_COURSES.map(c => <option key={c.id} value={c.id}>{c.shortName} - {c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="ud-label">Year</label>
                    <select 
                        className="ud-select" 
                        title="Year"
                        value={year} onChange={e => setYear(e.target.value ? Number(e.target.value) : '')} disabled={uploading}>
                        <option value="">Select Year</option>
                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>)}
                    </select>
                </div>
                <div>
                    <label className="ud-label">Subject</label>
                    <select 
                        className="ud-select" 
                        title="Subject"
                        value={subjectSelectValue}
                        onChange={handleSubjectChange}
                        disabled={uploading}
                    >
                        <option value="">Select Subject</option>
                        {availableSubjects.map(sub => (
                            <option key={sub.code} value={sub.code}>{sub.name} ({sub.code})</option>
                        ))}
                        {/* If an "Other" subject was picked from the modal, show it */}
                        {subjectCode && !availableSubjects.some(s => s.code === subjectCode) && (
                            <option value="__other_selected__">
                                ✓ {subjectLabel} ({subjectCode})
                            </option>
                        )}
                        <option value="__other__">🔍 Other — Search all subjects...</option>
                    </select>
                </div>
                <div>
                    <label className="ud-label">Document Type</label>
                    <select 
                        className="ud-select" 
                        title="Document Type"
                        value={docType} onChange={e => setDocType(e.target.value)} disabled={uploading}>
                        <option value="">Select Type</option>
                        <option value="notes">Notes / Study Material</option>
                        <option value="pyqs">Previous Year Questions (PYQs)</option>
                        <option value="imp">Important Questions</option>
                        <option value="assignment">Assignment / Lab Manual</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>

            <div className="ud-field" style={{ marginBottom: '1.25rem' }}>
                <label className="ud-label">Modules (Optional)</label>
                <div className="ud-module-grid">
                    {['Mod 1', 'Mod 2', 'Mod 3', 'Mod 4', 'Mod 5', 'All', 'General'].map(mod => (
                        <label key={mod} className="ud-checkbox">
                            <input
                                type="checkbox"
                                checked={modules.includes(mod)}
                                onChange={(e) => {
                                    if (e.target.checked) setModules(p => [...p, mod]);
                                    else setModules(p => p.filter(m => m !== mod));
                                }}
                                disabled={uploading}
                            />
                            <span className="ud-checkbox-box"></span>
                            <span className="ud-checkbox-label">{mod}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div
                className={`ud-dropzone${dragActive ? ' ud-dropzone--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <div className="ud-dropzone-bg"></div>
                <div className="ud-dropzone-content">
                    <div className="ud-dropzone-icon">
                        <span className="material-icons-outlined">cloud_upload</span>
                    </div>
                    {file ? (
                        <>
                            <p className="ud-dropzone-text">{file.name}</p>
                            <p className="ud-dropzone-subtext">{formatSize(file.size)}</p>
                        </>
                    ) : (
                        <>
                            <p className="ud-dropzone-text">Drop your file here or click to browse</p>
                            <p className="ud-dropzone-subtext">PDF, images, and documents supported</p>
                        </>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    title="Upload file"
                    className="ud-file-input"
                    onChange={handleFileChange}
                    disabled={uploading}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            <div className="ud-submit-wrap">
                <button
                    className="ud-submit-btn"
                    onClick={handleUpload}
                    disabled={!file || uploading}
                >
                    {uploading ? 'Uploading...' : 'Upload File'}
                </button>
            </div>

            {message && (
                <p className={`ud-upload-msg ${message.includes('Error') ? 'ud-upload-msg--error' : 'ud-upload-msg--success'}`}>
                    {message}
                </p>
            )}

            {/* Subject search modal */}
            <SubjectSearchModal
                open={showSubjectModal}
                onClose={() => setShowSubjectModal(false)}
                onSelect={handleOtherSubjectSelect}
            />
        </div>
    );
}
