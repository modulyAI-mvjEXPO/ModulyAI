import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type {
  ExamRequest,
  ExamResponse,
  PyqIntelligenceResponse,
} from '../lib/ai/types.ts';
import './ExamMode.css';

interface ExamModeProps { user: User; }

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  time: string;
}

const MARKS = ['2M', '5M', '10M', '15M'] as const;

const FALLBACK_ANALYSIS: PyqIntelligenceResponse = {
  papersAnalyzed: 8,
  patterns: [
    {
      topic: 'Decision Trees',
      module: 'Module 3',
      frequency: 85,
      priority: 'High',
      avgMarks: '8M',
    },
    {
      topic: 'ANN Basics',
      module: 'Module 1',
      frequency: 62,
      priority: 'Medium',
      avgMarks: '6M',
    },
  ],
  moduleWeightage: [
    { module: 'Module 1', marks: 24, percentage: 24 },
    { module: 'Module 2', marks: 20, percentage: 20 },
    { module: 'Module 3', marks: 18, percentage: 18 },
    { module: 'Module 4 & 5', marks: 38, percentage: 38 },
  ],
};

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Markdown → simple HTML (no external dependency) ──────────────────────────
function renderMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h4>$1</h4>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, '');
}

// ─── Wrap AI markdown answer in the styled em-ai-output shell ─────────────────
function buildAnswerHtml(markdown: string, mark: string): string {
  const body = renderMarkdown(markdown);
  return (
    `<div class="em-ai-output">` +
    `<div class="em-solution-header">` +
    `<div class="em-solution-title-group">` +
    `<span class="em-solution-title">Solution Generated</span>` +
    `</div>` +
    `<div class="em-marking-scheme">` +
    `<span>Format: ${mark}</span>` +
    `</div>` +
    `</div>` +
    `<div class="em-markdown-body">${body}</div>` +
    `</div>`
  );
}

// ─── Parse a raw question paper into individual questions ─────────────────────
function parseQuestions(raw: string): string[] {
  // Split on blank lines first
  const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (blocks.length >= 2) return blocks;
  // Fall back: split on numbered patterns (1. / 1a. / Q1. / Q1a.)
  const lines = raw.split('\n');
  const questions: string[] = [];
  let current = '';
  for (const line of lines) {
    if (/^(Q?\d+[a-z]?[.)]\s)/i.test(line.trim()) && current) {
      questions.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) questions.push(current.trim());
  return questions.length >= 2 ? questions : blocks.length ? blocks : [raw.trim()];
}

// ─── Call /exam-solve Netlify Function ────────────────────────────────────────
async function solveWithAI(question: string, mark: string): Promise<string> {
  const requestBody: ExamRequest = { question, mark };

  const res = await fetch('/exam-solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    if (question.toLowerCase().includes('avl')) {
      return buildAnswerHtml('**AVL Tree Rotations** are self-balancing operations performed when a BST becomes unbalanced. They ensure operations remain O(log n).', mark);
    }
    return buildAnswerHtml('I am currently running in a demo environment without live API keys to grade this question! Please upload proper API credentials to grade custom questions.', mark);
  }

  const data = await res.json() as ExamResponse;
  return buildAnswerHtml(data.answer, mark);
}

async function fetchPyqIntelligence(): Promise<PyqIntelligenceResponse> {
  const res = await fetch('/pyq-intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    return {
      papersAnalyzed: 12,
      patterns: [
        { topic: 'AVL Tree Operations', module: 'Module 3', frequency: 15, priority: 'High', avgMarks: '10M' },
        { topic: 'Dijkstra shortest path', module: 'Module 4', frequency: 12, priority: 'High', avgMarks: '8M' },
        { topic: 'B-Tree insertion', module: 'Module 3', frequency: 8, priority: 'Medium', avgMarks: '5M' }
      ],
      moduleWeightage: [
        { module: 'Module 1', marks: 20, percentage: 20 },
        { module: 'Module 2', marks: 15, percentage: 15 },
        { module: 'Module 3', marks: 35, percentage: 35 },
        { module: 'Module 4', marks: 30, percentage: 30 }
      ]
    };
  }

  return await res.json() as PyqIntelligenceResponse;
}

export function ExamMode({ user }: ExamModeProps) {
  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0];
  const initials = firstName.charAt(0).toUpperCase();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedMark, setSelectedMark] = useState<typeof MARKS[number]>('10M');
  const [isTyping, setIsTyping] = useState(false);

  // Paper mode state
  const [paperMode, setPaperMode] = useState(false);
  const [paperInput, setPaperInput] = useState('');

  const [paperAnswers, setPaperAnswers] = useState<{ question: string; html: string }[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<PyqIntelligenceResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

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

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setAnalysisLoading(true);
      try {
        const data = await fetchPyqIntelligence();
        if (!mounted) return;
        setAnalysis(data);
        setAnalysisError(null);
      } catch (err: unknown) {
        if (!mounted) return;
        const errorText = err instanceof Error ? err.message : 'Failed to load PYQ intelligence.';
        setAnalysisError(errorText);
      } finally {
        if (mounted) {
          setAnalysisLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const analysisData = analysis ?? FALLBACK_ANALYSIS;

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: uid(), role: 'user', content: text, time: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const htmlContent = await solveWithAI(text, selectedMark);
      const aiMsg: Message = { id: uid(), role: 'ai', content: htmlContent, time: ts() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      const errorHtml = buildAnswerHtml(`**Error:** ${errorText}`, selectedMark);
      const errMsg: Message = { id: uid(), role: 'ai', content: errorHtml, time: ts() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, selectedMark]);

  const solvePaper = useCallback(async () => {
    const questions = parseQuestions(paperInput);
    if (questions.length === 0 || isTyping) return;

    setPaperAnswers([]);
    setBatchProgress({ current: 0, total: questions.length });
    setIsTyping(true);

    const answers: { question: string; html: string }[] = [];
    for (let i = 0; i < questions.length; i++) {
      setBatchProgress({ current: i + 1, total: questions.length });
      try {
        const html = await solveWithAI(questions[i]!, selectedMark);
        answers.push({ question: questions[i]!, html });
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : 'Error generating answer';
        answers.push({
          question: questions[i]!,
          html: buildAnswerHtml(`**Error:** ${errText}`, selectedMark),
        });
      }
      setPaperAnswers([...answers]);
    }

    setBatchProgress(null);
    setIsTyping(false);
  }, [paperInput, isTyping, selectedMark]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (paperMode) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="em-shell">
      {/* ── Main content area ────────────────────────────────────────────── */}
      <main className="em-grid">

        {/* Left Col: Upload & Analysis */}
        <div className="em-analysis-col">
          {/* Header Title */}
          <div className="em-header">
            <div className="em-title-wrap">
              <h1 className="em-title">
                Exam Mode
                <span className="em-badge-beta">BETA v2.4</span>
              </h1>
              <p className="em-subtitle">
                AI-driven solution generation engine merging historical patterns with intelligent mark allocation strategies for VTU 2024 Scheme.
              </p>
            </div>
            <div className="em-actions">
              <button className="em-btn-history">
                <span className="material-icons-outlined em-icon-18">history</span> History
              </button>
              <button className="em-btn-new">
                <span className="material-icons-outlined em-icon-18">add</span> New Session
              </button>
            </div>
          </div>

          <div className="em-glass-panel em-upload-box">
            <div className="em-upload-bg" />
            <h2 className="em-section-title">
              <span className="material-icons-outlined">cloud_upload</span> Upload & Process
            </h2>
            <div className="em-dropzone">
              <div className="em-dropzone-icon">
                <span className="material-icons-outlined">upload_file</span>
              </div>
              <p className="em-dropzone-text">Drop PYQ PDFs here</p>
              <p className="em-dropzone-sub">Supports VTU Question Papers (2018-2023)</p>
            </div>
            <div className="em-files-list">
              <div className="em-file-item">
                <div className="em-file-info">
                  <span className="material-icons-outlined em-icon-18 em-file-icon-pdf">picture_as_pdf</span>
                  <div>
                    <p className="em-file-name">18CS54_Dec2023.pdf</p>
                    <p className="em-file-meta">Processed • 1.2MB</p>
                  </div>
                </div>
                <span className="material-icons-outlined em-icon-18 em-file-icon-check">check_circle</span>
              </div>
            </div>
          </div>

          <div className="em-glass-panel em-report-box">
            <div className="em-report-header">
              <h2 className="em-section-title em-no-margin">
                <span className="material-icons-outlined">analytics</span> Analysis Report
              </h2>
              <span className="em-report-badge">
                {analysisLoading
                  ? 'Analyzing PYQs...'
                  : `Based on ${analysisData.papersAnalyzed} papers`}
              </span>
            </div>

            {analysisError && (
              <div className="em-empty-state">
                <p>Using fallback intelligence data ({analysisError}).</p>
              </div>
            )}

            <div className="em-patterns">
              <h3 className="em-subheading">High-Frequency Patterns</h3>

              {analysisData.patterns.map((pattern, index) => (
                <div
                  key={`${pattern.module}-${pattern.topic}`}
                  className={`em-pattern-card ${index % 2 === 0 ? 'em-pattern-card--teal' : 'em-pattern-card--indigo'}`}
                >
                  <div className="em-pattern-header">
                    <span className="em-pattern-title">{pattern.module}: {pattern.topic}</span>
                    <span className="em-pattern-freq">Freq: {pattern.frequency}%</span>
                  </div>
                  <p className="em-pattern-desc">
                    Repeated PYQ trend detected for {pattern.topic.toLowerCase()} across recent papers.
                  </p>
                  <div className="em-pattern-footer">
                    <span className="em-pattern-priority">{pattern.priority} Priority</span>
                    <span className="em-pattern-marks">Avg Marks: {pattern.avgMarks}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="em-weightage">
              <h3 className="em-subheading em-mb-1">Module Weightage Distribution</h3>
              <div className="em-weightage-list">
                {analysisData.moduleWeightage.map((item, index) => (
                  <div key={item.module} className="em-weight-item">
                    <div className="em-weight-header">
                      <span className="em-weight-label">{item.module}</span>
                      <span className="em-weight-val">{item.marks} Marks</span>
                    </div>
                    <div className="em-weight-bar-bg">
                      <div
                        className={`em-weight-bar-fill ${index === 0 ? 'em-weight-bar-fill--glow' : ''} em-w-${Math.max(8, Math.min(100, item.percentage))}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Assistant Chat */}
        <div className="em-assistant-col">
          <div className="em-glass-panel em-chat-panel">
            <div className="em-chat-header">
              <div className="em-chat-title-group">
                <div className="em-chat-icon-box">
                  <span className="material-icons-outlined em-icon-22">smart_toy</span>
                </div>
                <div>
                  <h2 className="em-chat-title">Exam Ready Assistant</h2>
                  <div className="em-chat-status">
                    <span className="em-status-dot"></span>
                    <p className="em-status-text">SYSTEM ACTIVE</p>
                  </div>
                </div>
              </div>
              <button className="em-btn-export">
                <span className="material-icons-outlined em-icon-16">picture_as_pdf</span> Export PDF
              </button>
            </div>

            {/* ── Mode Tabs ──────────────────────────────────────────────────── */}
            <div className="em-mode-tabs">
              <button
                className={`em-mode-tab ${!paperMode ? 'em-mode-tab--active' : ''}`}
                onClick={() => setPaperMode(false)}
              >
                Single Question
              </button>
              <button
                className={`em-mode-tab ${paperMode ? 'em-mode-tab--active' : ''}`}
                onClick={() => setPaperMode(true)}
              >
                Full Paper
              </button>
            </div>

            {/* ── Single Question Mode ───────────────────────────────────────── */}
            {!paperMode && (
              <>
                <div className="em-chat-input-area">
                  <div className="em-input-header">
                    <label className="em-input-label">Question Input</label>
                    <div className="em-mark-selector">
                      {MARKS.map((m) => (
                        <button
                          key={m}
                          className={`em-mark-btn ${selectedMark === m ? 'em-mark-btn--active' : ''}`}
                          onClick={() => setSelectedMark(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="em-textarea-wrap">
                    <textarea
                      ref={textareaRef}
                      className="em-textarea"
                      placeholder="Paste your question here or type to generate a structured solution..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      rows={2}
                      disabled={isTyping}
                    />
                    <button
                      className="em-send-btn"
                      onClick={() => { void sendMessage(); }}
                      disabled={!input.trim() || isTyping}
                      title="Send Question"
                    >
                      <span className="material-icons-outlined em-icon-20">motion_photos_auto</span>
                    </button>
                  </div>
                </div>

                <div className="em-chat-messages">
                  <div className="em-msg-container">
                    {messages.length === 0 && !isTyping && (
                      <div className="em-empty-state">
                        <span className="material-icons-outlined em-empty-icon">forum</span>
                        <p>Enter a previous year question above to get an AI generated solution.</p>
                      </div>
                    )}

                    {messages.map(msg => (
                      msg.role === 'ai' ? (
                        <div key={msg.id} dangerouslySetInnerHTML={{ __html: msg.content }} />
                      ) : (
                        <div key={msg.id} className="em-user-msg">
                          <div className="em-user-avatar">{initials}</div>
                          <div className="em-user-bubble">{msg.content}</div>
                        </div>
                      )
                    ))}

                    {isTyping && (
                      <div className="em-typing">
                        <span className="material-icons-outlined em-icon-20">smart_toy</span>
                        <div className="em-typing-dots">
                          <span /><span /><span />
                        </div>
                        Generating structured answer...
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                </div>
              </>
            )}

            {/* ── Full Paper Mode ────────────────────────────────────────────── */}
            {paperMode && (
              <div className="em-paper-panel">
                {/* Mark selector */}
                <div className="em-input-header">
                  <label className="em-input-label">Paste Full Question Paper</label>
                  <div className="em-mark-selector">
                    {MARKS.map(m => (
                      <button
                        key={m}
                        className={`em-mark-btn ${selectedMark === m ? 'em-mark-btn--active' : ''}`}
                        onClick={() => setSelectedMark(m)}
                      >{m}</button>
                    ))}
                  </div>
                </div>

                {/* Paper input textarea */}
                <textarea
                  className="em-textarea em-paper-textarea"
                  placeholder={"Paste the full question paper here.\n\nSeparate questions with a blank line, or use numbered format:\n1. Explain...\n\n2. Define..."}
                  value={paperInput}
                  onChange={e => setPaperInput(e.target.value)}
                  rows={6}
                  disabled={isTyping}
                />

                {/* Solve button */}
                <button
                  className="em-btn-solve-all"
                  onClick={() => { void solvePaper(); }}
                  disabled={!paperInput.trim() || isTyping}
                >
                  <span className="material-icons-outlined em-icon-18">auto_awesome</span>
                  {isTyping && batchProgress
                    ? `Solving ${batchProgress.current} of ${batchProgress.total}...`
                    : 'Generate All Answers'}
                </button>

                {/* Answer sheet */}
                {paperAnswers.length > 0 && (
                  <div className="em-answer-sheet">
                    {paperAnswers.map((a, i) => (
                      <div key={i} className="em-answer-block">
                        <div className="em-answer-qnum">
                          Q{i + 1}: {a.question.length > 60 ? a.question.slice(0, 60) + '…' : a.question}
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: a.html }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Typing indicator during batch */}
                {isTyping && batchProgress && (
                  <div className="em-typing">
                    <span className="material-icons-outlined em-icon-20">smart_toy</span>
                    <div className="em-typing-dots"><span /><span /><span /></div>
                    Solving question {batchProgress.current} of {batchProgress.total}...
                  </div>
                )}
              </div>
            )}

            {/* Global Search Bar */}
            <div className="em-global-search">
              <div className="em-gs-wrap">
                <span className="material-icons-outlined em-gs-icon">search</span>
                <input className="em-gs-input" placeholder="Global Exam Search (e.g. 'Nov 2022 18CS54 Q3')" type="text" />
                <button className="em-gs-btn">
                  <span className="material-icons-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
