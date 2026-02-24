# Tekstnakijken

Cross-platform desktop app (Electron + React + TypeScript) die geselecteerde tekst uit elke applicatie herschrijft met OpenAI, via een globale hotkey.

## Features (MVP)

- Globale hotkey rewrite flow (aanpasbaar in Settings)
- Default Windows/Linux: `Ctrl + Alt + R`
- Default macOS: `Cmd + Ctrl + R`
- Fallback bij conflict: `Ctrl/Cmd + Shift + R`
- Copy -> clipboard read (200ms, retry max 2x) -> OpenAI rewrite -> clipboard write -> paste/preview
- Tray app met menu:
- `Rewrite now`
- `Settings...`
- `Quit`
- Settings window:
- Style presets
- Rewrite toggles
- OpenAI model + temperatuur (advanced)
- API key via OS keychain (`keytar`)
- Test API knop
- Debug mode (lokale request/response zichtbaarheid)
- Preview popup wanneer Auto-paste uitstaat:
- Tabs `Original` / `Improved`
- `Copy improved`, `Paste`, `Cancel`
- Usage & costs (Settings):
- Totaal requests, input/output tokens
- Totale geschatte EUR kost
- Kost van laatste request
- Privacy:
- Geen volledige tekst in standaard logs
- Alleen errors + timings

## Stack

- Electron
- React
- TypeScript
- OpenAI official SDK (`responses.create` met system + user messages)
- `@nut-tree-fork/nut-js` voor keyboard automation
- `electron-store` voor settings persistence
- `keytar` voor veilige API key opslag
- `electron-builder` voor distributie

## Projectstructuur

- `main/` Electron main process (tray, hotkey, clipboard flow, IPC, OpenAI, settings)
- `renderer/` React UI (settings + preview)
- `shared/` gedeelde types/constants/prompt builder
- `tests/` unit tests (OpenAI call, prompt builder, settings persistence)

## Vereisten

- Node.js `>= 20`
- npm `>= 10`
- macOS/Windows (Linux optioneel)

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Dit start:

- Vite dev server (renderer)
- TS build watcher voor Electron main/preload
- Electron runtime via lokale dev launcher

Standaard draait de renderer op poort `5173`. Een andere poort gebruiken:

```bash
npx cross-env VITE_DEV_PORT=5174 npm run dev
```

## Test en typecheck

```bash
npm test
npm run typecheck
```

## Production build (zonder installer)

```bash
npm run build
```

Output:

- `dist-renderer/`
- `dist-electron/`

## Installer builds met electron-builder

```bash
npm run dist
```

Typische artifacts:

- macOS: `dmg`, `zip`
- Windows: `nsis` installer
- Linux: `AppImage`

Artifacts komen in `release/`.

## GitHub Release (automatisch)

Bij een tag die start met `v` (bijv. `v0.1.0`) buildt GitHub Actions automatisch installers voor macOS, Windows en Linux en publiceert die als GitHub Release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## OpenAI key opslag

- API key wordt niet in `.env` opgeslagen.
- Key wordt via UI opgeslagen in OS keychain (`keytar`).
- `.env.example` is enkel een optionele fallback placeholder.

## Kostenoverzicht

- De app toont lokale kostschattingen op basis van token usage uit OpenAI responses.
- Bedragen zijn een schatting en kunnen afwijken van officiële OpenAI facturatie.
- Voor officiële cijfers: controleer OpenAI billing dashboard.

## Troubleshooting

### macOS: copy/paste automation werkt niet

`nut.js` keyboard automation vereist Accessibility permissie:

1. Open `System Settings` -> `Privacy & Security` -> `Accessibility`.
2. Voeg je app toe en geef toestemming.
3. Herstart de app.

### Hotkey registreert niet

- Als primaire hotkey bezet is, activeert de app automatisch fallback.
- Als beide falen, verschijnt een foutmelding.

### Dev start opent niet of blijft hangen

Sluit resterende dev-processen en start opnieuw:

```bash
pkill -f "Tekstnakijken|dist-electron/main.js|node_modules/.bin/vite|tsup main/main.ts|node scripts/dev-app.js" || true
npm run dev
```

### Port 5173 is already in use

Start de devomgeving op een andere poort:

```bash
npx cross-env VITE_DEV_PORT=5174 npm run dev
```

### 429 insufficient_quota bij Test API

De key is dan meestal geldig, maar het OpenAI project heeft geen actief quota/billing.

### Geen tekst geselecteerd

- De app toont `Geen tekst geselecteerd`.
- Selecteer tekst in de actieve app en trigger opnieuw.

## Belangrijke implementatiedetails

- System prompt staat in `shared/constants.ts`.
- Prompt opbouw in `shared/promptBuilder.ts`.
- Output wordt opgeschoond naar plain text (quotes/backticks gestript).
- Clipboard rollback gebeurt automatisch bij fouten.
- Preview `Cancel` zet oude clipboard terug.
