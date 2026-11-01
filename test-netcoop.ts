import assert from "node:assert/strict";
import { validateTelemetry, validateTelemetryTolerant } from "./src/netcoop/telemetry";
import { runPerformanceAgent } from "./src/netcoop/agents/performance-agent";
import { runInfrastructureAgent } from "./src/netcoop/agents/infrastructure-agent";
import { runConnectivityAgent } from "./src/netcoop/agents/connectivity-agent";
import {
  AgentMessageBus,
  createAgentMessage,
  validateAgentMessage,
} from "./src/netcoop/agents/agent-communication";
import type { NetworkTelemetry } from "./src/netcoop/types";
import { AgentTaskManager } from "./src/netcoop/agents/task-manager";
import {
  handleDiagnosticAgentRequest,
  selectDiagnosticAgentOrder,
} from "./src/netcoop/agents/diagnostic-agent-runtime";

import {
  getRegisteredAgents,
  getAgentRegistration,
  findAgentsForEvidence,
  negotiateAgentCapability,
} from "./src/netcoop/agents/agent-registry";
import { dispatchDiagnosticAgent } from "./src/netcoop/agents/agent-dispatcher";
import { assessTopology } from "./src/netcoop/agents/topology-agent";
import { runFaultCorrelationAgent } from "./src/netcoop/agents/fault-correlation-agent";
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("PASS:", name);
  } catch (error) {
    failed++;
    console.error("FAIL:", name, error);
  }
}

function telemetry(metrics: Record<string, number> = {}): NetworkTelemetry {
  return {
    incident_id: "TEST-001",
    device: "Switch-01",
    metrics,
  };
}

// TELEMETRY VALIDATION
test("Accepts valid telemetry", () => {
  assert.equal(validateTelemetry(telemetry({ latency_ms: 20 })).valid, true);
});

test("Rejects null telemetry", () => {
  assert.equal(validateTelemetry(null).valid, false);
});

test("Rejects missing incident ID", () => {
  assert.equal(validateTelemetry({ device: "SW-1", metrics: {} }).valid, false);
});

test("Rejects string metric values", () => {
  assert.equal(validateTelemetry({
    incident_id: "T1", device: "SW-1",
    metrics: { latency_ms: "100" },
  }).valid, false);
});

test("Rejects negative latency", () => {
  assert.equal(validateTelemetry(telemetry({ latency_ms: -1 })).valid, false);
});

test("Rejects packet loss above 100 percent", () => {
  assert.equal(validateTelemetry(telemetry({ packet_loss_percent: 101 })).valid, false);
});

test("Rejects unknown metric names", () => {
  assert.equal(validateTelemetry(telemetry({ unknown_metric: 10 })).valid, false);
});

test("Accepts missing optional measurements", () => {
  assert.equal(validateTelemetry(telemetry({})).valid, true);
});

test("Accepts versioned telemetry with source and device status", () => {
  const result = validateTelemetry({
    schema_version: "1.0", source: "snmp-adapter", incident_id: "T2",
    device: "SW-2", device_status: "up", interface_status: "up",
    neighbors: ["SW-3"], metrics: { latency_ms: 12 },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.schema_version, "1.0");
    assert.equal(result.data.source, "snmp-adapter");
    assert.deepEqual(result.data.neighbors, ["SW-3"]);
  }
});

test("Rejects unsupported telemetry schema versions", () => {
  assert.equal(validateTelemetry({
    schema_version: "2.0", incident_id: "T3", device: "SW-3", metrics: {},
  }).valid, false);
});

test("Normalizes wireless, DNS, DHCP and capacity metrics", () => {
  const result = validateTelemetry({
    incident_id: "T4", device: "AP-1",
    metrics: {
      rssi: { value: -67, unit: "dBm" },
      wifi_retransmission: { value: 0.12, unit: "fraction" },
      dns_failure: { value: 2, unit: "percent" },
      dhcp_failure: 1,
      link_capacity: { value: 1, unit: "gbps" },
    },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.metrics.rssi_dbm, -67);
    assert.equal(result.data.metrics.wifi_retransmission_percent, 12);
    assert.equal(result.data.metrics.dns_failure_percent, 2);
    assert.equal(result.data.metrics.dhcp_failure_percent, 1);
    assert.equal(result.data.metrics.link_capacity_mbps, 1000);
  }
});

test("Tolerant ingestion preserves valid metrics and quarantines invalid ones", () => {
  const result = validateTelemetryTolerant({
    incident_id: "T5", device: "SW-5",
    metrics: { latency_ms: 25, unknown_vendor_metric: 7, packet_loss_percent: 3 },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.metrics.latency_ms, 25);
    assert.equal(result.data.metrics.packet_loss_percent, 3);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].code, "METRIC_QUARANTINED");
  }
});


test("Tolerant ingestion quarantines duplicate aliases instead of overwriting", () => {
  const result = validateTelemetryTolerant({
    incident_id: "T6", device: "SW-6",
    metrics: { latency: 20, latency_ms: 30 },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.metrics.latency_ms, 20);
    assert.equal(result.issues.length, 1);
    assert.match(result.issues[0].message, /ambiguous/i);
  }
});

// PERFORMANCE AGENT
test("Performance agent detects high latency", () => {
  const result = runPerformanceAgent(telemetry({ latency_ms: 200 }));
  assert.match(result.observation, /latency/i);
});

test("Performance agent detects packet loss", () => {
  const result = runPerformanceAgent(telemetry({ packet_loss_percent: 5 }));
  assert.match(result.observation, /packet loss/i);
});

test("Performance agent detects high jitter", () => {
  const result = runPerformanceAgent(telemetry({ jitter_ms: 50 }));
  assert.match(result.observation, /jitter/i);
});

test("Performance agent reports missing measurements", () => {
  const result = runPerformanceAgent(telemetry({}));
  assert.ok(result.limitations.length > 0);
});

test("Performance agent does not flag normal latency", () => {
  const result = runPerformanceAgent(telemetry({ latency_ms: 20 }));
  assert.match(result.observation, /No elevated latency/i);
});

// INFRASTRUCTURE AGENT
test("Infrastructure agent detects high CPU", () => {
  const result = runInfrastructureAgent(telemetry({ cpu_utilization_percent: 90 }));
  assert.match(result.observation, /CPU/i);
});

test("Infrastructure agent detects high memory", () => {
  const result = runInfrastructureAgent(telemetry({ memory_utilization_percent: 95 }));
  assert.match(result.observation, /memory/i);
});

test("Infrastructure agent detects high interface utilization", () => {
  const result = runInfrastructureAgent(telemetry({ utilization_percent: 90 }));
  assert.match(result.observation, /utilization/i);
});

test("Infrastructure agent detects interface errors", () => {
  const result = runInfrastructureAgent(telemetry({ interface_errors: 5 }));
  assert.match(result.observation, /interface errors/i);
});

test("Infrastructure agent detects queue drops", () => {
  const result = runInfrastructureAgent(telemetry({ queue_drops: 20 }));
  assert.match(result.observation, /queue drops/i);
});

test("Infrastructure agent reports missing metrics", () => {
  const result = runInfrastructureAgent(telemetry({}));
  assert.ok(result.limitations.length > 0);
});

// CONNECTIVITY AGENT
test("Connectivity agent detects packet loss", () => {
  const result = runConnectivityAgent(telemetry({ packet_loss_percent: 8 }));
  assert.match(result.observation, /packet loss/i);
});

test("Connectivity agent reports missing topology", () => {
  const result = runConnectivityAgent(telemetry({ latency_ms: 20 }));
  assert.ok(result.limitations.some(item => /topology/i.test(item)));
});


// TELEMETRY INTEROPERABILITY
test("Normalizes common telemetry aliases", () => {
  const result = validateTelemetry({
    incident_id: "ALIAS-1",
    hostname: "edge-01",
    measurements: {
      latency: 120,
      packetLossPercent: 1.5,
      cpu_percent: 70,
    },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.device, "edge-01");
    assert.equal(result.data.metrics.latency_ms, 120);
    assert.equal(result.data.metrics.packet_loss_percent, 1.5);
    assert.equal(result.data.metrics.cpu_utilization_percent, 70);
  }
});

test("Converts explicitly supplied units to canonical units", () => {
  const result = validateTelemetry({
    incident_id: "UNIT-1",
    device_id: "router-02",
    telemetry: {
      latency: { value: 0.12, unit: "seconds" },
      bandwidth: { value: 1, unit: "Gbps" },
      packet_loss: { value: 0.02, unit: "fraction" },
    },
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.metrics.latency_ms, 120);
    assert.equal(result.data.metrics.bandwidth_mbps, 1000);
    assert.equal(result.data.metrics.packet_loss_percent, 2);
  }
});

test("Rejects ambiguous duplicate aliases", () => {
  const result = validateTelemetry({
    incident_id: "DUP-1",
    device: "router-03",
    metrics: { latency: 100, latency_ms: 110 },
  });
  assert.equal(result.valid, false);
});

test("Rejects unsupported units instead of guessing", () => {
  const result = validateTelemetry({
    incident_id: "BAD-UNIT",
    device: "router-04",
    metrics: { latency: { value: 100, unit: "minutes" } },
  });
  assert.equal(result.valid, false);
});

test("Prioritizes diagnostic agents based on available telemetry coverage", () => {
  const order = selectDiagnosticAgentOrder(telemetry({
    cpu_utilization_percent: 91,
    memory_utilization_percent: 88,
    utilization_percent: 92,
    queue_drops: 4,
    interface_errors: 2,
  }));
  assert.equal(order[0], "infrastructure-agent");
  assert.equal(new Set(order).size, 3);
});


test("Diagnostic handler executes and sends a correlated response", () => {
  const bus = new AgentMessageBus("TEST-001");
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [], requested_data: ["latency_ms"] },
  });
  bus.send(request);
  const finding = handleDiagnosticAgentRequest({
    request,
    telemetry: telemetry({ latency_ms: 180 }),
    messageBus: bus,
  });
  const response = bus.getMessagesFor("coordinator").find(
    (message) => message.message_type === "response"
  );
  assert.ok(finding.evidence.length > 0);
  assert.equal(response?.sender, "performance-agent");
  assert.equal(response?.correlation_id, request.message_id);
});

// MESSAGE PROTOCOL AND BUS
test("Creates a valid structured agent message", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [], requested_data: ["latency_ms"] },
  });
  assert.deepEqual(validateAgentMessage(message, "TEST-001"), []);
});

test("Rejects messages for another incident", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  assert.ok(validateAgentMessage(message, "OTHER-INCIDENT").length > 0);
});

test("Rejects incompatible protocol version", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  assert.ok(validateAgentMessage({ ...message, protocol_version: "99.0" }, "TEST-001").length > 0);
});

test("Rejects self-directed agent messages", () => {
  assert.throws(() => createAgentMessage({
    incidentId: "TEST-001", sender: "performance-agent", recipient: "performance-agent",
    messageType: "finding", payload: { evidence: [], limitations: [] },
  }), /cannot send a message to itself/);
});

test("Rejects oversized protocol messages", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001", sender: "coordinator", recipient: "performance-agent",
    messageType: "request", payload: { evidence: ["x".repeat(65_000)], limitations: [] },
  });
  assert.ok(validateAgentMessage(message, "TEST-001").some(issue => /64 KB/.test(issue)));
});

test("Rejects unknown agents", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  assert.ok(validateAgentMessage({ ...message, sender: "unknown-agent" }, "TEST-001").length > 0);
});

test("Capability negotiation ranks agents by supported evidence coverage", () => {
  const matches = negotiateAgentCapability({
    evidenceTypes: ["latency_ms", "packet_loss_percent", "jitter_ms"],
    roles: ["diagnostic"], schemaVersion: "1.0",
  });
  assert.equal(matches[0]?.agent.id, "performance-agent");
  assert.equal(matches[0]?.coverage, 1);
});

test("Message bus stores and retrieves request/response messages", () => {
  const bus = new AgentMessageBus("TEST-001");
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const response = createAgentMessage({
    incidentId: "TEST-001",
    sender: "performance-agent",
    recipient: "coordinator",
    messageType: "response",
    correlationId: request.message_id,
    payload: { evidence: ["Latency: 20 ms"], limitations: [], observation: "Normal" },
  });
  bus.send(request);
  bus.send(response);
  assert.equal(bus.getMessages().length, 2);
  assert.equal(bus.getMessagesFor("coordinator").length, 1);
  assert.equal(bus.getMessagesFrom("performance-agent").length, 1);
  assert.equal(response.correlation_id, request.message_id);
});

test("Message bus retrieves only the response correlated to the requested agent", () => {
  const bus = new AgentMessageBus("TEST-001");
  const request = createAgentMessage({
    incidentId: "TEST-001", sender: "coordinator", recipient: "performance-agent",
    messageType: "request", payload: { evidence: [], limitations: [] },
  });
  const response = createAgentMessage({
    incidentId: "TEST-001", sender: "performance-agent", recipient: "coordinator",
    messageType: "response", correlationId: request.message_id,
    payload: { evidence: [], limitations: [], observation: "Checked" },
  });
  bus.send(request);
  bus.send(response);
  assert.equal(bus.getResponseFor(request.message_id, "performance-agent")?.message_id, response.message_id);
  assert.equal(bus.getResponseFor(request.message_id, "infrastructure-agent"), undefined);
});

test("Rejects malformed structured evidence at the message boundary", () => {
  const message = createAgentMessage({
    incidentId: "TEST-001", sender: "performance-agent", recipient: "coordinator",
    messageType: "finding", payload: {
      evidence: [], limitations: [],
      structured_evidence: [{
        evidence_id: "e-1", metric: "latency_ms", value: Number.NaN, severity: "warning",
        observation: "Latency observed", source_agent: "performance-agent", device_id: "SW-1",
      }],
    },
  });
  assert.ok(validateAgentMessage(message, "TEST-001").some((issue) => issue.includes("value")));
});

test("Message bus rejects responses without a matching sent request", () => {
  const bus = new AgentMessageBus("TEST-001");
  const response = createAgentMessage({
    incidentId: "TEST-001", sender: "performance-agent", recipient: "coordinator",
    messageType: "response", correlationId: "missing-request",
    payload: { evidence: [], limitations: [] },
  });
  assert.throws(() => bus.send(response), /unknown or unsent request/);
});

test("Message bus rejects duplicate message IDs", () => {
  const bus = new AgentMessageBus("TEST-001");
  const message = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  bus.send(message);
  assert.throws(() => bus.send(message), /Duplicate message ID/);
});


// AGENT TASK LIFECYCLE
test("Creates a pending task for an agent request", () => {
  const bus = new AgentMessageBus("TEST-001");
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request);

  assert.equal(task.status, "pending");
  assert.equal(task.agent, "performance-agent");
  assert.equal(task.request_message_id, request.message_id);
  assert.equal(manager.getTasks().length, 1);
});

test("Completes a task only after a correlated response from its assigned agent", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request);
  manager.markRunning(task.task_id);

  const response = createAgentMessage({
    incidentId: "TEST-001",
    sender: "performance-agent",
    recipient: "coordinator",
    messageType: "response",
    correlationId: request.message_id,
    payload: { evidence: ["Latency: 20 ms"], limitations: [] },
  });

  const completed = manager.completeFromResponse(response);
  assert.equal(completed.status, "completed");
  assert.equal(completed.response_message_id, response.message_id);
});

test("Rejects a response from the wrong agent", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request);
  manager.markRunning(task.task_id);

  const response = createAgentMessage({
    incidentId: "TEST-001",
    sender: "infrastructure-agent",
    recipient: "coordinator",
    messageType: "response",
    correlationId: request.message_id,
    payload: { evidence: [], limitations: [] },
  });

  assert.throws(
    () => manager.completeFromResponse(response),
    /sender does not match/
  );
  assert.equal(manager.getTask(task.task_id)?.status, "running");
});

test("Rejects completion before a task starts running", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request);

  const response = createAgentMessage({
    incidentId: "TEST-001",
    sender: "performance-agent",
    recipient: "coordinator",
    messageType: "response",
    correlationId: request.message_id,
    payload: { evidence: [], limitations: [] },
  });

  assert.throws(
    () => manager.completeFromResponse(response),
    /must be running/
  );
  assert.equal(manager.getTask(task.task_id)?.status, "pending");
});

test("Records agent task failures", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "connectivity-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request);
  manager.markRunning(task.task_id);

  const failed = manager.failTask(task.task_id, "Agent processing failed");

  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "Agent processing failed");
  assert.throws(
    () => manager.markRunning(task.task_id),
    /already failed/
  );
});

test("Expires tasks whose deadlines have passed", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });
  const manager = new AgentTaskManager();
  const task = manager.createTask(request, 1000);
  manager.markRunning(task.task_id);

  const expired = manager.expireTasks(
    Date.parse(task.deadline_at) + 1
  );

  assert.equal(expired.length, 1);
  assert.equal(expired[0].status, "timed_out");
  assert.equal(manager.getTask(task.task_id)?.status, "timed_out");
});

// AGENT REGISTRY
test("Registers all six specialist agents", () => {
  assert.equal(getRegisteredAgents().length, 6);
});

test("Every registered agent has capabilities", () => {
  for (const agent of getRegisteredAgents()) {
    assert.ok(agent.id);
    assert.ok(agent.name);
    assert.ok(agent.capabilities.length > 0);
  }
});

test("Finds agents capable of analyzing latency evidence", () => {
  const agents = findAgentsForEvidence(["latency_ms"]);
  const ids = agents.map((agent) => agent.id);

  assert.ok(ids.includes("performance-agent"));
  assert.ok(ids.includes("connectivity-agent"));
});

test("Rejects unknown agent identifiers", () => {
  assert.equal(
    getAgentRegistration("unknown-agent" as never),
    undefined
  );
});


// AGENT DISPATCHER
test("Dispatcher executes a registered performance agent", () => {
  const bus = new AgentMessageBus("TEST-001");
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: {
      evidence: [],
      limitations: [],
      requested_data: ["latency_ms"],
    },
  });

  bus.send(request);
  const result = dispatchDiagnosticAgent({
    request,
    telemetry: telemetry({ latency_ms: 200 }),
    messageBus: bus,
    capabilityId: "performance_analysis",
  });

  assert.equal(result.agent, "performance-agent");
  assert.ok(result.finding.observation.length > 0);
  assert.equal(bus.getMessagesFor("coordinator").length, 1);
});

test("Dispatcher rejects unsupported capabilities", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });

  assert.throws(
    () => dispatchDiagnosticAgent({
      request,
      telemetry: telemetry(),
      messageBus: new AgentMessageBus("TEST-001"),
      capabilityId: "unknown_capability",
    }),
    /does not support capability/
  );
});

test("Dispatcher rejects registered agents without execution adapters", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "fault-correlation-agent",
    messageType: "request",
    payload: { evidence: [], limitations: [] },
  });

  assert.throws(
    () => dispatchDiagnosticAgent({
      request,
      telemetry: telemetry(),
      messageBus: new AgentMessageBus("TEST-001"),
      capabilityId: "cross_agent_correlation",
    }),
    /no diagnostic execution adapter/
  );
});

test("Dispatcher rejects evidence outside declared capabilities", () => {
  const request = createAgentMessage({
    incidentId: "TEST-001",
    sender: "coordinator",
    recipient: "performance-agent",
    messageType: "request",
    payload: {
      evidence: [],
      limitations: [],
      requested_data: ["topology"],
    },
  });

  assert.throws(
    () => dispatchDiagnosticAgent({
      request,
      telemetry: telemetry(),
      messageBus: new AgentMessageBus("TEST-001"),
      capabilityId: "performance_analysis",
    }),
    /does not declare support/
  );
});

test("Diagnostic agents emit structured evidence with metric provenance", () => {
  const result = runPerformanceAgent(telemetry({ latency_ms: 220 }));
  assert.equal(result.structured_evidence?.[0]?.metric, "latency_ms");
  assert.equal(result.structured_evidence?.[0]?.severity, "warning");
  assert.equal(result.structured_evidence?.[0]?.source_agent, "performance-agent");
});

test("Topology assessment includes only explicit neighbor links", () => {
  const result = assessTopology({ incident_id: "TOPO-1", device: "SW-1", neighbors: ["SW-2", "SW-3", "SW-2"], metrics: {} });
  assert.deepEqual(result.devices, ["SW-1", "SW-2", "SW-3"]);
  assert.equal(result.links.length, 2);
  assert.equal(result.links[0].source, "SW-1");
});

test("Correlation agent deduplicates repeated structured evidence", () => {
  const item = { evidence_id: "E-1", metric: "latency_ms", value: 200, unit: "ms", severity: "warning" as const, observation: "high latency", source_agent: "performance-agent", device_id: "SW-1" };
  const result = runFaultCorrelationAgent([
    { agent: "performance-agent", observation: "latency", evidence: [], limitations: [], structured_evidence: [item] },
    { agent: "connectivity-agent", observation: "latency", evidence: [], limitations: [], structured_evidence: [item] },
  ]);
  assert.equal(result.structured_evidence?.length, 1);
});

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;







