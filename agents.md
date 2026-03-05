# Agents

## Tampermonkey Scripts

### Workflow
- Source files live in `src/` as TypeScript
- Built JS files go to `dist/` and are committed to the repo
- Husky pre-commit hook runs `pnpm build` and stages `dist/` automatically
- The hook also verifies that `@version` was bumped in any changed script

### Tampermonkey Auto-Update
- Scripts include `@updateURL` and `@downloadURL` headers pointing to the raw GitHub URL
- Pattern: `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<script>.js`
- Tampermonkey checks for updates based on the `@version` header — bump it to propagate changes
- To install: paste the raw GitHub URL in Tampermonkey's "Install from URL" dialog

### Adding a New Script
1. Create `src/<name>.ts` with the `// ==UserScript==` header block
2. Include `@updateURL` and `@downloadURL` pointing to `https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/<name>.js`
3. Bump `@version` on every change
4. Commit — the pre-commit hook handles building and staging `dist/`
