# Phase 4 Research: Study Mode Enhancement

## What We're Building

Phase 4 adds VTU curriculum awareness and polishes the already-partially-implemented document selection and mark calibration features. The three requirements are:

- **STUDY-03**: User can select which uploaded documents the AI should reference (Study Kit), and only chunks from those documents are used in RAG retrieval
- **STUDY-04**: User can specify mark allocation (2M, 5M, 8M, 10M) and AI calibrates answer depth and length to match VTU exam expectations
- **STUDY-05**: System prompts include VTU syllabus details (module topics, exam pattern) for at least 2-3 demo subjects so AI demonstrates curriculum awareness

---

## Gap Analysis: What's Already Done vs. What's Missing

### STUDY-03 (Document Selection → RAG Filtering) — ~90% Done

**What already works (Phase 3):**
- `StudyMode.tsx` has checkboxes to select/deselect each document (`toggleDoc`)
- `sendMessage` extracts `selectedDocIds = docs.filter(d => d.selected).map(d => d.id)` and passes to `/chat`
- `chat.mts` accepts `documentIds` and passes `filter_document_ids` to `match_documents_filtered` RPC
- The RPC itself correctly filters by document IDs (Migration 006)

**What's missing / to polish:**
- The `+ Add` button in the sidebar just shows an `alert()` placeholder — should navigate to UploadDocs page
- No visual feedback when zero documents are selected (the RAG call succeeds but returns no chunks; the fallback message in the prompt handles it, but UX could be clearer)
- Minor: no "Select All / Deselect All" shortcut

**Decision**: STUDY-03 is functionally complete. Plan 04-01 will add the `+ Add` navigation fix, "select all/none" toggle, and a zero-docs-selected guard. No new backend work needed.

---

### STUDY-04 (Mark Calibration) — ~85% Done

**What already works (Phase 3):**
- `MARKS = ['2M', '8M', '10M']` selector in header
- `selectedMark` passed to `/chat` as `mark`
- `buildSystemPrompt` in `chat.mts` generates mark instruction:
  - "shorter for 2M, detailed with examples for 10M"

**What's missing:**
- `5M` is absent from `MARKS` — STUDY-04 explicitly requires `2M, 5M, 8M, 10M`
- The mark instruction doesn't have explicit guidance for `5M` ("medium length, one example") or `8M` (it's implied but not explicit)
- No visual chip update when mark changes (the violet chip in the footer already shows selected mark — this is fine as-is)

**Decision**: Plan 04-01 adds `5M` to the MARKS array and improves the `buildSystemPrompt` mark instruction for all four marks with explicit calibration text.

---

### STUDY-05 (VTU Curriculum Awareness) — 0% Done

**What's missing:**
- `INITIAL_TOPICS` in `StudyMode.tsx` is still placeholder DS&A topics (AVL Trees, BFS, DFS, Graph Traversal) — no real VTU curriculum
- `buildSystemPrompt` in `chat.mts` is generic — no subject-specific module topics
- `subjectId` is accepted in `chat.mts` but never wired in the `StudyMode.tsx` UI
- No VTU syllabus data anywhere in the codebase

**This is the primary new work for Phase 4.**

---

## Architecture Decision: How to Implement VTU Curriculum Awareness

### Option A: Subject selector + server-side syllabus lookup
Add a subject dropdown in the UI, pass `subjectId` to `/chat`, and have the function load a hardcoded subject syllabus map and inject module topics into the system prompt.

**Pros**: Clean separation, works with existing `subjectId` field in `ChatRequest`
**Cons**: More complex state management, requires subject selection UX

### Option B: Hardcode 2-3 subject profiles directly in `buildSystemPrompt`
Add a `subjectProfile` object in `chat.mts` keyed by known `subjectId` strings (e.g. `'data-structures'`, `'computer-networks'`, `'dbms'`). When `subjectId` matches, inject that subject's VTU module topics and exam pattern into the system prompt.

**Pros**: Simple, no new DB tables, demo-ready
**Cons**: Subject coverage limited to hardcoded subjects

### Option C: Subject selector drives INITIAL_TOPICS in the frontend only
Show a subject dropdown that replaces `INITIAL_TOPICS` with real VTU module topics for the selected subject. The topics appear as quick-select chips. Send the subject name (not ID) as context in the message or as a `subjectId`.

**Pros**: Purely frontend, no backend changes, visible demo value
**Cons**: Topics are only for UX — doesn't affect the system prompt's curriculum knowledge

### Decision: **Option A + B hybrid**

Use Option B for the backend (add subject profile map in `chat.mts`) and Option A's UI pattern (subject selector in the sidebar that sets `subjectId` state and sends it to `/chat`). This:
1. Wires up the already-present `subjectId` field in the API
2. Injects real VTU module topics into the system prompt
3. Replaces the placeholder `INITIAL_TOPICS` with subject-specific real topics in the sidebar
4. Delivers visible, demo-ready VTU awareness for 3 subjects

---

## VTU Subject Selection for Demo

Targeting 3 subjects that are common across CS/ECE/IS programs at VTU:

### Subject 1: Data Structures and Algorithms (BCS301/BCS201)
VTU Module breakdown (21CS301/BCS301):
- Module 1: Introduction to algorithms, Arrays, Stacks, Queues
- Module 2: Linked Lists (SLL, DLL, CLL)
- Module 3: Trees (BST, AVL, B-Trees, Heaps)
- Module 4: Sorting (Bubble, Selection, Insertion, Quick, Merge)
- Module 5: Graphs (BFS, DFS, Spanning Trees, Shortest Path)

Exam pattern: 5 modules, choose 1 of 2 questions per module (2×5M or 1×10M), plus short-answer 2M/3M questions.

### Subject 2: Computer Networks (21CS52/BCS502)
VTU Module breakdown:
- Module 1: Introduction, OSI model, TCP/IP model, Data link layer
- Module 2: MAC sublayer, LAN protocols (CSMA/CD, CSMA/CA)
- Module 3: Network layer, IP addressing, Routing algorithms
- Module 4: Transport layer, TCP, UDP, flow control
- Module 5: Application layer, HTTP, DNS, SMTP, FTP

Exam pattern: Same VTU 5-module pattern. TCP/IP stack questions are high frequency.

### Subject 3: Database Management Systems (21CS42/BCS401)
VTU Module breakdown:
- Module 1: ER model, relational model, relational algebra
- Module 2: SQL (DDL, DML, views, constraints)
- Module 3: Normalization (1NF, 2NF, 3NF, BCNF)
- Module 4: Transactions, ACID properties, concurrency control
- Module 5: File organization, indexing, B+ trees

Exam pattern: Normalization and SQL are consistently highest-frequency topics.

---

## Implementation Design: chat.mts Changes

### Subject Profile Map

```typescript
type SubjectProfile = {
  readonly name: string;
  readonly modules: ReadonlyArray<string>;
  readonly examPattern: string;
  readonly highFrequencyTopics: ReadonlyArray<string>;
};

const SUBJECT_PROFILES: Readonly<Record<string, SubjectProfile>> = {
  'data-structures': {
    name: 'Data Structures and Algorithms',
    modules: [
      'Module 1: Arrays, Stacks, Queues, Algorithm complexity',
      'Module 2: Linked Lists (SLL, DLL, Circular)',
      'Module 3: Trees (BST, AVL, B-Trees, Heaps)',
      'Module 4: Sorting algorithms (Bubble, Quick, Merge, Heap)',
      'Module 5: Graphs (BFS, DFS, Prim, Kruskal, Dijkstra)',
    ],
    examPattern: 'VTU pattern: 5 modules, 2 questions per module (answer 1), mix of 5M and 10M questions',
    highFrequencyTopics: ['AVL tree rotations', 'BFS/DFS traversal', 'Sorting complexity', 'Dijkstra algorithm'],
  },
  'computer-networks': { ... },
  'dbms': { ... },
};
```

### Modified buildSystemPrompt

Add a `subjectId` parameter. When a matching profile exists, append a curriculum section:

```
VTU Curriculum Context for [Subject Name]:
Modules: [list]
Exam Pattern: [pattern]
High-Frequency Topics: [list]
```

---

## Implementation Design: StudyMode.tsx Changes

### Subject Selector

Add to the sidebar (below Source Docs, above Active Topics):

```tsx
<section className="sm-section">
  <span className="sm-label">Subject</span>
  <select className="sm-subject-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
    <option value="">General (no subject)</option>
    <option value="data-structures">Data Structures & Algorithms</option>
    <option value="computer-networks">Computer Networks</option>
    <option value="dbms">Database Management Systems</option>
  </select>
</section>
```

### Dynamic INITIAL_TOPICS

Replace `INITIAL_TOPICS` constant with a `getTopicsForSubject(subjectId)` function that returns relevant topics for the selected subject, defaulting to generic ones if no subject is selected.

When `subjectId` changes, reset topics to the subject's topic set.

### sendMessage Update

Pass `subjectId` to `chatWithAI` (and thence to `/chat`):
```typescript
const response = await chatWithAI(text, selectedDocIds, selectedMark, strict, subjectId || undefined, history);
```

---

## Plan Split Decision

The ROADMAP specifies 2 plans for Phase 4:
- `04-01`: Study Kit document selection and RAG filtering
- `04-02`: Mark-based prompt engineering and VTU system prompts

Given that STUDY-03 and STUDY-04 are mostly done (just polish), and STUDY-05 is the primary work, the split is:

**Plan 04-01** (quick): Polish STUDY-03 + STUDY-04 gaps
- Add `5M` to MARKS
- Improve mark instruction text in `buildSystemPrompt` for all 4 marks
- Fix `+ Add` button → navigate to UploadDocs
- Add "Select All / None" toggle to document list
- Zero-docs-selected guard (show warning chip)
- Estimated: ~15 minutes

**Plan 04-02** (main work): STUDY-05 VTU curriculum awareness
- Add `SUBJECT_PROFILES` map to `chat.mts`
- Extend `buildSystemPrompt` with `subjectId` parameter and curriculum injection
- Add subject selector UI to `StudyMode.tsx` sidebar
- Replace `INITIAL_TOPICS` with dynamic subject topics
- Wire `subjectId` through `chatWithAI` to `/chat`
- Estimated: ~25 minutes

---

## TypeScript Considerations

- `chat.mts` uses `tsconfig.functions.json` (Node types, verbatimModuleSyntax: true, strict: true)
- `StudyMode.tsx` uses `tsconfig.app.json` (DOM types, verbatimModuleSyntax: true, strict: true)
- `import type` required for type-only imports
- No new dependencies needed — all changes are pure TypeScript/logic
- `npx tsc -b --noEmit` after each plan to verify

---

## No New Tests Needed

Phase 3 set the precedent: no new test files for frontend/function integration work. The 34 existing tests remain the safety net. If `buildSystemPrompt` logic becomes complex enough, a unit test could be added, but given the simplicity of string concatenation it's not warranted.

---
*Research completed: 2026-03-16*
