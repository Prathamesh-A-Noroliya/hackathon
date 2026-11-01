# NetCoop AI — Evidence-led Multi-Agent Network Investigation

NetCoop AI is a research and demonstration platform for analyzing supplied network telemetry, coordinating specialist agents, building evidence-grounded hypotheses, and independently verifying candidate explanations.

It is designed for synthetic data and explicitly authorized test environments. It does not connect to, scan, or modify production network infrastructure.

## Product capabilities

The interface uses a light operational visual system with accessible contrast, restrained gradients, responsive navigation, and distinct semantic colours for healthy, warning, and critical states.

- **Light NOC workspace:** clean, responsive operations-centre interface with white surfaces, cyan/purple accents, amber highlights, red critical states with overview, diagnosis, investigations, agent intelligence, evidence graph, fault simulator, protocol inspector, and context-aware AI analyst.
- **Telemetry contract:** versioned schema, canonical metric names, aliases, unit conversion, strict validation, and optional tolerant ingestion with quarantined fields.
- **Specialist analysis:** performance, infrastructure, and connectivity agents produce findings and structured metric evidence.
- **Agent interoperability:** versioned message envelopes, sender/recipient validation, incident and correlation IDs, bounded payloads, duplicate rejection, and correlated responses.
- **Orchestration:** concurrent specialist-agent fan-out, capability registry, per-agent correlated tasks, bounded retries, failure isolation, and partial-result retention. Specialist adapters are currently synchronous local analyzers; the fan-out contract is ready for asynchronous/remote adapters.
- **Evidence intelligence:** evidence catalogue, provenance, deduplication, fault correlation, explicit limitations, hypothesis-to-evidence traceability, and transparent confidence caveats.
- **Hypothesis and independent verification:** evidence-linked candidate explanations, supporting/contradicting/missing evidence, and separate verification verdicts.
- **Topology context:** interactive 3D synthetic campus topology plus supplied device/neighbor relationships; illustrative topology is clearly labelled and inferred routes are not fabricated.
- **Optional AI analyst:** OpenAI-compatible or local Ollama configuration. Core diagnosis remains deterministic and usable without an LLM key.
- **Scenario suite:** six synthetic scenarios covering normal operation, congestion, weak Wi-Fi symptoms, interface faults, insufficient DNS/DHCP evidence, and invalid/interoperable input. A fault-simulator workspace loads reproducible profiles into the diagnosis form.

## Requirements

- Node.js 20.9 or newer (Node.js 22 recommended)
- npm

## Windows PowerShell setup

From the project root:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The core diagnosis engine works without an API key. The optional chat assistant requires provider configuration in `.env.local`.

## Optional model configuration

Edit `.env.local`:

```dotenv
NETCOOP_USE_LLM=false
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4.1-mini
```

For a local Ollama OpenAI-compatible endpoint, set `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama`, and a model installed locally. Never commit `.env.local` or real API keys.

Set `NETCOOP_USE_LLM=true` only when you intentionally want optional model-assisted hypothesis/verification reasoning. The deterministic path remains the default. Model output is treated as untrusted and validated against the evidence catalogue.

## Commands

```powershell
npm run dev                 # Development server
npm run build               # Production build
npm run start               # Production server
npm run lint                # ESLint
npm run typecheck           # TypeScript check
npm test                    # Unit and protocol tests
npm run test:scenarios      # End-to-end synthetic scenario checks
npm run test:performance    # Performance-agent smoke test
npm run test:all            # Typecheck, tests, scenarios, and production build
```

## API

### `GET /api/diagnose`

Returns readiness, protocol/schema versions, registered agent capabilities, and supported ingestion modes.

### `POST /api/diagnose`

Send JSON telemetry. Example:

```json
{
  "schema_version": "1.0",
  "source": "synthetic-lab",
  "incident_id": "INC-1001",
  "device": "gateway-01",
  "timestamp": "2026-11-01T10:00:00Z",
  "metrics": {
    "latency_ms": 280,
    "packet_loss_percent": 8,
    "jitter_ms": 75,
    "utilization_percent": 96,
    "queue_drops": 420
  }
}
```

Strict validation is the default. Add `"ingestion_mode": "tolerant"` to preserve valid fields while quarantining unknown, invalid, or duplicate metric aliases. Envelope errors such as missing incident/device identity still reject the request.

### `POST /api/chat`

Optional model-backed analyst endpoint. Provider settings are read server-side; credentials are not sent to the browser.

## Evaluation and evidence

The synthetic scenario suite is intended to test repeatability and expected system behavior, not to claim production accuracy. See:

- `docs/ARCHITECTURE.md` — agent roles, evidence flow, orchestration, topology limits
- `docs/AGENT_PROTOCOL.md` — message contract and validation
- `docs/SCENARIO_MATRIX.md` — scenario expectations
- `docs/COMPETITION_EVALUATION.md` — judging-oriented evaluation rubric and measurable criteria
- `docs/QUALITY_ASSURANCE.md` — verification record and environment limitations
- `docs/DEMO_SCRIPT.md` — suggested demonstration sequence
- `docs/FINAL_VALIDATION.md` — prior validation notes
- `docs/UPGRADE_NOTES.md` — changes in the interface and architecture upgrade notes and current verification boundaries
- `six-scenario-results-historical.csv` — historical API smoke-test output retained for transparency; not a current pass report

## Safety, limitations and responsible use

- Use synthetic data or telemetry you are explicitly authorized to analyze.
- No production telemetry collection, scanning, or remediation is performed.
- Recommendations are advisory; a network operator must review them.
- Thresholds are demonstration defaults and must be calibrated to the environment.
- Confidence is an uncalibrated model/evidence assessment, not a statistically calibrated probability. The API labels this explicitly and exposes a separate telemetry-field coverage indicator.
- A single snapshot cannot prove causation; historical time series, logs, and multi-point measurements improve diagnosis.
- The in-memory message bus is process-local, not a distributed durable broker.
- The project is a prototype, not a certified network monitoring or incident-response product.
