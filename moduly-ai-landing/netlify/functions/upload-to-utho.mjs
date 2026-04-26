import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'https';

const s3Client = new S3Client({
    endpoint: process.env.UTHO_ENDPOINT,
    region: process.env.UTHO_REGION || 'innoida',
    credentials: {
        accessKeyId: process.env.UTHO_ACCESS_KEY,
        secretAccessKey: process.env.UTHO_SECRET_KEY,
    },
});

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { filename, contentType, base64Data } = JSON.parse(event.body);

        if (!filename || !contentType || !base64Data) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' }),
            };
        }

        const buffer = Buffer.from(base64Data, 'base64');

        const command = new PutObjectCommand({
            Bucket: process.env.UTHO_BUCKET_NAME,
            Key: filename,
            ContentType: contentType,
            ACL: 'public-read',
        });

        // Generate signed URL
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        // Upload using native https to easily bypass TLS errors and follow 307 redirects
        await new Promise((resolve, reject) => {
            const doUpload = (targetUrl) => {
                const parsedUrl = new URL(targetUrl);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 443,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'PUT',
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': buffer.length
                    },
                    rejectUnauthorized: false // Bypass ERR_CERT_AUTHORITY_INVALID
                };

                const req = https.request(options, (res) => {
                    let responseBody = '';
                    res.on('data', chunk => responseBody += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve();
                        } else if (res.statusCode === 307 || res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 308) {
                            if (res.headers.location) {
                                // Follow redirect
                                doUpload(res.headers.location);
                            } else {
                                reject(new Error(`Utho responded with status: ${res.statusCode} but no Location header\nBody: ${responseBody}`));
                            }
                        } else {
                            reject(new Error(`Utho responded with status: ${res.statusCode}\nBody: ${responseBody}`));
                        }
                    });
                });

                req.on('error', (e) => reject(e));
                req.write(buffer);
                req.end();
            };

            doUpload(uploadUrl);
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ success: true, filename }),
        };
    } catch (error) {
        console.error('Error uploading to Utho via proxy:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to upload document: ' + (error.message || String(error)) }),
        };
    }
};
