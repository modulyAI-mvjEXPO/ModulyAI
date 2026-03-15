# Feature Research

**Domain:** AI-Powered Study Platform for VTU Engineering Students
**Researched:** 2026-03-15
**Confidence:** HIGH (based on existing codebase analysis + competitor research + domain knowledge)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete at Project Expo demo.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **AI Chat for Subject Learning** | Core value prop — "AI study assistant" means you can ask questions about your subjects | HIGH | UI prototype exists in `StudyMode.tsx`. Requires: LLM integration, context from study materials (RAG), subject-scoped conversations. Hardest part is RAG pipeline. |
| **PYQ Analysis & Solving** | VTU students live and die by PYQs — every competitor/tutor offers this | HIGH | UI prototype exists in `ExamMode.tsx`. Requires: PDF parsing of question papers, question extraction, LLM-generated answers with marking schemes. Two distinct capabilities: frequency analysis + answer generation. |
| **Document Upload & Storage** | Users need to contribute materials to get value from the platform | LOW | **Already functional** in `UploadDocs.tsx` — Utho S3 + Netlify Functions. Needs: file type validation, size limits, metadata tagging (subject, module, doc type). |
| **Community Document Library** | Shared resources are the foundation of any study platform — users expect to browse what others uploaded | MEDIUM | UI prototype exists in `Library.tsx` with hardcoded data. Needs: real Supabase queries, filtering by subject/module/type, search. Currently mock data only. |
| **User Authentication** | Users expect persistent accounts, saved progress, personalized experience | LOW | **Already functional** — Supabase email + OTP auth is working. |
| **VTU-Specific Subject Selection** | Platform claims VTU focus — must actually know VTU branches, semesters, subjects | LOW | **Already functional** — `vtuData.ts` has 31 colleges, 16 courses, 6 branches, 8 semesters of subject data hardcoded. |
| **Markdown/Formatted AI Responses** | AI responses with equations, code, lists must render properly — raw text looks broken | LOW | Already implemented in `StudyMode.tsx` with `react-markdown` + `remark-gfm`. Just needs real AI responses instead of hardcoded ones. |
| **Mark-Based Answer Formatting** | VTU has specific mark allocations (2M, 8M, 10M) — answers must match expected depth | MEDIUM | UI selector exists in `StudyMode.tsx`. Requires: prompt engineering to calibrate answer length/depth per mark value. System prompt work, not a separate feature. |

### Differentiators (Competitive Advantage)

Features that set Moduly AI apart from ChatPDF/Quizlet/generic AI chatbots. These are what make judges say "this is clever."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **RAG from Uploaded Study Materials** | Unlike ChatGPT/generic AI — answers are grounded in actual VTU textbooks, notes, and materials uploaded by the community. Source-cited, relevant, accurate. | HIGH | **Highest technical risk.** Requires: PDF text extraction, chunking, embedding generation (free model needed), vector storage, retrieval at query time. No infrastructure exists yet. This is the single most important differentiator. |
| **PYQ Frequency Analysis** | Automatically identifies which topics appear most frequently across past papers — tells students exactly what to study. No competitor does this for VTU specifically. | MEDIUM | UI exists in `ExamMode.tsx` (module weightage chart, frequency patterns). Requires: PDF parsing of multiple question papers, question-to-module mapping, statistical analysis. Could be partially hardcoded for demo. |
| **VTU Curriculum Awareness** | AI knows the specific syllabus, module structure, and exam pattern for each VTU subject. Not just "any engineering" — specifically VTU. | MEDIUM | `vtuData.ts` provides the skeleton. Needs: subject-specific syllabus content (module topics, learning objectives) added to system prompts or RAG context. Could start with 2-3 subjects for demo. |
| **Study Kit Context Control** | User explicitly selects which source documents the AI should reference — gives control over AI's knowledge scope. Unique UX pattern. | MEDIUM | UI prototype exists in `StudyMode.tsx` sidebar ("Study Kit" with source selection, strict context toggle, active topics). Requires: integration with RAG pipeline to filter retrieval by selected sources. |
| **Structured Exam Answers** | AI generates answers formatted like VTU exam answers — with marking schemes, step-by-step solutions, and confidence indicators. Not just "here's the answer." | LOW | UI exists in `ExamMode.tsx`. Primarily prompt engineering + response formatting. Low complexity because it's mostly system prompt design. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but would kill the 2-week timeline or create more problems than they solve.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Collaborative Study** | "Study with friends!" sounds appealing | Requires WebSocket infrastructure, presence, conflict resolution. Massive scope for near-zero benefit at Expo. | Show shared library instead — async collaboration through uploaded docs. |
| **Flashcard Generation** | Quizlet has it, seems expected | Requires separate UI, spaced repetition algorithm, progress tracking. Competes with Quizlet on their turf. | Focus AI chat on explaining concepts — more flexible than fixed flashcards. |
| **Video Content Integration** | "Add YouTube lecture links" | Video parsing/transcription is expensive and complex. Adds UI complexity. Not the core value prop. | Stay focused on text-based materials (PDFs, notes). Link to external videos without processing them. |
| **Full Offline Support** | "What if students don't have internet?" | Service workers + offline LLM is impossible at this scale. IndexedDB caching adds significant complexity. | Ensure fast loading and reasonable mobile experience. Offline is a v2+ concern. |
| **AI-Generated Mind Maps** | Library.tsx lists "Mind Map" as a doc type | Requires graph rendering library, layout algorithms, interactive canvas. Huge scope creep. | Remove Mind Map from doc types. Focus on text-based summaries and notes. |
| **Gamification / Streaks / Points** | "Increase engagement!" | Superficial engagement mechanics take significant time to design and implement well. Judges see through hollow gamification. | Let the AI quality and VTU-specific value be the engagement driver. |
| **Multi-Language Support** | VTU students may prefer Kannada/Hindi | i18n infrastructure, translated content, multilingual LLM responses. Massive scope. | English-only for Expo. Add language support post-launch. |
| **Plagiarism Detection** | "Make sure answers are original" | Requires plagiarism API integration, comparison corpus. Not the core value prop. Misleading — AI answers are generated, not copied. | Clearly label AI-generated content. Focus on educational value, not originality checking. |

## Feature Dependencies

```
[User Auth] (DONE)
    |
    v
[Document Upload] (DONE)
    |
    +-----> [Community Library] -----> [Library Search/Filter]
    |
    +-----> [RAG Pipeline] ---------> [Study Mode AI Chat]
    |           |                         |
    |           |                         +-----> [Study Kit Context Control]
    |           |                         +-----> [Mark-Based Formatting]
    |           |
    |           +-------------------> [Exam Mode AI Chat]
    |                                     |
    |                                     +-----> [Structured Exam Answers]
    |
    +-----> [PYQ Frequency Analysis] (can work independently of RAG)

[VTU Subject Data] (DONE)
    |
    +-----> [VTU Curriculum Awareness] -----> [Study Mode AI Chat]
    +-----> [PYQ Frequency Analysis]
    +-----> [Community Library] (filtering by subject)
```

### Dependency Notes

- **RAG Pipeline requires Document Upload:** Documents must be stored before they can be chunked, embedded, and retrieved. Upload is done; RAG is the critical gap.
- **Study Mode AI Chat requires RAG Pipeline:** Without retrieval, the AI is just a generic chatbot — loses the core differentiator of source-grounded answers.
- **Exam Mode AI Chat requires RAG Pipeline:** Answer generation needs access to textbook content for accurate, curriculum-aligned responses.
- **Study Kit Context Control requires RAG Pipeline:** Filtering retrieval by selected sources is a RAG-layer feature.
- **PYQ Frequency Analysis is independent of RAG:** Can work by parsing question papers and mapping to modules without needing the full embedding/retrieval pipeline. Good candidate for early demo value.
- **Community Library requires Document Upload:** Library displays what's been uploaded. Upload works; Library needs real database queries.
- **Mark-Based Formatting enhances Study Mode:** Primarily prompt engineering on top of working AI chat. Low incremental cost once chat works.
- **VTU Curriculum Awareness enhances both AI modes:** Adding syllabus content to system prompts improves all AI responses. Can be done incrementally per subject.

## MVP Definition

### Launch With (Expo Demo v1)

Minimum viable product for Project Expo judges. Must demonstrate the core value proposition: "AI that understands VTU and helps you study using real materials."

- [x] **User Authentication** — Already working (Supabase email + OTP)
- [x] **Document Upload** — Already working (Utho S3 + Netlify Functions)
- [x] **VTU Subject Data** — Already working (hardcoded in vtuData.ts)
- [ ] **RAG Pipeline (basic)** — PDF text extraction + chunking + embeddings + vector search. Even a simple version transforms the app from mockup to functional. Use free embedding models (e.g., NVIDIA NV-Embed via free tier).
- [ ] **Study Mode AI Chat (functional)** — Replace hardcoded responses with real LLM calls. Source-grounded via RAG. Mark-based formatting via system prompts.
- [ ] **Community Library (real data)** — Replace mock data with Supabase queries. Filter by subject, module, doc type.
- [ ] **Exam Mode AI Chat (basic)** — LLM-generated answers for PYQ questions. Structured output formatting. Can share RAG pipeline with Study Mode.

### Add After Validation (Expo Enhancement)

Features to add if core is working and time permits (last 2-3 days).

- [ ] **PYQ Frequency Analysis** — Parse multiple past papers, generate topic frequency charts. High demo impact, moderately complex.
- [ ] **Study Kit Context Control** — Let users select which documents the AI references. Requires RAG filter support.
- [ ] **VTU Curriculum Awareness** — Enrich system prompts with syllabus module details for 2-3 demo subjects.
- [ ] **Dashboard Stats (real data)** — Replace hardcoded stats with real usage metrics (docs uploaded, sessions, etc.).

### Future Consideration (Post-Expo)

Features to defer until after the competition.

- [ ] **Advanced PYQ pattern prediction** — ML model for predicting likely exam topics. Needs historical data and validation.
- [ ] **Document summarization** — Auto-generate summaries of uploaded materials. Nice but not core.
- [ ] **Study groups / social features** — Async collaboration features. Requires social infrastructure.
- [ ] **Mobile app** — React Native or PWA. Current SPA works on mobile browsers.
- [ ] **Multi-language support** — Kannada/Hindi support for broader VTU reach.
- [ ] **Spaced repetition / review scheduling** — Flashcard-style active recall system.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Status |
|---------|------------|---------------------|----------|--------|
| RAG Pipeline (basic) | HIGH | HIGH | **P0** | Not started |
| Study Mode AI Chat | HIGH | MEDIUM | **P0** | UI done, needs LLM integration |
| Community Library (real data) | HIGH | LOW | **P1** | UI done, needs Supabase queries |
| Exam Mode AI Chat | HIGH | MEDIUM | **P1** | UI done, needs LLM integration |
| Mark-Based Formatting | MEDIUM | LOW | **P1** | UI done, prompt engineering only |
| Structured Exam Answers | MEDIUM | LOW | **P1** | UI done, prompt engineering only |
| PYQ Frequency Analysis | HIGH | MEDIUM | **P2** | UI done, needs PDF parsing |
| Study Kit Context Control | MEDIUM | MEDIUM | **P2** | UI done, needs RAG filter layer |
| VTU Curriculum Awareness | MEDIUM | MEDIUM | **P2** | Data structure exists, needs content |
| Dashboard Stats (real) | LOW | LOW | **P3** | UI done, needs real queries |

**Priority key:**
- **P0:** Absolutely critical — without these, there is no demo. RAG is the foundation everything else sits on.
- **P1:** Must have for a complete demo — these transform "prototype" into "product."
- **P2:** Should have if time permits — these add depth and differentiation for judges.
- **P3:** Nice to have — polish items that enhance but aren't essential.

## Competitor Feature Analysis

| Feature | Khanmigo | ChatPDF | Quizlet | NotebookLM | **Moduly AI** |
|---------|----------|---------|---------|------------|---------------|
| AI Chat | Socratic method (guides, doesn't answer directly) | Direct answers from uploaded docs | AI study guides from content | Multi-source grounded chat | **Direct answers grounded in VTU materials** |
| Document Upload | No (uses Khan Academy content) | PDF upload, multi-file | Flashcard import | Multi-source upload (docs, URLs, audio) | **S3 upload (working), community shared** |
| Source Citations | References Khan content | Page-level citations from PDF | N/A | Inline source citations | **Planned via RAG retrieval metadata** |
| Exam Prep | Practice problems within Khan | N/A | Test mode, practice tests | N/A | **VTU PYQ-specific with mark formatting** |
| Curriculum Awareness | Khan Academy curriculum | None (generic) | None (user-created) | None (user sources only) | **VTU syllabus, branches, modules** |
| Community Sharing | No | No | Study groups, shared sets | Shared notebooks | **Community library with shared uploads** |
| Pricing | Paid (Khanmigo Plus) | Free tier (2 docs/day) | Freemium | Free (Google) | **Free (free-tier LLM providers)** |

### Our Competitive Angle

Moduly AI is not competing with ChatGPT or NotebookLM on general AI quality. The moat is:

1. **VTU-specific curriculum awareness** — No competitor knows VTU syllabus structure, exam patterns, or mark allocation schemes.
2. **PYQ intelligence** — Frequency analysis and exam-formatted answers are unique to the VTU exam preparation workflow.
3. **Community-driven materials** — Students share and benefit from each other's uploads, creating a VTU-specific knowledge base.
4. **Zero cost to students** — Free tier LLM providers mean no subscription barrier. Important for Indian engineering students.

## Technical Risk Assessment

| Feature | Risk Level | Risk Description | Mitigation |
|---------|------------|------------------|------------|
| RAG Pipeline | **CRITICAL** | No infrastructure exists. Requires: PDF parsing, chunking, embeddings (free model), vector store, retrieval. All on serverless (Netlify Functions). | Start with simplest possible RAG: extract text, chunk naively, use free embedding API, store vectors in Supabase pgvector. Accept lower quality for Expo. |
| LLM Integration | **HIGH** | Near-zero budget. Free tier models (OpenRouter, NVIDIA) have rate limits, quality variance, and may go down. | Use multiple free providers as fallbacks. Cache common responses. Keep prompts efficient to minimize token usage. |
| PDF Parsing | **MEDIUM** | VTU question papers are often scanned images (not text PDFs). OCR adds complexity and cost. | For Expo demo, use only text-searchable PDFs. Mention OCR as future capability. Curate demo materials that are text-based. |
| Vector Storage | **MEDIUM** | Need persistent vector storage on serverless. Supabase pgvector is the obvious choice but adds setup complexity. | Supabase is already in the stack for auth. Adding pgvector extension is a known pattern. Fallback: store embeddings as JSON in Supabase tables with cosine similarity in application code. |
| Serverless Constraints | **MEDIUM** | Netlify Functions have 10s timeout (default), 50MB deploy size, cold starts. RAG pipeline may exceed timeout. | Optimize for speed: pre-process documents at upload time (not at query time). Keep retrieval fast. Consider background processing via Netlify Background Functions (15 min timeout). |

## Sources

- **Khanmigo**: Direct analysis of Khan Academy's Khanmigo product page and feature descriptions
- **ChatPDF**: Direct analysis of chatpdf.com features and pricing
- **Quizlet**: Direct analysis of quizlet.com features and AI capabilities
- **NotebookLM**: Known capabilities from Google's product documentation (fetch failed, based on prior knowledge — MEDIUM confidence)
- **Existing codebase**: Full analysis of StudyMode.tsx, ExamMode.tsx, Library.tsx, UploadDocs.tsx, Dashboard.tsx, vtuData.ts
- **VTU domain knowledge**: Understanding of VTU exam patterns, mark allocations, and student workflows

---
*Feature research for: AI-Powered Study Platform for VTU Engineering Students*
*Researched: 2026-03-15*
