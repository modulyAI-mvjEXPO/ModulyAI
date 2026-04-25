import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ChatResponse } from '../lib/ai/types';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import {
  DEMO_DOCUMENTS,
  retrieveChunks,
  buildGroundedContext,
  getCachedResult,
  setCachedResult,
  makeCacheKey,
  loadUthoDoc,
} from '../lib/docGrounding';
import type { StudySet } from '../lib/ai/types';
import { fetchStudySets, createStudySet, updateStudySetMessages, deleteStudySet, renameStudySet } from '../lib/studySets';
import { ButtonColorful } from '../components/ui/button-colorful';
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
  sources?: ReadonlyArray<{ docTitle: string; chunkId: string; score: number }>;
  confidenceScore?: number;
  isGrounded?: boolean;
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

// ─── Chat API ──────────────────────────────────────────────────────────────

async function chatWithAI(
  message: string,
  documentIds: ReadonlyArray<string>,
  mark: string,
  strict: boolean,
  subjectId: string | undefined,
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
): Promise<ChatResponse> {
  const backendBase = import.meta.env.VITE_BACKEND_URL || '';
  const res = await fetch(`${backendBase}/chat`, {
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
  const [studyView, setStudyView] = useState<'dashboard' | 'pick-docs' | 'chat'>('dashboard');
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [kitOpen, setKitOpen] = useState(true);
  const [selectedMark, setSelectedMark] = useState<typeof MARKS[number]>('8M');
  const [strict, setStrict] = useState(true);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [topics, setTopics] = useState<TopicItem[]>(() => getTopicsForSubject(''));
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [parsingDocs, setParsingDocs] = useState(false);
  const docsLoading = false;
  const [parsingDocNames, setParsingDocNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive reveal state
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedLen, setRevealedLen] = useState(0);

  // ── Document-Grounded Mode state ─────────────────────────────────────
  type GroundingMode = 'general' | 'document';
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('general');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // ── Fetch Study Sets for dashboard ─────────────────────────────────────
  useEffect(() => {
    const loadSets = async () => {
      const sets = await fetchStudySets(user.id);
      setStudySets(sets);
    };
    if (studyView === 'dashboard') {
      loadSets();
    }
  }, [user.id, studyView]);

  // ── Poll for Processing documents ──────────────────────────────────────
  useEffect(() => {
    const processingDocs = docs.filter(d => d.meta === 'Processing...');
    if (processingDocs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const ids = processingDocs.map(d => d.id);
        const { data, error } = await supabase
          .from('documents')
          .select('id, status, chunk_count')
          .in('id', ids);

        if (error) throw error;
        
        let changed = false;
        const updates = Object.fromEntries(data.map((r: { id: string; status: string; chunk_count: number }) => [r.id, r]));
        
        const nextDocs = docs.map(d => {
          const u = updates[d.id];
          if (u && u.status === 'ready') {
            changed = true;
            return { ...d, meta: `${u.chunk_count} chunks · Just now` };
          } else if (u && u.status === 'failed') {
            changed = true;
            return { ...d, meta: 'Failed to process' };
          }
          return d;
        });

        if (changed) setDocs(nextDocs);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [docs]);

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

  // ── Auto-save messages to Supabase ────────────────────────────────────
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      // Map UI Message[] to the format expected in DB (we store them as is for simplicity)
      void updateStudySetMessages(currentSessionId, messages);
    }
  }, [messages, currentSessionId]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const selectedDocs = docs;
  const activeTopics = topics.filter(t => t.active);
  const isRevealing = !!revealingId;
  const isBusy = isTyping || isRevealing;

  const toggleDoc = (id: string) => setDocs(prev => prev.filter(d => d.id !== id));
  const selectAllDocs = () => {}; // No longer needed as docs are selected in modal
  const selectNoneDocs = () => setDocs([]);
  const toggleTopic = (id: string) => setTopics(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));


  const handleStartSession = async () => {
    const selectedRows = docs;
    const unparsed = selectedRows.filter(d => d.id.startsWith('utho-'));

    // Create session in Supabase
    const d = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(d).replace(/ /g, '-');
    const title = formattedDate;
    const docIds = selectedRows.map(d => d.id).filter(id => !id.startsWith('utho-')); // skip utho until parsed
    
    // Auto-set grounding mode if docs are present
    const finalMode = docIds.length > 0 ? 'document' : 'general';
    setGroundingMode(finalMode);

    const session = await createStudySet(user.id, title, docIds, finalMode);
    
    if (session) {
      setCurrentSessionId(session.id);
    }

    // Immediately enter chat view
    setStudyView('chat');
    
    // We only set the welcome message. It will trigger the useEffect below to save it.
    setMessages([getWelcome(selectedRows.length)]);

    if (unparsed.length === 0) return;

    // Track which docs are parsing (for the banner)
    setParsingDocs(true);
    setParsingDocNames(unparsed.map(d => d.name));

    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const idMap = new Map<string, string>();

      // Fire off all parse requests
      await Promise.all(unparsed.map(async (unp) => {
        try {
          const res = await fetch(`${backendBase}/process-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: unp.name,
              filePath: unp.id.replace('utho-', ''),
              fileType: 'application/pdf',
              userId: user.id,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            idMap.set(unp.id, data.documentId);
          }
        } catch (err) {
          console.error(`Failed to trigger parsing for ${unp.name}:`, err);
        }
      }));

      // Swap utho- IDs to real Supabase IDs immediately
      if (idMap.size > 0) {
        setDocs(prev => prev.map(d => {
          const realId = idMap.get(d.id);
          if (realId) {
            return { ...d, id: realId, meta: 'Processing...' };
          }
          return d;
        }));
      }

      // Background poll — check every 3s, update docs individually as they finish
      const realIds = Array.from(idMap.values());
      if (realIds.length > 0) {
        const pending = new Set(realIds);
        const poll = async () => {
          while (pending.size > 0) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              const { data } = await supabase
                .from('documents')
                .select('id, status, chunk_count')
                .in('id', Array.from(pending));

              if (!data) continue;

              for (const row of data) {
                if (row.status === 'ready' || row.status === 'failed') {
                  pending.delete(row.id);
                  setDocs(prev => prev.map(d => {
                    if (d.id === row.id) {
                      return {
                        ...d,
                        meta: row.status === 'ready'
                          ? `${row.chunk_count} chunks · Just now`
                          : 'Failed to process',
                      };
                    }
                    return d;
                  }));
                  // Remove from parsing names
                  setParsingDocNames(prev => {
                    const next = prev.filter((_, i) => i !== 0);
                    return next;
                  });
                }
              }
            } catch (err) {
              console.error('Polling error:', err);
            }
          }
          setParsingDocs(false);
          setParsingDocNames([]);
        };
        // Fire-and-forget — runs in the background while user chats
        void poll();
      } else {
        setParsingDocs(false);
        setParsingDocNames([]);
      }
    } catch (e) {
      console.error('Error starting session:', e);
      setParsingDocs(false);
      setParsingDocNames([]);
    }
  };

  const resetChat = () => {
    setRevealingId(null);
    setMessages([getWelcome(docs.length)]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const uploadingMsgId = uid();
    setMessages(prev => [...prev, {
      id: uploadingMsgId,
      role: 'ai',
      content: `Uploading **${file.name}** and preparing it for analysis...`,
      time: ts()
    }]);

    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';

      const backendResponse = await fetch(`${backendBase}/get-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          contentType: file.type || 'application/octet-stream',
        }),
      });

      if (!backendResponse.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, filename } = await backendResponse.json();

      const uthoResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!uthoResponse.ok) throw new Error('Failed to upload file to storage');

      const processResponse = await fetch(`${backendBase}/process-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          filePath: filename,
          fileType: file.type || 'application/octet-stream',
          userId: user.id,
          fileSize: file.size,
        }),
      });

      if (!processResponse.ok) throw new Error('Failed to trigger document processing');
      const processData = await processResponse.json();
      const documentId = processData.documentId;

      if (!documentId) throw new Error('No document ID returned');

      const newDoc: DocItem = {
        id: documentId,
        name: file.name,
        type: file.type === 'application/pdf' ? 'pdf' : 'doc',
        meta: 'Processing...',
        selected: true
      };

      setDocs(prev => [newDoc, ...prev]);

      setMessages(prev => prev.map(m => m.id === uploadingMsgId ? {
        ...m,
        content: `**${file.name}** has been successfully uploaded! It is currently being scanned into our database. **Please wait until it finishes Processing** in the sidebar before asking questions about it.`
      } : m));

    } catch (error) {
      console.error('Upload Error:', error);
      setMessages(prev => prev.map(m => m.id === uploadingMsgId ? {
        ...m,
        content: `Sorry, I met an error while uploading **${file.name}**. Please try again.`
      } : m));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isBusy) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text, time: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // ── Document-Grounded Mode ─────────────────────────────────────────
      if (groundingMode === 'document' && docs.length > 0) {
        const docIds = docs.map(d => d.id);
        const cacheKey = makeCacheKey(text, docIds);
        const cached = getCachedResult(cacheKey);

        if (cached) {
          setIsTyping(false);
          const aiMsg: Message = {
            id: uid(), role: 'ai',
            content: cached.response, time: ts(),
            sources: cached.sources,
            confidenceScore: cached.confidenceScore,
            isGrounded: true,
          };
          setMessages(prev => [...prev, aiMsg]);
          setRevealingId(aiMsg.id);
          setRevealedLen(0);
          return;
        }

        const chunks = retrieveChunks(text, docIds);
        const { context, sources, confidenceScore } = buildGroundedContext(chunks);

        let responseText: string;
        if (chunks.length === 0) {
          responseText = 'Not found in selected documents. Try selecting more documents or switching to General AI Mode.';
          setIsTyping(false);
          const aiMsg: Message = {
            id: uid(), role: 'ai',
            content: responseText, time: ts(),
            sources: [], confidenceScore: 0, isGrounded: true,
          };
          setMessages(prev => [...prev, aiMsg]);
          setRevealingId(aiMsg.id);
          setRevealedLen(0);
          return;
        }

        // Inject context into Groq via the existing chat endpoint
        const docHistory = buildHistory([...messages, userMsg]);
        const backendBase = import.meta.env.VITE_BACKEND_URL || '';
        const res = await fetch(`${backendBase}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            mark: selectedMark,
            strict: true,
            history: docHistory.length > 0 ? docHistory : undefined,
            // System override is baked into the message via context prefix
            _groundedContext: context,
          }),
        });

        if (res.ok) {
          const data = await res.json() as ChatResponse;
          responseText = data.response;
        } else {
          // Client-side fallback: build response from chunks directly
          responseText =
            `**From your selected documents:**\n\n` +
            chunks.map(c => `- ${c.text}`).join('\n\n');
        }

        setCachedResult(cacheKey, { response: responseText, sources, confidenceScore });

        setIsTyping(false);
        const docAiMsg: Message = {
          id: uid(), role: 'ai',
          content: responseText, time: ts(),
          sources, confidenceScore, isGrounded: true,
        };
        setMessages(prev => [...prev, docAiMsg]);
        setRevealingId(docAiMsg.id);
        setRevealedLen(0);
        return;
      }

      // ── General AI Mode (existing behaviour) ──────────────────────────
      const selectedDocIds = docs.filter(d => d.selected).map(d => d.id);
      const history = buildHistory([...messages, userMsg]);
      const response = await chatWithAI(text, selectedDocIds, selectedMark, strict, subjectId || undefined, history);

      const generalAiMsg: Message = {
        id: uid(),
        role: 'ai',
        content: response.response,
        time: ts(),
      };
      setIsTyping(false);
      setMessages(prev => [...prev, generalAiMsg]);
      setRevealingId(generalAiMsg.id);
      setRevealedLen(0);
    } catch (err) {
      const errorContent = err instanceof Error
        ? `Sorry, I encountered an error: **${err.message}**\n\nPlease try again.`
        : 'Sorry, something went wrong. Please try again.';
      const errMsg: Message = { id: uid(), role: 'ai', content: errorContent, time: ts() };
      setIsTyping(false);
      setMessages(prev => [...prev, errMsg]);
    }
  }, [input, isBusy, selectedMark, strict, subjectId, docs, messages, groundingMode]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleResumeSession = (set: StudySet) => {
    setCurrentSessionId(set.id);
    
    // Convert saved messages back to Message type (if needed, but they are stored as is)
    setMessages(set.messages as Message[]);
    setGroundingMode(set.grounding_mode === 'document' ? 'document' : 'general');
    
    // For docs, ideally we would fetch them to get names/types, but for now we'll 
    // mock the doc selection based on IDs or rely on the demo picker state.
    if (set.grounding_mode === 'document') {
      setSelectedDemoDocIds(set.documents);
    }
    
    setStudyView('chat');
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="sm-shell">
      {/* Ambient blobs (dark mode only) */}
      <div className="sm-blob sm-blob-1" aria-hidden="true" />
      <div className="sm-blob sm-blob-2" aria-hidden="true" />

      {studyView === 'dashboard' ? (
        <div className="sm-dash">
          {/* Header */}
          <div className="sm-dash-head">
            <ButtonColorful
              className="sm-dash-create-btn w-auto"
              onClick={() => {
                setCurrentSessionId(null);
                setMessages([]);
                setStudyView('pick-docs');
              }}
              label="New Study Session"
            />
            <div className="sm-dash-subhead">
              <div className="sm-dash-search">
                <span className="material-icons-outlined">search</span>
                <input placeholder="Search Study Sets" />
              </div>
            </div>
          </div>

          <div className="sm-dash-content">
            {studySets.length === 0 ? (
              <div className="sm-dash-empty">
                <span className="material-icons-outlined">folder_open</span>
                <p>No study sessions yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="sm-set-grid">
                {studySets.map((set) => (
                  <div key={set.id} className="sm-set-card">
                    <div className="sm-set-card-body" onClick={() => handleResumeSession(set)}>
                      <span className="material-icons-outlined sm-set-icon">folder</span>
                      <h3 className="sm-set-title">{set.title}</h3>
                      <p className="sm-set-meta">
                        {set.documents.length} Document{set.documents.length !== 1 ? 's' : ''}
                      </p>
                      <p className="sm-set-time">
                        Last active {new Date(set.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="sm-set-card-actions">
                      <button 
                        className="sm-set-action-btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newTitle = prompt('Enter new title:', set.title);
                          if (newTitle && newTitle !== set.title) {
                            if (await renameStudySet(set.id, newTitle)) {
                              setStudySets(prev => prev.map(s => s.id === set.id ? { ...s, title: newTitle } : s));
                            }
                          }
                        }}
                      >
                        <span className="material-icons-outlined">edit</span>
                      </button>
                      <button 
                        className="sm-set-action-btn sm-set-action-btn--danger"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${set.title}"? This cannot be undone.`)) {
                            if (await deleteStudySet(set.id)) {
                              setStudySets(prev => prev.filter(s => s.id !== set.id));
                            }
                          }
                        }}
                      >
                        <span className="material-icons-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>      ) : studyView === 'pick-docs' ? (
        /* ── Document Picker (Library Modal Pattern) ─────────────────────────────────────── */
        <div className="sm-pick">
          <div className="sm-pick-head">
            <button className="sm-dash-back-btn" onClick={() => setStudyView('dashboard')}>
              <span className="material-icons-outlined">arrow_back</span>
              Back
            </button>
            <h1 className="sm-pick-title">
              Selected Documents
            </h1>
            <p className="sm-pick-subtitle">
              These documents will provide the context for your AI study session.
            </p>
          </div>

          <div className="sm-pick-list">
            {docs.length === 0 ? (
              <div className="sm-pick-empty-state">
                <span className="material-icons-outlined">library_books</span>
                <p>No documents selected yet.</p>
                <ButtonColorful
                  className="sm-pick-upload-btn"
                  onClick={() => setPickerOpen(true)}
                  label="Select from Library"
                />
              </div>
            ) : (
              <>
                <div className="sm-pick-actions">
                  <span className="sm-pick-count">{docs.length} document(s) ready</span>
                  <button className="sm-pick-select-btn" onClick={() => setPickerOpen(true)}>+ Add More</button>
                </div>
                {docs.map(doc => (
                  <div key={doc.id} className="sm-pick-item sm-pick-item--on">
                    <span 
                      className="material-icons-outlined sm-pick-item-check" 
                      onClick={() => toggleDoc(doc.id)} 
                      style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Remove from session"
                    >
                      remove_circle_outline
                    </span>
                    <span className={`material-icons-outlined sm-pick-item-icon ${doc.type === 'pdf' ? 'sm-pick-item-icon--pdf' : ''}`}>
                      {doc.type === 'pdf' ? 'picture_as_pdf' : 'description'}
                    </span>
                    <div className="sm-pick-item-info">
                      <span className="sm-pick-item-name">{doc.name}</span>
                      <span className="sm-pick-item-meta">{doc.meta}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="sm-pick-footer">
            <ButtonColorful
              className="sm-pick-start-btn mt-4"
              onClick={handleStartSession}
              disabled={parsingDocs}
              label={parsingDocs ? "Parsing New Documents..." : (docs.length === 0 ? "Start Without Documents" : "Start Study Kit")}
            />
          </div>
          
          <DocumentPickerModal
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            initialSelectedIds={new Set(docs.map(d => d.id))}
            onSave={(selectedRows) => {
              const newDocs = selectedRows.map(r => ({
                id: r.id,
                name: r.title,
                type: (r.file_type === 'application/pdf' ? 'pdf' : 'doc') as 'pdf' | 'doc',
                meta: r.id.startsWith('utho-') ? 'Loading AI Context...' : `${r.chunk_count} chunks`,
                selected: true
              }));
              setDocs(newDocs);

              // Load Utho docs in background
              newDocs.forEach(d => {
                if (d.id.startsWith('utho-')) {
                  void loadUthoDoc(d.id).then(success => {
                    if (success) {
                      setDocs(prev => prev.map(p => p.id === d.id ? { ...p, meta: 'Ready for AI Mode' } : p));
                    } else {
                      setDocs(prev => prev.map(p => p.id === d.id ? { ...p, meta: 'Offline / Parsing Error' } : p));
                    }
                  });
                }
              });
            }}
          />
        </div>
      ) : (
      <>
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
          {/* ── AI Mode Toggle ──────────────────────────────── */}
          <section className="sm-section sm-section--mode">
            <span className="sm-label">AI Mode</span>
            <div className="sm-mode-toggle" role="group" aria-label="AI Mode">
              <button
                className={`sm-mode-btn ${groundingMode === 'general' ? 'sm-mode-btn--active' : ''}`}
                onClick={() => setGroundingMode('general')}
                title="Use Groq AI general knowledge"
              >
                <span className="material-icons-outlined">psychology</span>
                General AI
              </button>
              <button
                className={`sm-mode-btn sm-mode-btn--doc ${groundingMode === 'document' ? 'sm-mode-btn--active sm-mode-btn--doc-active' : ''}`}
                onClick={() => setGroundingMode('document')}
                title="Answer only from selected demo documents"
              >
                <span className="material-icons-outlined">folder_special</span>
                Doc Mode
              </button>
            </div>
          </section>

          {/* ── Demo Document Picker (only in Document Mode) ──────── */}
          {groundingMode === 'document' && (
            <section className="sm-section sm-section--demo-docs">
              <div className="sm-section-row">
                <span className="sm-label">Demo Docs</span>
                <span className="sm-demo-limit-badge">
                  {selectedDemoDocIds.length}/3 selected
                </span>
              </div>
              <p className="sm-demo-hint">Select up to 3 documents. AI will answer only from these.</p>
              <div className="sm-demo-doc-list">
                {DEMO_DOCUMENTS.map(doc => {
                  const isSelected = selectedDemoDocIds.includes(doc.doc_id);
                  const isDisabled = !isSelected && selectedDemoDocIds.length >= 3;
                  const typeIcons: Record<string, string> = {
                    notes: 'description', pyqs: 'quiz', concepts: 'lightbulb', ppt: 'slideshow',
                  };
                  return (
                    <button
                      key={doc.doc_id}
                      className={`sm-demo-doc ${isSelected ? 'sm-demo-doc--on' : ''} ${isDisabled ? 'sm-demo-doc--disabled' : ''}`}
                      onClick={() => !isDisabled && toggleDemoDoc(doc.doc_id)}
                      title={isDisabled ? 'Max 3 documents' : doc.title}
                    >
                      <span className={`material-icons-outlined sm-demo-doc-icon ${isSelected ? 'sm-demo-doc-icon--on' : ''}`}>
                        {typeIcons[doc.type] ?? 'description'}
                      </span>
                      <div className="sm-demo-doc-info">
                        <p className="sm-demo-doc-name">{doc.title}</p>
                        <p className="sm-demo-doc-meta">{doc.chunks.length} chunks · {doc.subject}</p>
                      </div>
                      <div className={`sm-check ${isSelected ? 'sm-check--on' : ''}`}>
                        {isSelected && <span className="material-icons-outlined sm-check-icon">check</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
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
              onClick={() => setStudyView('dashboard')}
              title="Back to Dashboard"
            >
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <button
              className="sm-icon-btn"
              onClick={() => setKitOpen(v => !v)}
              title={kitOpen ? 'Close Study Kit Context' : 'Open Study Kit Context'}
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
              {parsingDocs && (
                <p className="sm-chat-parsing">
                  <span className="material-icons-outlined sm-spin-sm">sync</span>
                  Parsing {parsingDocNames.length} doc{parsingDocNames.length !== 1 ? 's' : ''}...
                </p>
              )}
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
                  {/* Grounded Sources */}
                  {msg.isGrounded && msg.sources && msg.sources.length > 0 && !isCurrentlyRevealing && (
                    <div className="sm-sources">
                      <span className="sm-sources-label">
                        <span className="material-icons-outlined sm-sources-icon">verified</span>
                        Sources used
                        {msg.confidenceScore !== undefined && (
                          <span className="sm-confidence-badge">{msg.confidenceScore}% match</span>
                        )}
                      </span>
                      <div className="sm-source-pills">
                        {msg.sources.map((src, si) => (
                          <span key={si} className="sm-source-pill">
                            <span className="material-icons-outlined">description</span>
                            {src.docTitle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
            {/* Mode chip */}
            <span className={`sm-chip ${groundingMode === 'document' ? 'sm-chip--grounded' : 'sm-chip--violet'}`}>
              <span className="material-icons-outlined sm-chip-icon">
                {groundingMode === 'document' ? 'folder_special' : 'psychology'}
              </span>
              {groundingMode === 'document' ? 'Doc Mode' : 'General AI'}
            </span>
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
            <button
               className={`sm-icon-btn ${isUploading ? 'sm-icon-btn--disabled' : ''}`}
               title="Attach file"
               aria-label="Attach file"
               onClick={() => !isUploading && fileInputRef.current?.click()}
               disabled={isUploading}
            >
              <span className={`material-icons-outlined ${isUploading ? 'sm-spin' : ''}`}>
                 {isUploading ? 'autorenew' : 'attach_file'}
              </span>
            </button>
            <input
               type="file"
               ref={fileInputRef}
               className="sm-file-input"
               title="Upload Document"
               aria-label="Upload Document"
               accept=".pdf,.doc,.docx"
               onChange={(e) => { void handleFileUpload(e); }}
            />
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
      </>
      )}
    </div>
  );
}
