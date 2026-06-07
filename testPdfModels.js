import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const key = process.env.GEMINI_API_KEY1;
const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/ Kids [3 0 R]>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000015 00000 n\n0000000068 00000 n\n0000000125 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF');
const base64Data = pdfBuffer.toString("base64");

async function testPdf(modelName) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent([{inlineData: {data: base64Data, mimeType: "application/pdf"}}, "test"]);
    console.log(`✅ ${modelName}`);
    return true;
  } catch (err) {
    console.log(`❌ ${modelName}: ${err.message.substring(0, 100)}`);
    return false;
  }
}

const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-pro",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];

async function run() {
  console.log("Testing PDF support...\n");
  for (const m of models) {
    await testPdf(m);
    await new Promise(r => setTimeout(r, 1500));
  }
}

run();