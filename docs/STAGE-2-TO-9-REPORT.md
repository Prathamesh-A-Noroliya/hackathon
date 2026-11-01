# Stages 2–9 Engineering Summary

## Interoperability and contracts

The agent bus now enforces versioned envelopes, incident scoping, sender/recipient identity, bounded evidence fields, response correlation, duplicate rejection and one response per request. The dispatcher checks registered diagnostic role, capability ID, requested evidence identifiers and schema version.

## Diagnostic coverage

The three diagnostic agents now emit structured observations for performance, infrastructure, wireless, DNS/DHCP and explicit device/interface state. Thresholds are declared centrally and documented as demonstration defaults. Missing telemetry is surfaced as a limitation, not silently assumed normal.

## Evidence and reasoning

Evidence IDs are sample-aware. Duplicate observations are deduplicated before cross-domain correlation. Hypotheses use existing evidence catalogue IDs only. Verification distinguishes a symptom cluster from independent cross-domain support. Candidate confidence is explicitly heuristic and does not represent a calibrated probability.

## Orchestration

The coordinator dispatches all available specialists through the registry, tracks correlated tasks, retries a failed specialist once, preserves successful partial results and returns a timeline. A failed specialist no longer automatically converts every valid scenario into an API 500.

## Topology and interface

The topology helper models only directly supplied neighbor relationships. The dashboard exposes sample scenario presets, the diagnostic evidence ledger, agent timeline and topology limits. No generated imagery or 3D visualization is required for the evaluation criteria.

## Submission materials

README, protocol, architecture, scenario matrix, validation and demo-script documentation are included in the final repository.
