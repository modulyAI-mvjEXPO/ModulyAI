import { useState, useRef } from 'react';


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

export function FileUpload({ onUploadSuccess, userId }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file first.');
            return;
        }

        setUploading(true);
        setMessage('');

        try {
            const backendBase = import.meta.env.VITE_BACKEND_URL || '';

            // Step 1: Get pre-signed upload URL from backend
            const backendResponse = await fetch(`${backendBase}/get-upload-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: `${Date.now()}-${file.name}`,
                    contentType: file.type || 'application/octet-stream',
                }),
            });

            if (!backendResponse.ok) throw new Error('Failed to get upload URL from backend');
            const { uploadUrl, filename } = await backendResponse.json();

            // Step 2: Upload directly to Utho using the pre-signed URL
            const uthoResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file,
            });

            if (!uthoResponse.ok) throw new Error('Failed to upload file to Utho Storage');

            // Step 3: Trigger document processing pipeline
            let documentId: string | undefined;
            try {
                const processResponse = await fetch(`${backendBase}/process-document`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: file.name.replace(/^\d+-/, ''),
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
                title: file.name.replace(/^\d+-/, ''),
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

    return (
        <div className="ud-form">
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
        </div>
    );
}
