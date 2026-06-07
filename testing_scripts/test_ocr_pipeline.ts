/**
 * Test OCR Pipeline
 * Run: npx tsx testing_scripts/test_ocr_pipeline.ts
 * 
 * Tests:
 * 1. Document parser with Groq Vision OCR
 * 2. loadUthoDoc with OCR fallback
 */

import { parseDocument } from '../src/lib/ai/document-parser';
import { loadUthoDoc, UTHO_DOCUMENTS } from '../src/lib/docGrounding';
import { chunkText } from '../src/lib/ai/chunker';

console.log('\n🧪 Testing OCR Pipeline\n');
console.log('='.repeat(50));

async function testParseImage() {
  console.log('\n📄 Test 1: Parse image with OCR');
  console.log('-'.repeat(30));
  
  // Create a simple test image (1x1 PNG with some text would be ideal, but we'll test the function exists)
  const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  try {
    const result = await parseDocument(testBuffer, 'test.png', true);
    console.log(`✓ parseDocument function works`);
    console.log(`  - Type: ${result.type}`);
    console.log(`  - Is scanned: ${result.isScanned}`);
  } catch (e) {
    console.log(`✗ Error: ${e}`);
  }
}

async function testChunker() {
  console.log('\n📄 Test 2: Text chunking');
  console.log('-'.repeat(30));
  
  const testText = `
    Introduction to Machine Learning
    
    Machine learning is a subset of artificial intelligence that focuses on
    teaching computers to learn from data without being explicitly programmed.
    
    Types of Machine Learning:
    1. Supervised Learning - learning from labeled examples
    2. Unsupervised Learning - finding patterns in unlabeled data
    3. Reinforcement Learning - learning through trial and error
    
    Key Concepts:
    - Training Data: The data used to train models
    - Features: Input variables that the model uses
    - Labels: The target variable we want to predict
    - Model: The mathematical representation learned from data
  `.trim();
  
  const chunks = chunkText(testText, { chunkSize: 200, overlap: 30 });
  console.log(`✓ chunkText works`);
  console.log(`  - Input text: ${testText.length} chars`);
  console.log(`  - Output chunks: ${chunks.length}`);
  chunks.forEach((c, i) => console.log(`  - Chunk ${i + 1}: ${c.content.slice(0, 50)}...`));
}

async function testLoadUthoDoc() {
  console.log('\n📄 Test 3: Load UTHO document with OCR fallback');
  console.log('-'.repeat(30));
  
  // Find available docs - try some common UTHO doc IDs
  const testDocIds = [
    'utho-ai-ml-notes.pdf',
    'utho-python-cheatsheet.png', 
    'utho-data-structures.pdf',
  ];
  
  for (const docId of testDocIds) {
    console.log(`\nTrying: ${docId}`);
    const success = await loadUthoDoc(docId);
    
    if (success) {
      const doc = UTHO_DOCUMENTS.find(d => d.doc_id === docId);
      if (doc) {
        console.log(`✓ Loaded: ${doc.title}`);
        console.log(`  - Chunks: ${doc.chunks.length}`);
        console.log(`  - Type: ${doc.type}`);
        if (doc.chunks[0]) {
          console.log(`  - Sample: ${doc.chunks[0].text.slice(0, 100)}...`);
        }
        break;
      }
    } else {
      console.log(`  ✗ Failed to load (may not exist)`);
    }
  }
}

async function testGroqVision() {
  console.log('\n📄 Test 4: Groq Vision API connection');
  console.log('-'.repeat(30));
  
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.log('✗ GROQ_API_KEY not found');
    return;
  }
  console.log(`✓ GROQ_API_KEY present: ${groqKey.slice(0, 10)}...`);
  
  // Quick API test
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${groqKey}` }
    });
    
    if (response.ok) {
      const models = await response.json();
      const visionModels = models.data?.filter((m: any) => m.id.includes('vision')) || [];
      console.log(`✓ Groq API accessible`);
      console.log(`  - Vision models available: ${visionModels.length}`);
      visionModels.forEach((m: any) => console.log(`    - ${m.id}`));
    } else {
      console.log(`✗ API error: ${response.status}`);
    }
  } catch (e) {
    console.log(`✗ Connection failed: ${e}`);
  }
}

// Run tests
console.log('\n🚀 Starting OCR pipeline tests...\n');

await testParseImage();
await testChunker();
await testLoadUthoDoc();
await testGroqVision();

console.log('\n' + '='.repeat(50));
console.log('✅ Tests complete!\n');