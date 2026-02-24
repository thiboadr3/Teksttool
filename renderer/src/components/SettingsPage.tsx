import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, PRESET_LABELS } from "../../../shared/constants";
import type {
  AuthState,
  CostSnapshot,
  RewriteDebugPayload,
  RewriteSettings,
  SettingsPayload,
  UpdateCheckResult
} from "../../../shared/types";
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

const DEFAULT_AUTH_STATE: AuthState = {
  initialized: false,
  authenticated: false,
  email: null
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
  const [authState, setAuthState] = useState<AuthState>(DEFAULT_AUTH_STATE);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
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
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const desktopApiAvailable = typeof window.desktopApi !== "undefined";
  const shortcutOptions = useMemo(() => getShortcutOptions(), []);

  const addToast = useCallback((level: ToastItem["level"], message: string) => {
    setToasts((prev) => [...prev, createToast(level, message)]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const refreshUpdateState = useCallback(
    async (showToast: boolean) => {
      if (!desktopApiAvailable) {
        return;
      }

      setCheckingUpdates(true);
      try {
        const result = await window.desktopApi.checkForUpdates();
        setUpdateState(result);

        if (showToast) {
          addToast(result.ok ? (result.hasUpdate ? "info" : "success") : "error", result.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Updatecheck mislukt.";
        if (showToast) {
          addToast("error", message);
        }
      } finally {
        setCheckingUpdates(false);
      }
    },
    [addToast, desktopApiAvailable]
  );

  const loadProtectedData = useCallback(async () => {
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
      try {
        void refreshUpdateState(false);
        const auth = await window.desktopApi.getAuthState();
        setAuthState(auth);
        setAuthEmail(auth.email ?? "");

        if (!auth.authenticated) {
          setStatusLabel(auth.initialized ? "Log in om verder te gaan" : "Maak eerst een account aan");
          setLoading(false);
          return;
        }

        await loadProtectedData();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kon app data niet laden";
        setStatusLabel("Load failed");
        addToast("error", message);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubscribeStatus();
      unsubscribeDebug();
      unsubscribeCost();
    };
  }, [addToast, desktopApiAvailable, loadProtectedData, refreshUpdateState]);

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

  async function handleAuthenticate(): Promise<void> {
    if (!desktopApiAvailable) {
      addToast("error", "Desktop API niet beschikbaar");
      return;
    }

    const normalizedEmail = authEmail.trim();
    const normalizedPassword = authPassword.trim();

    if (!normalizedEmail || !normalizedPassword) {
      addToast("error", "E-mail en wachtwoord zijn verplicht.");
      return;
    }

    if (!authState.initialized && normalizedPassword !== authConfirmPassword.trim()) {
      addToast("error", "Wachtwoorden komen niet overeen.");
      return;
    }

    setAuthBusy(true);
    try {
      const result = authState.initialized
        ? await window.desktopApi.login({ email: normalizedEmail, password: normalizedPassword })
        : await window.desktopApi.registerAuth({ email: normalizedEmail, password: normalizedPassword });

      if (!result.ok) {
        addToast("error", result.message);
        return;
      }

      const nextAuthState: AuthState = {
        initialized: true,
        authenticated: true,
        email: normalizedEmail.toLowerCase()
      };

      setAuthState(nextAuthState);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setLoading(true);
      await loadProtectedData();
      setStatusLabel("Ingelogd");
      addToast("success", result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inloggen mislukt.";
      addToast("error", message);
    } finally {
      setAuthBusy(false);
      setLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    if (!desktopApiAvailable) {
      addToast("error", "Desktop API niet beschikbaar");
      return;
    }

    try {
      await window.desktopApi.logout();
      setAuthState((prev) => ({
        initialized: prev.initialized,
        authenticated: false,
        email: prev.email
      }));
      setApiKey("");
      setApiKeyConfigured(false);
      setDebugPayload(null);
      setCostStats(DEFAULT_COST_SNAPSHOT);
      setSettings(DEFAULT_SETTINGS);
      setStatusLabel("Log in om verder te gaan");
      addToast("success", "Uitgelogd");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Uitloggen mislukt";
      addToast("error", message);
    }
  }

  async function handleOpenUpdateDownload(): Promise<void> {
    if (!desktopApiAvailable) {
      addToast("error", "Desktop API niet beschikbaar");
      return;
    }

    try {
      await window.desktopApi.openUpdateDownload(updateState?.downloadUrl || updateState?.releaseUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kon updatepagina niet openen.";
      addToast("error", message);
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

  if (!authState.authenticated) {
    return (
      <main className="page">
        <header className="header">
          <h1>Tekstnakijken</h1>
          <p>Beveiligde toegang</p>
        </header>

        <section className="card">
          <h2>{authState.initialized ? "Log in" : "Account aanmaken"}</h2>
          <p className="small-note">
            Eerst inloggen verplicht. Zonder actieve sessie blijft de OpenAI key afgeschermd.
          </p>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="naam@bedrijf.com"
            />
          </label>

          <label className="field">
            <span>Wachtwoord</span>
            <input
              type="password"
              autoComplete={authState.initialized ? "current-password" : "new-password"}
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Minstens 8 tekens"
            />
          </label>

          {!authState.initialized && (
            <label className="field">
              <span>Bevestig wachtwoord</span>
              <input
                type="password"
                autoComplete="new-password"
                value={authConfirmPassword}
                onChange={(event) => setAuthConfirmPassword(event.target.value)}
                placeholder="Herhaal wachtwoord"
              />
            </label>
          )}

          <div className="actions">
            <button className="btn primary" type="button" disabled={authBusy} onClick={() => void handleAuthenticate()}>
              {authBusy ? "Even wachten..." : authState.initialized ? "Log in" : "Account aanmaken"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Updates</h2>
          <div className="row">
            <span>Huidige versie</span>
            <strong>{updateState?.currentVersion ?? "-"}</strong>
          </div>
          <div className="row">
            <span>Laatste versie</span>
            <strong>{updateState?.latestVersion ?? "Onbekend"}</strong>
          </div>
          <p className="small-note">{updateState?.message ?? "Nog geen updatecheck uitgevoerd."}</p>
          <div className="actions">
            <button className="btn secondary" type="button" disabled={checkingUpdates} onClick={() => void refreshUpdateState(true)}>
              {checkingUpdates ? "Controleren..." : "Check updates"}
            </button>
            {updateState?.hasUpdate && (
              <button className="btn primary" type="button" onClick={() => void handleOpenUpdateDownload()}>
                Download update
              </button>
            )}
          </div>
        </section>

        <footer className="footer">
          <div className="status">{statusLabel}</div>
        </footer>

        <ToastStack toasts={toasts} onRemove={removeToast} />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Tekstnakijken</h1>
        <p>Minimal productivity rewrite tool</p>
      </header>

      <section className="card">
        <h2>Sessie</h2>
        <div className="row">
          <span>Ingelogd als</span>
          <strong>{authState.email ?? "-"}</strong>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => void handleLogout()}>
            Uitloggen
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Updates</h2>
        <div className="row">
          <span>Huidige versie</span>
          <strong>{updateState?.currentVersion ?? "-"}</strong>
        </div>
        <div className="row">
          <span>Laatste versie</span>
          <strong>{updateState?.latestVersion ?? "Onbekend"}</strong>
        </div>
        <p className="small-note">{updateState?.message ?? "Nog geen updatecheck uitgevoerd."}</p>
        <div className="actions">
          <button className="btn secondary" type="button" disabled={checkingUpdates} onClick={() => void refreshUpdateState(true)}>
            {checkingUpdates ? "Controleren..." : "Check updates"}
          </button>
          {updateState?.hasUpdate && (
            <button className="btn primary" type="button" onClick={() => void handleOpenUpdateDownload()}>
              Download update
            </button>
          )}
        </div>
      </section>

      {!apiKeyConfigured && (
        <section className="card hint-card">
          <h2>Quick start</h2>
          <p>
            1) Plak je OpenAI API key. 2) Klik Save. 3) Selecteer tekst in eender welke app en druk {activeHotkeyLabel}. De tekst wordt meteen vervangen.
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
