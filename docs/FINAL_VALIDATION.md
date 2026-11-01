# Final Validation Report — NetCoop AI Obsidian

Date: 2026-11-01

## Checks executed against this source tree

| Check | Result | Execution method / boundary |
|---|---:|---|
| Core unit and protocol tests | **61 passed, 0 failed** | Global `ts-node --transpile-only`; temporary OpenAI import stub used only to satisfy module loading. Deterministic test path made no model call. |
| Synthetic scenario evaluation | **42 passed, 0 failed** | Global `ts-node --transpile-only`; includes six scenario fixtures, strict/tolerant ingestion, diagnosis outcomes, correlated agent fan-out, evidence references, verification coverage and confidence metadata. |
| Performance-agent smoke test | Executed | Output inspected; not represented as a benchmark. |
| Backend TypeScript strict check | **Passed** | Global `tsc --strict` against `src/netcoop`; temporary ambient declarations supplied for unavailable Node/OpenAI type packages. |
| TypeScript/TSX syntax transpilation | **27 files, 0 syntax diagnostics** | Global TypeScript compiler API. Syntax validation is not a complete frontend typecheck. |
| ZIP integrity | Passed | Archive tested after packaging. |

## Scenario outcomes

| Scenario | Expected result | Observed |
|---|---|---|
| Normal operation | `no_fault_detected` | Pass |
| Link congestion | `probable_cause` | Pass |
| Weak Wi-Fi symptoms without RF telemetry | `insufficient_evidence` | Pass |
| Interface fault with competing signals | `multiple_plausible_causes` | Pass |
| DNS/DHCP without service counters | `insufficient_evidence` | Pass |
| Invalid/incompatible fields | Strict rejection; tolerant quarantine | Pass |

All valid scenarios returned three correlated specialist responses. The fan-out test confirms that all three distinct specialist requests are emitted before the first specialist response. Hypothesis evidence references resolved to the evidence catalogue, and each generated hypothesis received one verification result.

## Not verified in this environment

- `npm ci` did not complete because the npm registry request timed out; the local npm cache did not contain all required dependencies.
- Consequently, the project-native `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:scenarios`, and `npm run build` commands were not run with the complete dependency tree.
- Browser/mobile visual QA, production deployment, live LLM provider behavior, and live network telemetry integration were not tested.

## Required verification on the target machine

Use Node.js 20.9+ (Node.js 22 recommended) and run:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:scenarios
npm run build
```

Only claim those checks as passing after they complete successfully against this exact source tree.

## Historical API smoke-test data

`six-scenario-results-historical.csv` retains an earlier API smoke-test run containing HTTP 500 and HTTP 400 failures. It is intentionally labelled historical and is not a current test result. The deterministic local test-harness results above are a separate execution path; do not conflate them.
