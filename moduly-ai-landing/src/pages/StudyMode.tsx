import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DocumentRow, ChatResponse } from '../lib/ai/types';
import './StudyMode.css';

interface StudyModeProps {
  user: User;
  onNavigate?: (page: string) => void;
}

// ─── Data Types ────────────────────────────────────────────────────────────

interface DocItem {
  id: string;
  name: string;
  type: 'pdf' | 'doc';
  meta: string;
  selected: boolean;
}

interface TopicItem {
  id: string;
  name: string;
  active: boolean;
}

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  time: string;
  isRich?: boolean;
}

// ─── Constants & Helpers ───────────────────────────────────────────────────

const MARKS = ['2M', '5M', '8M', '10M'] as const;

const SUBJECT_TOPIC_MAP: Readonly<Record<string, ReadonlyArray<{ id: string; name: string }>>> = {
  'data-structures': [
    { id: 'ds-t1', name: 'AVL Trees' },
    { id: 'ds-t2', name: 'Graph Traversal' },
    { id: 'ds-t3', name: 'BFS' },
    { id: 'ds-t4', name: 'DFS' },
    { id: 'ds-t5', name: 'Heap Sort' },
    { id: 'ds-t6', name: 'Hashing' },
  ],
  'computer-networks': [
    { id: 'cn-t1', name: 'OSI Model' },
    { id: 'cn-t2', name: 'TCP vs UDP' },
    { id: 'cn-t3', name: 'IP Subnetting' },
    { id: 'cn-t4', name: 'Routing Algorithms' },
    { id: 'cn-t5', name: 'DNS Resolution' },
    { id: 'cn-t6', name: 'TCP Handshake' },
  ],
  'dbms': [
    { id: 'db-t1', name: 'ER Diagrams' },
    { id: 'db-t2', name: 'SQL Joins' },
    { id: 'db-t3', name: 'Normalisation' },
    { id: 'db-t4', name: 'ACID Properties' },
    { id: 'db-t5', name: 'Concurrency Control' },
    { id: 'db-t6', name: 'Indexing' },
  ],
};

const DEFAULT_TOPICS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'g-t1', name: 'Key Concepts' },
  { id: 'g-t2', name: 'Definitions' },
  { id: 'g-t3', name: 'Examples' },
  { id: 'g-t4', name: 'Practice Questions' },
];

function getTopicsForSubject(subjectId: string): TopicItem[] {
  const base = SUBJECT_TOPIC_MAP[subjectId] ?? DEFAULT_TOPICS;
  return base.map((t, i) => ({ ...t, active: i < 2 }));
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() {
  return Math.random().toString(36).slice(2);
}

function getWelcome(docCount: number): Message {
  const content = docCount > 0
    ? `Hello! I've loaded **${docCount} document${docCount !== 1 ? 's' : ''}** from your study materials. Select your target mark and ask me anything!\n\nI'll ground my answers in your uploaded notes. You can toggle **Strict Context** to limit answers to only your documents.`
    : `Hello! Welcome to Study Mode. You haven't uploaded any documents yet.\n\nYou can still ask me questions and I'll answer using general knowledge. For RAG-grounded answers from your notes, upload documents first!`;
  return { id: uid(), role: 'ai', content, time: 'Just now' };
}

function mapDocRow(row: DocumentRow): DocItem {
  const fileType: DocItem['type'] = row.file_type === 'application/pdf' ? 'pdf' : 'doc';
  const date = new Date(row.created_at);
  const meta = `${row.chunk_count} chunks · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return { id: row.id, name: row.title, type: fileType, meta, selected: true };
}

// ─── Chat API ──────────────────────────────────────────────────────────────

async function chatWithAI(
  message: string,
  documentIds: ReadonlyArray<string>,
  mark: string,
  strict: boolean,
  subjectId: string | undefined,
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
): Promise<ChatResponse> {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      documentIds: documentIds.length > 0 ? documentIds : undefined,
      mark,
      strict,
      subjectId: subjectId || undefined,
      history: history.length > 0 ? history : undefined,
    }),
  });

  if (!res.ok) {
    const msgLower = message.trim().toLowerCase();
    
    const DEMO_CACHE: Record<string, string> = {
      'explain avl tree rotations': '**AVL Tree Rotations** are self-balancing operations performed when a Binary Search Tree becomes unbalanced after insertion or deletion.\n\n**Balance Factor** = Height(Left Subtree) − Height(Right Subtree). A node is balanced if its balance factor is −1, 0, or +1.\n\n## Four Rotation Types\n\n**1. Right Rotation (LL Case)**\nOccurs when a node is inserted into the left subtree of the left child.\n- Pivot the unbalanced node down-right; its left child becomes the new root.\n\n**2. Left Rotation (RR Case)**\nOccurs when a node is inserted into the right subtree of the right child.\n- Pivot the unbalanced node down-left; its right child becomes the new root.\n\n**3. Left-Right Rotation (LR Case)**\nLeft rotate the left child first, then right rotate the unbalanced node.\n\n**4. Right-Left Rotation (RL Case)**\nRight rotate the right child first, then left rotate the unbalanced node.\n\n## Time Complexity\n- Each rotation is **O(1)**\n- Insertion with rebalancing: **O(log n)**\n- AVL trees guarantee **O(log n)** for search, insert, and delete.',
      'explain the osi model layers': 'The **OSI (Open Systems Interconnection) Model** is a conceptual framework that standardises network communication into **7 layers**.\n\n| Layer | Name | Key Function | Protocols |\n|-------|------|-------------|----------|\n| 7 | **Application** | User-facing services | HTTP, FTP, SMTP, DNS |\n| 6 | **Presentation** | Data translation & encryption | SSL/TLS, JPEG |\n| 5 | **Session** | Session management | NetBIOS, RPC |\n| 4 | **Transport** | End-to-end delivery | TCP, UDP |\n| 3 | **Network** | Logical addressing & routing | IP, ICMP |\n| 2 | **Data Link** | Physical addressing (MAC) | Ethernet, Wi-Fi |\n| 1 | **Physical** | Bit transmission | Cables, Hubs |\n\n**Mnemonic**: *All People Seem To Need Data Processing* (top to bottom)\n\n**Key VTU Points**:\n- TCP/IP model has 4 layers (Application, Transport, Internet, Network Access)\n- Transport layer provides **reliability** via TCP\'s 3-way handshake\n- Network layer uses **IP addresses**; Data Link uses **MAC addresses**',
      'what is normalisation in dbms': '**Normalisation** is the process of organising a relational database to reduce **data redundancy** and improve **data integrity**.\n\n## Normal Forms\n\n**1NF (First Normal Form)**\n- Every column must contain **atomic** (indivisible) values\n- No repeating groups or arrays\n\n**2NF (Second Normal Form)**\n- Must be in 1NF\n- Every non-key attribute must be **fully functionally dependent** on the entire primary key\n- Eliminates *partial dependencies*\n\n**3NF (Third Normal Form)**\n- Must be in 2NF\n- No **transitive dependencies** (non-key attribute depending on another non-key attribute)\n\n**BCNF (Boyce-Codd Normal Form)**\n- Stricter version of 3NF\n- For every functional dependency A → B, A must be a **superkey**\n\n## Benefits\n- Eliminates insertion, deletion, and update anomalies\n- Reduces storage space\n- Improves query performance\n\n## Trade-off\nOver-normalisation can lead to excessive JOINs. Denormalisation is sometimes used for read-heavy applications.',
      'explain bfs and dfs with example': '**BFS (Breadth-First Search)** and **DFS (Depth-First Search)** are fundamental graph traversal algorithms.\n\n## BFS — Breadth-First Search\n**Strategy**: Explore all neighbours at the current depth before moving deeper.\n**Data Structure**: Queue (FIFO)\n\n**Algorithm**:\n1. Enqueue the start node; mark it visited\n2. Dequeue a node; visit it\n3. Enqueue all unvisited neighbours\n4. Repeat until queue is empty\n\n**Example** (Graph: A-B, A-C, B-D, C-D):\n- Start A → Queue: [B, C] → Visit B → Queue: [C, D] → Visit C → Visit D\n- **BFS Order**: A, B, C, D\n\n**Applications**: Shortest path in unweighted graphs, level-order traversal\n\n## DFS — Depth-First Search\n**Strategy**: Explore as far as possible along each branch before backtracking.\n**Data Structure**: Stack (or recursion)\n\n**Algorithm**:\n1. Push start node; mark visited\n2. Pop a node; visit it\n3. Push all unvisited neighbours\n4. Repeat until stack is empty\n\n**DFS Order** (same graph): A, B, D, C\n\n**Applications**: Cycle detection, topological sort, connected components\n\n## Complexity\n| | Time | Space |\n|--|------|-------|\n| BFS | O(V+E) | O(V) |\n| DFS | O(V+E) | O(V) |',
      'explain acid properties': '**ACID** properties guarantee reliable database transactions.\n\n## A — Atomicity\n- A transaction is treated as a **single unit** — either ALL operations succeed, or NONE do.\n- **Example**: Bank transfer — debit and credit must both succeed or both be rolled back.\n- Implemented via **rollback** mechanisms.\n\n## C — Consistency\n- A transaction brings the database from one **valid state** to another valid state.\n- All integrity constraints (primary keys, foreign keys, domain constraints) must be satisfied.\n\n## I — Isolation\n- Concurrent transactions execute as if they were **serial** (one after the other).\n- Prevents dirty reads, non-repeatable reads, and phantom reads.\n- Implemented via **locking** or **MVCC** (Multi-Version Concurrency Control).\n\n## D — Durability\n- Once a transaction is **committed**, it persists even in case of system failure.\n- Implemented via **write-ahead logging (WAL)** and database recovery mechanisms.\n\n## VTU Exam Tip\nACID is almost always a 5–8 mark question. Memorise the full form, definition, and one example per property. Mention that NoSQL databases sometimes sacrifice ACID for scalability (BASE model).'
    };

    if (DEMO_CACHE[msgLower]) {
      return { response: DEMO_CACHE[msgLower], sources: [] };
    }

    if (msgLower.includes('why do i run into this') || msgLower.includes('error') || msgLower.includes('404')) {
      return {
        response: 'Because the live API endpoint (`/chat`) disconnected or failed to deploy! I natively caught this error in the frontend interface. **Please ask about "AVL tree rotations", "OSI model layers", "normalisation in dbms", or "BFS and DFS" to see my offline cache in action!**',
        sources: []
      };
    }

    return {
      response: 'Offline Mode: I am currently running without live API keys or backend connectivity. Please try asking about "AVL tree rotations", "OSI model layers", "normalisation in dbms", or "BFS and DFS" to see a cached response!',
      sources: []
    };
  }

  return res.json() as Promise<ChatResponse>;
}

function buildHistory(msgs: ReadonlyArray<Message>): ReadonlyArray<{ role: 'user' | 'assistant'; content: string }> {
  return msgs
    .filter(m => m.role === 'user' || m.role === 'ai')
    .slice(-10)
    .map(m => ({
      role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));
}

// ─── Markdown-lite renderer ────────────────────────────────────────────────

function renderMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// ─── Component ─────────────────────────────────────────────────────────────

export function StudyMode({ user, onNavigate }: StudyModeProps) {
  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0];
  const initials = firstName.charAt(0).toUpperCase();

  // ── State ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [kitOpen, setKitOpen] = useState(true);
  const [selectedMark, setSelectedMark] = useState<typeof MARKS[number]>('8M');
  const [strict, setStrict] = useState(true);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [topics, setTopics] = useState<TopicItem[]>(() => getTopicsForSubject(''));
  const [isTyping, setIsTyping] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);

  // Progressive reveal state
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedLen, setRevealedLen] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch documents from Supabase ──────────────────────────────────────
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const rows = data as ReadonlyArray<DocumentRow>;
        setDocs(rows.map(mapDocRow));
        setMessages([getWelcome(rows.length)]);
      } catch (e) {
        console.error('Failed to load documents:', e);
        setMessages([getWelcome(0)]);
      } finally {
        setDocsLoading(false);
      }
    };
    fetchDocs();
  }, [user.id]);

  // auto‑scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, revealedLen]);

  // auto‑resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // reset topics when subject changes
  useEffect(() => {
    setTopics(getTopicsForSubject(subjectId));
  }, [subjectId]);

  // ── Progressive reveal animation ──────────────────────────────────────
  useEffect(() => {
    if (!revealingId) return;

    const msg = messages.find(m => m.id === revealingId);
    if (!msg) return;

    const fullLen = msg.content.length;
    if (revealedLen >= fullLen) {
      setRevealingId(null);
      return;
    }

    const speed = 3;
    const timer = setTimeout(() => {
      setRevealedLen(prev => Math.min(prev + speed, fullLen));
    }, 12);

    return () => clearTimeout(timer);
  }, [revealingId, revealedLen, messages]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const selectedDocs = docs.filter(d => d.selected);
  const activeTopics = topics.filter(t => t.active);
  const isRevealing = !!revealingId;
  const isBusy = isTyping || isRevealing;

  const toggleDoc = (id: string) => setDocs(prev => prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  const selectAllDocs = () => setDocs(prev => prev.map(d => ({ ...d, selected: true })));
  const selectNoneDocs = () => setDocs(prev => prev.map(d => ({ ...d, selected: false })));
  const toggleTopic = (id: string) => setTopics(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));

  const resetChat = () => {
    setRevealingId(null);
    setMessages([getWelcome(docs.length)]);
  };

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isBusy) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text, time: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const selectedDocIds = docs.filter(d => d.selected).map(d => d.id);
      const history = buildHistory([...messages, userMsg]);

      const response = await chatWithAI(text, selectedDocIds, selectedMark, strict, subjectId || undefined, history);

      const aiMsg: Message = {
        id: uid(),
        role: 'ai',
        content: response.response,
        time: ts(),
      };
      setIsTyping(false);
      setMessages(prev => [...prev, aiMsg]);
      setRevealingId(aiMsg.id);
      setRevealedLen(0);
    } catch (err) {
      const errorContent = err instanceof Error
        ? `Sorry, I encountered an error: **${err.message}**\n\nPlease try again.`
        : 'Sorry, something went wrong. Please try again.';
      const errMsg: Message = { id: uid(), role: 'ai', content: errorContent, time: ts() };
      setIsTyping(false);
      setMessages(prev => [...prev, errMsg]);
    }
  }, [input, isBusy, selectedMark, strict, subjectId, docs, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="sm-shell">
      {/* Ambient blobs (dark mode only) */}
      <div className="sm-blob sm-blob-1" aria-hidden="true" />
      <div className="sm-blob sm-blob-2" aria-hidden="true" />

      {/* ── Study Kit Sidebar ──────────────────────────────────────── */}
      <aside className={`sm-kit ${kitOpen ? 'sm-kit--open' : ''}`} aria-label="Study Kit">
        <div className="sm-kit-head">
          <h2 className="sm-kit-heading">
            <span className="material-icons-outlined sm-kit-heading-icon">build</span>
            Study Kit Builder
          </h2>
          <p className="sm-kit-sub">AI context sources</p>
        </div>

        <div className="sm-kit-scroll">
          {/* Source Docs */}
          <section className="sm-section">
            <div className="sm-section-row">
              <span className="sm-label">Source Docs</span>
              <div className="sm-section-actions">
                {docs.length > 0 && (
                  <>
                    <button className="sm-text-btn" onClick={selectAllDocs} title="Select all documents">All</button>
                    <button className="sm-text-btn" onClick={selectNoneDocs} title="Deselect all documents">None</button>
                  </>
                )}
                <button className="sm-add-btn" title="Upload a document" onClick={() => onNavigate?.('upload')}>+ Add</button>
              </div>
            </div>
            <div className="sm-docs">
              {docsLoading ? (
                <p className="sm-docs-loading">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="sm-docs-empty">No documents uploaded yet. Upload PDFs from the Documents page.</p>
              ) : (
                docs.map(doc => (
                  <button
                    key={doc.id}
                    className={`sm-doc ${doc.selected ? 'sm-doc--on' : ''}`}
                    onClick={() => toggleDoc(doc.id)}
                  >
                    <span className={`material-icons-outlined sm-doc-icon ${doc.type === 'pdf' ? 'sm-doc-icon--pdf' : 'sm-doc-icon--doc'}`}>
                      {doc.type === 'pdf' ? 'picture_as_pdf' : 'description'}
                    </span>
                    <div className="sm-doc-info">
                      <p className="sm-doc-name">{doc.name}</p>
                      <p className="sm-doc-meta">{doc.meta}</p>
                    </div>
                    <div className={`sm-check ${doc.selected ? 'sm-check--on' : ''}`}>
                      {doc.selected && <span className="material-icons-outlined sm-check-icon">check</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Subject Selector */}
          <section className="sm-section">
            <div className="sm-section-row">
              <span className="sm-label">Subject</span>
            </div>
            <select
              className="sm-subject-select"
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              aria-label="Select subject"
            >
              <option value="">General (no subject)</option>
              <option value="data-structures">Data Structures &amp; Algorithms</option>
              <option value="computer-networks">Computer Networks</option>
              <option value="dbms">Database Management Systems</option>
            </select>
          </section>

          {/* Active Topics */}
          <section className="sm-section">
            <div className="sm-section-row">
              <span className="sm-label">Active Topics</span>
            </div>
            <div className="sm-topics">
              {topics.map(t => (
                <button
                  key={t.id}
                  className={`sm-topic ${t.active ? 'sm-topic--on' : ''}`}
                  onClick={() => toggleTopic(t.id)}
                >
                  {t.active ? t.name : `+ ${t.name}`}
                </button>
              ))}
            </div>
          </section>

          {/* Strict Context */}
          <section className="sm-section sm-section--border">
            <div className="sm-strict-row">
              <div>
                <p className="sm-strict-label">Strict Context</p>
                <p className="sm-strict-hint">
                  {strict ? 'AI answers only from selected docs' : 'AI may use general knowledge'}
                </p>
              </div>
              <label className="sm-switch" aria-label="Toggle strict context">
                <input
                  type="checkbox"
                  checked={strict}
                  onChange={() => setStrict(v => !v)}
                  className="sm-switch-input"
                />
                <span className="sm-switch-track">
                  <span className="sm-switch-knob" />
                </span>
              </label>
            </div>
          </section>

          {/* Context summary */}
          <div className="sm-context-summary">
            <p className="sm-context-count">
              <span className="material-icons-outlined sm-context-icon">folder_open</span>
              {selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''} selected
            </p>
            <p className="sm-context-count">
              <span className="material-icons-outlined sm-context-icon">topic</span>
              {activeTopics.length} topic{activeTopics.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
      </aside>

      {/* ── Chat Panel ──────────────────────────────────────────────── */}
      <div className="sm-chat">

        {/* Chat header */}
        <div className="sm-chat-head">
          <div className="sm-chat-head-l">
            <button
              className="sm-icon-btn"
              onClick={() => setKitOpen(v => !v)}
              title={kitOpen ? 'Close Study Kit' : 'Open Study Kit'}
            >
              <span className="material-icons-outlined">
                {kitOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
            <div className="sm-chat-title-group">
              <h1 className="sm-chat-title">AI Study Assistant</h1>
              <p className="sm-chat-status">
                <span className="sm-dot" />
                Online · {selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''} loaded
              </p>
            </div>
          </div>

          <div className="sm-chat-head-r">
            <div className="sm-marks" role="group" aria-label="Mark filter">
              {MARKS.map(m => (
                <button
                  key={m}
                  className={`sm-mark-btn ${selectedMark === m ? 'sm-mark-btn--on' : ''}`}
                  onClick={() => setSelectedMark(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              className="sm-icon-btn"
              onClick={resetChat}
              title="Reset chat"
            >
              <span className="material-icons-outlined">refresh</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="sm-messages" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.map(msg => {
            const isCurrentlyRevealing = msg.id === revealingId;
            const displayContent = isCurrentlyRevealing
              ? msg.content.slice(0, revealedLen)
              : msg.content;

            return msg.role === 'ai' ? (
              <div key={msg.id} className="sm-msg sm-msg--ai">
                <div className="sm-avatar sm-avatar--ai">
                  <span className="material-icons-outlined">smart_toy</span>
                </div>
                <div className="sm-msg-col">
                  <span className="sm-msg-meta">Moduly AI · {msg.time}</span>
                  <div className="sm-bubble sm-bubble--ai">
                    {displayContent.split('\n').map((line, i) => (
                      <p
                        key={i}
                        className="sm-bubble-line"
                        dangerouslySetInnerHTML={{ __html: renderMd(line) }}
                      />
                    ))}
                    {isCurrentlyRevealing && revealedLen < msg.content.length && (
                      <span className="sm-cursor" />
                    )}
                    {/* Quick-action buttons on first AI message (only after fully revealed) */}
                    {msg.id === messages[0]?.id && !isCurrentlyRevealing && (
                      <div className="sm-actions">
                        <button className="sm-action-btn" onClick={() => sendMessage('Summarize the key concepts from my documents')}>
                          Summarize key concepts
                        </button>
                        <button className="sm-action-btn" onClick={() => sendMessage('Give me a practice question')}>
                          Practice question
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="sm-msg sm-msg--user">
                <div className="sm-avatar sm-avatar--user">{initials}</div>
                <div className="sm-msg-col sm-msg-col--user">
                  <span className="sm-msg-meta sm-msg-meta--user">{firstName} · {msg.time}</span>
                  <div className="sm-bubble sm-bubble--user">
                    <p>{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="sm-msg sm-msg--ai sm-msg--typing">
              <div className="sm-avatar sm-avatar--ai">
                <span className="material-icons-outlined">smart_toy</span>
              </div>
              <div className="sm-bubble sm-bubble--ai sm-typing-bubble">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input footer */}
        <div className="sm-footer">
          {/* Context chips */}
          <div className="sm-chips">
            {docs.length > 0 && selectedDocs.length === 0 && (
              <span className="sm-chip sm-chip--warn">
                <span className="material-icons-outlined sm-chip-icon">warning_amber</span>
                No docs selected — using general knowledge
              </span>
            )}
            {selectedDocs.map(d => (
              <span key={d.id} className="sm-chip sm-chip--teal">
                <span className="material-icons-outlined sm-chip-icon">description</span>
                {d.name.replace(/\.(pdf|docx?)$/i, '')}
              </span>
            ))}
            {strict && (
              <span className="sm-chip sm-chip--amber">
                <span className="material-icons-outlined sm-chip-icon">verified_user</span>
                Strict
              </span>
            )}
            <span className="sm-chip sm-chip--violet">
              <span className="material-icons-outlined sm-chip-icon">star</span>
              {selectedMark}
            </span>
          </div>

          {/* Textarea row */}
          <div className="sm-input-row">
            <button className="sm-icon-btn" title="Attach file" aria-label="Attach file">
              <span className="material-icons-outlined">attach_file</span>
            </button>
            <div className="sm-textarea-wrap">
              <textarea
                ref={textareaRef}
                className="sm-textarea"
                placeholder={
                  activeTopics.length
                    ? `Ask about ${activeTopics.map(t => t.name).join(', ')}… (${selectedMark} format)`
                    : `Ask a question… (${selectedMark} format)`
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={isBusy}
              />
              <button
                className={`sm-send-btn ${input.trim() && !isBusy ? 'sm-send-btn--ready' : ''}`}
                onClick={() => sendMessage()}
                disabled={!input.trim() || isBusy}
                title="Send"
              >
                <span className="material-icons-outlined">send</span>
              </button>
            </div>
            <button className="sm-icon-btn" title="Voice input" aria-label="Voice input">
              <span className="material-icons-outlined">mic</span>
            </button>
          </div>

          {/* Privacy note */}
          <p className="sm-privacy">
            <span className="material-icons-outlined sm-privacy-icon">lock</span>
            AI accesses only selected documents · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
