# NETTRACER Version Manifold

(c) Jesus Vilela Jato, all rights reserved. 21/05/2026

## Purpose

This file records the non-destructive version manifold for NETTRACER.

Each version is treated as a local fiber in a larger hypercomplex object. The repository does not flatten V1, V2, and V3 into one linear replacement path; it preserves them as compatible projections with explicit launch surfaces and invariants.

## Fibers

```text
V1 fiber:
  role: original scan/ingress and J->U absorb compatibility surface
  key endpoint: /ju/absorb
  invariant: existing scan semantics are not mutated by later versions

V2 fiber:
  role: observable cognition infrastructure
  key endpoints:
    /api/cognition/status
    /api/cognition/trace
    /api/cognition/atlas
    /api/epic1/scan/preview
    /cognition
  invariant: bridge events expose dominance trace, energy transfer, projection violence, active remainder, and repo-cosmos atlas fields

V3 fiber:
  role: object-reflection mesh infrastructure
  key endpoints:
    /api/v3/object-mesh
    /v3/object-mesh
  invariant: the object itself is modeled as a read-only virtual 360x360 orthogonal hypercomplex mesh with interbridges
```

## Launch Separation

```text
V2 launch:
  script: scripts/start-v2-infra.ps1
  port: 8788
  data: data-v2

V3 launch:
  script: scripts/start-v3-infra.ps1
  port: 8789
  data: data-v3
```

Runtime data directories are intentionally ignored and are not part of the pushed source repository.

## Non-Destructive Contract

```text
preserve V1 scan semantics
keep V2 and V3 launch state isolated
do not commit runtime data, passkeys, logs, service build outputs, or generated archives
prefer additive endpoints over mutation of existing endpoints
keep bridge records append-only when persistence is used
```

## Hypercomplex/Hyperdim Principle

```text
all versions = local sections of one version manifold
V1 = ingress/translation compatibility
V2 = cognition telemetry and repo-cosmos atlas
V3 = self-reflective object mesh
gluing condition = later versions increase perspective without erasing prior invariants
```

