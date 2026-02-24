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
    expect(prompt.user).toContain("Tekst:\nHallo wereld");
  });

  it("parses inline prompt between double asterisks", () => {
    const prompt = buildRewritePrompt("**dit is een tekst naar de CEO** Joww, kunnen we straks effe samenzitten", DEFAULT_SETTINGS);

    expect(prompt.user).toContain("Extra gebruikerscontext: dit is een tekst naar de CEO");
    expect(prompt.user).toContain("Tekst:\nJoww, kunnen we straks effe samenzitten");
  });

  it("parses inline prompt between single asterisks", () => {
    const prompt = buildRewritePrompt("*vriendelijke WhatsApp naar klant* Hoi, je hebt nog niet betaald", DEFAULT_SETTINGS);

    expect(prompt.user).toContain("Extra gebruikerscontext: vriendelijke WhatsApp naar klant");
    expect(prompt.user).toContain("Tekst:\nHoi, je hebt nog niet betaald");
  });

  it("keeps text unchanged when marker contains only prompt", () => {
    const prompt = buildRewritePrompt("**alleen prompt zonder tekst**", DEFAULT_SETTINGS);
    expect(prompt.user).toContain("Tekst:\n**alleen prompt zonder tekst**");
    expect(prompt.user).not.toContain("Extra gebruikerscontext:");
  });

  it("sanitizes wrapped quotes and markdown fences", () => {
    expect(sanitizeModelOutput('"Klaar"')).toBe("Klaar");
    expect(sanitizeModelOutput("```text\nHallo\n```")) .toBe("Hallo");
  });
});
