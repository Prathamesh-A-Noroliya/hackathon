# NetCoop AI

## Project
Multi-Agent Network Fault Diagnosis and Interoperability.

## Architecture
- Diagnostic agents: Performance, Infrastructure, Connectivity.
- Reasoning agents: Fault Correlation, Hypothesis, Verification.
- Coordinator: Concurrent specialist task fan-out, correlated task tracking, retries and partial-result retention.
- Communication: Structured agent messages and correlated responses.

## Required scenarios
1. Normal network operation.
2. Link congestion.
3. Weak Wi-Fi signal.
4. Ethernet/interface fault.
5. DNS/DHCP failure.
6. Interoperability failure.

## Evaluation requirements
- Evidence-backed hypotheses.
- Competing explanations.
- Independent evidence challenge.
- Versioned communication protocol.
- Malformed-message handling.
- Confidence and uncertainty reporting, with explicit uncalibrated-score metadata and telemetry coverage.
- Reproducible scenario tests.

## Telemetry limitation
Sample telemetry must be distinguished from live device telemetry. Live collection requires a configured monitoring integration.

## Product workspaces
- Obsidian dark NOC overview and synthetic 3D topology view.
- Diagnosis and investigation report.
- Evidence-linked hypothesis workspace.
- Synthetic fault simulator.
- Agent intelligence and protocol inspector.
- Context-aware AI analyst when an LLM provider is configured.

## Demo
1. Introduce the network incident.
2. Submit telemetry.
3. Show diagnostic agent collaboration.
4. Show hypothesis generation.
5. Show verification and conflicting evidence.
6. Present the final JSON diagnosis.
