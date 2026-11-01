# Repository Baseline — 2026-11-01

## Submitted repository inventory
- Next.js 16 / React 19 / TypeScript application.
- Six diagnostic/reasoning agent identities are registered in the current source.
- Three deterministic diagnostic agents are present: performance, infrastructure, connectivity.
- Existing message bus, dispatcher, planner, task manager, coordinator, hypothesis agent, and verification agent.
- Six JSON scenario inputs and a recorded `six-scenario-results-historical.csv`.
- Existing `test-netcoop.ts` test runner.

## Environment observations
- The submitted ZIP does not contain `node_modules` or Git history.
- Runtime available in the working environment: Node.js 22.16.0 and npm 10.9.2.
- Dependency installation did not complete within the initial setup window; automated test execution is therefore pending dependency availability.

## Recorded scenario results supplied in the repository
- Normal operation: API_FAILED (500).
- Link congestion: API_FAILED (500).
- Weak Wi-Fi symptoms: API_SUCCESS, insufficient evidence.
- Interface fault: API_FAILED (500).
- DNS/DHCP insufficient evidence: API_SUCCESS, insufficient evidence.
- Invalid interoperability input: API_FAILED (400).

The 400 result for intentionally invalid input is not automatically a defect. The three 500 results on valid scenarios require investigation. These are historical repository results, not a fresh execution in this environment.

## Baseline limitations
- No full clean-install/build/test result has yet been established.
- The existing CSV does not contain server logs, so it cannot identify the cause of the 500 responses.
