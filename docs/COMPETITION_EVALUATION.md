# Competition Evaluation Framework

This framework maps the product to common technical-hackathon judging dimensions. It is a proposed evaluation protocol, not a claim that the project has received a judge's score or achieved production-grade accuracy.

## Evaluation matrix

| Dimension | What a reviewer should inspect | Suggested evidence / measurement |
|---|---|---|
| Problem relevance | Whether the tool addresses a real network-operations workflow | Clear user story, inputs, outputs, limitations |
| Technical implementation | Correctness of telemetry normalization, validation, orchestration and API behavior | Typecheck, unit tests, API tests, reproducible scenarios |
| Multi-agent design | Whether specialists have distinct responsibilities and communicate through validated messages | Agent registry, message envelopes, correlation IDs, task lifecycle |
| Evidence quality | Whether claims are linked to observable telemetry and source agents | Evidence IDs, structured observations, provenance, deduplication |
| Reasoning quality | Whether hypotheses account for support, contradiction and missing evidence | Hypothesis evidence references and independent verification records |
| Robustness | Behavior under missing, invalid, duplicate, incompatible or incomplete inputs | Strict/tolerant validation and negative scenarios |
| Explainability | Whether an analyst can understand why a result was produced and what remains unknown | Findings, limitations, confidence caveat, missing evidence, recommendations |
| UX and accessibility | Information hierarchy, responsiveness, keyboard focus, reduced-motion behavior | Desktop/mobile walkthrough and accessibility review |
| Practical impact | Whether an operator can use the output to decide the next investigation step | Timed task walkthrough with representative users |
| Innovation | Whether coordination and verification add value beyond a single threshold alert | Baseline comparison against simple rules/manual triage |

## Suggested quantitative measures

1. **Scenario outcome agreement:** correct expected status / total labeled scenarios.
2. **Input rejection precision:** invalid payloads rejected / invalid payloads submitted.
3. **Valid-input acceptance:** valid payloads accepted / valid payloads submitted.
4. **Evidence reference integrity:** hypothesis evidence references resolving to catalogue entries / all references.
5. **Agent response correlation:** valid correlated responses / accepted agent requests.
6. **Verification coverage:** hypotheses with an explicit verification record / hypotheses requiring verification.
7. **Latency:** median and p95 API response time over a documented test setup and repeated runs.
8. **Analyst task time:** time to identify evidence, uncertainty and next action in a controlled user test.
9. **Usability:** task completion rate and a documented user-feedback instrument.
10. **Reliability:** successful runs / total repeated runs, with environment and sample size stated.

## Fair comparison protocol

- Compare NetCoop AI against a documented threshold/rule-based baseline on the same scenario inputs.
- Keep scenario labels hidden from the system during evaluation.
- Use repeated runs and report sample sizes.
- Separate status classification from root-cause correctness.
- Report false positives, false negatives, inconclusive outcomes and abstentions.
- Do not treat a heuristic confidence score as a calibrated probability.
- Do not claim that synthetic scenarios represent real campus or enterprise networks.
- Include a reviewer walkthrough of one normal case, one fault case and one insufficient-evidence case.

## Current prototype boundaries

The system is deterministic by default, uses synthetic scenario data in its included test suite, and does not collect live network telemetry. The current verification agent is an independent software stage in the same application workflow; it is not an independent external auditor or a separately hosted model. Production-grade accuracy, calibrated confidence, distributed execution and user-study impact require additional validation.
