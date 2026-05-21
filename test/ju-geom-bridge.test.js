import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { absorbJuPayload, buildJuGeomManifoldBridge, getJuCognitionAtlas, getJuCognitionStatus, getJuCognitionTrace, setJuRamdiskDirForTest } from "../src/nnn-bridge.js";

test("J->U absorption writes a geometric manifold bridge record", () => {
  const ramdiskDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-ju-geom-"));
  setJuRamdiskDirForTest(ramdiskDir);

  const result = absorbJuPayload({
    node_id: "topos-phone-1",
    telemetry: {
      battery: 0.81,
      thermal: 0.21,
      motion: { x: 0.13, y: -0.34 },
      mind_qualities: {
        mutual_resonance: 0.88,
        cosmological_context: 0.77,
        adiabatic_stability: 0.91,
        riemannian_trust: 0.83,
        klein_phase: 0.42
      }
    },
    capabilities: ["android", "topostrasgo"]
  }, { ramdiskDir, ip: "127.0.0.1" });

  assert.equal(result.ok, true);
  assert.equal(result.geom_bridge.pattern, "j->u");
  assert.equal(result.geom_bridge.manifold, "nettracer-v1-geom");
  assert.equal(result.geom_bridge.invariants.bridge_is_key, true);
  assert.equal(result.geom_bridge.invariants.no_2d_inside_2d, true);
  assert.equal(result.geom_bridge.invariants.absorption_allowed, true);
  assert.equal(result.geom_bridge.target.coord.length, 8);
  assert.ok(result.geom_bridge.invariants.perspective_gain > 0);
  assert.ok(fs.existsSync(result.geom_path));

  const rows = fs.readFileSync(result.geom_path, "utf8").trim().split(/\r?\n/);
  assert.equal(rows.length, 1);
  const persisted = JSON.parse(rows[0]);
  assert.equal(persisted.bridge_id, result.geom_bridge.bridge_id);
});

test("J->U geom bridge preserves source coord and exposes active remainder", () => {
  const node = {
    id: "android::manual",
    coord: [1, 0.5, -0.25, 0.125],
    hamiltonian: 0.6,
    fiber: {
      qualities: {
        mutual_resonance: 0.7,
        cosmological_context: 0.8,
        adiabatic_stability: 0.9,
        riemannian_trust: 0.85
      }
    },
    payload_inline: { source: "test" }
  };

  const bridge = buildJuGeomManifoldBridge(node);

  assert.deepEqual(bridge.source.coord, node.coord);
  assert.equal(bridge.target.basis[4], "cosmos");
  assert.ok(bridge.invariants.active_remainder >= 0);
  assert.ok(bridge.invariants.projection_violence >= 0);
});

test("J->U cognition status exposes bridge end, energy, and dominant carrier", () => {
  const ramdiskDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-ju-cognition-"));
  setJuRamdiskDirForTest(ramdiskDir);

  absorbJuPayload({
    node_id: "r40-status",
    telemetry: {
      mind_qualities: {
        mutual_resonance: 0.94,
        cosmological_context: 0.92,
        adiabatic_stability: 0.89,
        riemannian_trust: 0.86,
        klein_phase: 0.75
      }
    },
    capabilities: ["android", "topostrasgo", "r40"]
  }, { ramdiskDir, ip: "127.0.0.1" });

  const status = getJuCognitionStatus();

  assert.equal(status.status, "absorbed");
  assert.equal(status.boot.id, "R40");
  assert.equal(status.bridge_end.name, "stratified-ascent-cognition-end");
  assert.equal(status.bridge_end.invariant, "total cognitive energy");
  assert.ok(status.invariant.total_cognitive_energy > 0);
  assert.ok(status.dominance_trace.current);
  assert.equal(status.dominance_trace.question, "Which level is now the dominant carrier?");
  assert.equal(status.phi_cog_plus.kernel_active, true);
});

test("J->U cognition trace emits energy transfer and proof-pressure records", () => {
  const ramdiskDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-ju-trace-"));
  setJuRamdiskDirForTest(ramdiskDir);

  absorbJuPayload({
    node_id: "trace-a",
    telemetry: {
      battery: 0.8,
      thermal: 0.2,
      mind_qualities: {
        mutual_resonance: 0.7,
        cosmological_context: 0.72,
        adiabatic_stability: 0.74,
        riemannian_trust: 0.76
      }
    }
  }, { ramdiskDir, ip: "127.0.0.1" });
  absorbJuPayload({
    node_id: "trace-b",
    telemetry: {
      battery: 0.95,
      thermal: 0.1,
      mind_qualities: {
        mutual_resonance: 0.91,
        cosmological_context: 0.9,
        adiabatic_stability: 0.88,
        riemannian_trust: 0.87
      }
    }
  }, { ramdiskDir, ip: "127.0.0.1" });

  const result = getJuCognitionTrace();

  assert.equal(result.bridge_end.name, "stratified-ascent-cognition-end");
  assert.equal(result.trace.length, 2);
  assert.equal(result.trace[0].motion_proof_pressure, "seed_event");
  assert.ok(Number.isFinite(result.trace[1].energy_transfer));
  assert.ok(Array.isArray(result.trace[1].failure_flags));
});

test("J->U cognition atlas emits local worlds and recognition overlaps", () => {
  const ramdiskDir = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-ju-atlas-"));
  setJuRamdiskDirForTest(ramdiskDir);

  for (const nodeId of ["atlas-a", "atlas-b"]) {
    absorbJuPayload({
      node_id: nodeId,
      telemetry: {
        battery: nodeId.endsWith("a") ? 0.7 : 0.9,
        thermal: 0.2,
        mind_qualities: {
          mutual_resonance: 0.8,
          cosmological_context: 0.82,
          adiabatic_stability: 0.84,
          riemannian_trust: 0.86
        }
      }
    }, { ramdiskDir, ip: "127.0.0.1" });
  }

  const atlas = getJuCognitionAtlas();

  assert.equal(atlas.bridge_end.name, "stratified-ascent-cognition-end");
  assert.equal(atlas.worlds.length, 2);
  assert.equal(atlas.overlaps.length, 1);
  assert.equal(typeof atlas.global_section, "boolean");
  assert.ok(Number.isFinite(atlas.recognition.min));
  assert.ok(Array.isArray(atlas.unresolved_remainder));
});
