import type { NetworkTelemetry } from "../types";

export interface TopologyAssessment {
  devices: string[];
  links: { source: string; target: string }[];
  limitations: string[];
}

/** Build only edges explicitly present in telemetry; never infer unobserved paths. */
export function assessTopology(telemetry: NetworkTelemetry): TopologyAssessment {
  const neighbors = [...new Set((telemetry.neighbors ?? []).map(item => item.trim()).filter(Boolean))]
    .filter(item => item !== telemetry.device);
  return {
    devices: [telemetry.device, ...neighbors],
    links: neighbors.map(target => ({ source: telemetry.device, target })),
    limitations: neighbors.length
      ? ["Only explicitly supplied one-hop neighbor relationships are represented; multi-hop routes and reachability are not inferred."]
      : ["No neighbor or topology records were supplied; affected paths and upstream dependencies cannot be established."],
  };
}
