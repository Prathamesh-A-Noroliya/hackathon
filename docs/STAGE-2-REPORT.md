# Stage 2 — Agent interoperability and contracts

## Objective

Make agent collaboration verifiable rather than relying only on TypeScript interfaces or loosely correlated messages. This stage strengthens the existing protocol, registry, dispatcher, and diagnostic runtime without changing the overall project architecture.

## Implemented

- **Versioned message boundary:** runtime validation checks protocol version, incident identity, registered sender/recipient, message type, timestamps, bounded text/list sizes, confidence range, schema version, and structured evidence fields.
- **Correlated request/response:** the in-memory bus now requires a response to reference an already-sent request, checks that sender/recipient match that request, and accepts at most one response per request.
- **Safe message handling:** stored and returned messages are cloned; duplicate message IDs and investigation message-limit overflow are rejected.
- **Response lookup:** `getResponseFor()` retrieves a response by request ID and optionally by expected agent, avoiding broad `.find()` logic in the coordinator.
- **Capability negotiation:** every registered capability declares telemetry schema `1.0`; diagnostic capability declarations now include the Stage 1 throughput, capacity, device/interface, Wi-Fi, DNS and DHCP evidence fields. `negotiateAgentCapability()` ranks matches by evidence coverage with deterministic tie-breaking.
- **Dispatcher enforcement:** requests are runtime-validated before dispatch, and duplicate or unsupported evidence identifiers are rejected.
- **Response contract:** diagnostic responses preserve structured evidence when an agent supplies it and carry the telemetry schema version when available.
- **Regression coverage added:** tests cover capability ranking, malformed structured evidence, response correlation, and unknown request rejection.

## Validation

- Passed strict TypeScript compilation for the changed protocol, registry, dispatcher, and diagnostic runtime modules:

  ```bash
  tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/netcoop/types.ts src/netcoop/agents/agent-communication.ts src/netcoop/agents/agent-registry.ts src/netcoop/agents/agent-dispatcher.ts src/netcoop/agents/diagnostic-agent-runtime.ts
  ```

- Passed `git diff --check`.
- The full test suite and Next.js build were not run: project dependencies are not installed in this environment (the earlier npm registry install timed out). Added tests are therefore **not yet runtime-verified**.

## Remaining limitations

- The message bus remains process-local and in-memory; it is not a distributed transport or durable event log.
- Diagnostic agents are still synchronous local handlers. The protocol supports structured collaboration, but this stage does not introduce remote agent execution.
- Existing diagnostic agents may continue to emit human-readable evidence strings; structured evidence is validated and transported when provided, but not fabricated from unparsed prose.
