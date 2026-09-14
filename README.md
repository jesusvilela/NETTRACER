<div align="center">

```text
  ┌─────────────────────────────────────────────────────────┐
  │  ネ ッ ト ワ ー ク ・ ト レ ー サ ー                    │
  │  N E T T R A C E R  //  v 0 . 1 . 0                    │
  │  Topos Orchestration Broker & Section Language Substrate │
  └─────────────────────────────────────────────────────────┘
```

[![Node.js 22+](https://img.shields.io/badge/node.js->=22.0.0-000000?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: BSD 3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-000000?style=for-the-badge)](LICENSE)
[![CI Status](https://img.shields.io/badge/build-passing-000000?style=for-the-badge&logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![Protocol: .s1 / §-LANG](https://img.shields.io/badge/protocol-.s1%20%2F%20%C2%A7--LANG-000000?style=for-the-badge)](#-section-language--s1-protocol)

*A local-first, zero-trust Topos orchestration broker interposing across neural runtimes, section-language control planes, and hypercomplex manifold projections.*

---

</div>

## 概要 // OVERVIEW

**NETTRACER** is a local-first Topos orchestration broker for connecting edge clients, local model runtimes, and observable control-plane state.

An edge client binds once to the broker. In turn, `netracer`:
- Interposes across local LLM runtimes (LM Studio, Ollama, vLLM, llama.cpp),
- Emits signed `.s1` control-plane packets across a 7-stage lifecycle,
- Enforces software-defined route policies (SDR),
- Exposes an operator cockpit, HoloView Catalina HUD, and hypercomplex version manifold projections (V1–V13).

The visual language is intentionally playful; the runtime contract is intentionally boring: HTTP, WebSocket, SQLite, Prometheus text metrics, and environment-based configuration.

---

## システム構造 // ARCHITECTURE

### 1. Topos Broker Flow

```mermaid
flowchart TD
    classDef client fill:#101520,stroke:#70ceff,color:#ebf7ff;
    classDef broker fill:#0a121e,stroke:#f0c971,color:#ebf7ff;
    classDef runtime fill:#0d1826,stroke:#89ffd0,color:#ebf7ff;
    classDef storage fill:#150f24,stroke:#ffb5a7,color:#ebf7ff;

    APK["Edge Client<br/><code>§0|BIND http://host:8787</code>"]
    NET["NETTRACER Broker<br/><code>:8787</code>"]

    subgraph Runtimes["Local Neural Substrates"]
        LMS["LM Studio<br/><code>:1234</code>"]
        OLL["Ollama<br/><code>:11434</code>"]
        VLL["vLLM<br/><code>:8000</code>"]
        CPP["llama.cpp<br/><code>:8080</code>"]
    end

    subgraph Observability["Control Plane & State"]
        S1[".s1 SQLite Archive<br/><code>s1-archive.sqlite</code>"]
        SDR["SDR Channel Matrix"]
        CP["Cognitive Memory & Reflect"]
    end

    APK -->|"POST /v1/chat/completions"| NET
    NET -->|"Policy / Auto-Cycle"| SDR
    NET -->|"Route & Proxy"| LMS
    NET -->|"Route & Proxy"| OLL
    NET -->|"Route & Proxy"| VLL
    NET -->|"Route & Proxy"| CPP
    NET -->|"Sign & Emit Packets"| S1
    NET -->|"Compute Reflection"| CP

    class APK client
    class NET broker
    class LMS,OLL,VLL,CPP runtime
    class S1,SDR,CP storage
```

### 2. `.s1` Packet Lifecycle & Section-Language Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client / APK
    participant Broker as NETTRACER Broker
    participant Policy as SDR Policy / Auto-Cycle
    participant Runtime as Upstream Runtime
    participant Archive as SQLite .s1 Archive

    Client->>Broker: Prompt with §-directives (e.g. §CH{a} §OP{strict})
    Broker->>Broker: Build `intent` packet & parse section tags
    Broker->>Policy: Resolve route plan (strict / fallback)
    Policy-->>Broker: Emit `route-plan` & `admission`
    Broker->>Runtime: Dispatch request to target model/channel
    Runtime-->>Broker: Stream completion response
    Broker->>Broker: Emit `execution`, `proof`, or `alert`
    Broker->>Archive: Compress (gzip) & index packet in SQLite
    Broker-->>Client: Return OpenAI-compatible response
```

### 3. Version Manifold (V1 – V13)

```mermaid
flowchart LR
    classDef v1 fill:#081420,stroke:#70ceff,color:#ebf7ff;
    classDef v2 fill:#141120,stroke:#f0c971,color:#ebf7ff;
    classDef v3 fill:#0f1c18,stroke:#89ffd0,color:#ebf7ff;

    V1["V1 Fiber<br/>Ingress Traffic & Translate"]
    V2["V2 Fiber<br/>Cognition Telemetry & Atlas"]
    V3["V3 Fiber<br/>Self-Reflective Object Mesh"]
    V4_13["V4-V13 Cage<br/>Hypercomplex Semantic Analysis"]

    V1 == Non-destructive bridge ==> V2
    V2 == Object recognition ==> V3
    V3 == Manifold consolidation ==> V4_13

    class V1 v1
    class V2 v2
    class V3,V4_13 v3
```

---

## 機能 // CAPABILITIES

- **OpenAI-Compatible Compatibility Surface**:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/embeddings`
- **`.s1` Packet Lifecycle Classes**:
  - `intent` • `route-plan` • `admission` • `execution` • `proof` • `audit` • `alert`
- **Multi-Runtime Orchestration**: Policy-aware upstream selection across local engines with real-time health checks.
- **Software-Defined Routing (SDR)**: Alias channels, operation profiles, and in-prompt directives (`§CH{a}`, `§OP{strict}`, `§ROUTE{...}`).
- **Continuous Auto-Cycle Loop**: Autonomous failover and failback based on upstream probes.
- **Native SQLite Archive**: `.s1` packet compression (`gzip`) with quantitative & qualitative insight projections.
- **HoloView Catalina HUD**: Interactive WebGL/Canvas renderer with 10 view profiles (gold-disk, fiber-orbit, manifold-grid, etc.).
- **SLANG Topology & Cognitive Reflection**: Deterministic runtime self-assessment scoring 30+ cognitive and operational qualities.

---

## 監視・操作エンドポイント // ENDPOINTS & SURFACES

### Operator Surfaces

| Surface | Path / Endpoint | Description |
|---|---|---|
| **Dashboard Cockpit** | `GET /` | Main operator dashboard |
| **V2 Cognition Trace** | `GET /cognition` | Hyperbolic stream & cognitive reflection UI |
| **.s1 Observatory** | `GET /s1` | Packet volume, motifs, and sheaf analysis |
| **V3 Object Mesh** | `GET /v3/object-mesh` | Virtual 360x360 hypercomplex orthogonal manifold |
| **V4 Version Cage** | `GET /v4/version-cage` | Cross-version bridge consolidation UI |
| **V5 AAA Cosmos** | `GET /v5/aaa-cosmos` | WebGL 3D depth scene with navigable worlds |
| **Health Check** | `GET /healthz` or `GET /health` | System health probe |
| **SLANG Topology** | `GET /api/slang/topology` | Node set with SLANG negotiation coverage |
| **Cognitive Reflection** | `GET /api/slang/cognitive` | Deterministic self-assessment score |
| **Reservoir Scheme** | `GET /api/slang/reservoir` | Reservoir-computing state & spectral radius |

### Secure Control Actions

| Action | Endpoint | Description |
|---|---|---|
| **Authentication** | `POST /api/auth/login` | Session login with operator passkey |
| **Replay Packet** | `POST /api/packets/replay` | Re-emit historic packet through control plane |
| **Route Pinning** | `POST /api/routes/pin` | Force route binding for target client |
| **Runtime Toggle** | `POST /api/runtimes/:id/enable` | Enable or disable specific upstream runtimes |
| **SDR Channel Upsert** | `POST /api/channels/upsert` | Update or add software-defined route channels |
| **Auto-Cycle Trigger** | `POST /api/autocycle/run` | Execute control-loop failover cycle |
| **Archive Compact** | `POST /api/archive/compact` | Flush and compact memory trace to SQLite |
| **Pack Upgrade** | `POST /api/slang/packs/upgrade` | Upgrade active SLANG pack across topology |

---

## 実行方法 // RUN & DEPLOYMENT

### Quick Start

```powershell
# Install dependencies
npm install

# Run the test suite
npm test

# Start the broker (default bind: 0.0.0.0:8787)
npm start
```

### Zero-upstream demo

Run the broker with synthetic `.s1` traffic so the dashboard and metrics are useful before any model runtime is configured:

```powershell
npm start -- --demo
# dashboard: http://127.0.0.1:8787/
# metrics:   http://127.0.0.1:8787/metrics
# health:    http://127.0.0.1:8787/healthz
```

Use `HOST=127.0.0.1` when the broker should remain local-only. Use `PORT=<port>` when the default port is already occupied.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind host IP (`127.0.0.1` for local-only) |
| `PORT` | `8787` | HTTP/WebSocket server port |
| `DATA_DIR` | `data` | Root directory for trace, state, and archive storage |
| `OPERATOR_PASSKEY` | *(Auto-generated)* | Operator passkey (saved to `data/state/operator-passkey.txt`) |
| `NNN_BRIDGE_ENABLED` | `1` | Enable/disable NNN hyperbolic sidecar bridge |
| `TELOS_BASE_URL` | *(unset)* | Optional base URL for an external topology validator |

### Windows Service Watchdog

An enterprise supervisor service is included under `windows-service/Netracer.ServiceHost`.

```powershell
# Install service (Elevated PowerShell)
.\scripts\install-service.ps1 -TakeoverExisting

# Uninstall service (Elevated PowerShell)
.\scripts\uninstall-service.ps1
```

---

## 開発・貢献 // DEVELOPMENT & LICENSING

- **Testing**: Run unit tests via `npm test` (`node --test`).
- **Contributing**: Please review [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.
- **Security**: Security findings should be submitted according to [SECURITY.md](SECURITY.md).
- **License**: [BSD 3-Clause License](LICENSE).

---

<div align="center">

```text
  ┌─────────────────────────────────────────────────────────┐
  │  BSD 3-Clause  ·  2026  ·  NETTRACER contributors       │
  │  "confidence can move faster than evidence."            │
  └─────────────────────────────────────────────────────────┘
```

</div>
