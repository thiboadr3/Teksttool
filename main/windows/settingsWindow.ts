import { BrowserWindow } from "electron";

interface CreateSettingsWindowOptions {
  preloadPath: string;
  loadContent: (window: BrowserWindow) => void;
}

export function createSettingsWindow(options: CreateSettingsWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 420,
    minHeight: 620,
    show: false,
    title: "Tekstnakijken Settings",
    backgroundColor: "#f7f8fa",
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  options.loadContent(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  return window;
}
