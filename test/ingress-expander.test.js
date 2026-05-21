import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectScanTargets, embedS1Carrier, expandFileToS1, normalizeIncludeExtensions } from "../src/ingress-expander.js";
import { embedHyperbolicGraph } from "../src/hyperbolic-engine.js";

test("normalizeIncludeExtensions keeps supported extensions", () => {
  const normalized = normalizeIncludeExtensions(["txt", ".md", ".unknown"]);
  assert.deepEqual(normalized, [".txt", ".md"]);
});

test("collectScanTargets and expandFileToS1 parse markdown and png", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-ingress-"));
  const mdPath = path.join(root, "sample.md");
  const pngPath = path.join(root, "sample.png");

  fs.writeFileSync(mdPath, "# Heading\n\n§1|NODE alpha beta gamma.\nsecond clause -> output", "utf8");
  fs.writeFileSync(
    pngPath,
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+1f8AAAAASUVORK5CYII=", "base64")
  );

  const targets = collectScanTargets(root, { recursive: true, include: [".md", ".png"] });
  assert.equal(targets.files.length, 2);

  const markdown = expandFileToS1({ filePath: mdPath, hyperbolize: true, backend: "webgpu" });
  assert.equal(markdown.kind, "markdown");
  assert.equal(markdown.meta.modality, "textual");
  assert.ok(markdown.meta.chomsky.branchingEntropy > 0);
  assert.ok(markdown.meta.hyperbolic.bundle.fiber_rank >= 1);

  const png = expandFileToS1({ filePath: pngPath, hyperbolize: true, backend: "webgpu" });
  assert.equal(png.kind, "image");
  assert.equal(png.meta.structure.width, 1);
  assert.equal(png.meta.structure.height, 1);
  assert.equal(png.meta.modality, "vision");
  assert.equal(markdown.meta.hyperbolic.engine, "js-hyperbolic-embedder");
  for (const point of Object.values(markdown.meta.hyperbolic.coords)) {
    assert.ok(Math.hypot(point[0], point[1]) < 1);
  }
});

test("expandFileToS1 detects embedded png .s1 carrier", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netracer-carrier-"));
  const pngPath = path.join(root, "carrier.png");
  fs.writeFileSync(
    pngPath,
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+1f8AAAAASUVORK5CYII=", "base64")
  );

  embedS1Carrier({
    filePath: pngPath,
    payload: "§S1{kind=multimodal_carrier,node=netracer,pack=v2.4}"
  });

  const png = expandFileToS1({ filePath: pngPath, hyperbolize: false, backend: "webgpu" });
  assert.equal(png.meta.carrier.detected, true);
  assert.equal(png.meta.carrier.validS1, true);
  assert.ok(png.relations.some((relation) => relation.endsWith(":steganographic-carrier")));
});

test("embedHyperbolicGraph is deterministic and degree aware", () => {
  const entities = {
    hub: ["hub", "node"],
    left: ["left", "node"],
    right: ["right", "node"],
    leaf: ["leaf", "node"]
  };
  const relations = [
    "hub→left:links",
    "hub→right:links",
    "hub→leaf:links"
  ];
  const first = embedHyperbolicGraph({ entities, relations }, { seed: "fixed-seed" });
  const second = embedHyperbolicGraph({ entities, relations }, { seed: "fixed-seed" });
  assert.deepEqual(first.coords, second.coords);
  assert.ok(first.polar.hub.r < first.polar.left.r);
  assert.ok(first.metrics.degreeRadialCorrelation > 0.5);
});

test("isomorphic graphs keep equivalent radial embeddings", () => {
  const first = embedHyperbolicGraph({
    entities: {
      a: ["a", "node"],
      b: ["b", "node"],
      c: ["c", "node"],
      d: ["d", "node"],
      e: ["e", "node"]
    },
    relations: [
      "a→b:links",
      "a→c:links",
      "b→d:links",
      "c→d:links",
      "d→e:links"
    ]
  }, { seed: "iso-seed" });
  const second = embedHyperbolicGraph({
    entities: {
      q1: ["q1", "node"],
      q2: ["q2", "node"],
      q3: ["q3", "node"],
      q4: ["q4", "node"],
      q5: ["q5", "node"]
    },
    relations: [
      "q1→q2:links",
      "q1→q3:links",
      "q2→q4:links",
      "q3→q4:links",
      "q4→q5:links"
    ]
  }, { seed: "iso-seed" });
  const firstRadii = Object.values(first.polar).map((point) => point.r).sort((a, b) => a - b);
  const secondRadii = Object.values(second.polar).map((point) => point.r).sort((a, b) => a - b);
  assert.deepEqual(firstRadii, secondRadii);
});
