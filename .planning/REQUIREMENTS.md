# Requirements: Moduly AI

**Defined:** 2026-03-16
**Core Value:** AI-powered study assistant that understands VTU syllabus and helps students study using real course materials (RAG-grounded)

## v1 Requirements

Requirements for Project Expo demo. Each maps to roadmap phases.

### Document Processing & RAG Pipeline

- [ ] **RAG-01**: User's uploaded PDF is automatically extracted into plain text upon upload
- [ ] **RAG-02**: Extracted text is split into overlapping chunks (500 chars, 50 overlap) for retrieval quality
- [ ] **RAG-03**: Each chunk is embedded into a 1024-dimensional vector via NVIDIA NV-EmbedQA E5 v5
- [ ] **RAG-04**: Embeddings are stored in Supabase pgvector with HNSW index and retrievable via cosine similarity search
- [ ] **RAG-05**: Vector search filters results by metadata (subject, selected documents) before ranking by similarity
- [ ] **RAG-06**: Document processing status (processing/ready/failed/no_text) is tracked in the database and visible to the user
- [ ] **RAG-07**: Scanned PDFs with no extractable text are detected and the user sees a clear message explaining why the document can't be processed
- [ ] **RAG-08**: If NVIDIA NIM embedding API is unavailable, the system falls back to an alternative embedding provider without user intervention

### Study Mode

- [ ] **STUDY-01**: User can chat with AI about any VTU subject and receive RAG-grounded answers from uploaded documents (replacing hardcoded mock responses)
- [ ] **STUDY-02**: AI responses stream in real-time via SSE so the user sees text appearing progressively (not waiting for full response)
- [ ] **STUDY-03**: User can select which uploaded documents the AI should reference (Study Kit), and only chunks from those documents are used in RAG retrieval
- [ ] **STUDY-04**: User can specify mark allocation (2M, 5M, 8M, 10M) and AI calibrates answer depth and length to match VTU exam expectations
- [ ] **STUDY-05**: System prompts include VTU syllabus details (module topics, exam pattern) for at least 2-3 demo subjects so AI demonstrates curriculum awareness

### Exam Mode

- [ ] **EXAM-01**: User can input a PYQ question and receive an AI-generated answer grounded in uploaded study materials
- [ ] **EXAM-02**: User can upload or select a full question paper and receive a complete model answer paper with all questions answered
- [ ] **EXAM-03**: AI-generated exam answers follow VTU exam formatting with marking schemes, step-by-step solutions, and section headers
- [ ] **EXAM-04**: System parses multiple past papers and displays topic frequency analysis showing which topics appear most often across exams
- [ ] **EXAM-05**: User can manually paste/type a question when working with scanned or image-based question papers that can't be parsed

### Community Library

- [ ] **LIB-01**: User can browse all uploaded documents with real data from Supabase (replacing mock/hardcoded library data)
- [ ] **LIB-02**: User can filter library documents by subject, module, and document type (notes, question papers, lab manuals, textbooks)
- [ ] **LIB-03**: User can request removal of a document they uploaded, with the request handled by admin via Supabase console

### Demo Hardening

- [ ] **DEMO-01**: LLM calls use a multi-provider fallback chain (OpenRouter → NVIDIA NIM → cached responses) so the demo never shows a raw API error
- [ ] **DEMO-02**: All AI features display user-friendly error messages instead of raw errors when something goes wrong
- [ ] **DEMO-03**: AI chat interfaces show typing/loading indicators while waiting for responses
- [ ] **DEMO-04**: Exact demo flow responses are pre-cached so the demo works even if all LLM providers are down
- [ ] **DEMO-05**: API connections are pre-warmed before the demo to eliminate cold start delays

## v2 Requirements

Deferred to post-expo. Tracked but not in current roadmap.

### Advanced AI

- **ADV-01**: ML model for predicting likely exam topics based on historical PYQ patterns
- **ADV-02**: Auto-generate summaries of uploaded documents
- **ADV-03**: Multi-language support (Kannada/Hindi) for broader VTU reach

### Social & Collaboration

- **SOC-01**: Study groups with shared document collections
- **SOC-02**: Spaced repetition / review scheduling system

### Platform

- **PLAT-01**: Admin dashboard for content moderation (replacing Supabase console)
- **PLAT-02**: Mobile app (React Native or PWA)
- **PLAT-03**: Freemium monetization with ad integration
- **PLAT-04**: Real dashboard stats with actual usage metrics

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaborative study | WebSocket infrastructure, presence, conflict resolution — massive scope for zero expo benefit |
| Flashcard generation | Competes with Quizlet on their turf; AI chat is more flexible |
| Video content integration | Video parsing/transcription is expensive and complex; not core value |
| Full offline support | Service workers + offline LLM impossible at this scale |
| AI-generated mind maps | Graph rendering, layout algorithms, interactive canvas — huge scope creep |
| Gamification / streaks / points | Superficial engagement mechanics; judges see through hollow gamification |
| Plagiarism detection | AI answers are generated, not copied; misleading feature |
| OCR for scanned PDFs | Complex, costly; curate text-based demo content instead |
| LangChain.js | Massive dependency for trivial utility; custom chunker replaces it |
| Pinecone / Weaviate | Unnecessary external vector DB; Supabase pgvector is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAG-01 | — | Pending |
| RAG-02 | — | Pending |
| RAG-03 | — | Pending |
| RAG-04 | — | Pending |
| RAG-05 | — | Pending |
| RAG-06 | — | Pending |
| RAG-07 | — | Pending |
| RAG-08 | — | Pending |
| STUDY-01 | — | Pending |
| STUDY-02 | — | Pending |
| STUDY-03 | — | Pending |
| STUDY-04 | — | Pending |
| STUDY-05 | — | Pending |
| EXAM-01 | — | Pending |
| EXAM-02 | — | Pending |
| EXAM-03 | — | Pending |
| EXAM-04 | — | Pending |
| EXAM-05 | — | Pending |
| LIB-01 | — | Pending |
| LIB-02 | — | Pending |
| LIB-03 | — | Pending |
| DEMO-01 | — | Pending |
| DEMO-02 | — | Pending |
| DEMO-03 | — | Pending |
| DEMO-04 | — | Pending |
| DEMO-05 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️ (will be mapped during roadmap creation)

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
