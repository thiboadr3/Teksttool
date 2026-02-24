import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, PRESET_LABELS } from "../../../shared/constants";
import type { CostSnapshot, RewriteDebugPayload, RewriteSettings, SettingsPayload } from "../../../shared/types";
import type { RewriteStatusMessage } from "../../../shared/ipc";
import ToastStack, { type ToastItem } from "./ToastStack";

interface RendererSettingsState extends RewriteSettings {
  apiKeyConfigured: boolean;
  activeHotkeyLabel: string;
  lastDebug: RewriteDebugPayload | null;
}

const MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"];

interface ShortcutOption {
  label: string;
  value: string;
}

const USD_TO_EUR = 0.92;

const DEFAULT_COST_SNAPSHOT: CostSnapshot = {
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalEstimatedCostUsd: 0,
  lastRequest: null,
  pricingNote: "Schatting op basis van token usage en lokale model-pricing (kan afwijken van OpenAI billing)."
};

function getShortcutOptions(): ShortcutOption[] {
  const isMac = navigator.platform.toLowerCase().includes("mac");

  if (isMac) {
    return [
      { label: "Cmd + Ctrl + R (Default)", value: "CommandOrControl+Control+R" },
      { label: "Cmd + Shift + R", value: "CommandOrControl+Shift+R" },
      { label: "Cmd + Option + R", value: "CommandOrControl+Alt+R" },
      { label: "Ctrl + Option + R", value: "Control+Alt+R" }
    ];
  }

  return [
    { label: "Ctrl + Alt + R (Default)", value: "Control+Alt+R" },
    { label: "Ctrl + Shift + R", value: "Control+Shift+R" },
    { label: "Ctrl + Alt + R (Compat)", value: "CommandOrControl+Alt+R" },
    { label: "Ctrl + Shift + R (Compat)", value: "CommandOrControl+Shift+R" }
  ];
}

function createToast(level: ToastItem["level"], message: string): ToastItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message
  };
}

function formatEurFromUsd(valueUsd: number): string {
  const valueEur = valueUsd * USD_TO_EUR;
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  }).format(valueEur);
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(timestamp));
}

function ToggleRow(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { label, value, onChange } = props;
  return (
    <label className="row row-toggle">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`switch ${value ? "switch-on" : ""}`}
        onClick={() => onChange(!value)}
      >
        <span className="switch-thumb" />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<RewriteSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [activeHotkeyLabel, setActiveHotkeyLabel] = useState("-");
  const [statusLabel, setStatusLabel] = useState("Voer API key in");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [debugPayload, setDebugPayload] = useState<RewriteDebugPayload | null>(null);
  const [costStats, setCostStats] = useState<CostSnapshot>(DEFAULT_COST_SNAPSHOT);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const desktopApiAvailable = typeof window.desktopApi !== "undefined";
  const shortcutOptions = useMemo(() => getShortcutOptions(), []);

  const addToast = useCallback((level: ToastItem["level"], message: string) => {
    setToasts((prev) => [...prev, createToast(level, message)]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!desktopApiAvailable) {
      setLoading(false);
      setStatusLabel("Preload/IPC niet geladen");
      return;
    }

    const unsubscribeStatus = window.desktopApi.onStatus((payload: RewriteStatusMessage) => {
      addToast(payload.level, payload.message);
    });

    const unsubscribeDebug = window.desktopApi.onDebugUpdate((payload) => {
      setDebugPayload(payload);
    });

    const unsubscribeCost = window.desktopApi.onCostUpdate((payload) => {
      setCostStats(payload);
    });

    void (async () => {
      const [state, snapshot] = await Promise.all([
        window.desktopApi.getSettings() as Promise<RendererSettingsState>,
        window.desktopApi.getCostStats()
      ]);

      setSettings({
        shortcut: state.shortcut,
        stylePreset: state.stylePreset,
        autoPaste: state.autoPaste,
        preserveMeaning: state.preserveMeaning,
        fixSpellingGrammar: state.fixSpellingGrammar,
        makeConcise: state.makeConcise,
        makePersuasive: state.makePersuasive,
        model: state.model,
        temperature: state.temperature,
        advancedOpen: state.advancedOpen,
        debugMode: state.debugMode
      });
      setApiKeyConfigured(state.apiKeyConfigured);
      setActiveHotkeyLabel(state.activeHotkeyLabel);
      setDebugPayload(state.lastDebug);
      setCostStats(snapshot);
      setStatusLabel(state.apiKeyConfigured ? "Saved" : "Voer API key in");
      setLoading(false);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : "Kon settings niet laden";
      setStatusLabel("Load failed");
      addToast("error", message);
      setLoading(false);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeDebug();
      unsubscribeCost();
    };
  }, [addToast, desktopApiAvailable]);

  const canTestApi = useMemo(() => Boolean(apiKey.trim()) || apiKeyConfigured, [apiKey, apiKeyConfigured]);

  const payload: SettingsPayload = {
    ...settings,
    apiKey: apiKey.trim() ? apiKey.trim() : undefined
  };

  async function refreshHotkeyLabel(): Promise<void> {
    if (!desktopApiAvailable) {
      return;
    }

    const state = (await window.desktopApi.getSettings()) as RendererSettingsState;
    setActiveHotkeyLabel(state.activeHotkeyLabel);
  }

  async function handleSave(): Promise<void> {
    if (!desktopApiAvailable) {
      addToast("error", "Desktop API niet beschikbaar");
      return;
    }

    setSaving(true);
    try {
      await window.desktopApi.saveSettings(payload);
      if (apiKey.trim()) {
        setApiKeyConfigured(true);
        setApiKey("");
      }
      await refreshHotkeyLabel();
      setStatusLabel("Saved");
      addToast("success", "Saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      addToast("error", message);
      setStatusLabel("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestApi(): Promise<void> {
    if (!desktopApiAvailable) {
      addToast("error", "Desktop API niet beschikbaar");
      return;
    }

    setTesting(true);
    try {
      const result = await window.desktopApi.testApi(payload);
      if (result.ok) {
        setStatusLabel("API OK");
        addToast("success", "API OK");
      } else {
        setStatusLabel("API failed");
        addToast("error", result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test API mislukt";
      setStatusLabel("API failed");
      addToast("error", message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="page loading">Loading...</div>;
  }

  if (!desktopApiAvailable) {
    return (
      <main className="page">
        <section className="card">
          <h2>Renderer geladen, maar desktop bridge ontbreekt</h2>
          <p>
            Herstart de app via <code>npm run dev</code> of start de laatste build opnieuw.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Tekstnakijken</h1>
        <p>Minimal productivity rewrite tool</p>
      </header>

      {!apiKeyConfigured && (
        <section className="card hint-card">
          <h2>Quick start</h2>
          <p>
            1) Plak je OpenAI API key. 2) Klik Save. 3) Selecteer tekst in eender welke app en druk {activeHotkeyLabel}.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Usage & costs</h2>
        <div className="row">
          <span>Totale requests</span>
          <strong>{costStats.totalRequests}</strong>
        </div>
        <div className="row">
          <span>Totale input tokens</span>
          <strong>{costStats.totalInputTokens}</strong>
        </div>
        <div className="row">
          <span>Totale output tokens</span>
          <strong>{costStats.totalOutputTokens}</strong>
        </div>
        <div className="row">
          <span>Totale geschatte kost (EUR)</span>
          <strong>{formatEurFromUsd(costStats.totalEstimatedCostUsd)}</strong>
        </div>

        {costStats.lastRequest && (
          <>
            <hr className="divider" />
            <div className="row">
              <span>Laatste request</span>
              <strong>{costStats.lastRequest.kind}</strong>
            </div>
            <div className="row">
              <span>Model</span>
              <strong>{costStats.lastRequest.model}</strong>
            </div>
            <div className="row">
              <span>Tokens (in/out)</span>
              <strong>
                {costStats.lastRequest.inputTokens} / {costStats.lastRequest.outputTokens}
              </strong>
            </div>
            <div className="row">
              <span>Kost laatste request</span>
              <strong>
                {costStats.lastRequest.estimatedCostUsd === null
                  ? "Onbekend model"
                  : formatEurFromUsd(costStats.lastRequest.estimatedCostUsd)}
              </strong>
            </div>
            <div className="row">
              <span>Tijdstip</span>
              <strong>{formatTimestamp(costStats.lastRequest.timestamp)}</strong>
            </div>
          </>
        )}
        <p className="small-note">{costStats.pricingNote} Omgerekend naar EUR met vaste factor 0.92.</p>
      </section>

      <section className="card">
        <h2>Shortcut</h2>
        <label className="field">
          <span>Preferred shortcut</span>
          <select
            value={settings.shortcut}
            onChange={(event) => setSettings((prev) => ({ ...prev, shortcut: event.target.value }))}
          >
            {shortcutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <span>Active hotkey</span>
          <strong>{activeHotkeyLabel}</strong>
        </div>
      </section>

      <section className="card">
        <h2>Rewrite style</h2>
        <p className="small-note">Tip: start je selectie met <code>**jouw context**</code> gevolgd door je tekst. Voorbeeld: <code>**dit is een tekst naar de CEO** Joww, kunnen we straks effe samenzitten</code>.</p>
        <label className="field">
          <span>Style preset</span>
          <select
            value={settings.stylePreset}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, stylePreset: event.target.value as RewriteSettings["stylePreset"] }))
            }
          >
            {Object.entries(PRESET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <ToggleRow
          label="Auto-paste"
          value={settings.autoPaste}
          onChange={(value) => setSettings((prev) => ({ ...prev, autoPaste: value }))}
        />
        <ToggleRow
          label="Preserve meaning"
          value={settings.preserveMeaning}
          onChange={(value) => setSettings((prev) => ({ ...prev, preserveMeaning: value }))}
        />
        <ToggleRow
          label="Fix spelling/grammar"
          value={settings.fixSpellingGrammar}
          onChange={(value) => setSettings((prev) => ({ ...prev, fixSpellingGrammar: value }))}
        />
        <ToggleRow
          label="Make more concise"
          value={settings.makeConcise}
          onChange={(value) => setSettings((prev) => ({ ...prev, makeConcise: value }))}
        />
        <ToggleRow
          label="Make more persuasive"
          value={settings.makePersuasive}
          onChange={(value) => setSettings((prev) => ({ ...prev, makePersuasive: value }))}
        />
      </section>

      <section className="card">
        <h2>OpenAI</h2>

        <label className="field">
          <span>API key</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={apiKeyConfigured ? "Stored in keychain" : "sk-..."}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>

        <button
          className="link-button"
          type="button"
          onClick={() => setSettings((prev) => ({ ...prev, advancedOpen: !prev.advancedOpen }))}
        >
          {settings.advancedOpen ? "Hide advanced" : "Show advanced"}
        </button>

        {settings.advancedOpen && (
          <div className="advanced-block">
            <label className="field">
              <span>Model</span>
              <select
                value={settings.model}
                onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
              >
                {MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Temperature</span>
              <input
                type="number"
                min={0}
                max={1.5}
                step={0.1}
                value={settings.temperature}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    temperature: Number.parseFloat(event.target.value || "0.4")
                  }))
                }
              />
            </label>

            <ToggleRow
              label="Debug mode"
              value={settings.debugMode}
              onChange={(value) => setSettings((prev) => ({ ...prev, debugMode: value }))}
            />

            {settings.debugMode && (
              <div className="debug-warning">Warning: Debug mode can display full request/response locally.</div>
            )}
          </div>
        )}

        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => void handleTestApi()} disabled={!canTestApi || testing}>
            {testing ? "Testing..." : "Test API"}
          </button>
        </div>
      </section>

      {settings.debugMode && debugPayload && (
        <section className="card debug-card">
          <h2>Debug output</h2>
          <pre>{JSON.stringify(debugPayload, null, 2)}</pre>
        </section>
      )}

      <footer className="footer">
        <div className="status">{statusLabel}</div>
        <button className="btn primary" type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving..." : "Save"}
        </button>
      </footer>

      <ToastStack toasts={toasts} onRemove={removeToast} />
    </main>
  );
}
