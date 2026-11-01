# Quality Assurance Record — Obsidian Upgrade

## Environment

- Node.js: v22.16.0
- npm: v10.9.2
- `npm ci` did not complete because registry access timed out; the installed dependency tree was incomplete.
- The test harness therefore used globally available TypeScript/ts-node tools and a temporary OpenAI import stub. The deterministic path did not invoke the OpenAI client.

## Checks

| Check | Result | Notes |
|---|---:|---|
| Core unit/protocol suite | **61 passed, 0 failed** | Global `ts-node --transpile-only`; no model call. |
| Synthetic scenario suite | **42 passed, 0 failed** | Includes six fixtures, three-specialist fan-out ordering, expected diagnosis status, evidence reference integrity, verification coverage and confidence metadata. |
| Backend strict TypeScript compile | **Passed** | `src/netcoop` compiled with global `tsc --strict` and temporary ambient declarations for unavailable type packages. |
| TypeScript/TSX syntax check | **27 files, 0 diagnostics** | Compiler API transpilation; not a full project typecheck. |
| Performance-agent smoke test | Executed | Output inspected; not a benchmark. |
| Next.js production build | Not run | Requires complete dependency installation. |
| ESLint | Not run | Requires project dependencies. |
| Full frontend typecheck | Not run | Requires React/Next.js and related dependency types. |
| Browser/mobile visual QA | Not run | Requires running the app in a browser. |

## Important interpretation

The local unit/protocol and scenario results demonstrate deterministic behavior for the included fixtures. They do not establish production readiness, calibrated diagnostic accuracy, or zero defects. Run the full project-native checks on a network-enabled Windows or Linux machine after `npm ci`.

## Final verification commands

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:scenarios
npm run build
```

After a successful build, run `npm run start` and manually verify all navigation pages, scenario presets, evidence references, protocol events, chat context behavior, responsive layout and API error states.
