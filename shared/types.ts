export type StylePreset =
  | "professioneel"
  | "kort-krachtig"
  | "friendly"
  | "salesy"
  | "nl-en"
  | "en-nl";

export type CostRequestKind = "rewrite" | "test";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostRequestSummary extends TokenUsage {
  kind: CostRequestKind;
  model: string;
  estimatedCostUsd: number | null;
  timestamp: number;
}

export interface CostSnapshot {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number;
  lastRequest: CostRequestSummary | null;
  pricingNote: string;
}

export interface RewriteSettings {
  shortcut: string;
  stylePreset: StylePreset;
  autoPaste: boolean;
  preserveMeaning: boolean;
  fixSpellingGrammar: boolean;
  makeConcise: boolean;
  makePersuasive: boolean;
  model: string;
  temperature: number;
  advancedOpen: boolean;
  debugMode: boolean;
}

export interface SettingsPayload extends RewriteSettings {
  apiKey?: string;
}

export interface TestApiResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface RewriteRunContext {
  sourceText: string;
  improvedText: string;
  previousClipboardText: string;
}

export interface RewriteDebugPayload {
  model: string;
  temperature: number;
  systemMessage: string;
  userMessage: string;
  responseText: string;
  latencyMs: number;
}

export interface RewriteResult {
  text: string;
  latencyMs: number;
  usage: TokenUsage;
  debug?: RewriteDebugPayload;
}
