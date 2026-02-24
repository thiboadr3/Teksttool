import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell
} from "electron";
import {
  APP_NAME,
  DEFAULT_SETTINGS,
  HOTKEY_FALLBACK,
  HOTKEY_PRIMARY
} from "../shared/constants";
import { IPC_CHANNELS, type RewriteStatusMessage } from "../shared/ipc";
import type {
  AuthPayload,
  AuthResult,
  AuthState,
  CostSnapshot,
  RewriteDebugPayload,
  RewriteRunContext,
  RewriteSettings,
  SettingsPayload,
  TestApiResult,
  UpdateCheckResult
} from "../shared/types";
import { createCostService } from "./services/costService";
import { getApiKey, setApiKey } from "./services/keychainService";
import { logError, logInfo } from "./services/logger";
import { OpenAIService } from "./services/openaiService";
import { RewriteWorkflow } from "./services/rewriteWorkflow";
import { AuthService } from "./services/authService";
import { createSettingsService } from "./services/settingsService";
import { simulatePasteShortcut } from "./services/keyboardAutomation";
import { createPreviewWindow } from "./windows/previewWindow";
import { createSettingsWindow } from "./windows/settingsWindow";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preloadPath = path.join(__dirname, "preload.js");
const rendererHtmlPath = path.join(__dirname, "../dist-renderer/index.html");
const GITHUB_REPO = "thiboadr3/Teksttool";
const RELEASES_LATEST_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
let currentPreviewContext: RewriteRunContext | null = null;
let currentDebugPayload: RewriteDebugPayload | null = null;
let activeHotkey = HOTKEY_PRIMARY;
let quitting = false;

const settingsService = createSettingsService();
const costService = createCostService();
const openAiService = new OpenAIService();
const authService = new AuthService();

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubReleasePayload {
  tag_name: string;
  html_url: string;
  assets: GithubReleaseAsset[];
}

function isDevMode(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function loadWindow(window: BrowserWindow, windowType: "settings" | "preview"): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDevMode() && devUrl) {
    void window.loadURL(`${devUrl}?window=${windowType}`);
    return;
  }

  void window.loadFile(rendererHtmlPath, {
    query: {
      window: windowType
    }
  });
}

function formatHotkeyLabel(hotkey: string): string {
  const commandOrControlReplacement = process.platform === "darwin" ? "Cmd" : "Ctrl";
  const altReplacement = process.platform === "darwin" ? "Option" : "Alt";

  return hotkey
    .replace(/CommandOrControl/g, commandOrControlReplacement)
    .replace(/\bControl\b/g, "Ctrl")
    .replace(/\bAlt\b/g, altReplacement)
    .replace(/\+/g, " + ");
}

function publishStatus(level: RewriteStatusMessage["level"], message: string): void {
  const payload: RewriteStatusMessage = { level, message };
  settingsWindow?.webContents.send(IPC_CHANNELS.rewriteStatus, payload);
  previewWindow?.webContents.send(IPC_CHANNELS.rewriteStatus, payload);

  if (!settingsWindow || !settingsWindow.isVisible()) {
    new Notification({
      title: APP_NAME,
      body: message,
      silent: true
    }).show();
  }
}

function publishDebug(payload: RewriteDebugPayload): void {
  currentDebugPayload = payload;
  settingsWindow?.webContents.send(IPC_CHANNELS.debugUpdate, payload);
}

function publishCostUpdate(snapshot: CostSnapshot): void {
  settingsWindow?.webContents.send(IPC_CHANNELS.costUpdate, snapshot);
}

function normalizeShortcut(input: unknown): string {
  if (typeof input !== "string") {
    return HOTKEY_PRIMARY;
  }

  const value = input.trim();
  return value.length > 0 ? value : HOTKEY_PRIMARY;
}

function getNormalizedSettings(input: Partial<RewriteSettings>): RewriteSettings {
  const candidate = {
    ...DEFAULT_SETTINGS,
    ...input
  };

  const boundedTemperature = Math.max(0, Math.min(1.5, Number(candidate.temperature || 0.4)));

  return {
    ...candidate,
    shortcut: normalizeShortcut(candidate.shortcut),
    temperature: Number.isFinite(boundedTemperature) ? boundedTemperature : 0.4
  };
}

function getHotkeyCandidates(preferredShortcut: string): string[] {
  const pool = [
    normalizeShortcut(preferredShortcut),
    HOTKEY_PRIMARY,
    HOTKEY_FALLBACK,
    process.platform === "darwin" ? "CommandOrControl+Alt+R" : "Control+Shift+R"
  ];

  return [...new Set(pool)];
}

function normalizeAuthPayload(payload: unknown): AuthPayload {
  if (!payload || typeof payload !== "object") {
    return { email: "", password: "" };
  }

  const candidate = payload as Partial<AuthPayload>;

  return {
    email: typeof candidate.email === "string" ? candidate.email : "",
    password: typeof candidate.password === "string" ? candidate.password : ""
  };
}

function normalizeVersion(input: string): string {
  return input.trim().replace(/^v/i, "");
}

function parseVersion(input: string): number[] {
  return normalizeVersion(input)
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((value) => (Number.isFinite(value) ? value : 0));
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i += 1) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;

    if (aPart > bPart) {
      return 1;
    }

    if (aPart < bPart) {
      return -1;
    }
  }

  return 0;
}

function getPreferredUpdateAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset | null {
  if (assets.length === 0) {
    return null;
  }

  if (process.platform === "darwin") {
    const withArch = assets.find(
      (asset) =>
        asset.name.endsWith(".zip") &&
        asset.name.toLowerCase().includes("mac") &&
        asset.name.toLowerCase().includes(process.arch)
    );
    if (withArch) {
      return withArch;
    }

    const macZip = assets.find((asset) => asset.name.endsWith(".zip") && asset.name.toLowerCase().includes("mac"));
    if (macZip) {
      return macZip;
    }
  }

  if (process.platform === "win32") {
    const setupExe = assets.find((asset) => asset.name.endsWith(".exe") && !asset.name.endsWith(".exe.blockmap"));
    if (setupExe) {
      return setupExe;
    }
  }

  if (process.platform === "linux") {
    const appImage = assets.find((asset) => asset.name.endsWith(".AppImage"));
    if (appImage) {
      return appImage;
    }
  }

  return assets[0] ?? null;
}

function getSafeExternalUrl(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    return RELEASES_PAGE_URL;
  }

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:") {
      return RELEASES_PAGE_URL;
    }

    return parsed.toString();
  } catch {
    return RELEASES_PAGE_URL;
  }
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();

  try {
    const response = await fetch(RELEASES_LATEST_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": APP_NAME
      }
    });

    if (!response.ok) {
      throw new Error(`Update check failed (${response.status}).`);
    }

    const payload = (await response.json()) as GithubReleasePayload;
    const latestVersion = normalizeVersion(payload.tag_name);
    if (!latestVersion) {
      throw new Error("Kon de laatste releaseversie niet bepalen.");
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    const preferredAsset = getPreferredUpdateAsset(payload.assets ?? []);

    if (!hasUpdate) {
      return {
        ok: true,
        message: "Je zit op de laatste versie.",
        currentVersion,
        latestVersion,
        hasUpdate: false,
        releaseUrl: payload.html_url || RELEASES_PAGE_URL
      };
    }

    return {
      ok: true,
      message: `Update beschikbaar: v${latestVersion}`,
      currentVersion,
      latestVersion,
      hasUpdate: true,
      releaseUrl: payload.html_url || RELEASES_PAGE_URL,
      downloadUrl: preferredAsset?.browser_download_url || payload.html_url || RELEASES_PAGE_URL
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Updatecheck mislukt.";
    logError("Update check failed", error);
    return {
      ok: false,
      message,
      currentVersion
    };
  }
}

function tryRegisterHotkey(accelerator: string): boolean {
  try {
    return globalShortcut.register(accelerator, () => {
      void triggerRewriteFlow();
    });
  } catch (error) {
    logError(`Invalid or unsupported hotkey: ${accelerator}`, error);
    return false;
  }
}

function registerHotkey(preferredShortcut: string, notifyOnFallback: boolean): void {
  globalShortcut.unregisterAll();

  const candidates = getHotkeyCandidates(preferredShortcut);

  for (const candidate of candidates) {
    if (!tryRegisterHotkey(candidate)) {
      continue;
    }

    activeHotkey = candidate;

    if (candidate !== preferredShortcut && notifyOnFallback) {
      publishStatus(
        "info",
        `Gekozen shortcut was niet beschikbaar. Fallback actief: ${formatHotkeyLabel(candidate)}`
      );
    }

    logInfo("Registered hotkey", {
      preferred: preferredShortcut,
      active: candidate
    });
    return;
  }

  activeHotkey = "";
  publishStatus("error", "Kon geen globale hotkey registreren.");
}

function showSettingsWindow(): void {
  if (!settingsWindow) {
    settingsWindow = createSettingsWindow({
      preloadPath,
      loadContent: (window) => loadWindow(window, "settings")
    });

    settingsWindow.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        settingsWindow?.hide();
      }
    });
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function positionPreviewNearCursor(window: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const area = display.workArea;
  const bounds = window.getBounds();

  const margin = 10;
  let targetX = cursor.x + 8;
  let targetY = cursor.y + 18;

  if (targetX + bounds.width > area.x + area.width - margin) {
    targetX = Math.max(area.x + margin, cursor.x - bounds.width - 8);
  }

  if (targetY + bounds.height > area.y + area.height - margin) {
    targetY = Math.max(area.y + margin, cursor.y - bounds.height - 12);
  }

  window.setPosition(Math.round(targetX), Math.round(targetY), false);
}

function showPreviewWindow(context: RewriteRunContext): void {
  currentPreviewContext = context;

  if (!previewWindow) {
    previewWindow = createPreviewWindow({
      preloadPath,
      loadContent: (window) => loadWindow(window, "preview")
    });

    previewWindow.on("closed", () => {
      previewWindow = null;
      currentPreviewContext = null;
    });
  }

  positionPreviewNearCursor(previewWindow);

  if (!previewWindow.isVisible()) {
    previewWindow.show();
  }

  previewWindow.webContents.send(IPC_CHANNELS.rewriteStatus, {
    level: "info",
    message: "Preview klaar"
  });
  previewWindow.focus();
}

async function triggerRewriteFlow(): Promise<void> {
  if (!authService.isAuthenticated()) {
    showSettingsWindow();
    publishStatus("error", "Log eerst in om de tool te gebruiken.");
    return;
  }

  await rewriteWorkflow.run();
}

const rewriteWorkflow = new RewriteWorkflow({
  getSettings: () => settingsService.getSettings(),
  getApiKey,
  openAiService,
  onStatus: publishStatus,
  onDebugUpdate: publishDebug,
  onUsageRecorded: (model, usage) => {
    const snapshot = costService.recordUsage("rewrite", model, usage);
    publishCostUpdate(snapshot);
  }
});

function createTray(): void {
  const trayImage = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAKklEQVR4AWNABf7///8R2JgxY8aMGTNmzJgxY8aMGTNmzJgxY8YMADejBR5kSyfIAAAAAElFTkSuQmCC"
  );

  tray = new Tray(trayImage);
  tray.setToolTip(APP_NAME);

  const menu = Menu.buildFromTemplate([
    {
      label: "Rewrite now",
      click: () => {
        void triggerRewriteFlow();
      }
    },
    {
      label: "Settings...",
      click: () => showSettingsWindow()
    },
    {
      type: "separator"
    },
    {
      label: "Quit",
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => showSettingsWindow());
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getAuthState, async (): Promise<AuthState> => {
    return authService.getState();
  });

  ipcMain.handle(IPC_CHANNELS.registerAuth, async (_event, payload: unknown): Promise<AuthResult> => {
    const normalizedPayload = normalizeAuthPayload(payload);

    try {
      await authService.register(normalizedPayload.email, normalizedPayload.password);
      publishStatus("success", "Account aangemaakt. Je bent ingelogd.");
      return {
        ok: true,
        message: "Account aangemaakt. Je bent ingelogd."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kon account niet aanmaken.";
      logError("Auth register failed", error);
      return {
        ok: false,
        message
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.login, async (_event, payload: unknown): Promise<AuthResult> => {
    const normalizedPayload = normalizeAuthPayload(payload);

    try {
      await authService.login(normalizedPayload.email, normalizedPayload.password);
      publishStatus("success", "Inloggen gelukt.");
      return {
        ok: true,
        message: "Inloggen gelukt."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inloggen mislukt.";
      logError("Auth login failed", error);
      return {
        ok: false,
        message
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.logout, (): { ok: boolean } => {
    authService.logout();
    publishStatus("info", "Uitgelogd.");
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.checkForUpdates, async (): Promise<UpdateCheckResult> => {
    return checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.openUpdateDownload, async (_event, url?: string): Promise<{ ok: boolean }> => {
    await shell.openExternal(getSafeExternalUrl(url));
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.getSettings, async () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    const settings = settingsService.getSettings();
    const apiKey = await getApiKey();

    return {
      ...settings,
      apiKeyConfigured: Boolean(apiKey),
      activeHotkeyLabel: activeHotkey ? formatHotkeyLabel(activeHotkey) : "Niet beschikbaar",
      lastDebug: currentDebugPayload
    };
  });

  ipcMain.handle(IPC_CHANNELS.getCostStats, () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    return costService.getSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.saveSettings, async (_event, payload: SettingsPayload) => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    const { apiKey, ...settingsPayload } = payload;
    const normalized = getNormalizedSettings(settingsPayload);
    settingsService.saveSettings(normalized);

    registerHotkey(normalized.shortcut, true);

    if (typeof apiKey === "string") {
      await setApiKey(apiKey);
    }

    publishStatus("success", "Settings opgeslagen.");
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.testApi, async (_event, payload: SettingsPayload): Promise<TestApiResult> => {
    if (!authService.isAuthenticated()) {
      return {
        ok: false,
        message: "Je moet eerst inloggen."
      };
    }

    const { apiKey: maybeApiKey, ...settingsPayload } = payload;
    const normalized = getNormalizedSettings(settingsPayload);

    try {
      const keyToUse = maybeApiKey?.trim() || (await getApiKey()) || "";
      if (!keyToUse) {
        return {
          ok: false,
          message: "API key ontbreekt."
        };
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("API timeout na 20s")), 20000);
      });

      const result = await Promise.race([
        openAiService.rewriteText(
          "dit is een korte testzin met kleine foutjes en slordige formulering",
          normalized,
          keyToUse
        ),
        timeoutPromise
      ]);

      const snapshot = costService.recordUsage("test", normalized.model, result.usage);
      publishCostUpdate(snapshot);

      if (normalized.debugMode && result.debug) {
        publishDebug(result.debug);
      }

      return {
        ok: true,
        message: "API OK",
        latencyMs: result.latencyMs
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onbekende API fout";
      logError("API test failed", error);
      return {
        ok: false,
        message
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.triggerRewrite, async () => {
    await triggerRewriteFlow();
  });

  ipcMain.handle(IPC_CHANNELS.getPreviewData, () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    return currentPreviewContext;
  });

  ipcMain.handle(IPC_CHANNELS.previewCopy, async () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    if (!currentPreviewContext) {
      return;
    }

    clipboard.writeText(currentPreviewContext.improvedText);
    publishStatus("success", "Improved tekst gekopieerd.");
  });

  ipcMain.handle(IPC_CHANNELS.previewPaste, async () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    if (!currentPreviewContext) {
      return;
    }

    clipboard.writeText(currentPreviewContext.improvedText);
    await simulatePasteShortcut();
    publishStatus("success", "Improved tekst geplakt.");
    currentPreviewContext = null;
    previewWindow?.close();
  });

  ipcMain.handle(IPC_CHANNELS.previewCancel, async () => {
    if (!authService.isAuthenticated()) {
      throw new Error("Je moet eerst inloggen.");
    }

    if (!currentPreviewContext) {
      previewWindow?.close();
      return;
    }

    clipboard.writeText(currentPreviewContext.previousClipboardText);
    publishStatus("info", "Preview geannuleerd. Clipboard hersteld.");
    currentPreviewContext = null;
    previewWindow?.close();
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  registerIpcHandlers();
  createTray();

  const initialSettings = settingsService.getSettings();
  registerHotkey(initialSettings.shortcut, false);

  showSettingsWindow();

  app.on("activate", () => {
    showSettingsWindow();
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}

app.on("window-all-closed", () => {
  if (quitting) {
    app.quit();
  }
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showSettingsWindow();

    if (settingsWindow?.isMinimized()) {
      settingsWindow.restore();
    }

    settingsWindow?.show();
    settingsWindow?.focus();
  });

  void bootstrap().catch((error) => {
    logError("Failed to bootstrap app", error);
    app.quit();
  });
}
