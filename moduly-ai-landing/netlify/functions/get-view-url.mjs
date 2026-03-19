import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const filename = event.queryStringParameters?.filename;
    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename parameter' }) };
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.UTHO_BUCKET_NAME,
            Key: filename,
            // Hint browser to display inline rather than forcing download
            ResponseContentDisposition: `inline; filename="${filename}"`,
        });

        // Pre-signed URL valid for 1 hour (3600 seconds)
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ url: signedUrl }),
        };
    } catch (error) {
        console.error('Error generating view URL:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate view URL' }),
        };
    }
};
