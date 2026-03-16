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
