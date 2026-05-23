import test from "node:test";
import assert from "node:assert/strict";
import { buildV11ActiveCognitionInstrument } from "../src/v11-active-cognition-instrument.js";

test("V11 exposes interactive fiber agency and live meaning recompute", () => {
  const result = buildV11ActiveCognitionInstrument({
    meshCount: 4,
    carrier: "H",
    traffic: [{ packetId: "p1", direction: "TO_SUBSTRATE", route: "cognition" }],
    topology: { nodes: [{ id: "netracer" }, { id: "client-alpha" }], edges: [] }
  });

  assert.equal(result.product, "netracer-v11-active-cognition-instrument");
  assert.equal(result.inherits, "netracer-v10-sign-stabilized-fibers");
  assert.equal(result.instrument_geometry.not_2d, true);
  assert.equal(result.instrument_geometry.agency_inside_geometry, true);
  assert.equal(result.controls.perturb_sign.includes("flip"), true);
  assert.equal(result.selected.available, true);
  assert.equal(result.selected.carrier, "H");
  assert.equal(result.meaning_field.selected_carrier_filter, "H");
  assert.equal(result.meaning_field.live_traffic_events, 1);
  assert.ok(result.meaning_field.total_cognitive_energy > 0);
  assert.ok(result.event_stream.some((event) => event.type === "meaning_recomputed"));
});

test("V11 sign perturbation changes the selected fiber and remainder accounting", () => {
  const baseline = buildV11ActiveCognitionInstrument({ meshCount: 3 });
  const selectedId = baseline.selected.id;
  const result = buildV11ActiveCognitionInstrument({
    meshCount: 3,
    selectedFiberId: selectedId,
    signPerturbations: { [selectedId]: true }
  });

  assert.equal(result.selected.id, selectedId);
  assert.equal(result.selected.perturbation_active, true);
  assert.equal(result.selected.sign, baseline.selected.sign * -1);
  assert.equal(result.meaning_field.perturbed_count, 1);
  assert.ok(result.meaning_field.active_remainder >= baseline.meaning_field.active_remainder);
  assert.ok(result.event_stream.some((event) => event.type === "sign_perturbation"));
});
