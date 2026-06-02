import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Ensure uploads dir exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// S3 client for Utho
const s3Client = new S3Client({
  endpoint: process.env.UTHO_ENDPOINT,
  region: process.env.UTHO_REGION || "innoida",
  credentials: {
    accessKeyId: process.env.UTHO_ACCESS_KEY || "",
    secretAccessKey: process.env.UTHO_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

// Supabase client (service role for reading documents table)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Track preparation progress per document
const prepProgress = new Map();

const apiKeys = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
  process.env.GEMINI_API_KEY4
].filter(Boolean);

let currentKeyIndex = 0;

async function generateWithFallback(modelName, parts) {
  if (apiKeys.length === 0) throw new Error("No Gemini API keys configured.");

  let attempts = 0;
  while (attempts < apiKeys.length) {
    try {
      console.log(`Using API key index: ${currentKeyIndex}, model: ${modelName}`);
      const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      return (await result.response).text();
    } catch (err) {
      console.error(`Error with key ${currentKeyIndex}:`, err.message);
      
      // If it's an image support error, re-throw with clear message
      if (err.message && (err.message.includes("does not support") || err.message.includes("image") || err.message.includes("vision"))) {
        throw new Error("Image processing not supported with this model. Please use PDF format.");
      }
      
      currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
      attempts++;
    }
  }
  throw new Error("All API keys exhausted or failed.");
}

// Extract text from DOCX files
async function extractDocxText(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (err) {
    throw new Error("Failed to read Word document: " + err.message);
  }
}

// Extract text from PPTX files
async function extractPptxText(filePath) {
  try {
    const { default: AdmZip } = await import('adm-zip');
    const zip = new AdmZip(filePath);
    const slideFiles = zip.getEntries().filter(e => e.entryName.match(/ppt\/slides\/slide[0-9]+\.xml$/));
    
    let fullText = '';
    for (const slide of slideFiles) {
      const content = slide.getData().toString('utf8');
      const textMatches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      for (const match of textMatches) {
        const text = match.replace(/<[^>]+>/g, '');
        if (text.trim()) fullText += text + '\n';
      }
    }
    return fullText || "No text content found in presentation";
  } catch (err) {
    try {
      return await extractDocxText(filePath);
    } catch {
      throw new Error("Failed to read PowerPoint file: " + err.message);
    }
  }
}

// OCR for images and scanned PDFs
async function performOCR(filePath) {
  try {
    console.log("Performing OCR on:", filePath);
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    
    if (!text || text.trim().length < 10) {
      throw new Error("Could not extract readable text from this image. The image may not contain readable text or is too low quality.");
    }
    
    return text;
  } catch (err) {
    throw new Error("OCR failed: " + err.message);
  }
}

// Get file type from filename
function getFileType(originalName, filePath) {
  const ext = (originalName || filePath).toLowerCase().split('.').pop();
  return ext;
}

// Chat endpoint with multiple file type support
app.post("/api/chat", upload.single("file"), async (req, res) => {
  try {
    const question = req.body.question;
    const filePath = req.file?.path;
    const originalName = req.file?.originalname;

    if (!filePath) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing file:", originalName || req.file.filename);
    const fileType = getFileType(originalName, req.file.filename);
    let textContent = null;

    // Process based on file type
    switch (fileType) {
      case 'pdf': {
        // Check if PDF is text-based or scanned
        const buffer = fs.readFileSync(filePath);
        const textContentRatio = (buffer.filter(b => b >= 32 && b <= 126).length) / buffer.length;
        
        if (textContentRatio < 0.3) {
          // Likely scanned/image PDF - use OCR
          console.log("Detected scanned PDF, running OCR...");
          textContent = await performOCR(filePath);
        }
        // else: textContent stays null, we'll send PDF directly
        break;
      }
      
      case 'docx':
        textContent = await extractDocxText(filePath);
        break;
        
      case 'pptx':
      case 'ppt':
        textContent = await extractPptxText(filePath);
        break;
        
      case 'txt':
        textContent = fs.readFileSync(filePath, 'utf8');
        break;
        
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif':
      case 'bmp': {
        // For images, try Gemini first, fall back to OCR
        try {
          const fileData = fs.readFileSync(filePath);
          const base64 = fileData.toString("base64");
          const mimeType = `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;
          
          console.log("Trying direct image processing...");
          await generateWithFallback("gemini-2.5-flash", [
            { inlineData: { data: base64, mimeType } },
            { text: "Describe what you see in this image briefly." }
          ]);
          // If this works, textContent stays null
        } catch (imgErr) {
          console.log("Direct image failed, falling back to OCR...");
          textContent = await performOCR(filePath);
        }
        break;
      }
      
      default:
        throw new Error(`Unsupported file format: ${fileType}. Supported: PDF, DOCX, PPTX, TXT, PNG, JPG, JPEG, WEBP`);
    }

    let text;
    
    if (textContent !== null) {
      // Send extracted text to Gemini
      console.log("Sending extracted text to Gemini...");
      text = await generateWithFallback("gemini-2.5-flash", [
        { text: `You are ModulyAI, a VTU engineering study assistant. Answer ONLY from the provided document content. Format answers in VTU style: headings, bullet points, concise explanations, exam-oriented structure.\n\nDocument Content:\n${textContent}\n\nQuestion: ${question}` }
      ]);
    } else {
      // Send file directly to Gemini (text-based PDF)
      const fileData = fs.readFileSync(filePath);
      const base64 = fileData.toString("base64");
      
      text = await generateWithFallback("gemini-2.5-flash", [
        { inlineData: { data: base64, mimeType: "application/pdf" } },
        { text: `You are ModulyAI, a VTU engineering study assistant. Answer ONLY from the uploaded document. Format answers in VTU style: headings, bullet points, concise explanations, exam-oriented structure.\n\nQuestion: ${question}` }
      ]);
    }

    res.json({ answer: text });
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error(err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// ─── Shared VTU marker mode instructions ─────────────────────────────────────
function getVtuMarkerInstructions(markerMode) {
  if (!markerMode) return '';
  let instructions = `\n\n─── VTU 2022 SCHEME · ${markerMode} ANSWER FORMAT ───\n`;

  if (markerMode === '2M') {
    instructions += `This is a 2-mark question under the VTU 2022 CBCS scheme.
EVALUATION CRITERIA: Evaluators expect a SHORT, PRECISE answer — typically 2–4 lines (30–50 words max).
STRUCTURE (follow strictly):
1. **Definition / Statement:** One clear sentence defining the term or stating the formula.
2. **Key Point / Formula:** If applicable, write the relevant formula with variable definitions OR one supporting point.
   • If the question says "Define", give ONLY the definition.
   • If the question says "State", give the law/theorem statement verbatim.
   • If the question says "List", give 2–3 bullet items max.
   • If the question says "Differentiate" or "Compare", use a 2-column table with 2–3 rows.
DO NOT write lengthy explanations, advantages/disadvantages, or diagrams unless explicitly asked. Brevity = full marks.`;
  } else if (markerMode === '5M') {
    instructions += `This is a 5-mark (sub-part) question under the VTU 2022 CBCS scheme.
EVALUATION CRITERIA: Evaluators expect a MODERATE answer — approximately 0.5 to 1 page (80–150 words).
STRUCTURE (follow strictly):
1. **Definition / Introduction** (1–2 sentences): Define the concept or state the context.
2. **Explanation** (3–5 bullet points or a short paragraph): Cover the working principle, mechanism, or theory in concise bullet points. Use technical keywords — evaluators scan for these.
3. **Diagram / Formula** (if applicable): Include ONE relevant labeled diagram, circuit, flowchart, or formula derivation. Describe it in a "[Diagram: ...]" annotation.
4. **Example / Application** (1–2 lines): Provide a brief real-world application or numerical example if relevant.
FORMATTING RULES:
- Use **bold** for technical terms and keywords.
- Use bullet points, not dense paragraphs.
- For "Explain with a diagram", the diagram description is MANDATORY.
- For numerical problems, show step-by-step working with units.`;
  } else if (markerMode === '8M') {
    instructions += `This is an 8-mark (sub-part) question under the VTU 2022 CBCS scheme.
EVALUATION CRITERIA: Evaluators expect a DETAILED answer — approximately 1.5 to 2 pages (200–350 words).
STRUCTURE (follow strictly):
1. **Definition / Introduction** (2–3 sentences): Define the concept clearly.
2. **Detailed Explanation** (5–8 points with sub-explanations):
   - Break into numbered or bulleted points.
   - Each point: bold heading keyword + 1–2 line explanation.
   - Cover: What it is → How it works → Why it matters.
3. **Diagram / Block Diagram / Flowchart** (MANDATORY):
   - Write "[Diagram: <description>]" and explain it briefly.
4. **Advantages / Disadvantages / Characteristics** (3–4 points each, if relevant).
5. **Applications / Use Cases** (2–3 bullet points).
FORMATTING RULES:
- Use markdown headings for each section.
- **Bold** every technical keyword.
- For "Derive" questions: show complete step-by-step derivation.
- For "Compare" questions: use a comparison table with 4–5 parameters.`;
  } else if (markerMode === '10M') {
    instructions += `This is a 10-mark question under the VTU 2022 CBCS scheme.
EVALUATION CRITERIA: Evaluators expect a COMPREHENSIVE answer — approximately 2.5 to 3 pages (350–500 words).
STRUCTURE (follow strictly):
1. **Definition / Introduction** (3–4 sentences): Define the concept and its relevance.
2. **Theory / Detailed Explanation** (8–12 detailed points under clear subheadings).
3. **Diagram(s)** (MANDATORY — include 1–2 diagrams with labels and explanation).
4. **Mathematical Derivation / Algorithm** (if applicable — complete step-by-step).
5. **Advantages AND Disadvantages** (4–5 points each).
6. **Applications** (4–5 real-world applications).
7. **Conclusion** (2–3 sentences summarizing the key takeaway).
FORMATTING RULES:
- Begin with "**Q:** <restate the question>" at the top.
- Use markdown ## headings for major sections.
- **Bold** every technical keyword.
- For "Compare" questions: use a detailed table with 5–6 parameters.
- For "Explain with example": include a worked-out numerical example.
- Never leave sections empty; write something for each to earn partial marks.`;
  }

  instructions += `\n\nGENERAL VTU FORMATTING RULES:
- Always begin each major section with a bold heading.
- Bold important technical terms throughout — VTU evaluators scan for keywords.
- If a diagram is mentioned, include a textual description marked as [Diagram: ...].
- Present the answer as if writing in an exam booklet: neat, structured, point-wise.
- Format using clear markdown headings.
- Output as a Q&A accordion: clearly state the question at the top (e.g. '**Q:** <question>') AND begin the answer with '**A:**'.`;

  return instructions;
}

// ─── Context-aware chat for follow-up messages ───────────────────────────────
app.post("/api/chat-context", async (req, res) => {
  try {
    const { message, context, history, markerMode } = req.body;

    let SYSTEM_GUARD = `You are ModulyAI, a dedicated VTU engineering study assistant.

STRICT RULES:
1. You ONLY answer questions related to academics, education, engineering concepts, study material, exam preparation, syllabus topics, and learning.
2. Basic greetings (hi, hello, bye, thank you, how are you) are allowed — respond warmly but briefly, then gently steer the conversation back to studies.
3. For ANY non-educational query (entertainment, politics, personal advice, recipes, coding projects unrelated to VTU syllabus, etc.), respond with a subtle, friendly reminder like: "I appreciate the curiosity! But I'm your study companion — let's keep the focus on academics. What topic would you like to explore?"
4. Never reveal your underlying model, API, or technology stack. You are simply "ModulyAI".
5. Format answers in VTU style: headings, bullet points, concise explanations, exam-oriented structure.`;

    // Append marker mode instructions if present
    if (markerMode) {
      SYSTEM_GUARD += getVtuMarkerInstructions(markerMode);
    }

    const conversationParts = [];
    
    if (context) {
      conversationParts.push({ text: `${SYSTEM_GUARD}\n\nPrevious conversation context:\n${context}\n\nBased on the above context, answer the following question.` });
    } else {
      conversationParts.push({ text: SYSTEM_GUARD });
    }

    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        conversationParts.push({ text: msg.content });
      }
    }

    conversationParts.push({ text: message });

    const text = await generateWithFallback("gemini-2.5-flash", conversationParts);
    res.json({ response: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// General chat endpoint
app.post("/api/chat-general", async (req, res) => {
  try {
    const { message, history, markerMode } = req.body;

    let systemInstruction = `You are ModulyAI, a dedicated VTU engineering study assistant.

STRICT RULES:
1. You ONLY answer questions related to academics, education, engineering concepts, study material, exam preparation, syllabus topics, and learning.
2. Basic greetings (hi, hello, bye, thank you, how are you) are allowed — respond warmly but briefly, then gently steer back to studies.
3. For ANY non-educational query, respond with a subtle, friendly reminder like: "I appreciate the curiosity! But I'm your study companion — let's keep the focus on academics. What topic would you like to explore?"
4. Never reveal your underlying model, API, or technology stack. You are simply "ModulyAI".
5. Format answers in VTU style: headings, bullet points, concise explanations, exam-oriented structure.`;
    
    if (markerMode) {
      systemInstruction += getVtuMarkerInstructions(markerMode);
    }

    const conversation = [
      { text: systemInstruction }
    ];

    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        conversation.push({ text: msg.content });
      }
    }

    conversation.push({ text: message });

    const text = await generateWithFallback("gemini-2.5-flash", conversation);
    res.json({ response: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Exam solve endpoint
app.post("/api/exam-solve", async (req, res) => {
  try {
    const { question, mark } = req.body;

    // Map mark string to marker mode key
    const markerMap = { '2': '2M', '5': '5M', '8': '8M', '10': '10M' };
    const markerKey = markerMap[mark] || null;
    const vtuInstructions = markerKey ? getVtuMarkerInstructions(markerKey) : '';

    const prompt = `You are ModulyAI, a VTU engineering exam assistant specializing in the VTU 2022 CBCS scheme.

Your task is to answer the following question exactly as a top-scoring VTU student would write it in their answer booklet.
${vtuInstructions}

Mark: ${mark}

Question: ${question}

Provide a structured, exam-ready answer.`;

    const text = await generateWithFallback("gemini-2.5-flash", [
      { text: prompt }
    ]);

    res.json({ answer: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Prepare Library Document ────────────────────────────────────────────────
// Downloads a document from Utho S3 and saves it as a temp file for Gemini usage
app.post("/api/prepare-library-doc", async (req, res) => {
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "Missing documentId" });

  // Initialize progress
  prepProgress.set(documentId, { status: "downloading", progress: 0 });

  try {
    // 1. Get file_path from Supabase documents table
    prepProgress.set(documentId, { status: "downloading", progress: 10 });
    const { data: doc, error: dbErr } = await supaAdmin
      .from("documents")
      .select("file_path, title, file_type")
      .eq("id", documentId)
      .single();

    if (dbErr || !doc) {
      prepProgress.delete(documentId);
      return res.status(404).json({ error: "Document not found in database" });
    }

    prepProgress.set(documentId, { status: "downloading", progress: 25 });

    // 2. Download from Utho S3
    const s3Key = doc.file_path;
    const command = new GetObjectCommand({
      Bucket: process.env.UTHO_BUCKET_NAME,
      Key: s3Key,
    });

    prepProgress.set(documentId, { status: "downloading", progress: 40 });
    const s3Response = await s3Client.send(command);
    const bodyBytes = await s3Response.Body?.transformToByteArray();

    if (!bodyBytes) {
      prepProgress.delete(documentId);
      return res.status(404).json({ error: "File not found in storage" });
    }

    prepProgress.set(documentId, { status: "downloading", progress: 70 });

    // 3. Save to temp file
    const ext = path.extname(doc.file_path) || ".pdf";
    const tempPath = path.join("uploads", `lib-${documentId}${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(bodyBytes));

    prepProgress.set(documentId, { status: "ready", progress: 100, tempPath, title: doc.title, fileType: doc.file_type });

    res.json({
      success: true,
      documentId,
      tempPath,
      title: doc.title,
      fileType: doc.file_type,
      size: bodyBytes.length,
    });
  } catch (err) {
    console.error("prepare-library-doc error:", err);
    prepProgress.set(documentId, { status: "error", progress: 0, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Progress polling endpoint
app.get("/api/prepare-library-doc/status/:docId", (req, res) => {
  const info = prepProgress.get(req.params.docId);
  if (!info) return res.json({ status: "unknown", progress: 0 });
  res.json(info);
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
  console.log("Supported formats:");
  console.log("  - PDF (text & scanned)");
  console.log("  - DOCX, PPTX, TXT");
  console.log("  - PNG, JPG, JPEG, WEBP (with OCR fallback)");
});