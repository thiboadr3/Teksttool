import { clipboard } from "electron";
import type { RewriteDebugPayload, RewriteSettings, TokenUsage } from "../../shared/types";
import { OpenAIService } from "./openaiService";
import { logError, logInfo, logTiming } from "./logger";
import { simulateCopyShortcut, simulatePasteShortcut } from "./keyboardAutomation";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readSelectionWithRetry(clipboardProbeValue: string): Promise<string> {
  const retries = 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await sleep(200);
    const text = clipboard.readText().trim();
    if (text.length > 0 && text !== clipboardProbeValue) {
      return text;
    }
  }

  return "";
}

interface RewriteWorkflowDeps {
  getSettings: () => RewriteSettings;
  getApiKey: () => Promise<string | null>;
  openAiService: OpenAIService;
  onStatus: (level: "info" | "success" | "error", message: string) => void;
  onDebugUpdate: (payload: RewriteDebugPayload) => void;
  onUsageRecorded: (model: string, usage: TokenUsage) => void;
}

export class RewriteWorkflow {
  constructor(private readonly deps: RewriteWorkflowDeps) {}

  async run(): Promise<void> {
    const workflowStart = Date.now();
    const settings = this.deps.getSettings();
    const previousClipboardText = clipboard.readText();
    const clipboardProbeValue = `__TEKSTNAKIJKEN_PROBE_${Date.now()}_${Math.random().toString(16).slice(2)}__`;

    try {
      const apiKey = await this.deps.getApiKey();
      if (!apiKey) {
        this.deps.onStatus("error", "OpenAI API key ontbreekt. Open Settings.");
        return;
      }

      clipboard.writeText(clipboardProbeValue);
      await simulateCopyShortcut();
      const sourceText = await readSelectionWithRetry(clipboardProbeValue);

      if (!sourceText) {
        clipboard.writeText(previousClipboardText);
        this.deps.onStatus("info", "Geen tekst geselecteerd");
        return;
      }

      const rewritten = await this.deps.openAiService.rewriteText(sourceText, settings, apiKey);
      this.deps.onUsageRecorded(settings.model, rewritten.usage);

      clipboard.writeText(rewritten.text);

      if (settings.debugMode && rewritten.debug) {
        this.deps.onDebugUpdate(rewritten.debug);
      }

      await simulatePasteShortcut();
      this.deps.onStatus("success", "Tekst herschreven en geplakt.");
      logInfo("Rewrite complete", { sourceLength: sourceText.length, outputLength: rewritten.text.length });

      logTiming("workflow.total", workflowStart);
    } catch (error) {
      clipboard.writeText(previousClipboardText);
      this.deps.onStatus("error", "Rewrite mislukt. Clipboard is hersteld.");
      logError("Rewrite workflow failed", error);
    }
  }
}
