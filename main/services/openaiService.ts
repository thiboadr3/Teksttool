import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { buildRewritePrompt, sanitizeModelOutput } from "../../shared/promptBuilder";
import type { RewriteDebugPayload, RewriteResult, RewriteSettings, TokenUsage } from "../../shared/types";
import { logTiming } from "./logger";

interface OpenAIClient {
  responses: {
    create: (input: Record<string, unknown>) => Promise<Response>;
  };
}

type OpenAIClientFactory = (apiKey: string) => OpenAIClient;

const OPENAI_TIMEOUT_MS = 15000;

function defaultClientFactory(apiKey: string): OpenAIClient {
  return new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0
  });
}

function extractResponseText(response: Response): string {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text;
  }

  for (const outputItem of response.output) {
    if (outputItem.type !== "message") {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (contentItem.type === "output_text" && contentItem.text.trim().length > 0) {
        return contentItem.text;
      }
    }
  }

  throw new Error("OpenAI gaf geen tekstoutput terug.");
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractUsage(response: Response): TokenUsage {
  const responseUsage = response.usage;

  const inputTokens = toNumber(responseUsage?.input_tokens);
  const outputTokens = toNumber(responseUsage?.output_tokens);
  const totalTokensRaw = toNumber(responseUsage?.total_tokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokensRaw > 0 ? totalTokensRaw : inputTokens + outputTokens
  };
}

export class OpenAIService {
  constructor(private readonly createClient: OpenAIClientFactory = defaultClientFactory) {}

  async rewriteText(inputText: string, settings: RewriteSettings, apiKey: string): Promise<RewriteResult> {
    const startMs = Date.now();
    const prompt = buildRewritePrompt(inputText, settings);

    const client = this.createClient(apiKey);
    const response = await client.responses.create({
      model: settings.model,
      temperature: settings.temperature,
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt.system }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt.user }]
        }
      ]
    });

    const rawText = extractResponseText(response);
    const cleanText = sanitizeModelOutput(rawText);
    const usage = extractUsage(response);
    const latencyMs = logTiming("openai.rewrite", startMs);

    const debug: RewriteDebugPayload = {
      model: settings.model,
      temperature: settings.temperature,
      systemMessage: prompt.system,
      userMessage: prompt.user,
      responseText: cleanText,
      latencyMs
    };

    return {
      text: cleanText,
      latencyMs,
      usage,
      debug
    };
  }
}
