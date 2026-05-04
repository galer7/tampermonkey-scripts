# Agents

## Tampermonkey Scripts

### Workflow
- Source files live in `src/` as TypeScript
- Shared utilities in `src/lib/` (dom, panel, probe, toast, bridge)
- Build via esbuild (`pnpm build`) — each `src/*.ts` is bundled with lib inlined
- Files in `src/lib/` are NOT entry points — they get tree-shaken into scripts that import them
- Built JS files go to `dist/` and are committed to the repo
- Husky pre-commit hook runs `pnpm build` and stages `dist/` automatically
- The hook also verifies that `@version` was bumped in any changed script
- Type-check only: `pnpm typecheck` (tsc --noEmit, no output)

### Shared Library (`src/lib/`)
| Module | Exports | Purpose |
|--------|---------|---------|
| dom | `wait`, `waitForElement`, `waitForVisible`, `setInputValue`, `clickAndWait`, `SelectorError` | DOM interaction + error with HTML dump |
| panel | `createPanel` | Floating debug panel with log, buttons, error display |
| probe | `probe`, `probeAll`, `logProbeResults` | Selector health-check |
| toast | `toast` | Non-blocking notifications |
| bridge | `initBridge`, `bridgeLog` | WebSocket client to local debug server |

### Bridge Server (`pnpm server`)
A local WebSocket + HTTP server on `localhost:9876` for live debugging TM scripts from CLI.

**Starting**: `pnpm server` (or `node server/index.mjs`)

**HTTP Endpoints** (for agent/CLI access):
| Endpoint | Purpose |
|----------|---------|
| `GET /clients` | List connected scripts |
| `GET /eval?script=NAME&code=CODE` | Run JS in the script's page context |
| `GET /snapshot?script=NAME&selector=SEL` | Get innerHTML of a selector |
| `GET /probe?script=NAME&selector=SEL` | Check if selector exists |
| `GET /logs` | Recent log messages from all scripts |

**Usage from Claude Code**: `curl 'http://localhost:9876/snapshot?script=hriflow&selector=.modal-container'`

**In scripts**: call `initBridge("scriptName")` at startup. Panel logs auto-forward to the server.

### Tampermonkey Auto-Update
- Scripts include `@updateURL` and `@downloadURL` headers pointing to the raw GitHub URL
- Pattern: `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<script>.js`
- Tampermonkey checks for updates based on the `@version` header — bump it to propagate changes
- To install: paste the raw GitHub URL in Tampermonkey's "Install from URL" dialog

### Adding a New Script
1. Create `src/<name>.ts` with the `// ==UserScript==` header block
2. `import { initBridge, createPanel, ... } from "./lib"` — use what you need
3. Call `initBridge("<name>")` at script start for debug server connectivity
4. Include `@updateURL` and `@downloadURL` pointing to `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<name>.js`
5. Bump `@version` on every change
6. Commit — the pre-commit hook handles building and staging `dist/`

### Debugging a Script
1. Start the server: `pnpm server`
2. Open the page where the TM script runs
3. From CLI: `curl localhost:9876/clients` to verify connection
4. Inspect DOM: `curl 'localhost:9876/snapshot?script=NAME&selector=.some-class'`
5. Run code: `curl 'localhost:9876/eval?script=NAME&code=document.title'`
6. Read logs: `curl localhost:9876/logs`

When a `SelectorError` fires, the panel shows expandable HTML context (click to copy). Paste that to the agent for fixing.

### Conventions
- Use stable CSS selectors (class-based) instead of fragile nth-child paths
- Centralize selectors in a `SELECTORS` object at the top of each script for easy updates
- All scripts should call `initBridge()` for debug connectivity
