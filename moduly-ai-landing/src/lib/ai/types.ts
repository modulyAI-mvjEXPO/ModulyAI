export type EmbeddingRequest = {
  readonly input: string;
  readonly model: string;
};

export type EmbeddingResponse = {
  readonly data: ReadonlyArray<{
    readonly embedding: ReadonlyArray<number>;
    readonly index: number;
  }>;
  readonly model: string;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly total_tokens: number;
  };
};

export type ChatMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

export type ChatCompletionOptions = {
  readonly model: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly stream?: boolean;
  readonly temperature?: number;
  readonly max_tokens?: number;
};

export type ChatCompletionResponse = {
  readonly id: string;
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly role: string;
      readonly content: string;
    };
    readonly finish_reason: string;
  }>;
  readonly model: string;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
};

export type StreamChunk = {
  readonly id: string;
  readonly choices: ReadonlyArray<{
    readonly delta: {
      readonly content?: string;
      readonly role?: string;
    };
    readonly finish_reason: string | null;
  }>;
};

export type AIProviderError = {
  readonly provider: string;
  readonly status: number;
  readonly message: string;
};

export type AIProviderConfig = {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKeyEnvVar: string;
  readonly defaultModel: string;
};

export type DocumentStatus = 'processing' | 'ready' | 'failed' | 'no_text';

export type TextChunk = {
  readonly content: string;
  readonly chunkIndex: number;
};

export type PdfExtractionResult = {
  readonly text: string;
  readonly pageCount: number;
  readonly isScanned: boolean;
};

export type DocumentRow = {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly file_path: string;
  readonly file_type: string;
  readonly subject_id: string | null;
  readonly module_id: string | null;
  readonly created_at: string;
  readonly status: DocumentStatus;
  readonly chunk_count: number;
  readonly file_size: number | null;
  readonly updated_at: string;
};

export type ChatRequest = {
  readonly message: string;
  readonly documentIds?: ReadonlyArray<string>;
  readonly subjectId?: string;
  readonly mark?: string;
  readonly strict?: boolean;
  readonly history?: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
};

export type ChatResponse = {
  readonly response: string;
  readonly sources: ReadonlyArray<{
    readonly documentId: string;
    readonly content: string;
    readonly similarity: number;
  }>;
};

export type RagChunk = {
  readonly id: string;
  readonly document_id: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly similarity: number;
};

export type ExamRequest = {
  readonly question: string;
  readonly mark: string;
  readonly documentIds?: ReadonlyArray<string>;
  readonly subjectId?: string;
};

export type ExamResponse = {
  readonly answer: string;
  readonly sources: ReadonlyArray<{
    readonly documentId: string;
    readonly content: string;
    readonly similarity: number;
  }>;
};

export type PyqIntelligenceRequest = {
  readonly subjectId?: string;
  readonly maxDocuments?: number;
};

export type PyqTopicPattern = {
  readonly topic: string;
  readonly module: string;
  readonly frequency: number;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly avgMarks: string;
};

export type PyqModuleWeightage = {
  readonly module: string;
  readonly marks: number;
  readonly percentage: number;
};

export type PyqIntelligenceResponse = {
  readonly papersAnalyzed: number;
  readonly patterns: ReadonlyArray<PyqTopicPattern>;
  readonly moduleWeightage: ReadonlyArray<PyqModuleWeightage>;
};
