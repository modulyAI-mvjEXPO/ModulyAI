import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFParse } from 'pdf-parse';
import dotenv from 'dotenv';

dotenv.config();

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

async function run() {
  console.log('🚀 Starting bulk Utho document parsing...');
  
  try {
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET });
    const { Contents = [] } = await s3Client.send(listCmd);
    
    const pdfs = Contents.filter(obj => obj.Key.endsWith('.pdf') && !obj.Key.startsWith('parsed/'));
    console.log(`Found ${pdfs.length} PDFs to process.`);

    for (const obj of pdfs) {
      const jsonKey = `parsed/${obj.Key}.json`;
      
      // Check if already parsed
      try {
        await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: jsonKey }));
        console.log(`⏩ Skipping ${obj.Key} (already parsed)`);
        continue;
      } catch (e) {
        // Not found, proceed
      }

      console.log(`📄 Processing ${obj.Key}...`);
      
      // Download
      const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key });
      const response = await s3Client.send(getCmd);
      const buffer = Buffer.from(await response.Body.transformToByteArray());
      
      // Parse
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const { text } = await parser.getText();
      await parser.destroy();
      
      // Chunking (200-500 words)
      const words = text.split(/\s+/);
      const chunks = [];
      let chunkId = 1;
      
      for (let i = 0; i < words.length; i += 350) {
        const chunkText = words.slice(i, i + 350).join(' ');
        if (chunkText.trim()) {
          chunks.push({
            id: `${obj.Key}-c${chunkId++}`,
            text: chunkText
          });
        }
      }
      
      const parsedDoc = {
        metadata: {
          title: obj.Key.split('/').pop().replace('.pdf', ''),
          type: 'notes', // Default
          subject: 'general'
        },
        chunks
      };
      
      // Upload
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: jsonKey,
        Body: JSON.stringify(parsedDoc),
        ContentType: 'application/json'
      }));
      
      console.log(`✅ Uploaded ${jsonKey} (${chunks.length} chunks)`);
    }
    
    console.log('✨ All documents processed!');
  } catch (error) {
    console.error('❌ Error during processing:', error);
  }
}

run();
