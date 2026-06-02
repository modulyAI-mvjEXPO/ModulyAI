import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

const BUCKET = process.env.UTHO_BUCKET_NAME;

async function tryGetKey(key) {
    const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
    try {
        await s3Client.send(command);
        return key;
    } catch {
        return null;
    }
}

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const filename = event.queryStringParameters?.filename;
    if (!filename) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename parameter' }) };
    }

    try {
        // Try both with and without source/ prefix
        let s3Key = filename.startsWith('source/') 
            ? filename 
            : `source/${filename}`;
        
        // Check if key exists, fallback to original if not
        const foundKey = await tryGetKey(s3Key) || await tryGetKey(filename);
        
        if (!foundKey) {
            return { statusCode: 404, body: JSON.stringify({ error: 'File not found in storage' }) };
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: foundKey,
            ResponseContentDisposition: `inline; filename="${filename}"`,
        });

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
