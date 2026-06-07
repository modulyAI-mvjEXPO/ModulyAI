import { useState, useRef, useEffect, useCallback } from 'react';
import type { DocumentRow } from '../lib/ai/types';
import { renderMarkdownRich } from '../lib/renderMarkdown';
import { ExamMode } from './ExamMode';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import { supabase } from '../lib/supabase';
import './Chat.css';

interface SessionDoc {
  id: string;
  name: string;
  source: 'device' | 'library';
  type: string;
  size?: number;
  file?: File;
  status: 'ready' | 'preparing' | 'error';
  progress: number;
}

interface ChatProps {
  user?: any;
  onNavigate?: (page: string) => void;
  initialSessionId?: string | null;
}

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  time: string;
  isNew?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  mode: 'study' | 'exam';
  messages: Message[];
  updatedAt: string;
}

const STORAGE_KEY = 'moduly-chat-sessions';

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}


async function syncSessionToSupabase(session: ChatSession, userId?: string) {
  if (!userId) return;
  try {
    const { error } = await supabase.from('chat_sessions').upsert({
      id: session.id,
      user_id: userId,
      title: session.title,
      mode: session.mode,
      messages: session.messages,
      updated_at: session.updatedAt
    });
    if (error) console.error('Failed to sync session:', error.message);
  } catch (err) {}
}

async function fetchSessionsFromSupabase(userId: string): Promise<ChatSession[]> {
  try {
    const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (!error && data) {
      return data.map(row => ({
        id: row.id,
        title: row.title,
        mode: row.mode,
        messages: row.messages || [],
        updatedAt: row.updated_at
      }));
    }
  } catch (err) {}
  return [];
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function TypewriterMessage({ content }: { content: string }) {
  const [charIndex, setCharIndex] = useState(0);
  const htmlRef = useRef('');

  // For long responses, skip typing animation entirely
  const skipAnimation = content.length > 800;

  useEffect(() => {
    htmlRef.current = renderMarkdownRich(content);
    setCharIndex(skipAnimation ? content.length : 0);
  }, [content, skipAnimation]);

  // Animate reveal (only for short content)
  useEffect(() => {
    if (skipAnimation || charIndex >= content.length) return;
    const chunkSize = content.length > 300 ? 6 : 3;
    const timer = setTimeout(() => {
      setCharIndex(prev => Math.min(prev + chunkSize, content.length));
    }, 12);
    return () => clearTimeout(timer);
  }, [charIndex, content.length, skipAnimation]);

  const html = charIndex >= content.length
    ? htmlRef.current
    : renderMarkdownRich(content.slice(0, charIndex));

  return (
    <div
      className="chat-message-content chat-markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Chat({ user, initialSessionId }: ChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'study' | 'exam'>('study');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfProcessed, setPdfProcessed] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [markerMode, setMarkerMode] = useState<'2M' | '5M' | '8M' | '10M'>('2M');
  const [showMarkerModes, setShowMarkerModes] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Attach menu & library modal
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [sessionDocs, setSessionDocs] = useState<SessionDoc[]>([]);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const [modes, setModes] = useState({
    builtIn: true,
    docuOnly: true,
    webSearch: false
  });


  const handleRenameSession = (e: React.FormEvent | React.FocusEvent, id: string) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, title: editTitle.trim(), updatedAt: new Date().toISOString() } : s);
      saveSessions(updated);
      const changed = updated.find(s => s.id === id);
      if (changed && user?.id) syncSessionToSupabase(changed, user.id);
      return updated;
    });
    setEditingSessionId(null);
  };

  const toggleMode = (mode: keyof typeof modes) => {
    setModes(prev => {
      const next = { ...prev, [mode]: !prev[mode] };
      if (!next.builtIn && !next.docuOnly && !next.webSearch) {
        return prev;
      }
      return next;
    });
  };


  useEffect(() => {
    if (user?.id) {
      fetchSessionsFromSupabase(user.id).then(supaSessions => {
        if (supaSessions.length > 0) {
          setSessions(supaSessions);
          saveSessions(supaSessions); // Update local cache
        }
      });
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (initialSessionId) {
      const found = sessions.find(s => s.id === initialSessionId);
      if (found) loadSession(found);
    }
  }, [initialSessionId, sessions.length]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const keywords = /\b(question|questions|answer|answers|marker|markers|marks|qa|q&a)\b/i;
    setShowMarkerModes(keywords.test(input));
  }, [input]);

  // Persist session on message change
  const persistSession = useCallback((msgs: Message[]) => {
    if (msgs.length === 0) return;
    const title = msgs[0]?.content.slice(0, 50) || 'New Session';
    const now = new Date().toISOString();

    setSessions(prev => {
      let updated: ChatSession[];
      let targetId = activeSessionId;
      if (targetId) {
        updated = prev.map(s =>
          s.id === targetId ? { ...s, messages: msgs, title, updatedAt: now } : s
        );
      } else {
        targetId = Date.now().toString();
        setActiveSessionId(targetId);
        updated = [{ id: targetId, title, mode: chatMode, messages: msgs, updatedAt: now }, ...prev];
      }
      saveSessions(updated);
      if (user?.id) {
        const current = updated.find(s => s.id === targetId);
        if (current) syncSessionToSupabase(current, user.id);
      }
      return updated;
    });
  }, [activeSessionId, chatMode, user?.id]);

  // Close attach menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    if (attachMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [attachMenuOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.webp'];
    const newDocs: SessionDoc[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const fileName = file.name.toLowerCase();
      const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));
      if (!isAllowed) continue;

      newDocs.push({
        id: `device-${Date.now()}-${i}`,
        name: file.name,
        source: 'device',
        type: file.type || 'application/octet-stream',
        size: file.size,
        file,
        status: 'ready',
        progress: 100,
      });
    }

    if (newDocs.length === 0 && files.length > 0) {
      alert('Error: Unsupported file format.\n\nSupported formats:\n• PDF (including scanned)\n• Word (DOCX)\n• PowerPoint (PPTX)\n• Text (TXT)\n• Images (PNG, JPG, JPEG, WEBP)\n\nPlease select a valid file.');
    }

    if (newDocs.length > 0) {
      // For backward compat, set selectedFile to the first device file
      setSelectedFile(newDocs[0]!.file!);
      setPdfProcessed(false);
      setConversationContext('');
    }

    setSessionDocs(prev => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const prepareLibraryDoc = useCallback(async (docId: string) => {
    // Reset to preparing state
    setSessionDocs(prev => prev.map(d =>
      d.id === docId ? { ...d, status: 'preparing', progress: 5 } : d
    ));

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const maxPollTime = 60_000; // 60s safety timeout
    const pollStart = Date.now();

    try {
      // Start polling for progress BEFORE the fetch (poll runs in parallel)
      pollInterval = setInterval(async () => {
        // Safety: stop after max time
        if (Date.now() - pollStart > maxPollTime) {
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = null;
          return;
        }
        try {
          const statusRes = await fetch(`http://localhost:3001/api/prepare-library-doc/status/${docId}`);
          const statusData = await statusRes.json();
          if (statusData.progress != null) {
            setSessionDocs(prev => prev.map(d =>
              d.id === docId && d.status === 'preparing'
                ? { ...d, progress: statusData.progress }
                : d
            ));
          }
        } catch { /* ignore polling errors */ }
      }, 500);

      // Fire the actual preparation request (this awaits until done)
      const res = await fetch('http://localhost:3001/api/prepare-library-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });

      // Stop polling
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('prepare-library-doc failed:', errData);
        setSessionDocs(prev => prev.map(d =>
          d.id === docId ? { ...d, status: 'error', progress: 0 } : d
        ));
        return;
      }

      // Mark as ready
      setSessionDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, status: 'ready', progress: 100 } : d
      ));
    } catch (err) {
      console.error('prepareLibraryDoc error:', err);
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      setSessionDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, status: 'error', progress: 0 } : d
      ));
    }
  }, []);

  const handleLibrarySave = (docs: DocumentRow[]) => {
    const newDocs: SessionDoc[] = docs
      .filter(d => !sessionDocs.some(sd => sd.id === d.id))
      .map(d => ({
        id: d.id,
        name: d.title,
        source: 'library' as const,
        type: d.file_type,
        size: d.file_size ?? undefined,
        status: 'preparing' as const,
        progress: 0,
      }));
    setSessionDocs(prev => [...prev, ...newDocs]);

    // Kick off preparation for each new doc
    for (const doc of newDocs) {
      prepareLibraryDoc(doc.id);
    }
  };

  const removeSessionDoc = (docId: string) => {
    setSessionDocs(prev => {
      const updated = prev.filter(d => d.id !== docId);
      // If we removed the current device file, clear it
      const removedDoc = prev.find(d => d.id === docId);
      if (removedDoc?.source === 'device' && removedDoc.file === selectedFile) {
        setSelectedFile(null);
        setPdfProcessed(false);
        setConversationContext('');
      }
      return updated;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    if (!selectedFile && sessionDocs.length === 0 && modes.docuOnly) {
      alert("Please attach a document or disable Docu-Only mode!");
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, time };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      let responseText: string;

      if (!selectedFile) {
        const historyParams = messages.map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          content: m.content
        }));

        const res = await fetch("http://localhost:3001/api/chat-general", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input,
            history: historyParams.slice(-6),
            markerMode: showMarkerModes ? markerMode : undefined
          })
        });

        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        responseText = data.response;
      } else if (!pdfProcessed) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("question", input);
        formData.append("modes", JSON.stringify(modes));

        const response = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          body: formData
        });

        if (!response.ok) throw new Error("Server error");
        const data = await response.json();
        responseText = data.answer;

        setConversationContext(`User asked: "${input}"\nAI answered: "${responseText}"`);
        setPdfProcessed(true);
      } else {
        const historyParams = messages.map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          content: m.content
        }));

        const res = await fetch("http://localhost:3001/api/chat-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input,
            context: conversationContext,
            history: historyParams.slice(-6),
            modes,
            markerMode: showMarkerModes ? markerMode : undefined
          })
        });

        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        responseText = data.response;

        setConversationContext(prev =>
          `${prev}\n\nUser asked: "${input}"\nAI answered: "${responseText}"`
        );
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: responseText || "No response generated.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNew: true
      };
      setMessages(prev => {
        const updated = prev.map(m => ({ ...m, isNew: false }));
        const final = [...updated, aiMsg];
        persistSession(final);
        return final;
      });
    } catch (error) {
      console.error('Chat error:', error);
      let errorMessage = "Sorry, something went wrong. Make sure the backend is running on port 3001.";

      if (error instanceof Error) {
        if (error.message.includes("PDF") || error.message.includes("image") || error.message.includes("pdf")) {
          errorMessage = "Only PDF files are supported. This model does not accept images or other formats.";
        }
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: errorMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNew: true
      };
      setMessages(prev => {
        const updated = prev.map(m => ({ ...m, isNew: false }));
        const final = [...updated, errorMsg];
        persistSession(final);
        return final;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setPdfProcessed(false);
    setConversationContext('');
    setSelectedFile(null);
    setSessionDocs([]);
  };

  const loadSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setChatMode(session.mode || 'study');
    setMessages(session.messages.map(m => ({ ...m, isNew: false })));
    setPdfProcessed(true);
    setConversationContext(
      session.messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: "${m.content}"`).join('\n')
    );
    setSelectedFile(null);
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveSessions(updated);
      return updated;
    });
    if (user?.id) {
      supabase.from('chat_sessions').delete().eq('id', sessionId).then();
    }
    if (activeSessionId === sessionId) {
      startNewChat();
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return 'picture_as_pdf';
      case 'docx': case 'doc': return 'description';
      case 'pptx': case 'ppt': return 'slideshow';
      case 'txt': return 'article';
      case 'png': case 'jpg': case 'jpeg': case 'webp': return 'image';
      default: return 'attach_file';
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={`chat-layout ${sidebarOpen ? '' : 'chat-layout--collapsed'}`}>

      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar--open' : ''}`}>
        <div className="chat-sidebar-header">
          <span className="chat-sidebar-title">SESSIONS</span>
          <button
            className="chat-sidebar-collapse"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
          >
            <span className="material-icons-outlined">chevron_left</span>
          </button>
        </div>

        {/* ── Floating Study/Exam toggle in Sidebar ── */}
        <div className="chat-sidebar-toggle-wrap">
          <div className="chat-sidebar-toggle">
            <button
              className={`chat-toggle-btn ${chatMode === 'study' ? 'chat-toggle-btn--active' : ''}`}
              onClick={() => { setChatMode('study'); startNewChat(); }}
            >
              <span className="material-icons-outlined">menu_book</span>
              Study
            </button>
            <button
              className={`chat-toggle-btn ${chatMode === 'exam' ? 'chat-toggle-btn--active' : ''}`}
              onClick={() => { setChatMode('exam'); startNewChat(); }}
            >
              <span className="material-icons-outlined">quiz</span>
              Exam
            </button>
            <div 
              className={`chat-toggle-slider ${chatMode === 'exam' ? 'chat-toggle-slider--exam' : ''}`}
            />
          </div>
        </div>

        <button className="chat-sidebar-new" onClick={startNewChat}>
          <span className="material-icons-outlined">add</span>
          New Session
        </button>

        <div className="chat-sidebar-list">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`chat-sidebar-item ${s.id === activeSessionId ? 'chat-sidebar-item--active' : ''}`}
            >
              {editingSessionId === s.id ? (
                <form className="chat-sidebar-item-btn chat-sidebar-item-edit-form" onSubmit={(e) => handleRenameSession(e, s.id)}>
                  <input
                    autoFocus
                    className="chat-sidebar-item-edit-input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={(e) => handleRenameSession(e, s.id)}
                    aria-label="Rename session"
                    title="Rename session"
                    placeholder="Rename session"
                  />
                </form>
              ) : (
                <button
                  className="chat-sidebar-item-btn"
                  onClick={() => loadSession(s)}
                  onDoubleClick={() => { setEditingSessionId(s.id); setEditTitle(s.title); }}
                  title={s.title}
                >
                  <div className="chat-sidebar-item-icon-col">
                    <span className="material-icons-outlined chat-sidebar-item-icon">
                      {s.mode === 'exam' ? 'quiz' : 'menu_book'}
                    </span>
                  </div>
                  <span className="chat-sidebar-item-text">{s.title}</span>
                </button>
              )}
              {editingSessionId !== s.id && (
                <div className="chat-sidebar-actions">
                  <button
                    className="chat-sidebar-item-edit"
                    onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setEditTitle(s.title); }}
                    title="Rename session"
                  >
                    <span className="material-icons-outlined">edit</span>
                  </button>
                  <button
                    className="chat-sidebar-item-delete"
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    title="Delete session"
                  >
                    <span className="material-icons-outlined">delete_outline</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="chat-sidebar-empty">No previous sessions</p>
          )}
        </div>
      </aside>

      {/* Collapse handle (visible when sidebar is closed) */}
      {!sidebarOpen && (
        <button
          className="chat-sidebar-expand"
          onClick={() => setSidebarOpen(true)}
          title="Expand sidebar"
        >
          <span className="material-icons-outlined">chevron_right</span>
        </button>
      )}

      {/* ── Main Chat Area ── */}
      <div className="chat-page">
        {chatMode === 'exam' ? (
          <ExamMode user={user} initialMessages={chatMode === 'exam' ? messages : undefined} onMessagesChange={(msgs) => { setMessages(msgs); persistSession(msgs); }} />
        ) : (
          <>
            {/* ── Messages Area or Hero ── */}
            {hasMessages ? (
              <div className="chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-message chat-message--${msg.role}`}>
                    <div className="chat-message-avatar">
                      {msg.role === 'ai' ? '🤖' : '👈'}
                    </div>
                    <div className="chat-message-body">
                      <div className="chat-message-name">
                        {msg.role === 'ai' ? 'Moduly' : 'You'}
                        <span className="chat-message-time">{msg.time}</span>
                      </div>
                      {msg.role === 'ai' ? (
                        msg.isNew ? (
                          <TypewriterMessage content={msg.content} />
                        ) : (
                          <div
                            className="chat-message-content chat-markdown-body"
                            dangerouslySetInnerHTML={{ __html: renderMarkdownRich(msg.content) }}
                          />
                        )
                      ) : (
                        <div className="chat-message-content">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="chat-message chat-message--ai">
                    <div className="chat-message-avatar">🤖</div>
                    <div className="chat-message-body">
                      <div className="chat-message-name">Moduly</div>
                      <div className="chat-message-content chat-typing">
                        <span className="chat-typing-dot"></span>
                        <span className="chat-typing-dot"></span>
                        <span className="chat-typing-dot"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="chat-hero">
                <div className="chat-hero-emoji">🤖</div>
                <h1>Your Assistant</h1>
                <p className="chat-hero-subtitle">
                  your personalized study companion <span className="chat-hero-smile">:)</span>
                </p>
              </div>
            )}

            {/* ── Input Area (Side-by-side) ── */}
            <div className="chat-input-layout-row">
              {/* ── Composer ── */}
              <div className="chat-composer">
                {/* New Chat pill */}
                {hasMessages && (
                  <button onClick={startNewChat} className="chat-new-btn" title="New Chat">
                    <span className="material-icons-outlined">add</span>
                    New Chat
                  </button>
                )}

                {/* ── Search Card ── */}
                <form className="chat-search-card" onSubmit={handleSubmit}>
                  {/* Textarea */}
                  <div className="chat-textarea-wrap">
                    <textarea
                      ref={textareaRef}
                      className="chat-input"
                      title="Message"
                      aria-label="Message"
                      placeholder={sessionDocs.length > 0 ? "Ask about your documents..." : "Ask anything or attach a document..."}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isTyping}
                      rows={1}
                    />
                  </div>

                  {/* Toolbar */}
                  <div className="chat-search-toolbar">
                    <div className="chat-toolbar-left">
                      {/* Attach dropdown */}
                      <div className="chat-attach-wrap" ref={attachMenuRef}>
                        <button
                          type="button"
                          className={`chat-icon-btn ${attachMenuOpen ? 'chat-icon-btn--active' : ''}`}
                          onClick={() => setAttachMenuOpen(prev => !prev)}
                          title="Attach documents"
                        >
                          <span className="material-icons-outlined">attach_file</span>
                        </button>
                        {attachMenuOpen && (
                          <div className="chat-attach-menu">
                            <button
                              type="button"
                              className="chat-attach-menu-item"
                              onClick={() => {
                                setAttachMenuOpen(false);
                                setLibraryModalOpen(true);
                              }}
                            >
                              <span className="material-icons-outlined">local_library</span>
                              Library
                            </button>
                            <button
                              type="button"
                              className="chat-attach-menu-item"
                              onClick={() => {
                                setAttachMenuOpen(false);
                                if (fileInputRef.current) fileInputRef.current.click();
                              }}
                            >
                              <span className="material-icons-outlined">folder</span>
                              From Device
                            </button>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".pdf,.docx,.doc,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                        style={{ display: 'none' }}
                      />

                      {/* Triad */}
                      <div className="chat-triad">
                        <button
                          type="button"
                          className={`chat-triad-btn ${modes.builtIn ? 'chat-triad-btn--active' : ''}`}
                          onClick={() => toggleMode('builtIn')}
                        >
                          Built-In
                        </button>
                        <button
                          type="button"
                          className={`chat-triad-btn ${modes.docuOnly ? 'chat-triad-btn--active' : ''}`}
                          onClick={() => toggleMode('docuOnly')}
                        >
                          Docu-Only
                        </button>
                        <button
                          type="button"
                          className={`chat-triad-btn ${modes.webSearch ? 'chat-triad-btn--active' : ''}`}
                          onClick={() => toggleMode('webSearch')}
                        >
                          Web-Search
                        </button>
                      </div>

                      {/* Marker mode toggle */}
                      {showMarkerModes && (
                        <div className="chat-marker-modes">
                          {(['2M', '5M', '8M', '10M'] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              className={`chat-marker-btn ${markerMode === m ? 'chat-marker-btn--active' : ''}`}
                              onClick={() => setMarkerMode(m)}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="chat-toolbar-right">
                      <button type="submit" className="chat-send-btn" disabled={isTyping || !input.trim()}>
                        <span className="material-icons-outlined">arrow_upward</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* ── Session Docs Panel (Side by Side) ── */}
              {sessionDocs.length > 0 && (
                <div className="chat-session-docs-sidebar">
                  <div className="chat-session-docs-header">
                    <span className="material-icons-outlined chat-session-docs-icon">folder_special</span>
                    <span className="chat-session-docs-title">Docs Selected for the Session</span>
                    <span className="chat-session-docs-count">{sessionDocs.length}</span>
                  </div>
                  <div className="chat-session-docs-list">
                    {sessionDocs.map(doc => (
                      <div key={doc.id} className={`chat-session-doc-chip ${doc.status === 'preparing' ? 'chat-session-doc-chip--loading' : ''} ${doc.status === 'error' ? 'chat-session-doc-chip--error' : ''}`}>
                        <span className="material-icons-outlined chat-session-doc-chip-icon">
                          {doc.source === 'library' ? 'library_books' : getFileIcon(doc.name)}
                        </span>
                        <div className="chat-session-doc-chip-info">
                          <span className="chat-session-doc-chip-name">{doc.name}</span>
                          {doc.status === 'preparing' ? (
                            <div className="chat-session-doc-progress-wrap">
                              <div className="chat-session-doc-progress-bar">
                                <div className="chat-session-doc-progress-fill" style={{ width: `${doc.progress}%` }} />
                              </div>
                              <span className="chat-session-doc-progress-text">{doc.progress}%</span>
                            </div>
                          ) : doc.status === 'error' ? (
                            <span className="chat-session-doc-chip-status chat-session-doc-chip-status--error">
                              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>error</span>
                              Failed — tap to retry
                            </span>
                          ) : (
                            <span className="chat-session-doc-chip-status">
                              <span className="chat-session-doc-status-dot" />
                              Parsed and Ready
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="chat-session-doc-chip-remove"
                          onClick={() => doc.status === 'error' ? prepareLibraryDoc(doc.id) : removeSessionDoc(doc.id)}
                          title={doc.status === 'error' ? 'Retry preparation' : 'Remove document'}
                        >
                          <span className="material-icons-outlined">{doc.status === 'error' ? 'refresh' : 'close'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Library Document Picker Modal ── */}
      <DocumentPickerModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        initialSelectedIds={new Set(sessionDocs.filter(d => d.source === 'library').map(d => d.id))}
        onSave={handleLibrarySave}
      />
    </div>
  );
}