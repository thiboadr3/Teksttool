import type { RewriteSettings, StylePreset } from "./types";

export const APP_NAME = "Tekstnakijken";
export const KEYCHAIN_SERVICE = "Tekstnakijken";
export const KEYCHAIN_ACCOUNT = "openai_api_key";

const RUNTIME_PLATFORM = typeof process !== "undefined" && typeof process.platform === "string" ? process.platform : "unknown";

export const HOTKEY_PRIMARY = RUNTIME_PLATFORM === "darwin" ? "CommandOrControl+Control+R" : "Control+Alt+R";
export const HOTKEY_FALLBACK = RUNTIME_PLATFORM === "darwin" ? "CommandOrControl+Shift+R" : "Control+Shift+R";

export const PRESET_LABELS: Record<StylePreset, string> = {
  professioneel: "Professioneel",
  "kort-krachtig": "Kort & krachtig",
  friendly: "Friendly",
  salesy: "Salesy",
  "nl-en": "NL -> EN",
  "en-nl": "EN -> NL"
};

export const DEFAULT_SETTINGS: RewriteSettings = {
  shortcut: HOTKEY_PRIMARY,
  stylePreset: "professioneel",
  autoPaste: false,
  preserveMeaning: true,
  fixSpellingGrammar: true,
  makeConcise: false,
  makePersuasive: false,
  model: "gpt-4o-mini",
  temperature: 0.4,
  advancedOpen: false,
  debugMode: false
};

export const SYSTEM_PROMPT =
  "Je bent een ervaren Nederlandstalige editor en copywriter. Verbeter de tekst zonder de betekenis te veranderen. Houd dezelfde taal aan als de input, tenzij de gebruiker expliciet een vertaalpreset kiest. Geef enkel de verbeterde tekst terug, zonder uitleg, zonder opsomming, zonder aanhalingstekens.";
