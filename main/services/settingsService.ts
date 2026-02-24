import Store from "electron-store";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import type { RewriteSettings } from "../../shared/types";

export interface StoreLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

interface SettingsSchema {
  settings: RewriteSettings;
}

export class SettingsService {
  constructor(private readonly store: StoreLike) {}

  getSettings(): RewriteSettings {
    const persisted = this.store.get("settings") as Partial<RewriteSettings> | undefined;
    return {
      ...DEFAULT_SETTINGS,
      ...persisted
    };
  }

  saveSettings(settings: RewriteSettings): RewriteSettings {
    const merged: RewriteSettings = {
      ...DEFAULT_SETTINGS,
      ...settings
    };

    this.store.set("settings", merged);
    return merged;
  }
}

export function createSettingsService(): SettingsService {
  const store = new Store<SettingsSchema>({
    name: "tekstnakijken-settings",
    defaults: {
      settings: DEFAULT_SETTINGS
    }
  });

  return new SettingsService(store as unknown as StoreLike);
}
