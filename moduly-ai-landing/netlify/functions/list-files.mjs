import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const command = new ListObjectsV2Command({
            Bucket: process.env.UTHO_BUCKET_NAME,
        });

        const data = await s3Client.send(command);
        const files = (data.Contents || [])
            .filter(obj => !obj.Key.startsWith('parsed/'))
            .map(obj => {
                // Strip 'source/' prefix for backward-compatible display
                const displayKey = obj.Key.startsWith('source/')
                    ? obj.Key.slice('source/'.length)
                    : obj.Key;
                return {
                    filename: displayKey,
                    rawKey: obj.Key,
                    size: obj.Size,
                    lastModified: obj.LastModified,
                };
            });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ files }),
        };
    } catch (error) {
        console.error('Error listing files:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to list files' }),
        };
    }
};
