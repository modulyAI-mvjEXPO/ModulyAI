import { useState } from 'react';

/**
 * FileUpload component that completely handles the process of getting a secure
 * pre-signed URL from our backend and uploading the file directly to Utho Object Storage.
 */
export function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [uploadedUrl, setUploadedUrl] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
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
            // Step 1: Ask the Netlify function to generate a secure pre-signed URL for Utho
            // This relative URL works both locally with `netlify dev` AND on deployed Netlify!
            const backendResponse = await fetch('/.netlify/functions/get-upload-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: `${Date.now()}-${file.name}`, // Create a unique filename
                    contentType: file.type || 'application/octet-stream', // Send the correct content type
                }),
            });

            if (!backendResponse.ok) {
                throw new Error('Failed to get upload URL from backend');
            }

            const { uploadUrl, filename } = await backendResponse.json();

            // Step 2: Upload the file DIRECTLY to Utho using the temporary Presigned URL
            // Notice we are doing a PUT request directly to the Utho URL, bypassing our backend!
            const uthoResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                },
                body: file,
            });

            if (!uthoResponse.ok) {
                throw new Error('Failed to upload file to Utho Storage');
            }

            // If we got here, it was successful!
            // Utho object storage URLs can be tricky with subdomains vs paths. 
            // The most reliable way to access a public file is: https://[ENDPOINT]/[BUCKET]/[FILENAME]
            // We can construct this clean public URL using the original filename we sent:
            const cleanFilename = encodeURIComponent(filename);
            const publicUrl = `https://innoida.utho.io/mybucketika7uvqm36r52jei/${cleanFilename}`;

            setMessage('File uploaded successfully!');
            setUploadedUrl(publicUrl);
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
                <input type="file" onChange={handleFileChange} disabled={uploading} />
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

            {uploadedUrl && (
                <div style={{ marginTop: '15px', wordBreak: 'break-all' }}>
                    <strong>File Available At:</strong><br />
                    <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">
                        {uploadedUrl}
                    </a>
                </div>
            )}
        </div>
    );
}
