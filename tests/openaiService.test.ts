import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/constants";
import { OpenAIService } from "../main/services/openaiService";

describe("OpenAIService", () => {
  it("sends system + user messages and sanitizes output", async () => {
    const createMock = vi.fn().mockResolvedValue({
      output_text: '"Herschreven tekst"',
      output: []
    });

    const service = new OpenAIService(() => ({
      responses: {
        create: createMock
      }
    }));

    const result = await service.rewriteText("ruwe input", DEFAULT_SETTINGS, "sk-test");

    expect(result.text).toBe("Herschreven tekst");

    const payload = createMock.mock.calls[0]![0];
    expect(payload.model).toBe(DEFAULT_SETTINGS.model);
    expect(payload.input[0].role).toBe("system");
    expect(payload.input[1].role).toBe("user");
  });
});
