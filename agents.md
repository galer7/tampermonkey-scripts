# Agents

## Tampermonkey Scripts

### Workflow
- Source files live in `src/` as TypeScript
- Shared utilities in `src/lib/` (dom, panel, probe, toast)
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

### Tampermonkey Auto-Update
- Scripts include `@updateURL` and `@downloadURL` headers pointing to the raw GitHub URL
- Pattern: `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<script>.js`
- Tampermonkey checks for updates based on the `@version` header — bump it to propagate changes
- To install: paste the raw GitHub URL in Tampermonkey's "Install from URL" dialog

### Adding a New Script
1. Create `src/<name>.ts` with the `// ==UserScript==` header block
2. `import { createPanel, ... } from "./lib"` — use what you need
3. Include `@updateURL` and `@downloadURL` pointing to `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<name>.js`
4. Bump `@version` on every change
5. Commit — the pre-commit hook handles building and staging `dist/`

### Debugging a Script
Use Browser Bridge (bbx) to read the page, run code in it and click through it.

When a `SelectorError` fires, the panel shows expandable HTML context (click to copy). Paste that to the agent for fixing.

