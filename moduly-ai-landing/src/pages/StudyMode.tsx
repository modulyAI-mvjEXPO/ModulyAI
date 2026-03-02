import { useState, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import './StudyMode.css';

interface StudyModeProps {
  user: User;
}

interface Message {
  role: 'ai' | 'user';
  text: string;
  time: string;
  isRich?: boolean;
}

const MARK_OPTIONS = ['2M', '8M', '10M'];

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'ai',
    text: "Hello! I've loaded your notes on **Trees & Graphs**. I see you want to focus on 8-mark questions.\n\nShall we start by explaining the concept of AVL tree rotations with an example, or would you like me to generate a practice question first?",
    time: 'Just now',
  },
];

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StudyMode({ user }: StudyModeProps) {
  const [selectedMark, setSelectedMark] = useState('8M');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [strictContext, setStrictContext] = useState(true);
  const [kitOpen, setKitOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0];
  const initials = firstName.charAt(0).toUpperCase();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: Message = { role: 'user', text: trimmed, time: now() };
    const aiMsg: Message = {
      role: 'ai',
      text: "That's a great question! Based on your selected documents and topics, here's what I found...\n\n*(AI response coming soon — integration in progress)*",
      time: now(),
    };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="sm-shell">
      {/* Ambient blobs */}
      <div className="sm-blob sm-blob-1" />
      <div className="sm-blob sm-blob-2" />

      {/* ── Body ── */}
      <div className="sm-body">

        {/* Study Kit sidebar */}
        <aside className={`sm-kit ${kitOpen ? 'sm-kit--open' : ''}`}>
          <div className="sm-kit-head">
            <h3 className="sm-kit-title">
              <span className="material-icons-outlined sm-kit-title-icon">build</span>
              Study Kit Builder
            </h3>
            <p className="sm-kit-sub">Select resources for AI context</p>
          </div>

          <div className="sm-kit-body">
            {/* Source docs */}
            <div className="sm-kit-section">
              <div className="sm-kit-section-header">
                <span className="sm-kit-label">Source Docs</span>
                <span className="sm-kit-add">Add New</span>
              </div>
              <div className="sm-kit-docs">
                <div className="sm-doc sm-doc--checked">
                  <span className="material-icons-outlined sm-doc-icon sm-doc-icon--pdf">picture_as_pdf</span>
                  <div className="sm-doc-info">
                    <p className="sm-doc-name">Module_3_Trees.pdf</p>
                    <p className="sm-doc-meta">24 pages · Uploaded yesterday</p>
                  </div>
                  <div className="sm-doc-check sm-doc-check--on">
                    <span className="material-icons-outlined sm-check-icon">check</span>
                  </div>
                </div>
                <div className="sm-doc">
                  <span className="material-icons-outlined sm-doc-icon sm-doc-icon--doc">description</span>
                  <div className="sm-doc-info">
                    <p className="sm-doc-name">Class_Notes_Graphs.docx</p>
                    <p className="sm-doc-meta">5 pages · Uploaded 2 days ago</p>
                  </div>
                  <div className="sm-doc-check" />
                </div>
              </div>
            </div>

            {/* Active topics */}
            <div className="sm-kit-section">
              <div className="sm-kit-section-header">
                <span className="sm-kit-label">Active Topics</span>
              </div>
              <div className="sm-topics">
                <span className="sm-topic sm-topic--active">AVL Trees</span>
                <span className="sm-topic sm-topic--active">Graph Traversal</span>
                <span className="sm-topic">+ BFS</span>
                <span className="sm-topic">+ DFS</span>
              </div>
            </div>

            {/* Strict context toggle */}
            <div className="sm-kit-section sm-kit-section--border">
              <label className="sm-strict-row">
                <span className="sm-strict-label">Strict Context</span>
                <div className="sm-toggle-wrap">
                  <input
                    type="checkbox"
                    id="strict-context-toggle"
                    className="sm-toggle-input"
                    checked={strictContext}
                    onChange={() => setStrictContext(v => !v)}
                    title="Toggle strict context mode"
                  />
                  <label
                    htmlFor="strict-context-toggle"
                    className={`sm-toggle ${strictContext ? 'sm-toggle--on' : ''}`}
                    aria-hidden="true"
                  >
                    <div className="sm-toggle-knob" />
                  </label>
                </div>
              </label>
              <p className="sm-strict-hint">AI will strictly answer from selected docs.</p>
            </div>
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <div className="sm-chat">
          {/* Chat header */}
          <div className="sm-chat-head">
            <div className="sm-chat-head-left">
              {/* Study Kit toggle */}
              <button
                className="sm-kit-toggle"
                onClick={() => setKitOpen(o => !o)}
                title="Toggle Study Kit"
              >
                <span className="material-icons-outlined">
                  {kitOpen ? 'menu_open' : 'menu'}
                </span>
              </button>
              <div>
                <h1 className="sm-chat-title">AI Study Assistant</h1>
                <p className="sm-chat-status">
                  <span className="sm-status-dot" />
                  Online · Processing Module 3 Context
                </p>
              </div>
            </div>
            <div className="sm-chat-head-right">
              {/* Mark filter */}
              <div className="sm-mark-toggle">
                {MARK_OPTIONS.map(m => (
                  <button
                    key={m}
                    className={`sm-mark-btn ${selectedMark === m ? 'sm-mark-btn--active' : ''}`}
                    onClick={() => setSelectedMark(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                className="sm-reset-btn"
                onClick={() => setMessages(INITIAL_MESSAGES)}
                title="Reset chat"
              >
                <span className="material-icons-outlined">refresh</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="sm-messages">
            {messages.map((msg, i) =>
              msg.role === 'ai' ? (
                <div key={i} className="sm-msg sm-msg--ai">
                  <div className="sm-msg-avatar sm-msg-avatar--ai">
                    <span className="material-icons-outlined">smart_toy</span>
                  </div>
                  <div className="sm-msg-body">
                    <span className="sm-msg-time">Moduly AI · {msg.time}</span>
                    <div className="sm-bubble sm-bubble--ai">
                      {msg.text.split('\n').map((line, j) => (
                        <p key={j} className="sm-bubble-line"
                          dangerouslySetInnerHTML={{
                            __html: line
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          }}
                        />
                      ))}
                      {i === 2 && (
                        <>
                          <div className="sm-code-block">
                            Step 1: Perform Right Rotation on the right child.<br />
                            Step 2: Perform Left Rotation on the original critical node.
                          </div>
                          <div className="sm-tree-diagram">
                            <div className="sm-tree-side">
                              <div className="sm-tree-label">Before</div>
                              <pre className="sm-tree">{'10\n \\\n  15\n /\n12'}</pre>
                            </div>
                            <span className="material-icons-outlined sm-tree-arrow">arrow_forward</span>
                            <div className="sm-tree-side">
                              <div className="sm-tree-label sm-tree-label--after">After Balance</div>
                              <pre className="sm-tree">{'  12\n /  \\\n10    15'}</pre>
                            </div>
                          </div>
                          <div className="sm-bubble-actions">
                            <button className="sm-action-btn">Generate Practice Q</button>
                            <button className="sm-action-btn">Show Code Snippet</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="sm-msg sm-msg--user">
                  <div className="sm-msg-avatar sm-msg-avatar--user">{initials}</div>
                  <div className="sm-msg-body sm-msg-body--user">
                    <span className="sm-msg-time sm-msg-time--user">{firstName} · {msg.time}</span>
                    <div className="sm-bubble sm-bubble--user">
                      <p>{msg.text}</p>
                    </div>
                  </div>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="sm-input-bar">
            {/* Context chips */}
            <div className="sm-context-chips">
              <span className="sm-chip sm-chip--teal">
                <span className="material-icons-outlined sm-chip-icon">description</span>
                Module_3_Trees.pdf
              </span>
              <span className="sm-chip sm-chip--blue">
                <span className="material-icons-outlined sm-chip-icon">history</span>
                Last Session Context
              </span>
            </div>

            {/* Input row */}
            <div className="sm-input-row">
              <button className="sm-input-btn" title="Attach file">
                <span className="material-icons-outlined">attach_file</span>
              </button>
              <div className="sm-textarea-wrap">
                <textarea
                  className="sm-textarea"
                  placeholder={`Ask a question about Module 3… (${selectedMark})`}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                />
                <button className="sm-send-btn" onClick={sendMessage} title="Send">
                  <span className="material-icons-outlined">send</span>
                </button>
              </div>
              <button className="sm-input-btn" title="Voice input">
                <span className="material-icons-outlined">mic</span>
              </button>
            </div>

            <p className="sm-privacy">
              <span className="material-icons-outlined sm-privacy-icon">lock</span>
              AI accesses only selected documents. Your study data is private.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
