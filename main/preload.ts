import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type {
  CostSnapshot,
  RewriteDebugPayload,
  RewriteRunContext,
  SettingsPayload,
  TestApiResult
} from "../shared/types";
import type { RewriteSettings } from "../shared/types";
import type { RewriteStatusMessage } from "../shared/ipc";

export interface RendererSettingsState extends RewriteSettings {
  apiKeyConfigured: boolean;
  activeHotkeyLabel: string;
  lastDebug: RewriteDebugPayload | null;
}

const desktopApi = {
  getSettings: (): Promise<RendererSettingsState> => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  getCostStats: (): Promise<CostSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.getCostStats),
  saveSettings: (payload: SettingsPayload): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.saveSettings, payload),
  testApi: (payload: SettingsPayload): Promise<TestApiResult> => ipcRenderer.invoke(IPC_CHANNELS.testApi, payload),
  triggerRewrite: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.triggerRewrite),
  getPreviewData: (): Promise<RewriteRunContext | null> => ipcRenderer.invoke(IPC_CHANNELS.getPreviewData),
  previewCopy: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.previewCopy),
  previewPaste: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.previewPaste),
  previewCancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.previewCancel),
  onStatus: (handler: (message: RewriteStatusMessage) => void): (() => void) => {
    const wrapped = (_: unknown, payload: RewriteStatusMessage) => handler(payload);
    ipcRenderer.on(IPC_CHANNELS.rewriteStatus, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.rewriteStatus, wrapped);
    };
  },
  onDebugUpdate: (handler: (payload: RewriteDebugPayload) => void): (() => void) => {
    const wrapped = (_: unknown, payload: RewriteDebugPayload) => handler(payload);
    ipcRenderer.on(IPC_CHANNELS.debugUpdate, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.debugUpdate, wrapped);
    };
  },
  onCostUpdate: (handler: (payload: CostSnapshot) => void): (() => void) => {
    const wrapped = (_: unknown, payload: CostSnapshot) => handler(payload);
    ipcRenderer.on(IPC_CHANNELS.costUpdate, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.costUpdate, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
