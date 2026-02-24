import { BrowserWindow } from "electron";

interface CreatePreviewWindowOptions {
  preloadPath: string;
  loadContent: (window: BrowserWindow) => void;
}

export function createPreviewWindow(options: CreatePreviewWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 460,
    height: 480,
    resizable: false,
    maximizable: false,
    minimizable: true,
    show: false,
    title: "Rewrite preview",
    backgroundColor: "#f7f8fa",
    alwaysOnTop: true,
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
    window.focus();
  });

  return window;
}
