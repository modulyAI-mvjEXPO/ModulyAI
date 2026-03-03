import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import './StudyMode.css';

interface StudyModeProps { user: User; }

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

// ─── Initial Data ──────────────────────────────────────────────────────────

const MARKS = ['2M', '8M', '10M'] as const;

const INITIAL_DOCS: DocItem[] = [
  { id: 'd1', name: 'Module_3_Trees.pdf', type: 'pdf', meta: '24 pages · Uploaded yesterday', selected: true },
  { id: 'd2', name: 'Class_Notes_Graphs.docx', type: 'doc', meta: '5 pages · Uploaded 2 days ago', selected: false },
];

const INITIAL_TOPICS: TopicItem[] = [
  { id: 't1', name: 'AVL Trees', active: true },
  { id: 't2', name: 'Graph Traversal', active: true },
  { id: 't3', name: 'BFS', active: false },
  { id: 't4', name: 'DFS', active: false },
];

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() {
  return Math.random().toString(36).slice(2);
}

const WELCOME: Message = {
  id: uid(),
  role: 'ai',
  time: 'Just now',
  content:
    "Hello! I've loaded your notes on **Trees & Graphs**. I see you want to focus on **8‑mark** questions.\n\nShall we start by explaining AVL tree rotations with an example, or would you like a practice question first?",
};

// ─── Simple AI response generator ─────────────────────────────────────────

function generateResponse(query: string, mark: string, strict: boolean): string {
  const q = query.toLowerCase();

  if (q.includes('avl') || q.includes('rotation')) {
    return (
      `Great question! Here's an ${mark} explanation of AVL rotations:\n\n` +
      `**AVL Tree Rotations** keep the tree balanced (|BF| ≤ 1).\n\n` +
      `There are four cases:\n` +
      `1. **LL Rotation** – single right rotation\n` +
      `2. **RR Rotation** – single left rotation\n` +
      `3. **LR Rotation** – left then right rotation\n` +
      `4. **RL Rotation** – right then left rotation\n\n` +
      `Each rotation takes **O(1)** time, keeping overall insertion at **O(log n)**.`
    );
  }
  if (q.includes('bfs') || q.includes('breadth')) {
    return (
      `**BFS (Breadth‑First Search)** – ${mark} answer:\n\n` +
      `BFS explores nodes level by level using a **queue** (FIFO).\n\n` +
      `**Algorithm:**\n` +
      `1. Enqueue the source node; mark visited\n` +
      `2. While queue is not empty: dequeue node, visit it, enqueue unvisited neighbours\n\n` +
      `**Time Complexity:** O(V + E)\n` +
      `**Space Complexity:** O(V)\n\n` +
      `Used for: shortest path in unweighted graphs, level‑order traversal.`
    );
  }
  if (q.includes('dfs') || q.includes('depth')) {
    return (
      `**DFS (Depth‑First Search)** – ${mark} answer:\n\n` +
      `DFS explores as deep as possible before backtracking using a **stack** (or recursion).\n\n` +
      `**Algorithm:**\n` +
      `1. Push source; mark visited\n` +
      `2. While stack not empty: pop node, visit, push unvisited neighbours\n\n` +
      `**Time Complexity:** O(V + E)\n` +
      `**Applications:** topological sort, cycle detection, SCC.\n\n` +
      (strict ? '*(Strict mode: answer limited to your selected documents.)*' : '')
    );
  }
  if (q.includes('practice') || q.includes('question')) {
    return (
      `Here's a **${mark} practice question**:\n\n` +
      `*"Construct an AVL tree by inserting the following keys in order: 10, 20, 30, 40, 50, 25. Show all rotations performed and the final balanced tree."*\n\n` +
      `**Hint:** You will encounter at least one RR rotation and one RL rotation.\n\n` +
      `Try it yourself, then ask me to verify your answer! 💪`
    );
  }
  return (
    `Thanks for your question! Based on **${mark}** format requirements and your selected documents:\n\n` +
    `I've found relevant content in *Module_3_Trees.pdf*. ` +
    `Could you be more specific? For example:\n` +
    `• "Explain AVL rotations with an example"\n` +
    `• "Give me a practice question on graph traversal"\n` +
    `• "What is the time complexity of BFS?"\n\n` +
    (strict ? '*(Strict mode is ON – answers limited to selected docs.)*' : '')
  );
}

// ─── Markdown-lite renderer ────────────────────────────────────────────────

function renderMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// ─── Component ─────────────────────────────────────────────────────────────

export function StudyMode({ user }: StudyModeProps) {
  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0];
  const initials = firstName.charAt(0).toUpperCase();

  // ── State ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [kitOpen, setKitOpen] = useState(true);
  const [selectedMark, setSelectedMark] = useState<typeof MARKS[number]>('8M');
  const [strict, setStrict] = useState(true);
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS);
  const [topics, setTopics] = useState<TopicItem[]>(INITIAL_TOPICS);
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // auto‑scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // auto‑resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const selectedDocs = docs.filter(d => d.selected);
  const activeTopics = topics.filter(t => t.active);

  const toggleDoc = (id: string) => setDocs(prev => prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  const toggleTopic = (id: string) => setTopics(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));

  const resetChat = () => setMessages([{ ...WELCOME, id: uid(), time: ts() }]);

  const sendMessage = useCallback((override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text, time: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: uid(),
        role: 'ai',
        content: generateResponse(text, selectedMark, strict),
        time: ts(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 900 + Math.random() * 600);
  }, [input, isTyping, selectedMark, strict]);

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
              <button className="sm-add-btn" title="Add document">+ Add</button>
            </div>
            <div className="sm-docs">
              {docs.map(doc => (
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
              ))}
            </div>
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
          {messages.map(msg =>
            msg.role === 'ai' ? (
              <div key={msg.id} className="sm-msg sm-msg--ai">
                <div className="sm-avatar sm-avatar--ai">
                  <span className="material-icons-outlined">smart_toy</span>
                </div>
                <div className="sm-msg-col">
                  <span className="sm-msg-meta">Moduly AI · {msg.time}</span>
                  <div className="sm-bubble sm-bubble--ai">
                    {msg.content.split('\n').map((line, i) => (
                      <p
                        key={i}
                        className="sm-bubble-line"
                        dangerouslySetInnerHTML={{ __html: renderMd(line) }}
                      />
                    ))}
                    {/* Quick-action buttons on first AI message */}
                    {msg.id === messages[0]?.id && (
                      <div className="sm-actions">
                        <button className="sm-action-btn" onClick={() => sendMessage('Give me a practice question on AVL rotations')}>
                          Generate Practice Q
                        </button>
                        <button className="sm-action-btn" onClick={() => sendMessage('Explain AVL rotation with an example')}>
                          Explain with example
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
            )
          )}

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
            <button className="sm-icon-btn" title="Attach file" onClick={() => alert('File upload coming soon!')}>
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
                disabled={isTyping}
              />
              <button
                className={`sm-send-btn ${input.trim() && !isTyping ? 'sm-send-btn--ready' : ''}`}
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                title="Send"
              >
                <span className="material-icons-outlined">send</span>
              </button>
            </div>
            <button className="sm-icon-btn" title="Voice input" onClick={() => alert('Voice input coming soon!')}>
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
