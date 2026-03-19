import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';
import { getEmbedding } from '../../src/lib/ai/embedding.ts';
import { chatCompletion } from '../../src/lib/ai/llm.ts';
import type { ChatMessage, ChatRequest, RagChunk } from '../../src/lib/ai/types.ts';

type HandlerEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

const MAX_HISTORY_MESSAGES = 10;
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const RAG_MATCH_COUNT = 5;
const RAG_THRESHOLD = 0.5;

const MARK_INSTRUCTIONS: Readonly<Record<string, string>> = {
  '2M': 'The student needs a 2-mark answer. Write 2–3 concise sentences covering only the core definition or fact. No examples or elaboration needed.',
  '5M': 'The student needs a 5-mark answer. Write a focused explanation of 1–2 paragraphs covering the concept with one concrete example or diagram description. Avoid over-explaining.',
  '8M': 'The student needs an 8-mark answer. Write a structured answer with a brief introduction, main explanation covering key sub-points (use numbered lists or sub-headings), one or two illustrative examples, and a short conclusion.',
  '10M': 'The student needs a 10-mark answer. Write a comprehensive essay-style answer with an introduction, thorough coverage of all sub-topics (use clear headings and numbered steps), multiple examples with diagrams described in text, a comparison table if applicable, and a conclusion summarising key takeaways.',
};

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
      'Module 1: Arrays, Stacks, and Queues',
      'Module 2: Linked Lists (Singly, Doubly, Circular)',
      'Module 3: Trees (Binary Trees, BST, AVL Trees)',
      'Module 4: Graphs (BFS, DFS, Spanning Trees)',
      'Module 5: Sorting and Searching Algorithms',
    ],
    examPattern: 'VTU exam has 5 modules. Each module has two questions; student answers one. Questions are typically 10M or 8M. Definitions and algorithms carry 2–3 marks each.',
    highFrequencyTopics: [
      'AVL Tree rotations and insertion',
      'BFS and DFS traversal with examples',
      'Dijkstra\'s shortest path algorithm',
      'Heap sort and merge sort',
      'B-Tree and B+ Tree operations',
      'Hashing techniques and collision resolution',
    ],
  },
  'computer-networks': {
    name: 'Computer Networks',
    modules: [
      'Module 1: Introduction to Networks, OSI and TCP/IP Models',
      'Module 2: Data Link Layer — Framing, Error Control, Flow Control',
      'Module 3: Network Layer — IP Addressing, Routing Algorithms',
      'Module 4: Transport Layer — TCP, UDP, Congestion Control',
      'Module 5: Application Layer — DNS, HTTP, SMTP, FTP',
    ],
    examPattern: 'VTU exam has 5 modules. Each module has two questions; student answers one. Numerical problems on subnetting and routing carry 5–8 marks.',
    highFrequencyTopics: [
      'OSI model layers and functions',
      'TCP vs UDP comparison',
      'IP subnetting and CIDR',
      'Sliding window protocol',
      'Routing algorithms (Dijkstra, Bellman-Ford)',
      'DNS resolution process',
      'Three-way TCP handshake',
    ],
  },
  'dbms': {
    name: 'Database Management Systems',
    modules: [
      'Module 1: Introduction to DBMS, ER Model, Relational Model',
      'Module 2: Relational Algebra and SQL',
      'Module 3: Normalisation (1NF, 2NF, 3NF, BCNF)',
      'Module 4: Transactions, Concurrency Control, Recovery',
      'Module 5: Indexing, File Organisation, Query Processing',
    ],
    examPattern: 'VTU exam has 5 modules. Each module has two questions; student answers one. SQL queries and normalisation steps are common for 8–10 marks.',
    highFrequencyTopics: [
      'ER diagram to relational schema conversion',
      'SQL joins and subqueries',
      'Normalisation up to BCNF with examples',
      'ACID properties of transactions',
      'Two-phase locking protocol',
      'B+ Tree indexing',
      'Deadlock detection and prevention',
    ],
  },
};

const sanitizeError = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'AI is temporarily busy. Please try again in a moment.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The AI took too long to respond. Please try again.';
  }
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('all llm providers failed')
  ) {
    return 'AI service is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
};

const DEMO_CACHE: ReadonlyMap<string, string> = new Map([
  [
    'explain avl tree rotations',
    '**AVL Tree Rotations** are self-balancing operations performed when a Binary Search Tree becomes unbalanced after insertion or deletion.\n\n**Balance Factor** = Height(Left Subtree) − Height(Right Subtree). A node is balanced if its balance factor is −1, 0, or +1.\n\n## Four Rotation Types\n\n**1. Right Rotation (LL Case)**\nOccurs when a node is inserted into the left subtree of the left child.\n- Pivot the unbalanced node down-right; its left child becomes the new root.\n\n**2. Left Rotation (RR Case)**\nOccurs when a node is inserted into the right subtree of the right child.\n- Pivot the unbalanced node down-left; its right child becomes the new root.\n\n**3. Left-Right Rotation (LR Case)**\nLeft rotate the left child first, then right rotate the unbalanced node.\n\n**4. Right-Left Rotation (RL Case)**\nRight rotate the right child first, then left rotate the unbalanced node.\n\n## Time Complexity\n- Each rotation is **O(1)**\n- Insertion with rebalancing: **O(log n)**\n- AVL trees guarantee **O(log n)** for search, insert, and delete.',
  ],
  [
    'explain the osi model layers',
    'The **OSI (Open Systems Interconnection) Model** is a conceptual framework that standardises network communication into **7 layers**.\n\n| Layer | Name | Key Function | Protocols |\n|-------|------|-------------|----------|\n| 7 | **Application** | User-facing services | HTTP, FTP, SMTP, DNS |\n| 6 | **Presentation** | Data translation & encryption | SSL/TLS, JPEG |\n| 5 | **Session** | Session management | NetBIOS, RPC |\n| 4 | **Transport** | End-to-end delivery | TCP, UDP |\n| 3 | **Network** | Logical addressing & routing | IP, ICMP |\n| 2 | **Data Link** | Physical addressing (MAC) | Ethernet, Wi-Fi |\n| 1 | **Physical** | Bit transmission | Cables, Hubs |\n\n**Mnemonic**: *All People Seem To Need Data Processing* (top to bottom)\n\n**Key VTU Points**:\n- TCP/IP model has 4 layers (Application, Transport, Internet, Network Access)\n- Transport layer provides **reliability** via TCP\'s 3-way handshake\n- Network layer uses **IP addresses**; Data Link uses **MAC addresses**',
  ],
  [
    'what is normalisation in dbms',
    '**Normalisation** is the process of organising a relational database to reduce **data redundancy** and improve **data integrity**.\n\n## Normal Forms\n\n**1NF (First Normal Form)**\n- Every column must contain **atomic** (indivisible) values\n- No repeating groups or arrays\n\n**2NF (Second Normal Form)**\n- Must be in 1NF\n- Every non-key attribute must be **fully functionally dependent** on the entire primary key\n- Eliminates *partial dependencies*\n\n**3NF (Third Normal Form)**\n- Must be in 2NF\n- No **transitive dependencies** (non-key attribute depending on another non-key attribute)\n\n**BCNF (Boyce-Codd Normal Form)**\n- Stricter version of 3NF\n- For every functional dependency A → B, A must be a **superkey**\n\n## Benefits\n- Eliminates insertion, deletion, and update anomalies\n- Reduces storage space\n- Improves query performance\n\n## Trade-off\nOver-normalisation can lead to excessive JOINs. Denormalisation is sometimes used for read-heavy applications.',
  ],
  [
    'explain bfs and dfs with example',
    '**BFS (Breadth-First Search)** and **DFS (Depth-First Search)** are fundamental graph traversal algorithms.\n\n## BFS — Breadth-First Search\n**Strategy**: Explore all neighbours at the current depth before moving deeper.\n**Data Structure**: Queue (FIFO)\n\n**Algorithm**:\n1. Enqueue the start node; mark it visited\n2. Dequeue a node; visit it\n3. Enqueue all unvisited neighbours\n4. Repeat until queue is empty\n\n**Example** (Graph: A-B, A-C, B-D, C-D):\n- Start A → Queue: [B, C] → Visit B → Queue: [C, D] → Visit C → Visit D\n- **BFS Order**: A, B, C, D\n\n**Applications**: Shortest path in unweighted graphs, level-order traversal\n\n## DFS — Depth-First Search\n**Strategy**: Explore as far as possible along each branch before backtracking.\n**Data Structure**: Stack (or recursion)\n\n**Algorithm**:\n1. Push start node; mark visited\n2. Pop a node; visit it\n3. Push all unvisited neighbours\n4. Repeat until stack is empty\n\n**DFS Order** (same graph): A, B, D, C\n\n**Applications**: Cycle detection, topological sort, connected components\n\n## Complexity\n| | Time | Space |\n|--|------|-------|\n| BFS | O(V+E) | O(V) |\n| DFS | O(V+E) | O(V) |',
  ],
  [
    'explain acid properties',
    '**ACID** properties guarantee reliable database transactions.\n\n## A — Atomicity\n- A transaction is treated as a **single unit** — either ALL operations succeed, or NONE do.\n- **Example**: Bank transfer — debit and credit must both succeed or both be rolled back.\n- Implemented via **rollback** mechanisms.\n\n## C — Consistency\n- A transaction brings the database from one **valid state** to another valid state.\n- All integrity constraints (primary keys, foreign keys, domain constraints) must be satisfied.\n\n## I — Isolation\n- Concurrent transactions execute as if they were **serial** (one after the other).\n- Prevents dirty reads, non-repeatable reads, and phantom reads.\n- Implemented via **locking** or **MVCC** (Multi-Version Concurrency Control).\n\n## D — Durability\n- Once a transaction is **committed**, it persists even in case of system failure.\n- Implemented via **write-ahead logging (WAL)** and database recovery mechanisms.\n\n## VTU Exam Tip\nACID is almost always a 5–8 mark question. Memorise the full form, definition, and one example per property. Mention that NoSQL databases sometimes sacrifice ACID for scalability (BASE model).',
  ],
]);

const jsonResponse = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const buildSystemPrompt = (
  chunks: ReadonlyArray<RagChunk>,
  mark?: string,
  strict?: boolean,
  subjectId?: string,
): string => {
  const markInstruction = mark && MARK_INSTRUCTIONS[mark]
    ? `\n${MARK_INSTRUCTIONS[mark]}`
    : '';

  const strictInstruction = strict
    ? '\nIMPORTANT: Only use information from the provided context. Do not use general knowledge. If the context does not contain relevant information, say so clearly.'
    : '\nUse the provided context as primary source, but you may supplement with general knowledge if helpful. Clearly indicate when you are going beyond the provided materials.';

  const profile = subjectId ? SUBJECT_PROFILES[subjectId] : undefined;
  const curriculumSection = profile
    ? (
      `\n\nSubject: ${profile.name}\n` +
      `VTU Curriculum Modules:\n${profile.modules.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}\n` +
      `Exam Pattern: ${profile.examPattern}\n` +
      `High-Frequency Exam Topics: ${profile.highFrequencyTopics.join(', ')}.`
    )
    : '';

  const contextSection = chunks.length > 0
    ? `\n\nContext from student's study materials:\n---\n${chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join('\n\n')}\n---`
    : '\n\nNo relevant study materials were found for this question. Respond using your general knowledge and let the student know that no matching documents were found in their uploaded materials.';

  return (
    'You are Moduly AI, an intelligent study assistant for VTU (Visvesvaraya Technological University) students in India. ' +
    'Your role is to help students understand concepts, prepare for exams, and learn effectively from their uploaded study materials. ' +
    'Format your answers clearly using markdown: use **bold** for key terms, numbered lists for steps, and organize information with clear structure. ' +
    'Be encouraging and pedagogical — explain concepts thoroughly but accessibly.' +
    markInstruction +
    strictInstruction +
    curriculumSection +
    contextSection
  );
};

const buildMessagesArray = (
  systemPrompt: string,
  history: ChatRequest['history'],
  userMessage: string,
): ReadonlyArray<ChatMessage> => {
  const systemMsg: ChatMessage = { role: 'system', content: systemPrompt };
  const userMsg: ChatMessage = { role: 'user', content: userMessage };

  if (!history || history.length === 0) {
    return [systemMsg, userMsg];
  }

  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);
  const historyMsgs: ReadonlyArray<ChatMessage> = trimmedHistory.map((h) => ({
    role: h.role,
    content: h.content,
  }));

  return [systemMsg, ...historyMsgs, userMsg];
};

export const handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const message = body['message'];

    if (typeof message !== 'string' || message.trim().length === 0) {
      return jsonResponse(400, { error: 'Missing or empty "message" field' });
    }

    const request: ChatRequest = {
      message: message.trim(),
      documentIds: Array.isArray(body['documentIds']) ? body['documentIds'] as ReadonlyArray<string> : undefined,
      subjectId: typeof body['subjectId'] === 'string' ? body['subjectId'] : undefined,
      mark: typeof body['mark'] === 'string' ? body['mark'] : undefined,
      strict: typeof body['strict'] === 'boolean' ? body['strict'] : undefined,
      history: Array.isArray(body['history']) ? (body['history'] as ChatRequest['history'])?.slice(-MAX_HISTORY_MESSAGES) : undefined,
    };

    const queryEmbedding = await getEmbedding(request.message);

    const supabase = createServerSupabaseClient();
    const { data: chunks, error: ragError } = await supabase.rpc('match_documents_filtered', {
      query_embedding: queryEmbedding,
      filter_document_ids: request.documentIds ?? null,
      filter_subject_id: request.subjectId ?? null,
      match_threshold: RAG_THRESHOLD,
      match_count: RAG_MATCH_COUNT,
    });

    if (ragError) {
      console.error('RAG retrieval error:', ragError);
    }

    const ragChunks: ReadonlyArray<RagChunk> = (chunks ?? []) as ReadonlyArray<RagChunk>;

    const systemPrompt = buildSystemPrompt(ragChunks, request.mark, request.strict, request.subjectId);
    const messages = buildMessagesArray(systemPrompt, request.history, request.message);

    let responseText: string;
    try {
      const llmResult = await chatCompletion({
        model: DEFAULT_MODEL,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 2048,
      });
      if (typeof llmResult !== 'string') {
        throw new Error('LLM returned a stream instead of a string');
      }
      responseText = llmResult;
    } catch (llmErr: unknown) {
      const cacheKey = request.message.trim().toLowerCase();
      const cached = DEMO_CACHE.get(cacheKey);
      if (cached !== undefined) {
        console.warn('LLM failed — serving cached demo response for key:', cacheKey);
        return jsonResponse(200, { response: cached, sources: [], cached: true });
      }
      throw llmErr;
    }

    const sources = ragChunks.map((c) => ({
      documentId: c.document_id,
      content: c.content.slice(0, 200),
      similarity: c.similarity,
    }));

    return jsonResponse(200, {
      response: responseText,
      sources,
    });
  } catch (err: unknown) {
    console.error('Chat function error:', err);
    const raw = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, { error: sanitizeError(raw) });
  }
};
