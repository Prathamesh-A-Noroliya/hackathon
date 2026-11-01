# Agent Communication Protocol 1.0

## Purpose

NetCoop agents exchange bounded JSON messages. Every message belongs to one incident and has a unique message ID. Responses must reference the exact request they answer.

## Envelope

| Field | Meaning |
|---|---|
| `protocol_version` | Message protocol version; currently `1.0` |
| `message_id` | Unique ID for this message |
| `correlation_id` | Required on a response; points to the request message |
| `incident_id` | Incident scope shared by all messages in one investigation |
| `sender` / `recipient` | Registered agent IDs; self-messaging is rejected |
| `message_type` | `request`, `response`, `finding`, `hypothesis`, or `verification` |
| `timestamp` | ISO-compatible timestamp |
| `payload` | Bounded observation, evidence, limitations, confidence, requested data, schema version, and structured evidence |

## Payload conventions

- `evidence` contains readable statements grounded in telemetry.
- `limitations` describes missing data and interpretation boundaries.
- `requested_data` lists canonical metric/capability identifiers.
- `schema_version` identifies the telemetry schema understood by the sender.
- `structured_evidence` carries `evidence_id`, `metric`, `value`, `unit`, optional `threshold`, `severity`, `observation`, `source_agent`, `source_id`, `device_id`, optional `timestamp`, and provenance.
- `confidence` is a bounded heuristic score in `[0, 1]`, not a calibrated probability.

## Validation and delivery rules

1. Both endpoints must be registered and different.
2. The incident ID must match the active investigation.
3. Protocol and schema versions must be supported.
4. Evidence and limitation lists are bounded strings; structured evidence values must be finite numbers, strings, or booleans.
5. A response must have a correlation ID referencing an already-sent request.
6. Response sender and recipient must reverse the request endpoints.
7. A request accepts at most one response; duplicate message IDs are rejected.
8. The dispatcher verifies the recipient's declared role, capability, requested evidence types, and schema compatibility before running an adapter.
9. The bus enforces an investigation message ceiling to prevent unbounded growth.

## Compatibility

Telemetry schema `1.0` supports canonical performance, infrastructure, wireless, DNS, DHCP, device-state, interface-state, and neighbor fields. Strict ingestion rejects unknown or ambiguous metric aliases. Tolerant ingestion retains valid fields and returns quarantined-field warnings; it does not silently guess units or resolve ambiguous aliases.

## Current transport boundary

The message bus is an in-memory process-local implementation suitable for a reproducible hackathon demo. A distributed deployment would require durable transport, authentication, authorization, replay protection, and storage. Those production properties are not claimed by this prototype.


## Orchestration execution model

The coordinator emits a correlated request for each of the three diagnostic specialists before it consumes their responses. Tasks are tracked independently and partial results are retained. Current specialist adapters execute synchronously in-process; concurrent fan-out describes task scheduling and protocol behavior, not parallel CPU workers or a distributed broker.
