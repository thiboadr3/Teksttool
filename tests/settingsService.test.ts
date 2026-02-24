import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/constants";
import { SettingsService, type StoreLike } from "../main/services/settingsService";

class MemoryStore implements StoreLike {
  private readonly map = new Map<string, unknown>();

  get(key: string): unknown {
    return this.map.get(key);
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);
  }
}

describe("SettingsService", () => {
  it("returns defaults when no settings are stored", () => {
    const service = new SettingsService(new MemoryStore());
    expect(service.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and reads persisted settings", () => {
    const store = new MemoryStore();
    const service = new SettingsService(store);

    service.saveSettings({
      ...DEFAULT_SETTINGS,
      autoPaste: false,
      stylePreset: "salesy"
    });

    const loaded = service.getSettings();
    expect(loaded.autoPaste).toBe(false);
    expect(loaded.stylePreset).toBe("salesy");
  });
});
