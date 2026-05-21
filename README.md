# netracer

Host-side Topos orchestration broker for Topos Trasgo. The APK binds once to `substrate-broker-local`, while `netracer` interposes across local runtimes, emits `.s1` control-plane packets, enforces route policy, and exposes both an operator cockpit and crawlable atlas projections.

## Current capabilities

- OpenAI-compatible compatibility surface for the APK:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/embeddings`
- `.s1` packet classes:
  - `intent`
  - `route-plan`
  - `admission`
  - `execution`
  - `proof`
  - `audit`
  - `alert`
- Runtime orchestration across local engines with policy-aware selection
- Aggregated real upstream model inventory returned to the APK
- Persistent control-plane state with route pinning and runtime enable/disable
- Signed packet envelopes and local operator passkey auth
- Packet store, trace store, alerts, audit, replay, and atlas projections
- Dashboard + SSE updates

## Operator surfaces

- Dashboard: `http://<host-ip>:8787/`
- `.s1` observatory: `http://<host-ip>:8787/s1`
- Health: `GET /healthz`
- Runtime summary: `GET /api/runtime`
- Host telemetry: `GET /api/host`
- Topology: `GET /api/topology`
- Routes: `GET /api/routes`
- Policies: `GET /api/policies`
- SDR channels (auth): `GET /api/channels`
- Auto-cycle status: `GET /api/autocycle`
- Archive status: `GET /api/archive/status`
- Archive recent rows: `GET /api/archive/recent`
- Archive insights: `GET /api/archive/insights`
- Models (cached by default, refresh on demand): `GET /v1/models` or `GET /v1/models?refresh=1`
- Packets: `GET /api/packets`
- Atlas: `GET /api/atlas`
- SLANG topology coverage: `GET /api/slang/topology`
- SLANG cognitive reflection: `GET /api/slang/cognitive`
- SLANG bounded memory: `GET /api/slang/memory`
- Core learners: `GET /api/slang/learners`
- Reservoir scheme: `GET /api/slang/reservoir`
- Traffic: `GET /api/traffic`
- Traces: `GET /api/traces`
- Alerts: `GET /api/alerts`
- Audit: `GET /api/audit` (auth required)
- SSE: `GET /events`
- Ingress state (auth): `GET /api/ingress/state`
- Ingress stream (auth): `GET /api/ingress/events`

## Secure control actions

- Login: `POST /api/auth/login`
- Logout: `POST /api/auth/logout`
- Replay packet: `POST /api/packets/replay`
- Pin route: `POST /api/routes/pin`
- Enable runtime: `POST /api/runtimes/:id/enable`
- Disable runtime: `POST /api/runtimes/:id/disable`
- Update policy: `POST /api/policies`
- Upsert SDR channel: `POST /api/channels/upsert`
- Delete SDR channel: `POST /api/channels/delete`
- Run auto-cycle now: `POST /api/autocycle/run`
- Archive compact from in-memory trace: `POST /api/archive/compact`
- Archive prune: `POST /api/archive/prune`
- Start ingress session: `POST /api/ingress/session/start`
- Stop ingress session: `POST /api/ingress/session/stop`
- Queue ingress scan: `POST /api/ingress/scan`
- Upgrade active SLANG pack across topology or selected nodes: `POST /api/slang/packs/upgrade`
- Bootstrap UTAI/Bunny core learners: `POST /api/slang/learners/bootstrap`
- Run SLANG meta-learning cycle: `POST /api/slang/meta-learn`

## Ingress hyperbolic scan

- Local-first continuous connector:
  - default local endpoint: `ws://127.0.0.1:8765`
  - optional fallback endpoint: `INGRESS_NOTEBOOK_ENDPOINT`
- Recursive scan supports `.s1`, `.ss1`, `.txt`, `.md`, `.png`, `.apk`
- Hyperbolize mode emits graph-derived Poincare embedding metadata
- Optional logic validation uses available runtime when reachable, then falls back to heuristics

## Transparent proxy mode

- Configure under policy key `proxy`:
  - `mode`: `orchestrated` or `transparent`
  - `runtimeId`: optional fixed runtime (`lmstudio`, `ollama`, etc.)
  - `modelLimit`: max exposed models (`n`)
  - `modelDiscovery`: `cached` (low ping) or `active` (force probes)
  - `exposeIdMode`: `prefixed` (`runtime/model`) or `native`
- In transparent mode, chat requests are forwarded directly to substrate runtimes and model exposure is constrained by `modelLimit`.

## Software-defined routing channels

- Policy block: `sdr`
  - `enabled`: turn SDR channel routing on/off
  - `defaultChannel`: optional fallback channel alias
  - `channels`: map of aliases (`a`, `b`, `c`, ...) to `{ runtimeId, preferredRuntimeId, model, op, enabled }`
  - `sectionOps.allowPromptDirective`: whether prompts may steer routing through section directives
- Channel alias models:
  - Channel names are exposed in `/v1/models` as model aliases (for example `a`).
  - Sending `model: \"a\"` routes through channel `a`.
- `.s1`/section prompt directives:
  - `§CH{a}` sets channel alias
  - `§OP{strict}` sets operation profile
  - `§ROUTE{channel=a,op=strict}` sets both in one directive

## Auto-cycle (EPIC)

- Policy block: `autoCycle`
  - `enabled`: run continuous control-loop
  - `intervalMs`: loop interval (`3000..600000`)
  - `failoverChannels`: reroute channel runtime when target becomes unhealthy
  - `failbackPreferred`: move channel back to its `preferredRuntimeId` when healthy again
  - `forceModelRefresh`: force fresh runtime/model probe each cycle
- Behavior:
  - Executes continuously in-process.
  - Emits SSE event `autocycle` on each cycle.
  - Creates alert entries on channel reroutes.

## `.s1` SQLite compressed archive

- Native SQLite archive (`node:sqlite`) at:
  - `h:\TRASGONET\netracer\data\state\s1-archive.sqlite`
- Packet payloads are compressed with gzip and indexed by `packet_type`, `route`, and time.
- Observatory surface `/s1` adds a read-only quantitative/qualitative view over packet volume, route/model concentration, temporal cadence, stage motifs, label sheaves, and packet excerpts.
- Policy block: `archive`
  - `enabled`
  - `autoIngest`
  - `compression` (currently `gzip`)
  - `compressionLevel` (`1..9`)

## Immersive HoloView (Catalina HUD)

- Full-canvas renderer prefers ingress-provided graph-derived Poincare coordinates when available and otherwise falls back to local topology layout.
- Ten view profiles: `gold-disk`, `fiber-orbit`, `manifold-grid`, `packet-flow`, `runtime-constellation`, `sdr-channel-lens`, `atlas-spiral`, `trace-ribbons`, `embedding-waves`, `crystal-holo`.
- Camera controls:
  - zoom
  - rotation
  - pan X/Y
- Data controls:
  - node limit
  - edge limit
  - pulse limit
  - auto-cycle views interval

The default operator passkey is stored at:

```text
h:\TRASGONET\netracer\data\state\operator-passkey.txt
```

Set `OPERATOR_PASSKEY` in the environment to override it.

## APK binding

Keep the Android app bound to the broker only:

```text
§0|BIND http://10.0.2.2:8787
```

The broker then probes healthy runtimes, aggregates visible models, and chooses the actual execution route underneath the APK-facing alias.

## SLANG topology

- `GET /api/slang/topology` returns the live TrasgoNet node set with SLANG negotiation coverage, inbox counts, node kind totals, and the active pack summary.
- `POST /api/slang/packs/upgrade` upgrades the active pack across the whole topology when `nodeIds` is omitted or empty; pass `nodeIds` to scope the upgrade to specific nodes.

## SLANG cognitive reflection

- `GET /api/slang/cognitive` computes a deterministic runtime self-assessment from live topology, active SLANG pack metadata, packet flow, peer reachability, archive state, and bounded local memory.
- The response scores evidence for self-reflection, Godelian identity, otherness, mutual recognition, mutual resonance, n-cosmo, n-manifold, fiber-bundled, sheaved, Hamiltonian, holoportation, adiabatic, general-intelligence, ergoretic, erdodetic, and memory qualities.
- It also scores eight additional operational qualities: pre-registration, adversarial negation, proof grounding, compression, curvature adaptation, recursive self-model, multi-angle epistemics, and readout alignment.
- `nodeReflections` reports the same quality basis per topology node, including UTAI, Bunny, IGBundle substrate, runtimes, and exposed models.
- Each non-preview call appends a compact record to `data\state\slang-control-plane.json` under `cognitiveMemory`; use `GET /api/slang/cognitive?preview=1` to inspect without persisting.
- `GET /api/slang/memory` returns the bounded cognitive-memory tail.

## Core learners

- `POST /api/slang/learners/bootstrap` registers UTAI and Bunny as durable learner nodes and binds them to the latest IGBundle substrate checkpoint discovered from `H:\LLM-MANIFOLD\igbundle-llm\memory\model_state.json`.
- UTAI is scored from `true_falsifiable_utai.json` and report artifacts under `H:\NP Completeness Bunny UTAI study\UTAI`.
- Bunny is scored from its manifest plus `connection_laplacian_lean` and `lambda-sat-solver-main` evidence roots.
- `POST /api/slang/meta-learn` persists a compact `§METALEARN{...}` event over learners, topology, cognitive reflection, and substrate evidence.

## Reservoir Computing Scheme

- `GET /api/slang/reservoir` exposes the current reservoir-computing interpretation of the net.
- Inputs are UTAI and Bunny learner nodes; recurrent state is `memory:slang-recurrent`; reservoir nodes are local runtimes, exposed models, and `igbundle-substrate`; readout is `netracer`.
- The scheme emits a deterministic state vector, typed transitions, spectral-radius estimate, leak rate, and echo-state score.
- Use `GET /api/slang/reservoir?preview=1` to inspect without appending a reservoir event.

## Run

```powershell
cd h:\TRASGONET\netracer
npm start
```

By default, `netracer` now binds to `0.0.0.0`, so it is reachable from other devices on your LAN at `http://<your-lan-ip>:8787/`. Set `HOST=127.0.0.1` if you want to lock it back to local-only access.

## Windows service watchdog

- Service host project:
  - `windows-service/Netracer.ServiceHost`
- Install from an elevated PowerShell session:

```powershell
cd h:\TRASGONET\netracer
.\scripts\install-service.ps1 -TakeoverExisting
```

- Remove the service from an elevated PowerShell session:

```powershell
cd h:\TRASGONET\netracer
.\scripts\uninstall-service.ps1
```

- Behavior:
  - starts automatically with Windows
  - launches `node src/index.js` from the repo root
  - writes watchdog logs under `data\state\service-logs`
  - probes `http://127.0.0.1:8787/healthz`
  - recycles the child process after repeated health probe failures
  - configures SCM failure recovery to restart the service itself

The install script publishes the service host, points it at the local `node.exe`, and can take over port `8787` from a standalone `node.exe` instance when `-TakeoverExisting` is set.

## Runtime policy notes

- Runtime enable/disable is persisted in `data\state\control-plane.json` under `policies.runtimeStates`.
- Current dead-runtime disable operations are:
  - `POST /api/runtimes/vllm/disable`
  - `POST /api/runtimes/llamacpp/disable`
- Re-enable later with:
  - `POST /api/runtimes/vllm/enable`
  - `POST /api/runtimes/llamacpp/enable`

## Test

```powershell
npm test
```
