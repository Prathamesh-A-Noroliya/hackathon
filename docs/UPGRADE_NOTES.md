# NetCoop AI — Obsidian Upgrade Notes

## Product changes

- Replaced the light dashboard visual language with the NETCOOP // OBSIDIAN dark NOC theme, cyan/teal operational accents, dark panels, and improved contrast.
- Added Evidence Graph, Fault Simulator, and Protocol Inspector workspaces.
- Added an interactive 3D synthetic campus topology view. It is explicitly labelled illustrative and must not be confused with discovered/live infrastructure.
- The fault simulator loads bundled synthetic scenarios into the existing diagnosis workflow. It does not issue network commands or contact production devices.
- The AI analyst now receives a bounded JSON snapshot of the active investigation (when one exists), including findings, evidence references, hypotheses, verification and message timeline. The system prompt treats this context as untrusted data and requires a distinction between observations and inferences.

## Engineering changes

- The coordinator now fans out the three registered specialist diagnostic tasks together using `Promise.all` rather than asking a planner to dispatch one specialist per loop iteration.
- Every specialist retains its own protocol request, correlation ID, task lifecycle, bounded retry and failure isolation. Partial results remain available if one specialist fails.
- Post-investigation UI states are derived from actual protocol events and recorded failures. During a diagnosis, specialist agents show as active, reasoning stages as queued, and the coordinator as active.
- The confidence field is explicitly marked `uncalibrated_model_assessment`. The report now includes a caveat and a separate telemetry-field coverage value. Do not interpret confidence as a calibrated probability.
- Evidence workspace links hypothesis support/contradiction references back to the evidence catalogue. It does not infer causality from mere correlation.
- The historical API smoke-test CSV was renamed to `six-scenario-results-historical.csv`; it is not presented as a fresh successful test run.

## Known boundaries (do not overclaim)

- Specialist diagnostic handlers are currently synchronous local analyzers. The coordinator performs concurrent task fan-out and is structured for asynchronous/remote adapters, but this release does not claim CPU-parallel worker execution.
- The 3D network scene is a synthetic illustrative digital-twin visual, not a synchronized model of real campus devices.
- The evidence workspace is an evidence-linked investigation view, not a force-directed graph database or causal inference engine.
- Confidence is not calibrated. A labelled dataset and calibration evaluation (e.g. Brier score/reliability curve) remain future work.
- The protocol inspector shows the recorded message envelope metadata; payload-level message inspection and durable distributed messaging remain future work.
- No live device polling, network scanning, or automated remediation is implemented.

## Verification status for this packaged source

A TypeScript transpilation syntax pass completed with zero syntax diagnostics. Full typecheck, unit/scenario suite, lint and Next.js production build could not be completed in this environment because dependency installation did not finish; `node_modules` was incomplete. On a network-enabled machine, run:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:scenarios
npm run build
```

Only report commands as passing after they complete successfully against this exact source tree.
