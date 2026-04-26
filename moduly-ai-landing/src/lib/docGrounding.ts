/**
 * docGrounding.ts
 * ─────────────────────────────────────────────────────────
 * Document-Grounded Mode for Moduly AI
 *
 * - Preloaded demo documents (no file parsing at runtime)
 * - Fast keyword retrieval (no vector DB)
 * - Query result cache (last 10)
 * - Generates Groq-ready context string + source metadata
 * ─────────────────────────────────────────────────────────
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocChunk {
  readonly id: string;
  readonly text: string;
}

export interface GroundedDoc {
  readonly doc_id: string;
  readonly title: string;
  readonly type: 'notes' | 'pyqs' | 'concepts' | 'ppt';
  readonly subject: string;
  readonly chunks: ReadonlyArray<DocChunk>;
}

export interface RetrievedChunk {
  readonly docId: string;
  readonly docTitle: string;
  readonly chunkId: string;
  readonly text: string;
  readonly score: number;
}

export interface GroundingResult {
  readonly context: string;
  readonly sources: ReadonlyArray<{ docTitle: string; chunkId: string; score: number }>;
  readonly confidenceScore: number; // 0–100, static for demo
}

// ── Preloaded Demo Documents ───────────────────────────────────────────────

export const DEMO_DOCUMENTS: ReadonlyArray<GroundedDoc> = [
  {
    doc_id: 'demo-ml-notes',
    title: 'Machine Learning Fundamentals',
    type: 'notes',
    subject: 'machine-learning',
    chunks: [
      {
        id: 'ml-c1',
        text: 'Supervised Learning is a paradigm where the model is trained on labeled data. The algorithm learns a mapping function from input variables (X) to an output variable (Y). Common algorithms include Linear Regression (used for continuous outputs), Logistic Regression (used for binary classification), Support Vector Machines (SVM) which find the optimal hyperplane, and Random Forests which use an ensemble of decision trees to improve accuracy and prevent overfitting.',
      },
      {
        id: 'ml-c2',
        text: 'Unsupervised Learning involves training a model on data that does not have historical labels. The system tries to learn without a teacher by finding hidden structures or patterns in the data. Key algorithms include K-Means clustering (grouping data into k distinct clusters based on feature similarity), Hierarchical clustering (building a tree of clusters), and Principal Component Analysis (PCA) which is used for dimensionality reduction while preserving maximum variance.',
      },
      {
        id: 'ml-c3',
        text: 'Overfitting occurs when a machine learning model learns the training data too well, including the noise and outliers, resulting in poor performance on unseen test data. Underfitting happens when a model is too simple to capture the underlying trend of the data. Regularization techniques like L1 (Lasso) and L2 (Ridge) are commonly used to penalize complex models and prevent overfitting by adding a penalty term to the loss function.',
      }
    ],
  },
  {
    doc_id: 'demo-os-notes',
    title: 'Operating Systems Process Management',
    type: 'notes',
    subject: 'os',
    chunks: [
      {
        id: 'os-c1',
        text: 'A Process is a program in execution. It contains the program code (text section), current activity represented by the value of the program counter and the contents of the processor\'s registers. It also includes the process stack (temporary data like function parameters, return addresses) and a data section (global variables). Process Scheduling algorithms determine which process in the ready queue is to be allocated the CPU. FCFS is simple but suffers from the convoy effect. SJF minimizes average waiting time but requires knowing future CPU bursts.',
      },
      {
        id: 'os-c2',
        text: 'Deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process. Four necessary conditions for deadlock are: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Deadlock handling strategies include Prevention (invalidating one of the four conditions), Avoidance (using Banker\'s Algorithm to dynamically analyze resource allocation state), Detection, and Recovery.',
      },
      {
        id: 'os-c3',
        text: 'Virtual Memory is a technique that allows the execution of processes that are not completely in memory. It provides the illusion of a very large main memory. When a process tries to access a page that is mapped in the page table but not loaded in physical memory, a Page Fault occurs. The OS then handles this by loading the required page from the secondary storage (disk) into a free frame in physical memory.',
      }
    ],
  },
  {
    doc_id: 'demo-ds-pyqs',
    title: 'Data Structures PYQs (2021-2023)',
    type: 'pyqs',
    subject: 'data-structures',
    chunks: [
      {
        id: 'pyq-ds-1',
        text: 'College Dec 2023 (10 Marks): Explain the working of Dijkstra\'s shortest path algorithm with a suitable example. Answer: Dijkstra\'s algorithm solves the single-source shortest path problem for a directed graph with non-negative edge weights. It maintains a set of unvisited vertices and calculates the tentative distance from the source. It repeatedly selects the unvisited vertex with the smallest tentative distance, marks it as visited, and relaxes all of its outgoing edges by checking if the path through this vertex offers a shorter route. It utilizes a Min-Priority Queue for efficient vertex extraction, resulting in an O((V+E) log V) time complexity when implemented with a binary heap.',
      },
      {
        id: 'pyq-ds-2',
        text: 'College June 2022 (8 Marks): What is hashing? Explain any two collision resolution techniques. Answer: Hashing is the process of mapping a large amount of data to a smaller table using a hash function. A collision occurs when two keys map to the same index. Collision Resolution Techniques: 1) Chaining (Open Hashing): Each slot in the hash table points to a linked list of elements that hash to the same slot. 2) Linear Probing (Open Addressing): When a collision occurs, the algorithm linearly probes for the next empty slot in the table using the formula (h(k) + i) % n.',
      }
    ],
  },
  {
    doc_id: 'demo-cn-pyqs',
    title: 'Computer Networks PYQs (2021-2023)',
    type: 'pyqs',
    subject: 'computer-networks',
    chunks: [
      {
        id: 'pyq-cn-1',
        text: 'College Jan 2023 (8 Marks): Differentiate between TCP and UDP protocols. Answer: TCP (Transmission Control Protocol) is a connection-oriented, reliable protocol that guarantees in-order packet delivery. It uses a 3-way handshake (SYN, SYN-ACK, ACK) to establish a connection and incorporates flow control (sliding window) and congestion control mechanisms. UDP (User Datagram Protocol) is a connectionless, unreliable, and lightweight protocol. It does not establish a connection, offers no guarantees of delivery or ordering, and lacks flow/congestion control, making it much faster and suitable for real-time applications like VoIP and gaming.',
      },
      {
        id: 'pyq-cn-2',
        text: 'College July 2021 (10 Marks): Explain the functioning of the OSI Reference Model layers. Answer: The OSI model consists of 7 layers: 1) Physical: transmission of raw bit streams. 2) Data Link: Node-to-node data transfer and error detection (MAC addressing). 3) Network: Routing and IP addressing. 4) Transport: End-to-end communication and reliability (TCP/UDP). 5) Session: Establishes, manages, and terminates connections. 6) Presentation: Data formatting, encryption, and compression. 7) Application: Network applications interacting with the user (HTTP, FTP, SMTP).',
      }
    ],
  },
  {
    doc_id: 'demo-graph-handwritten',
    title: 'Handwritten Notes - Advanced Graph Algorithms',
    type: 'notes',
    subject: 'data-structures',
    chunks: [
      {
        id: 'hw-graph-1',
        text: '[Transcribed from Handwritten Notes] Minimum Spanning Tree (MST): A spanning tree of a connected, undirected graph is a subgraph that is a tree and includes all the vertices. An MST is a spanning tree with weight less than or equal to the weight of every other spanning tree. Kruskal\'s Algorithm is a greedy approach that sorts all edges in non-decreasing order of their weight and iteratively adds the smallest edge to the MST, provided it doesn\'t form a cycle (using a Disjoint-Set or Union-Find data structure).',
      },
      {
        id: 'hw-graph-2',
        text: '[Transcribed from Handwritten Notes] Prim\'s Algorithm for MST: Unlike Kruskal\'s which builds a forest, Prim\'s algorithm starts with a single source vertex and continuously grows a single tree. At each step, it adds the cheapest edge that connects a vertex in the MST to a vertex outside the MST. This is efficiently implemented using a Min-Priority Queue to track the minimum weight edges connecting the tree to the unvisited vertices. Both Kruskal\'s and Prim\'s run in O(E log V) time.',
      }
    ],
  }
];

// ── Keyword Extraction ─────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'of', 'to', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'through',
  'during', 'what', 'which', 'who', 'when', 'where', 'how', 'why',
  'explain', 'describe', 'define', 'give', 'write', 'state', 'list',
  'and', 'or', 'but', 'if', 'then', 'that', 'this', 'it', 'its',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'their',
]);

export function extractKeywords(query: string): ReadonlyArray<string> {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ── Chunk Scorer ───────────────────────────────────────────────────────────

function scoreChunk(keywords: ReadonlyArray<string>, chunk: DocChunk): number {
  const lowerText = chunk.text.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    // Exact word match (higher weight)
    const exactRe = new RegExp(`\\b${kw}\\b`, 'g');
    const exactMatches = (lowerText.match(exactRe) ?? []).length;
    score += exactMatches * 3;

    // Partial / substring match (lower weight)
    if (exactMatches === 0 && lowerText.includes(kw)) {
      score += 1;
    }
  }

  return score;
}

// ── Retrieval Engine ───────────────────────────────────────────────────────

const TOP_K = 4;
export const UTHO_DOCUMENTS: Array<GroundedDoc> = [];

export async function loadUthoDoc(docId: string): Promise<boolean> {
  if (UTHO_DOCUMENTS.find(d => d.doc_id === docId)) return true;
  if (!docId.startsWith('utho-')) return false;

  const filename = docId.replace('utho-', '');
  const jsonKey = `parsed/${filename}.json`;

  try {
    const backendBase = import.meta.env.VITE_BACKEND_URL || '';
    const res = await fetch(`${backendBase}/get-view-url?filename=${encodeURIComponent(jsonKey)}`);
    if (!res.ok) return false;
    
    const { url } = await res.json();
    const jsonRes = await fetch(url);
    if (!jsonRes.ok) return false;

    const data = await jsonRes.json();
    UTHO_DOCUMENTS.push({
      doc_id: docId,
      title: data.metadata?.title || filename,
      type: data.metadata?.type || 'notes',
      subject: data.metadata?.subject || 'general',
      chunks: data.chunks || []
    });
    return true;
  } catch (e) {
    console.error(`Failed to load Utho doc: ${docId}`, e);
    return false;
  }
}

export function retrieveChunks(
  query: string,
  selectedDocIds: ReadonlyArray<string>,
): ReadonlyArray<RetrievedChunk> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const targetDocs = [
    ...DEMO_DOCUMENTS.filter(d => selectedDocIds.includes(d.doc_id)),
    ...UTHO_DOCUMENTS.filter(d => selectedDocIds.includes(d.doc_id))
  ];
  if (targetDocs.length === 0) return [];

  const scored: Array<RetrievedChunk> = [];

  for (const doc of targetDocs) {
    for (const chunk of doc.chunks) {
      const score = scoreChunk(keywords, chunk);
      if (score > 0) {
        scored.push({
          docId: doc.doc_id,
          docTitle: doc.title,
          chunkId: chunk.id,
          text: chunk.text,
          score,
        });
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

// ── Prompt Builder ─────────────────────────────────────────────────────────

export function buildGroundedContext(chunks: ReadonlyArray<RetrievedChunk>): GroundingResult {
  if (chunks.length === 0) {
    return {
      context: '',
      sources: [],
      confidenceScore: 0,
    };
  }

  const contextParts = chunks.map(
    (c, i) => `[Source ${i + 1} — ${c.docTitle}]\n${c.text}`,
  );

  const context =
    'You are Moduly AI. You MUST answer ONLY from the context below. ' +
    'Do NOT use your general knowledge. ' +
    'If the answer is not found in the context, respond with exactly: ' +
    '"Not found in selected documents."\n\n' +
    'CONTEXT:\n---\n' +
    contextParts.join('\n\n') +
    '\n---';

  const sources = chunks.map(c => ({
    docTitle: c.docTitle,
    chunkId: c.chunkId,
    score: c.score,
  }));

  // Static confidence for demo: scale with max score found
  const maxScore = chunks[0]?.score ?? 0;
  const confidenceScore = Math.min(95, 60 + Math.round(maxScore * 5));

  return { context, sources, confidenceScore };
}

// ── Query Result Cache (LRU-lite, last 10) ─────────────────────────────────

interface CacheEntry {
  readonly response: string;
  readonly sources: ReadonlyArray<{ docTitle: string; chunkId: string; score: number }>;
  readonly confidenceScore: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_MAX = 10;

export function getCachedResult(key: string): CacheEntry | undefined {
  return queryCache.get(key);
}

export function setCachedResult(key: string, entry: CacheEntry): void {
  if (queryCache.size >= CACHE_MAX) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey !== undefined) queryCache.delete(firstKey);
  }
  queryCache.set(key, entry);
}

export function makeCacheKey(query: string, docIds: ReadonlyArray<string>): string {
  return `${query.trim().toLowerCase()}|${[...docIds].sort().join(',')}`;
}
