import { PRESET_LABELS, SYSTEM_PROMPT } from "./constants";
import type { RewriteSettings } from "./types";

export interface PromptBuildResult {
  system: string;
  user: string;
}

function buildToggleInstructions(settings: RewriteSettings): string[] {
  const instructions: string[] = [];

  instructions.push(`Stijl preset: ${PRESET_LABELS[settings.stylePreset]}.`);

  if (settings.preserveMeaning) {
    instructions.push(
      "Behoud de kernboodschap en intentie, behalve wanneer de gebruiker expliciet om een andere outputvorm vraagt."
    );
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
  instructions.push(
    "Interpreteer de volledige gebruikersinput als context en inhoud. De gebruiker kan directe opdrachten geven zoals 'improve:', 'kijk na op spelling:', 'maak hier een actieplan van:' of gelijkaardige instructies."
  );
  instructions.push(
    "Voer expliciete instructies uit op de meegegeven inhoud. Als geen expliciete instructie aanwezig is, verbeter de tekst volgens de ingestelde stijl en toggles."
  );

  return instructions;
}

export function buildRewritePrompt(inputText: string, settings: RewriteSettings): PromptBuildResult {
  const textToRewrite = inputText.trim();
  const instructions = buildToggleInstructions(settings);
  const user = `${instructions.join(" ")}\n\nGebruikersinput:\n${textToRewrite}`;

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
