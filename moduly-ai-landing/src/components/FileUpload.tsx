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
}

interface FileUploadProps {
    onUploadSuccess: (file: UploadedFile) => void;
}

/**
 * FileUpload component — handles getting a pre-signed URL from our backend
 * and uploading the file directly to Utho Object Storage.
 * On success, calls onUploadSuccess with the new upload item.
 */
export function FileUpload({ onUploadSuccess }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setMessage('');
        }
    };

    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext ?? '')) return { icon: 'image', color: 'teal' };
        if (['mp4', 'mov', 'avi'].includes(ext ?? '')) return { icon: 'videocam', color: 'purple' };
        if (['pdf'].includes(ext ?? '')) return { icon: 'picture_as_pdf', color: 'orange' };
        return { icon: 'description', color: 'blue' };
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

            // Step 3: Build the new upload entry and notify parent
            const { icon, color } = getFileIcon(file.name);
            const now = new Date();
            const dateStr = `Uploaded on ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

            onUploadSuccess({
                id: Date.now(),
                title: file.name.replace(/^\d+-/, ''), // strip timestamp prefix
                meta: `${formatSize(file.size)}`,
                status: 'Cloud',
                date: dateStr,
                icon,
                color,
                filename,
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
        <div className="file-upload-container" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px', margin: '20px auto' }}>
            <h3>Upload File to Utho</h3>

            <div style={{ marginBottom: '15px' }}>
                <input ref={inputRef} type="file" onChange={handleFileChange} disabled={uploading} />
            </div>

            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                style={{ padding: '8px 16px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: (file && !uploading) ? 'pointer' : 'not-allowed' }}
            >
                {uploading ? 'Uploading...' : 'Upload File'}
            </button>

            {message && (
                <p style={{ marginTop: '15px', color: message.includes('Error') ? 'red' : 'green' }}>
                    {message}
                </p>
            )}
        </div>
    );
}
