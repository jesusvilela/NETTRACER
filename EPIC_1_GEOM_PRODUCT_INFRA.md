# Epic 1: Separate Geometric Product Infra With V1 Scan Compatibility

## Source

Primary source artifact:

```text
C:\Users\HAL900\Downloads\Informe analítico para una auto-reflexión rigurosa y un plan de implementación geométrico-hiperdimen.pdf
```

Evidence extracted:

- Repository cognition should combine hyperbolic hierarchy, sheaf local-global consistency, Hamiltonian drift control, adiabatic policy evolution, holoportation between charts/agents, and erotetic question-guided coverage.
- The report explicitly treats nonstandard terms such as identity, n-cosmo, and erdodetic/ergocetic as operational constructs rather than closed canonical terms.
- First implementation should be incremental: embeddings, discrete sheaf structures on graphs, symplectic/Hamiltonian update discipline, and measurable retrieval/coverage/consistency metrics.

## Product Boundary

Epic 1 creates a new V2 product surface without mutating V1 scan behavior.

```text
Product: epic1-geom-product
Mode: non_destructive_preview
Endpoint: POST /api/epic1/scan/preview
Compatibility: accepts V1 scan-shaped payloads
```

## Substrate Target

Epic 1 references the user's accessible repositories as possible substrate targets, not as runtime dependencies.

The currently inspected reference is:

```text
Observed reference: jesusvilela/nnn-hyperbolic-ramdisk_v2
Scope: any accessible jesusvilela repository
Role: substrate-independent hyperbolic semantic memory fabric
Integration mode: reference_only_non_destructive
Metric: split-signature (2,2) placement/ranking metric
```

Another repository can become the active substrate target if it satisfies the same backend contract and safety gates. Epic 1 does not clone or bind to any repository here; it only reports the contract that downstream substrate infra must satisfy.

The repo scope is modeled as a cosmos atlas:

```text
Unit: repository_as_local_cosmos_fiber
Atlas: multi_repo_hypercomplex_manifold
Perspective operator: hypercomplex_inside_hypercomplex
Rule: wider repo-cosmos views must preserve local invariants while increasing gluing evidence
```

The referenced backend contract is:

```text
reserve
write
read
append
flush
migrate_out
events
```

The product preview reports this target class so downstream infra can align any compatible repository to the RAM/NVMe/ZNS/GPU/CXL substrate ladder later, while this Epic 1 endpoint remains emulator-first and side-effect-free.

Accepted payload shape:

```json
{
  "path": "string",
  "recursive": true,
  "include": [".md", ".png"],
  "hyperbolize": true,
  "backend": "webgpu",
  "sampleLimit": 5
}
```

## Non-Destructive Contract

The new endpoint must not:

```text
enqueue V1 ingress scans
emit broker packets
write archive rows
mutate source files
write to V1 data directories
change V1 /api/ingress/scan semantics
```

It may:

```text
read scan targets
reuse V1-compatible parsing/expansion code
return bounded sample graph and hyperbolic preview metadata
report skipped files and extension filters
```

## Implementation

Added:

```text
src/epic1-product.js
test/epic1-product.test.js
```

Server route:

```text
POST /api/epic1/scan/preview
```

The route requires the same authenticated server context as V1 ingress operations, but it is read-only and returns a preview object instead of queueing a job.

## Relation To V1

V1 scan remains:

```text
POST /api/ingress/scan
```

V2 Epic 1 preview is:

```text
POST /api/epic1/scan/preview
```

The payloads are compatible. The effects are not:

```text
V1 scan: operational ingestion
Epic 1 preview: product read model / geometric preview
```

## Acceptance

Epic 1 is accepted when:

```text
endpoint is separate
V1 scan endpoint is unchanged
preview is derived from existing scan-compatible parsing
response declares non-destructive guarantees
tests cover V1 compatibility and no write intent
```
