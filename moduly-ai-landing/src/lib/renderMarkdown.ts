// ─── Rich Markdown → HTML renderer ─────────────────────────────────────────
// Converts Gemini-style markdown to structured, styled HTML.
// Supports: headers (h1–h4), bold, italic, inline code, fenced code blocks,
// ordered & unordered lists, horizontal rule section containers, and tables.

function toRoman(num: number): string {
  const map: Record<string, number> = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let result = '';
  const entries = Object.entries(map);
  for (const [key, val] of entries) {
    while (num >= val) {
      result += key;
      num -= val;
    }
  }
  return result;
}

/**
 * Render a markdown string to rich HTML.
 * If the content contains rich formatting (headers, lists, code blocks, tables),
 * the entire output is wrapped in a styled container.
 */
export function renderMarkdownRich(md: string): string {
  // Check if the markdown has structural formatting
  const isFormatted = 
    /^(#{1,4})\s+/m.test(md) || 
    /^[-*]\s+/m.test(md) || 
    /^\d+[.)]\s+/m.test(md) || 
    /```/m.test(md) || 
    /^\|.*\|/m.test(md) ||
    /^(?:\*\*)?(?:Q|Question|Q\d+)\s*[:-]/im.test(md);

  const lines = md.split('\n');
  const qCounter = { val: 0 };
  
  // Strip out horizontal rules so they don't render as stray text
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed !== '---' && trimmed !== '***' && trimmed !== '___';
  });

  const html = renderBlock(filteredLines, qCounter);

  if (isFormatted) {
    return `<div class="md-section-container">${html}</div>`;
  }

  return html;
}

// ─── Block-level renderer ──────────────────────────────────────────────────

function renderBlock(lines: string[], qCounter = { val: 0 }): string {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip blank lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Fenced code block: ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      const escaped = escapeHtml(codeLines.join('\n'));
      const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
      const langLabel = lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : '';
      out.push(`<div class="md-code-block"${langAttr}>${langLabel}<pre><code>${escaped}</code></pre></div>`);
      continue;
    }

    // Headers: # through ####
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1]!.length;
      const content = renderInline(headerMatch[2]!);
      out.push(`<h${level} class="md-h${level}">${content}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list: - or * at start
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        listItems.push(renderInline(lines[i]!.trim().replace(/^[-*]\s+/, '')));
        i++;
      }
      out.push(`<ul class="md-ul">${listItems.map(li => `<li>${li}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list: 1. / 2. etc.
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i]!.trim())) {
        listItems.push(renderInline(lines[i]!.trim().replace(/^\d+[.)]\s+/, '')));
        i++;
      }
      out.push(`<ol class="md-ol">${listItems.map(li => `<li>${li}</li>`).join('')}</ol>`);
      continue;
    }

    // QA Accordion (Q: / A: formatting)
    const qMatch = trimmed.match(/^(?:\*\*)?(?:Q|Question|Q\d+)\s*[:-]?\s*(?:\*\*)?\s*(.+)$/i);
    if (qMatch) {
      const qText = qMatch[1];
      const startIndex = i;
      i++;
      
      const qLines: string[] = [qText];
      let foundAnswer = false;
      let answerMatch: RegExpMatchArray | null = null;
      
      // Look ahead for the answer
      while (i < lines.length) {
        answerMatch = lines[i]!.trim().match(/^(?:\*\*)?(?:A|Answer|A\d+)\s*[:-]?\s*(?:\*\*)?\s*(.*)$/i);
        if (answerMatch) {
          foundAnswer = true;
          break;
        }
        // If we hit an empty line and haven't found an answer yet, we keep going,
        // but if we hit another question, we stop.
        const nextQMatch = lines[i]!.trim().match(/^(?:\*\*)?(?:Q|Question|Q\d+)\s*[:-]?\s*(?:\*\*)?\s*(.+)$/i);
        if (nextQMatch) break;
        
        qLines.push(lines[i]!);
        i++;
      }

      if (foundAnswer && answerMatch) {
        qCounter.val++;
        const aFirstLine = answerMatch[1];
        i++;
        const aLines: string[] = aFirstLine ? [aFirstLine] : [];
        
        // Collect answer lines until next question or end
        while (i < lines.length) {
          const nextQMatch = lines[i]!.trim().match(/^(?:\*\*)?(?:Q|Question|Q\d+)\s*[:-]?\s*(?:\*\*)?\s*(.+)$/i);
          if (nextQMatch) break;
          aLines.push(lines[i]!);
          i++;
        }
        
        // Strip existing numbering like "1: " or "1. " or "**Q1:** " from the start
        const qFullText = qLines.join(' ').trim().replace(/\*\*+$/, '').trim();
        const qCleanedText = qFullText.replace(/^(?:\*\*)?(?:Q|Question|Q?\d+)\s*[:-]\s*(?:\*\*)?\s*/i, '').trim();
        
        const qHtml = renderInline(qCleanedText);
        const aHtml = renderBlock(aLines, qCounter);
        const roman = toRoman(qCounter.val);
        
        out.push(`
<details class="md-qa-accordion">
  <summary class="md-qa-summary">
    <div class="md-qa-summary-left">
      <span class="md-qa-roman">${roman}.</span>
      <span class="md-qa-text">${qHtml}</span>
    </div>
    <span class="md-qa-icon material-icons-outlined">expand_more</span>
  </summary>
  <div class="md-qa-content">${aHtml}</div>
</details>
        `);
        continue;
      } else {
        // If no answer found (e.g. during streaming), fallback to treating it as a standard paragraph
        qCounter.val++;
        const roman = toRoman(qCounter.val);
        out.push(`<p class="md-p"><strong>${roman}.</strong> ${renderInline(qText.trim())}</p>`);
        i = startIndex + 1;
        continue;
      }
    }

    // Table: lines starting with |
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        tableLines.push(lines[i]!.trim());
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote class="md-blockquote">${quoteLines.map(l => `<p>${renderInline(l)}</p>`).join('')}</blockquote>`);
      continue;
    }

    // Default: paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.trim().startsWith('#') &&
      !lines[i]!.trim().startsWith('```') &&
      !lines[i]!.trim().startsWith('---') &&
      !lines[i]!.trim().startsWith('***') &&
      !lines[i]!.trim().startsWith('___') &&
      !/^[-*]\s+/.test(lines[i]!.trim()) &&
      !/^\d+[.)]\s+/.test(lines[i]!.trim()) &&
      !lines[i]!.trim().startsWith('|') &&
      !lines[i]!.trim().startsWith('>') &&
      !/^(?:\*\*)?(?:Q|Question|Q\d+)\s*[:-]/i.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!.trim());
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p class="md-p">${renderInline(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('');
}

// ─── Inline renderer ──────────────────────────────────────────────────────

function renderInline(text: string): string {
  return text
    // Inline code (before bold/italic to avoid conflicts)
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
}

// ─── Table renderer ──────────────────────────────────────────────────────

function renderTable(lines: string[]): string {
  if (lines.length < 2) return '';

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(cell => cell.trim());

  const headers = parseRow(lines[0]!);
  // Skip separator line (index 1)
  const bodyLines = lines.slice(2);

  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  for (const h of headers) {
    html += `<th>${renderInline(h)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of bodyLines) {
    const cells = parseRow(row);
    html += '<tr>';
    for (const c of cells) {
      html += `<td>${renderInline(c)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

// ─── Utility ──────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
