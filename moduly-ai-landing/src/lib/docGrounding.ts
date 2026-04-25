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
    doc_id: 'demo-ds-notes',
    title: 'Data Structures Notes',
    type: 'notes',
    subject: 'data-structures',
    chunks: [
      {
        id: 'ds-c1',
        text: 'An AVL tree is a self-balancing Binary Search Tree (BST). The balance factor of every node must be -1, 0, or +1. If after insertion or deletion the balance factor violates this, rotations are performed to restore balance.',
      },
      {
        id: 'ds-c2',
        text: 'AVL Tree Rotations: (1) Right Rotation (LL case) – applied when imbalance is in the left subtree of the left child. (2) Left Rotation (RR case) – applied when imbalance is in the right subtree of the right child. (3) Left-Right (LR) – left rotate child, then right rotate root. (4) Right-Left (RL) – right rotate child, then left rotate root. All rotations are O(1).',
      },
      {
        id: 'ds-c3',
        text: 'BFS (Breadth-First Search) explores nodes level by level using a Queue. DFS (Depth-First Search) explores as far as possible down each branch before backtracking, using a Stack or recursion. Both have time complexity O(V+E) and space complexity O(V).',
      },
      {
        id: 'ds-c4',
        text: 'Heap Sort uses a Binary Max-Heap. Steps: (1) Build a max-heap from the input array. (2) Repeatedly extract the maximum (swap root with last element, reduce heap size, heapify). Time: O(n log n), Space: O(1). Not stable.',
      },
      {
        id: 'ds-c5',
        text: 'Hashing maps keys to indices using a hash function. Collision resolution: Open Addressing (linear probing, quadratic probing, double hashing) and Chaining (linked lists at each bucket). Average case O(1) for insert, search, delete.',
      },
      {
        id: 'ds-c6',
        text: 'A Binary Search Tree (BST) stores elements such that for each node, left subtree contains smaller values and right subtree contains larger values. Insertion, search, and deletion are O(h) where h is the height. Worst case O(n) for skewed trees.',
      },
      {
        id: 'ds-c7',
        text: 'Dijkstra\'s algorithm finds the shortest path from a source node to all other nodes in a weighted graph with non-negative edges. Uses a min-priority queue. Time complexity O((V+E) log V) with a binary heap.',
      },
      {
        id: 'ds-c8',
        text: 'B-Trees and B+ Trees are balanced multi-way search trees used in databases and file systems. B+ Trees store all data in leaf nodes and have linked leaf nodes for range queries. Order m B-Tree has at most m children and at least ⌈m/2⌉ children per internal node.',
      },
    ],
  },
  {
    doc_id: 'demo-ds-pyqs',
    title: 'Data Structures PYQs',
    type: 'pyqs',
    subject: 'data-structures',
    chunks: [
      {
        id: 'pyq-ds-1',
        text: 'VTU Dec 2023 – 10M: Construct an AVL tree by inserting the following elements in order: 10, 20, 30, 40, 50, 25. Show all rotations. Answer: Insert 10 (root). Insert 20 (right child). Insert 30 – RR imbalance at 10 → Left rotation → 20 becomes root, 10 left, 30 right. Insert 40 – right child of 30. Insert 50 – RR imbalance at 30 → Left rotation → 30 becomes left of 40. Insert 25 – RL imbalance at 20 → Right-Left rotation.',
      },
      {
        id: 'pyq-ds-2',
        text: 'VTU June 2023 – 8M: With a suitable example, explain BFS and DFS graph traversal. Key points: BFS uses Queue, visits level by level, finds shortest path in unweighted graphs. DFS uses Stack/recursion, finds connected components, detects cycles. Example: Graph {A-B, A-C, B-D, C-D, D-E}. BFS from A: A, B, C, D, E. DFS from A: A, B, D, C, E (stack order).',
      },
      {
        id: 'pyq-ds-3',
        text: 'VTU Dec 2022 – 10M: Explain Dijkstra\'s shortest path algorithm with example. Consider graph with vertices {A,B,C,D,E} and edges with weights. Initialize dist[source]=0, all others=∞. Greedily pick minimum distance vertex, relax its neighbours. Show step-by-step table with distance updates.',
      },
      {
        id: 'pyq-ds-4',
        text: 'VTU June 2022 – 8M: What is hashing? Explain collision resolution techniques with examples. Linear probing: probe next slot (h(k)+i)%n. Quadratic probing: (h(k)+i²)%n. Double hashing: (h1(k)+i*h2(k))%n. Chaining: each slot is a linked list – handles unlimited collisions.',
      },
    ],
  },
  {
    doc_id: 'demo-cn-notes',
    title: 'Computer Networks Notes',
    type: 'notes',
    subject: 'computer-networks',
    chunks: [
      {
        id: 'cn-c1',
        text: 'The OSI Model has 7 layers: Physical (Layer 1) – bit transmission; Data Link (Layer 2) – framing, MAC addressing, error detection; Network (Layer 3) – IP addressing, routing; Transport (Layer 4) – TCP/UDP, end-to-end delivery; Session (Layer 5) – session management; Presentation (Layer 6) – encryption, compression; Application (Layer 7) – HTTP, FTP, SMTP.',
      },
      {
        id: 'cn-c2',
        text: 'TCP (Transmission Control Protocol) is connection-oriented, reliable, uses 3-way handshake (SYN, SYN-ACK, ACK), provides flow control (sliding window), congestion control, and ordered delivery. UDP (User Datagram Protocol) is connectionless, unreliable, no handshake, fast, used for streaming, DNS, gaming.',
      },
      {
        id: 'cn-c3',
        text: 'IP Subnetting: Given an IP address and subnet mask, the network address is obtained by ANDing them. CIDR notation: 192.168.1.0/24 means 24 bits for network, 8 bits for host (256 addresses, 254 usable). Subnetting divides a network into smaller sub-networks to reduce broadcast domains.',
      },
      {
        id: 'cn-c4',
        text: 'DNS (Domain Name System) resolves domain names to IP addresses. Process: Browser checks cache → OS cache → Recursive Resolver → Root Name Server → TLD Name Server → Authoritative Name Server → returns IP. Uses UDP port 53 for queries, TCP for zone transfers.',
      },
      {
        id: 'cn-c5',
        text: 'Routing algorithms: (1) Dijkstra\'s (Link State) – each router knows full topology, computes shortest path. (2) Bellman-Ford (Distance Vector) – routers share distance tables with neighbours, converges to shortest paths. Count-to-infinity problem in distance vector routing.',
      },
    ],
  },
  {
    doc_id: 'demo-dbms-notes',
    title: 'DBMS Notes',
    type: 'notes',
    subject: 'dbms',
    chunks: [
      {
        id: 'db-c1',
        text: 'Normalisation reduces data redundancy and improves data integrity. 1NF: atomic values, no repeating groups. 2NF: 1NF + no partial dependencies (all non-key attributes depend on the entire primary key). 3NF: 2NF + no transitive dependencies. BCNF: for every X→Y, X must be a superkey.',
      },
      {
        id: 'db-c2',
        text: 'ACID Properties: Atomicity – all-or-nothing execution; Consistency – database moves from one valid state to another; Isolation – concurrent transactions appear serial; Durability – committed transactions persist even after system failures. Implemented via write-ahead logging (WAL) and locking protocols.',
      },
      {
        id: 'db-c3',
        text: 'SQL Joins: INNER JOIN returns matching rows from both tables. LEFT JOIN returns all rows from left table and matching from right (NULL if no match). RIGHT JOIN is the opposite. FULL OUTER JOIN returns all rows from both tables. CROSS JOIN returns Cartesian product.',
      },
      {
        id: 'db-c4',
        text: 'Two-Phase Locking (2PL) for concurrency control: Growing phase – transactions acquire locks and cannot release any. Shrinking phase – transactions release locks and cannot acquire new ones. Ensures serializability. Strict 2PL: hold all locks until commit/abort to prevent cascading rollbacks.',
      },
      {
        id: 'db-c5',
        text: 'ER Model to Relational Schema: (1) Entity → Table with primary key. (2) Attribute → Column. (3) 1:1 relationship → add FK in either table. (4) 1:N relationship → add FK in the N side. (5) M:N relationship → create a new relation (junction table) with FKs from both entities as composite PK.',
      },
      {
        id: 'db-c6',
        text: 'B+ Tree Indexing: All data stored at leaf level. Leaf nodes linked for sequential access. Internal nodes are guides for search. Order m: max m-1 keys per node. Height h = ⌈log⌈m/2⌉(n+1)⌉. Used in most database systems (MySQL InnoDB, PostgreSQL). Supports range queries efficiently.',
      },
    ],
  },
  {
    doc_id: 'demo-os-concepts',
    title: 'OS Concepts',
    type: 'concepts',
    subject: 'os',
    chunks: [
      {
        id: 'os-c1',
        text: 'Process Scheduling algorithms: FCFS (First Come First Served) – non-preemptive, convoy effect. SJF (Shortest Job First) – minimum average waiting time, preemptive version is SRTF. Round Robin – preemptive, time quantum, fair allocation. Priority Scheduling – preemptive or non-preemptive, risk of starvation (solved by aging).',
      },
      {
        id: 'os-c2',
        text: 'Deadlock: Four necessary conditions – Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait. Prevention: negate one condition. Avoidance: Banker\'s Algorithm. Detection: Resource Allocation Graph or Banker\'s. Recovery: process termination or resource preemption.',
      },
      {
        id: 'os-c3',
        text: 'Virtual Memory allows execution of processes not fully in physical memory. Page Table maps virtual pages to physical frames. Page fault occurs when page is not in memory → OS loads it from disk. Replacement algorithms: FIFO (Belady\'s anomaly), Optimal (theoretical), LRU (approximated by Clock algorithm).',
      },
    ],
  },
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

export function retrieveChunks(
  query: string,
  selectedDocIds: ReadonlyArray<string>,
): ReadonlyArray<RetrievedChunk> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const targetDocs = DEMO_DOCUMENTS.filter(d => selectedDocIds.includes(d.doc_id));
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
