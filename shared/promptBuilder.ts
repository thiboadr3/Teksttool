import { PRESET_LABELS, SYSTEM_PROMPT } from "./constants";
import type { RewriteSettings } from "./types";

export interface PromptBuildResult {
  system: string;
  user: string;
}

interface ParsedInlinePrompt {
  inlinePrompt: string | null;
  textToRewrite: string;
}

function parseInlinePrompt(inputText: string): ParsedInlinePrompt {
  const normalized = inputText.trim();

  const match = normalized.match(/^(?:\*\*([\s\S]+?)\*\*|\*([^\n*][\s\S]*?)\*)\s*([\s\S]*)$/);
  if (!match) {
    return {
      inlinePrompt: null,
      textToRewrite: normalized
    };
  }

  const promptCandidate = (match[1] ?? match[2] ?? "").trim();
  const textCandidate = (match[3] ?? "").trim();

  if (!promptCandidate || !textCandidate) {
    return {
      inlinePrompt: null,
      textToRewrite: normalized
    };
  }

  return {
    inlinePrompt: promptCandidate,
    textToRewrite: textCandidate
  };
}

function buildToggleInstructions(settings: RewriteSettings): string[] {
  const instructions: string[] = [];

  instructions.push(`Stijl preset: ${PRESET_LABELS[settings.stylePreset]}.`);

  if (settings.preserveMeaning) {
    instructions.push("Behoud exact de betekenis en intentie.");
  }
  if (settings.fixSpellingGrammar) {
    instructions.push("Corrigeer spelling en grammatica.");
  }
  if (settings.makeConcise) {
    instructions.push("Maak de tekst compacter waar logisch.");
  }
  if (settings.makePersuasive) {
    instructions.push("Maak de formulering overtuigender, zonder te overdrijven.");
  }

  if (settings.stylePreset === "nl-en") {
    instructions.push("Vertaal van Nederlands naar Engels.");
  }
  if (settings.stylePreset === "en-nl") {
    instructions.push("Vertaal van Engels naar Nederlands.");
  }

  instructions.push("Output: alleen platte tekst.");

  return instructions;
}

export function buildRewritePrompt(inputText: string, settings: RewriteSettings): PromptBuildResult {
  const { inlinePrompt, textToRewrite } = parseInlinePrompt(inputText);
  const instructions = buildToggleInstructions(settings);

  if (inlinePrompt) {
    instructions.push(
      `Extra gebruikerscontext: ${inlinePrompt}. Pas toon en register hierop aan zonder de boodschap te veranderen.`
    );
  }

  const user = `${instructions.join(" ")}\n\nTekst:\n${textToRewrite}`;

  return {
    system: SYSTEM_PROMPT,
    user
  };
}

export function sanitizeModelOutput(text: string): string {
  let result = text.trim();

  if (result.startsWith("```") && result.endsWith("```")) {
    result = result.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["`", "`"]
  ];

  for (const [start, end] of quotePairs) {
    if (result.startsWith(start) && result.endsWith(end) && result.length >= 2) {
      result = result.slice(1, -1).trim();
    }
  }

  return result;
}
