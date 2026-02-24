export const IPC_CHANNELS = {
  getAuthState: "auth:get-state",
  registerAuth: "auth:register",
  login: "auth:login",
  logout: "auth:logout",
  getSettings: "settings:get",
  saveSettings: "settings:save",
  testApi: "openai:test",
  triggerRewrite: "rewrite:trigger",
  rewriteStatus: "rewrite:status",
  getPreviewData: "preview:get-data",
  previewCopy: "preview:copy",
  previewPaste: "preview:paste",
  previewCancel: "preview:cancel",
  debugUpdate: "debug:update",
  getCostStats: "cost:get",
  costUpdate: "cost:update"
} as const;

export type RewriteStatusLevel = "info" | "success" | "error";

export interface RewriteStatusMessage {
  level: RewriteStatusLevel;
  message: string;
}
