import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildEpic1ScanPreview } from "../src/epic1-product.js";

test("Epic 1 scan preview is V1-compatible and non-destructive", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-epic1-"));
  const mdPath = path.join(root, "note.md");
  fs.writeFileSync(mdPath, "# SGS\n\nCognition is stratified ascent.\n\n§BOOT[R40]\n", "utf8");

  const result = buildEpic1ScanPreview({
    path: root,
    recursive: true,
    include: [".md"],
    hyperbolize: true,
    sampleLimit: 1
  }, {
    ingress: {
      maxScanFiles: 10,
      maxScanFileBytes: 1024 * 1024
    }
  });

  assert.equal(result.product, "epic1-geom-product");
  assert.equal(result.mode, "non_destructive_preview");
  assert.equal(result.v1_scan_compatible, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.guarantees.does_not_enqueue_v1_scan, true);
  assert.equal(result.guarantees.does_not_emit_packets, true);
  assert.equal(result.guarantees.does_not_write_archive, true);
  assert.equal(result.scan.totalFiles, 1);
  assert.equal(result.sample.length, 1);
  assert.equal(result.sample[0].kind, "markdown");
  assert.ok(result.sample[0].graph.entityCount > 0);
  assert.equal(result.substrate_target.scope, "any_accessible_jesusvilela_repo");
  assert.equal(result.substrate_target.observed_reference, "jesusvilela/nnn-hyperbolic-ramdisk_v2");
  assert.equal(result.substrate_target.integration_mode, "reference_only_non_destructive");
  assert.match(result.substrate_target.admissibility, /backend contract/);
  assert.equal(result.substrate_target.cosmos_model.unit, "repository_as_local_cosmos_fiber");
  assert.equal(result.substrate_target.cosmos_model.perspective_operator, "hypercomplex_inside_hypercomplex");
  assert.deepEqual(result.substrate_target.backend_contract, [
    "reserve",
    "write",
    "read",
    "append",
    "flush",
    "migrate_out",
    "events"
  ]);
  assert.ok(result.substrate_target.safety.includes("emulator_default"));
});
