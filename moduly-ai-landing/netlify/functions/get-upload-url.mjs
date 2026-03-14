import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    endpoint: process.env.UTHO_ENDPOINT,
    region: process.env.UTHO_REGION || 'innoida',
    credentials: {
        accessKeyId: process.env.UTHO_ACCESS_KEY,
        secretAccessKey: process.env.UTHO_SECRET_KEY,
    },
    forcePathStyle: true,
});

export const handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { filename, contentType } = JSON.parse(event.body);

        if (!filename || !contentType) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Filename and contentType are required.' }),
            };
        }

        const command = new PutObjectCommand({
            Bucket: process.env.UTHO_BUCKET_NAME,
            Key: filename,
            ContentType: contentType,
            ACL: 'public-read',
        });

        // Generate a pre-signed URL valid for 15 minutes
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ uploadUrl, filename }),
        };
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate upload URL' }),
        };
    }
};
