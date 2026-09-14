# RFC-001: The `.s1` Packet Envelope & `§-LANG` Protocol Specification

**Status**: Draft / Open Specification  
**Version**: 1.0.0  
**License**: CC BY 4.0 / Open Protocol  

---

## 1. Abstract

This specification defines the `.s1` packet envelope format and the `§-LANG` section directive grammar for zero-trust control-plane interposition across distributed LLM runtimes, local substrate brokers, and neural edge clients.

By decoupling the wire format and grammar from implementation details, any client library, proxy, or neural node can construct, sign, and parse `.s1` packets independently.

---

## 2. `.s1` Packet Lifecycle & Envelope Schema

A `.s1` packet is a cryptographically digestable JSON structure representing a single state transition or control event in a neural orchestration lifecycle.

### 2.1 Packet Classes (`packetType`)

| Packet Type | Description |
|---|---|
| `intent` | Client prompt submission, section-tag extraction, and initial route preference |
| `route-plan` | Control-plane candidate selection, priority ranking, and target upstream mapping |
| `admission` | Policy checks (max tokens, SDR channel clearance, authentication) |
| `execution` | Payload delivery to the neural substrate and streaming/batch response capture |
| `proof` | Terminal verification, digest validation, and status classification |
| `audit` | Security and access audit event logging |
| `alert` | Failover, circuit breaker, or health degradation alert |

### 2.2 JSON Schema

```json
{
  "id": "s1_1726320000000_a1b2c3d4",
  "packetType": "intent",
  "timestamp": "2026-09-14T16:00:00.000Z",
  "clientId": "topostrasgo-android",
  "actor": "operator",
  "payload": {
    "intent": "§CH{a} §OP{strict} Explain Riemannian manifold embeddings",
    "route": "lmstudio",
    "model": "qwen2.5-7b",
    "analysis": {
      "promptType": "CHAT_COMPLETION",
      "tags": ["§CH:a", "§OP:strict"],
      "digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "routeHint": "strict"
    },
    "stage": {
      "name": "ING",
      "score": 1.0
    }
  },
  "envelope": "§0|S1|INTENT|client=topostrasgo-android|route=lmstudio|digest=e3b0c442...",
  "labels": ["§NODE:lmstudio", "§CHANNEL:a"]
}
```

---

## 3. `§-LANG` Directives Grammar

`§-LANG` (Section Language) provides inline, structured directives embedded within prompt text or packet envelopes to steer routing, operation profiles, and topological state.

### 3.1 Directive Syntax

Directives begin with a section sign (`§`) followed by a uppercase directive token and key-value attributes inside curly braces (`{...}`):

```text
§TOKEN{key=value,key2=value2}
```

### 3.2 Canonical Directives

| Directive | Example | Operational Effect |
|---|---|---|
| **Channel Alias** | `§CH{a}` | Routes request through SDR Channel Alias `a` |
| **Operation Profile** | `§OP{strict}` | Enforces strict model engine matching |
| **Combined Route** | `§ROUTE{channel=a,op=strict}` | Sets both channel alias and operation profile in one directive |
| **Stage Identifier** | `§STAGE{ING}` | Sets packet lifecycle stage (`ING`, `CHK`, `CMT`, `RLB`) |
| **Binding Declaration** | `§0|BIND http://host:8787` | Binds edge client socket to local broker |

---

## 4. Cryptographic Envelope & Digest Verification

1. **Digest Calculation**: A SHA-256 hash is generated over the canonical concatenation of `timestamp`, `clientId`, `payload.intent`, and `payload.route`.
2. **Envelope String**:
   ```text
   §0|S1|<TYPE>|client=<clientId>|route=<route>|digest=<sha256>
   ```
3. **Storage & Compression**: Packet payloads stored at rest are gzipped and indexed by `packet_type`, `route`, and timestamp in SQLite archives.

---

## 5. Implementations

- **Reference Broker**: [NETTRACER (JavaScript / Node.js 22+)](https://github.com/jesusvilela/NETTRACER)
- **Edge Client**: Topos Trasgo (Kotlin / Android)
