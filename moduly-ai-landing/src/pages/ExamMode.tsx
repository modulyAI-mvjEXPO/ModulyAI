import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import './ExamMode.css';

interface ExamModeProps { user: User; }

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  time: string;
}

const MARKS = ['2M', '5M', '10M', '15M'] as const;

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Simple AI response generator (Mocked) ─────────────────────────────────
function generateResponse(query: string, mark: string): string {
  const q = query.toLowerCase();

  if (q.includes('backpropagation') || q.includes('vanishing')) {
    return (
      `<div class="em-ai-output">
         <div class="em-solution-header">
           <div class="em-solution-title-group">
             <span class="em-solution-title">Solution Generated</span>
             <span class="em-confidence-badge"><span class="material-icons-outlined" style="font-size: 14px">verified</span> Confidence: High</span>
           </div>
           <div class="em-marking-scheme">
             <span>Marking Scheme:</span>
             <span class="em-scheme-points">Logic: 4M</span> •
             <span class="em-scheme-points">Example: 4M</span> •
             <span class="em-scheme-points">Diagram: 2M</span>
           </div>
         </div>
         <div class="em-tags">
           <span class="em-tag">#NeuralNetworks</span>
           <span class="em-tag">#GradientDescent</span>
           <span class="em-tag">#ErrorCorrection</span>
         </div>
         <div class="em-markdown-body">
           <div class="em-step">
             <h4 class="em-step-title"><span class="em-step-num">1</span> Backpropagation Algorithm Overview (4 Marks)</h4>
             <div class="em-step-content">
               <p>Backpropagation is a supervised learning algorithm used for training Multi-layer Perceptrons. It works by computing the gradient of the loss function with respect to each weight by the chain rule.</p>
               <ul>
                 <li><strong>Forward Pass:</strong> Input is passed through the network to generate output.</li>
                 <li><strong>Error Calculation:</strong> Difference between predicted and actual target is calculated.</li>
                 <li><strong>Backward Pass:</strong> Error is propagated back to update weights and reduce loss.</li>
               </ul>
             </div>
           </div>
           <div class="em-step">
             <h4 class="em-step-title"><span class="em-step-num">2</span> Schematic Diagram (2 Marks)</h4>
             <div class="em-step-content">
               <div class="em-diagram-box">
                  <span class="material-icons-outlined em-diagram-icon">account_tree</span>
                  <p class="em-diagram-caption">Figure 1.2: Error Propagation Flow</p>
               </div>
             </div>
           </div>
           <div class="em-step em-step--no-border">
             <h4 class="em-step-title"><span class="em-step-num">3</span> Vanishing Gradient Problem (4 Marks)</h4>
             <div class="em-step-content">
               <p>In deep networks with many layers using activation functions like Sigmoid or Tanh, gradients can become extremely small. This prevents weights in early layers from changing.</p>
               <p><strong>Solution:</strong> Use ReLU (Rectified Linear Unit) activation function which does not saturate for positive values.</p>
             </div>
           </div>
         </div>
       </div>`
    );
  }

  return (
    `<div class="em-ai-output">
       <div class="em-solution-header">
         <div class="em-solution-title-group">
           <span class="em-solution-title">Solution Generated</span>
         </div>
         <div class="em-marking-scheme">
           <span>Format: ${mark}</span>
         </div>
       </div>
       <div class="em-markdown-body">
         <p>Here is an AI-generated solution for your query in the context of the VTU marking scheme.</p>
         <p>Re-phrase your query to include keywords like "Backpropagation" for a detailed example.</p>
       </div>
     </div>`
  );
}

export function ExamMode({ user }: ExamModeProps) {
  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0];
  const initials = firstName.charAt(0).toUpperCase();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedMark, setSelectedMark] = useState<typeof MARKS[number]>('10M');
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
        content: generateResponse(text, selectedMark),
        time: ts(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  }, [input, isTyping, selectedMark]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
              <span className="em-report-badge">Based on 8 papers</span>
            </div>

            <div className="em-patterns">
              <h3 className="em-subheading">High-Frequency Patterns</h3>

              <div className="em-pattern-card em-pattern-card--teal">
                <div className="em-pattern-header">
                  <span className="em-pattern-title">Module 3: Decision Trees</span>
                  <span className="em-pattern-freq">Freq: 85%</span>
                </div>
                <p className="em-pattern-desc">"Explain ID3 algorithm with entropy calculation" is a recurrent pattern.</p>
                <div className="em-pattern-footer">
                  <span className="em-pattern-priority">High Priority</span>
                  <span className="em-pattern-marks">Avg Marks: 8M</span>
                </div>
              </div>

              <div className="em-pattern-card em-pattern-card--indigo">
                <div className="em-pattern-header">
                  <span className="em-pattern-title">Module 1: ANN Basics</span>
                  <span className="em-pattern-freq">Freq: 62%</span>
                </div>
                <p className="em-pattern-desc">Activation functions (Sigmoid, ReLU) comparison questions.</p>
                <div className="em-pattern-footer">
                  <span className="em-pattern-priority">Medium Priority</span>
                  <span className="em-pattern-marks">Avg Marks: 6M</span>
                </div>
              </div>
            </div>

            <div className="em-weightage">
              <h3 className="em-subheading em-mb-1">Module Weightage Distribution</h3>
              <div className="em-weightage-list">
                <div className="em-weight-item">
                  <div className="em-weight-header">
                    <span className="em-weight-label">Module 1</span>
                    <span className="em-weight-val">24 Marks</span>
                  </div>
                  <div className="em-weight-bar-bg">
                    <div className="em-weight-bar-fill em-weight-bar-fill--glow em-w-80" />
                  </div>
                </div>
                <div className="em-weight-item">
                  <div className="em-weight-header">
                    <span className="em-weight-label">Module 2</span>
                    <span className="em-weight-val">20 Marks</span>
                  </div>
                  <div className="em-weight-bar-bg">
                    <div className="em-weight-bar-fill em-w-65" />
                  </div>
                </div>
                <div className="em-weight-item">
                  <div className="em-weight-header">
                    <span className="em-weight-label">Module 3</span>
                    <span className="em-weight-val">18 Marks</span>
                  </div>
                  <div className="em-weight-bar-bg">
                    <div className="em-weight-bar-fill em-w-60" />
                  </div>
                </div>
                <div className="em-weight-item">
                  <div className="em-weight-header">
                    <span className="em-weight-label">Module 4 & 5</span>
                    <span className="em-weight-val">38 Marks</span>
                  </div>
                  <div className="em-weight-bar-bg">
                    <div className="em-weight-bar-fill em-w-90" />
                  </div>
                </div>
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
                  onClick={() => sendMessage()}
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
