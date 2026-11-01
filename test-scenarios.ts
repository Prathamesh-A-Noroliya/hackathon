import fs from "node:fs";
import path from "node:path";
import { validateTelemetry, validateTelemetryTolerant } from "./src/netcoop/telemetry";
import { runInvestigationCoordinator } from "./src/netcoop/agents/investigation-coordinator";

const directory = path.join(process.cwd(), "datasets", "scenarios");
const expected: Record<string, string> = {
  "01-normal.json": "no_fault_detected",
  "02-link-congestion.json": "probable_cause",
  "03-weak-wifi-symptoms.json": "insufficient_evidence",
  "04-interface-fault.json": "multiple_plausible_causes",
  "05-dns-dhcp-insufficient-evidence.json": "insufficient_evidence",
};
let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — ${detail}`);
  if (ok) passed++; else failed++;
};

async function main() {
  const files = fs.readdirSync(directory).filter((file: string) => file.endsWith(".json")).sort();
  for (const file of files) {
    const input = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, "")) as unknown;
    const strict = validateTelemetry(input);
    const shouldBeValid = !file.startsWith("06-");
    check(`${file} strict validation`, strict.valid === shouldBeValid, strict.valid ? "accepted" : "rejected as expected");
    if (file.startsWith("06-")) {
      const tolerant = validateTelemetryTolerant(input);
      check(`${file} tolerant ingestion`, tolerant.valid && tolerant.issues.length > 0, tolerant.valid ? `${tolerant.issues.length} quarantined field(s)` : "envelope rejected");
      continue;
    }
    if (!strict.valid) continue;
    const report = await runInvestigationCoordinator(strict.data);
    const expectedStatus = expected[file];
    check(`${file} end-to-end diagnosis`, report.status === expectedStatus, `expected ${expectedStatus}, received ${report.status}`);
    check(`${file} agent collaboration`, report.evidence_sources.length === 3 && (report.agent_timeline ?? []).filter(item => item.message_type === "response").length === 3, `${report.evidence_sources.length} specialist findings; ${(report.agent_timeline ?? []).filter(item => item.message_type === "response").length} correlated responses`);
    const trace = report.agent_timeline ?? [];
    const requestEvents = trace.filter(item => item.sender === "coordinator" && item.message_type === "request");
    const firstResponseIndex = trace.findIndex(item => item.message_type === "response");
    check(`${file} specialist fan-out`, requestEvents.length === 3 && new Set(requestEvents.map(item => item.recipient)).size === 3 && firstResponseIndex >= 3, `${requestEvents.length} distinct specialist requests are emitted before the first response`);
    check(`${file} confidence transparency`, report.confidence_method === "uncalibrated_model_assessment" && typeof report.confidence_note === "string" && typeof report.telemetry_coverage === "number" && report.telemetry_coverage >= 0 && report.telemetry_coverage <= 1, `method=${report.confidence_method}; telemetry coverage=${report.telemetry_coverage}`);
    const knownIds = new Set(report.evidence_catalog.map(item => item.id));
    const allIdsValid = report.hypotheses.every(h => [...h.supporting_evidence, ...h.contradicting_evidence].every(id => knownIds.has(id)));
    check(`${file} evidence references`, allIdsValid, "all hypothesis evidence IDs resolve to the catalogue");
    check(`${file} verification coverage`, report.verifications.length === report.hypotheses.length, `${report.verifications.length} verification(s) for ${report.hypotheses.length} hypothesis(es)`);
    const structuredIds = (report.structured_evidence ?? []).map(item => item.evidence_id);
    check(`${file} structured evidence deduplication`, new Set(structuredIds).size === structuredIds.length, `${structuredIds.length} unique structured observation(s)`);
  }
  console.log(`\nSCENARIOS: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

void main().catch(error => {
  console.error("Scenario evaluation failed:", error);
  process.exitCode = 1;
});
