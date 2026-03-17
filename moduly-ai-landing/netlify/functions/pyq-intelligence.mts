import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';
import type {
  PyqIntelligenceRequest,
  PyqIntelligenceResponse,
  PyqModuleWeightage,
  PyqTopicPattern,
} from '../../src/lib/ai/types.ts';

type HandlerEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

type TopicRule = {
  readonly topic: string;
  readonly module: string;
  readonly avgMarks: string;
  readonly keywords: ReadonlyArray<string>;
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

const DEFAULT_MAX_DOCUMENTS = 20;

const TOPIC_RULES: ReadonlyArray<TopicRule> = [
  {
    topic: 'Decision Trees',
    module: 'Module 3',
    avgMarks: '8M',
    keywords: ['decision tree', 'id3', 'entropy', 'information gain'],
  },
  {
    topic: 'AVL Trees',
    module: 'Module 3',
    avgMarks: '8M',
    keywords: ['avl tree', 'rotation', 'balanced tree'],
  },
  {
    topic: 'Graph Traversal (BFS/DFS)',
    module: 'Module 4',
    avgMarks: '8M',
    keywords: ['bfs', 'dfs', 'graph traversal', 'breadth first', 'depth first'],
  },
  {
    topic: 'OSI Model',
    module: 'Module 1',
    avgMarks: '5M',
    keywords: ['osi model', 'seven layers', 'application layer', 'transport layer'],
  },
  {
    topic: 'TCP vs UDP',
    module: 'Module 4',
    avgMarks: '5M',
    keywords: ['tcp', 'udp', 'connection oriented', 'connectionless'],
  },
  {
    topic: 'IP Subnetting',
    module: 'Module 3',
    avgMarks: '8M',
    keywords: ['subnet', 'cidr', 'ip addressing', 'subnet mask'],
  },
  {
    topic: 'SQL Joins & Queries',
    module: 'Module 2',
    avgMarks: '8M',
    keywords: ['sql join', 'inner join', 'left join', 'select', 'query'],
  },
  {
    topic: 'Normalisation',
    module: 'Module 3',
    avgMarks: '8M',
    keywords: ['normalization', 'normalisation', '1nf', '2nf', '3nf', 'bcnf'],
  },
  {
    topic: 'ACID & Transactions',
    module: 'Module 4',
    avgMarks: '10M',
    keywords: ['acid', 'transaction', 'concurrency control', 'deadlock'],
  },
];

const FALLBACK_PATTERNS: ReadonlyArray<PyqTopicPattern> = [
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
];

const FALLBACK_WEIGHTAGE: ReadonlyArray<PyqModuleWeightage> = [
  { module: 'Module 1', marks: 24, percentage: 24 },
  { module: 'Module 2', marks: 20, percentage: 20 },
  { module: 'Module 3', marks: 18, percentage: 18 },
  { module: 'Module 4 & 5', marks: 38, percentage: 38 },
];

const jsonResponse = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const asMarkNumber = (mark: string): number => {
  const value = Number.parseInt(mark.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(value) ? 0 : value;
};

const getPriority = (frequency: number): PyqTopicPattern['priority'] => {
  if (frequency >= 70) return 'High';
  if (frequency >= 40) return 'Medium';
  return 'Low';
};

const normalize = (text: string): string => text.toLowerCase();

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as PyqIntelligenceRequest;
    const maxDocuments = body.maxDocuments && body.maxDocuments > 0
      ? body.maxDocuments
      : DEFAULT_MAX_DOCUMENTS;

    const supabase = createServerSupabaseClient();

    const { data: pyqDocs, error: pyqDocsError } = await supabase
      .from('documents')
      .select('id,title,status,created_at')
      .eq('status', 'ready')
      .or('title.ilike.%pyq%,title.ilike.%question%,title.ilike.%exam%,title.ilike.%qp%')
      .order('created_at', { ascending: false })
      .limit(maxDocuments);

    if (pyqDocsError) {
      throw new Error(pyqDocsError.message);
    }

    const documents = pyqDocs ?? [];

    if (documents.length === 0) {
      const fallback: PyqIntelligenceResponse = {
        papersAnalyzed: 0,
        patterns: FALLBACK_PATTERNS,
        moduleWeightage: FALLBACK_WEIGHTAGE,
      };
      return jsonResponse(200, fallback as unknown as Record<string, unknown>);
    }

    const documentIds = documents.map((doc) => doc.id);
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('document_id,content')
      .in('document_id', documentIds)
      .limit(maxDocuments * 120);

    if (chunksError) {
      throw new Error(chunksError.message);
    }

    const byDocument = new Map<string, string>();
    for (const docId of documentIds) {
      byDocument.set(docId, '');
    }

    for (const chunk of chunks ?? []) {
      const current = byDocument.get(chunk.document_id) ?? '';
      byDocument.set(chunk.document_id, `${current}\n${normalize(chunk.content ?? '')}`);
    }

    const papersAnalyzed = byDocument.size;

    const patterns = TOPIC_RULES.map((rule) => {
      let hitCount = 0;
      for (const text of byDocument.values()) {
        const matched = rule.keywords.some((k) => text.includes(k));
        if (matched) {
          hitCount += 1;
        }
      }

      const frequency = papersAnalyzed > 0 ? Math.round((hitCount / papersAnalyzed) * 100) : 0;
      return {
        topic: rule.topic,
        module: rule.module,
        frequency,
        priority: getPriority(frequency),
        avgMarks: rule.avgMarks,
        hits: hitCount,
      };
    })
      .filter((p) => p.hits > 0)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6);

    const moduleScores = new Map<string, number>();
    for (const pattern of patterns) {
      const markScore = asMarkNumber(pattern.avgMarks) * pattern.hits;
      const current = moduleScores.get(pattern.module) ?? 0;
      moduleScores.set(pattern.module, current + markScore);
    }

    const totalScore = Array.from(moduleScores.values()).reduce((sum, value) => sum + value, 0);
    const moduleWeightage = Array.from(moduleScores.entries())
      .map(([module, score]) => {
        const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
        return {
          module,
          marks: percentage,
          percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4);

    const response: PyqIntelligenceResponse = {
      papersAnalyzed,
      patterns: patterns.length > 0
        ? patterns.map(({ hits: _hits, ...rest }) => rest)
        : FALLBACK_PATTERNS,
      moduleWeightage: moduleWeightage.length > 0 ? moduleWeightage : FALLBACK_WEIGHTAGE,
    };

    return jsonResponse(200, response as unknown as Record<string, unknown>);
  } catch (err: unknown) {
    console.error('PYQ intelligence function error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse(500, { error: errorMessage });
  }
};
