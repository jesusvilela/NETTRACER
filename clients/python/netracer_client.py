"""
NETTRACER Python Client
Lightweight client wrapper for interacting with NETTRACER broker API and .s1 packet envelopes.
"""

import hashlib
import json
import sys
import time
import urllib.request
from typing import Any, Dict, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


class NetTracerClient:
    """Client for the NETTRACER Topos Broker API."""

    def __init__(self, base_url: str = "http://127.0.0.1:8787", client_id: str = "python-client"):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id

    def build_s1_envelope(self, intent: str, route: str = "auto") -> Dict[str, Any]:
        """Construct a valid .s1 packet envelope."""
        ts = int(time.time() * 1000)
        digest_input = f"{ts}:{self.client_id}:{intent}:{route}".encode("utf-8")
        digest = hashlib.sha256(digest_input).hexdigest()

        return {
            "id": f"s1_{ts}_{digest[:8]}",
            "packetType": "intent",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(ts / 1000)),
            "clientId": self.client_id,
            "actor": "operator",
            "payload": {
                "intent": intent,
                "route": route,
            },
            "envelope": f"§0|S1|INTENT|client={self.client_id}|route={route}|digest={digest[:16]}",
        }

    def health(self) -> Dict[str, Any]:
        """Check broker health status."""
        req = urllib.request.Request(f"{self.base_url}/health")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

    def metrics(self) -> str:
        """Fetch Prometheus metrics string from broker."""
        req = urllib.request.Request(f"{self.base_url}/metrics")
        with urllib.request.urlopen(req) as response:
            return response.read().decode("utf-8")


if __name__ == "__main__":
    import os
    port = os.environ.get("PORT", "8795")
    client = NetTracerClient(f"http://127.0.0.1:{port}")
    print("Health Status:", client.health().get("status"))
    print("Metrics sample:", client.metrics().splitlines()[0])
    print("Generated Envelope:", client.build_s1_envelope("§CH{a} Hello NETTRACER"))
