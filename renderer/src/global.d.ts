import type {
  AuthPayload,
  AuthResult,
  AuthState,
  CostSnapshot,
  RewriteDebugPayload,
  RewriteRunContext,
  SettingsPayload,
  TestApiResult
} from "../../shared/types";
import type { RewriteStatusMessage } from "../../shared/ipc";

interface RendererSettingsState {
  stylePreset: "professioneel" | "kort-krachtig" | "friendly" | "salesy" | "nl-en" | "en-nl";
  shortcut: string;
  autoPaste: boolean;
  preserveMeaning: boolean;
  fixSpellingGrammar: boolean;
  makeConcise: boolean;
  makePersuasive: boolean;
  model: string;
  temperature: number;
  advancedOpen: boolean;
  debugMode: boolean;
  apiKeyConfigured: boolean;
  activeHotkeyLabel: string;
  lastDebug: RewriteDebugPayload | null;
}

interface DesktopApi {
  getAuthState: () => Promise<AuthState>;
  registerAuth: (payload: AuthPayload) => Promise<AuthResult>;
  login: (payload: AuthPayload) => Promise<AuthResult>;
  logout: () => Promise<{ ok: boolean }>;
  getSettings: () => Promise<RendererSettingsState>;
  getCostStats: () => Promise<CostSnapshot>;
  saveSettings: (payload: SettingsPayload) => Promise<{ ok: boolean }>;
  testApi: (payload: SettingsPayload) => Promise<TestApiResult>;
  triggerRewrite: () => Promise<void>;
  getPreviewData: () => Promise<RewriteRunContext | null>;
  previewCopy: () => Promise<void>;
  previewPaste: () => Promise<void>;
  previewCancel: () => Promise<void>;
  onStatus: (handler: (payload: RewriteStatusMessage) => void) => () => void;
  onDebugUpdate: (handler: (payload: RewriteDebugPayload) => void) => () => void;
  onCostUpdate: (handler: (payload: CostSnapshot) => void) => () => void;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
