# Agent Console

Standalone Vite + React + TypeScript app for orchestrating AI agent workflows:

**Intake → Assign → Complete → Review**

Local persistence (localStorage), JSON export/import, mock quota with auto-save when remaining ≤ threshold (default 10%), and a typed extension registry.

## Run

```bash
cd agent-console
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173/`).

```bash
npm run build    # app + copies Windows shortcuts into dist/
npm run preview
```

## Quota guard

- `QuotaProvider` (`src/quota/QuotaProvider.ts`): `getRemaining()`, `getLimit()`, `getSnapshot()`, optional `subscribe`.
- Mock provider starts near the threshold; use **Burn mock quota** in the UI to trigger the warning.
- When `remaining/limit ≤ quotaThreshold` (default `0.10`), state is force-saved and a non-modal amber banner appears with **Export JSON**.

Wire a real Cursor/API meter later via `setQuotaProviderFactory(...)`.

## Extension API

Plugins import the registry — core does not import feature plugins:

```ts
import { registerExtension, type Extension } from './extensions'

registerExtension({
  id: 'my.plugin',
  label: 'My Plugin',
  onRegister(ctx) { /* optional cleanup return */ },
  onStageEnter(stage, ctx) {},
  onStageLeave(stage, ctx) {},
  onBeforePersist(snapshot, ctx) { return snapshot },
  onAfterPersist(ctx) {},
  onQuotaLow(snapshot, ctx) {},
  renderPanel(stage) { return null },
})
```

See `src/extensions/` for types and the built-in activity-log stub.

## Windows one-click Desktop shortcut

User OS is Windows. Launchers live under `scripts/` (copied to `dist/` on build):

| File | Purpose |
|------|---------|
| `scripts/start-agent-console.ps1` | Checkout PR branch, `npm install`, `npm run dev`, open browser |
| `scripts/Start Agent Console.bat` | Double-click wrapper (`-ExecutionPolicy Bypass` for that run only) |
| `scripts/install-desktop-shortcut.ps1` | Installs Desktop `.lnk` → launcher (+ `.url` fallback) |
| `scripts/Agent Console.url` | Browser-only fallback → `http://127.0.0.1:5173/` |

**Install once (from the repo root on Windows):**

```powershell
powershell -ExecutionPolicy Bypass -File .\agent-console\scripts\install-desktop-shortcut.ps1
```

Then double-click **Agent Console** on the Desktop. Or run without installing:

```powershell
cd agent-console
.\scripts\"Start Agent Console.bat"
```

## Project layout

- `src/App.tsx` — stage rail + panels with advance gates
- `src/persistence.ts` — localStorage + export/import
- `src/quota/` — pluggable quota
- `src/extensions/` — `registerExtension` hooks
- `scripts/` — Windows Desktop helpers
