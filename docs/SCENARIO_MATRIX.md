# Scenario Matrix and Expected Outcomes

All scenario values are synthetic demonstration data. They are not measurements from IIT Bhubaneswar.

| Dataset | Main supplied evidence | Expected status | Reason |
|---|---|---|---|
| `01-normal.json` | Multiple metrics below thresholds | `no_fault_detected` | Adequate clean snapshot; no threshold breach |
| `02-link-congestion.json` | High utilization, queue drops, latency, loss, jitter | `probable_cause` | Cross-domain evidence supports possible link congestion |
| `03-weak-wifi-symptoms.json` | High latency, loss, jitter; no RSSI/retransmission | `insufficient_evidence` | Performance symptoms do not prove weak Wi-Fi |
| `04-interface-fault.json` | Interface errors, queue drops, packet loss | `multiple_plausible_causes` | Interface fault and congestion remain plausible; no definitive path proof |
| `05-dns-dhcp-insufficient-evidence.json` | Normal latency/loss only; no DNS/DHCP counters | `insufficient_evidence` | Service-specific failure cannot be diagnosed without service evidence |
| `06-interoperability-invalid-input.json` | String metric and unknown metric | Strict: reject; tolerant: quarantine | Incompatible fields are reported instead of silently coerced |

## Acceptance checks

- Three distinct diagnostic specialists return correlated responses.
- Every hypothesis evidence ID resolves to the evidence catalogue.
- Every generated hypothesis receives exactly one verification record.
- Clean, insufficient-evidence, and fault scenarios are distinguished.
- Tolerant ingestion preserves valid fields and lists invalid/unknown fields as warnings.
- The coordinator retains valid partial results if a specialist execution fails.
