import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import { getCachedResult, setCachedResult, makeCacheKey } from '../lib/docGrounding';
import { renderMarkdownRich } from '../lib/renderMarkdown';

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

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() {
  return Math.random().toString(36).slice(2);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getWelcome(docCount: number): Message {
  const content = docCount > 0
    ? `Hello! I've loaded **${docCount} document${docCount !== 1 ? 's' : ''}** from your study materials. Select your target mark and ask me anything!\n\nI'll ground my answers in your uploaded notes. You can toggle **Strict Context** to limit answers to only your documents.`
    : `Hello! Welcome to Study Mode. You haven't uploaded any documents yet.\n\nYou can still ask me questions and I'll answer using general knowledge. For RAG-grounded answers from your notes, upload documents first!`;
  return { id: uid(), role: 'ai', content, time: 'Just now' };
}

// ─── Chat API ──────────────────────────────────────────────────────────────



function buildHistory(msgs: ReadonlyArray<Message>): ReadonlyArray<{ role: 'user' | 'assistant'; content: string }> {
  return msgs
    .filter(m => m.role === 'user' || m.role === 'ai')
    .slice(-10)
    .map(m => ({
      role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));
}

// ─── Markdown renderer (shared) ────────────────────────────────────────────
// Uses renderMarkdownRich from ../lib/renderMarkdown

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
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [parsingDocs, setParsingDocs] = useState(false);
  const docsLoading = false;
  const [parsingDocNames, setParsingDocNames] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive reveal state
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedLen, setRevealedLen] = useState(0);

  // ── Document-Grounded Mode state ─────────────────────────────────────
  type GroundingMode = 'general' | 'document';
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('general');
  const initialSelectedIds = useMemo(() => new Set(docs.map(d => d.id)), [docs]);

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

  // reset subject (no longer reset topics)
  useEffect(() => {
    // Topics removed - no longer needed
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
  const isRevealing = !!revealingId;
  const isBusy = isTyping || isRevealing;

  const toggleDoc = (id: string) => setDocs(prev => prev.filter(d => d.id !== id));
  const selectAllDocs = () => {}; // No longer needed as docs are selected in modal
  const selectNoneDocs = () => setDocs([]);


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

    // For direct upload in chat, we just stage the file.
    // It will be uploaded when the user sends their first message.
    setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAndProcessAttachedFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    const backendBase = import.meta.env.VITE_BACKEND_URL || '';
    try {
      // Convert file to base64 to send it as JSON payload through proxy
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
          let encoded = reader.result as string;
          encoded = encoded.split(',')[1] || '';
          resolve(encoded);
        };
        reader.onerror = error => reject(error);
      });

      const base64Data = await toBase64(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `chat-uploads/${user.id}/${Date.now()}-${safeName}`;

      const backendResponse = await fetch(`${backendBase}/upload-to-utho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          contentType: file.type || 'application/octet-stream',
          base64Data
        }),
      });

      if (!backendResponse.ok) throw new Error('Failed to upload file to storage');

      // 3. Trigger synchronous processing (Utho -> Vectara -> Supabase)
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

      if (!processResponse.ok) throw new Error('Failed to process document');
      const processData = await processResponse.json();
      return processData.documentId;
    } catch (err) {
      console.error('File upload/process error:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isBusy) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text, time: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    let activeDocIds = docs.map(d => d.id);

    // If there's an attached file, upload it first
    if (attachedFile) {
      const newDocId = await uploadAndProcessAttachedFile(attachedFile);
      if (newDocId) {
        const newDoc: DocItem = {
          id: newDocId,
          name: attachedFile.name,
          type: attachedFile.type === 'application/pdf' ? 'pdf' : 'doc',
          meta: 'Ready',
          selected: true
        };
        setDocs(prev => [newDoc, ...prev]);
        activeDocIds = [newDocId, ...activeDocIds];
        setGroundingMode('document');
      }
      setAttachedFile(null);
    }

    try {
      // ── Document-Grounded Mode ─────────────────────────────────────────
      if (groundingMode === 'document' || attachedFile) {
        const docIds = activeDocIds;

        // Check cache first
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

        // Get first document to send to Gemini
        const firstDoc = docs.find(d => d.selected);
        if (!firstDoc) {
          setIsTyping(false);
          const msg: Message = { id: uid(), role: 'ai', content: "Please select a document first.", time: ts() };
          setMessages(prev => [...prev, msg]);
          return;
        }

        // Get document URL from storage
        const { data: urlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(firstDoc.id, 3600);

        if (!urlData?.signedUrl) {
          throw new Error("Could not access document");
        }

        // Fetch the PDF file
        const fileResponse = await fetch(urlData.signedUrl);
        const fileBlob = await fileResponse.blob();
        void await blobToBase64(fileBlob);

        // Call backend with PDF
        const formData = new FormData();
        formData.append("file", fileBlob, "document.pdf");
        formData.append("question", text);

        const aiRes = await fetch("http://localhost:3001/api/chat", {
          method: "POST",
          body: formData
        });

        if (!aiRes.ok) throw new Error("AI request failed");
        const { answer } = await aiRes.json();

        setCachedResult(cacheKey, { response: answer, sources: [], confidenceScore: 100 });
        setIsTyping(false);
        const docAiMsg: Message = { id: uid(), role: 'ai', content: answer, time: ts(), sources: [], confidenceScore: 100, isGrounded: true };
        setMessages(prev => [...prev, docAiMsg]);
        setRevealingId(docAiMsg.id);
        setRevealedLen(0);
        return;
      }

      // ── General AI Mode ────────────────────────────────────────────────
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const history = buildHistory([...messages, userMsg]).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(`${backendBase}/chat-general`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history })
      });

      let responseText = "Sorry, I encountered an error. Please try again.";
      if (res.ok) {
        const data = await res.json();
        responseText = data.response;
      }

      setIsTyping(false);
      const generalAiMsg: Message = { id: uid(), role: 'ai', content: responseText, time: ts() };
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
  }, [input, isBusy, selectedMark, docs, messages, groundingMode, user]);




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
    
    if (set.grounding_mode === 'document' && set.documents.length > 0) {
      // Restore selected docs from saved session as DocItems
      setDocs(set.documents.map((id: string) => ({
        id,
        name: id,
        type: 'pdf' as const,
        meta: 'Indexed',
        selected: true,
      })));
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
            initialSelectedIds={initialSelectedIds}
            onSave={(selectedRows) => {
              // Simply store the selected doc IDs
              const newDocs = selectedRows.map(r => ({
                id: r.id,
                name: r.title,
                type: (r.file_type === 'application/pdf' ? 'pdf' : 'doc') as 'pdf' | 'doc',
                meta: r.status === 'ready' ? `${r.chunk_count ?? 0} chunks` : 'Processing...',
                selected: true
              }));
              setDocs(newDocs);
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
                    <div
                      className="sm-markdown-body"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownRich(displayContent) }}
                    />
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
              <div className="sm-bubble sm-bubble--ai sm-typing-bubble sm-typing-container">
                <span className="sm-typing-status">Analyzing study materials...</span>
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
              {attachedFile && (
                <div className="sm-attached-file">
                  <span className="material-icons-outlined">description</span>
                  <span className="sm-attached-name">{attachedFile.name}</span>
                  <button className="sm-attached-remove" onClick={() => setAttachedFile(null)}>
                    <span className="material-icons-outlined">close</span>
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="sm-textarea"
                placeholder={attachedFile ? "Ask about this file..." : `Ask a question… (${selectedMark} format)`}
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
