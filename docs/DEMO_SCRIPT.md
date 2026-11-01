# 3–5 Minute Demonstration Script

## 0:00–0:30 — Problem and architecture

Introduce NetCoop AI as an interoperable multi-agent network diagnosis prototype. Explain that the value is collaboration between specialist agents, not simply one model making a guess.

## 0:30–1:20 — Link congestion run

1. Open the diagnosis workspace.
2. Load **Link congestion** from the synthetic scenario presets.
3. Run the investigation.
4. Show the three diagnostic agents, correlated message timeline, structured evidence ledger, candidate hypothesis, independent verification, and recommendations.
5. Explain that the report calls congestion a probable cause, not a confirmed root cause.

## 1:20–2:10 — Missing evidence / abstention

1. Load **Weak Wi-Fi symptoms**.
2. Run the investigation.
3. Point out that latency, loss, and jitter do not prove weak Wi-Fi when RSSI and retransmission measurements are absent.
4. Show the `insufficient_evidence` status and requested additional measurements.

## 2:10–2:50 — Interoperability and robustness

Use `06-interoperability-invalid-input.json` with strict mode to show rejection. Repeat with `ingestion_mode: "tolerant"` to show valid fields retained and incompatible/unknown fields quarantined with warnings.

## 2:50–3:40 — Protocol and topology

Show the protocol documentation, request/response correlation IDs, capability registry, evidence deduplication, and explicit neighbor-only topology. Explain that the bus is in-memory and the prototype does not modify production infrastructure.

## 3:40–4:30 — Evaluation and limitations

Run `npm test` and `npm run test:scenarios`. State the tested scenario outcomes and explain that thresholds are demonstration defaults, confidence is heuristic, and real deployment requires calibrated baselines and historical telemetry.
