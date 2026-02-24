import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/constants";
import { buildRewritePrompt, sanitizeModelOutput } from "../shared/promptBuilder";

describe("promptBuilder", () => {
  it("builds system and user prompt with toggles", () => {
    const prompt = buildRewritePrompt(" Hallo wereld ", {
      ...DEFAULT_SETTINGS,
      makeConcise: true,
      stylePreset: "en-nl"
    });

    expect(prompt.system).toContain("Je bent een ervaren Nederlandstalige editor");
    expect(prompt.user).toContain("Stijl preset: EN -> NL");
    expect(prompt.user).toContain("Maak de tekst compacter");
    expect(prompt.user).toContain("Vertaal van Engels naar Nederlands");
    expect(prompt.user).toContain("Gebruikersinput:\nHallo wereld");
  });

  it("interprets full context without special marker syntax", () => {
    const prompt = buildRewritePrompt("maak hier een actieplan van: website online zetten tegen vrijdag", DEFAULT_SETTINGS);

    expect(prompt.user).toContain("Interpreteer de volledige gebruikersinput als context en inhoud");
    expect(prompt.user).toContain("Gebruikersinput:\nmaak hier een actieplan van: website online zetten tegen vrijdag");
  });

  it("keeps asterisk text as plain input", () => {
    const prompt = buildRewritePrompt("**dit is geen verplichte syntax meer** improve: deze zin", DEFAULT_SETTINGS);

    expect(prompt.user).toContain("Gebruikersinput:\n**dit is geen verplichte syntax meer** improve: deze zin");
  });

  it("sanitizes wrapped quotes and markdown fences", () => {
    expect(sanitizeModelOutput('"Klaar"')).toBe("Klaar");
    expect(sanitizeModelOutput("```text\nHallo\n```")) .toBe("Hallo");
  });
});
