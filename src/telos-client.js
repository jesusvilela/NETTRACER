/**
 * Client for the W|W' TELOS Engine microservice.
 * Provides topological validation and geometric metrics.
 */
export class TelosClient {
  constructor(baseUrl = process.env.TELOS_BASE_URL || "http://127.0.0.1:8001") {
    this.baseUrl = baseUrl;
  }

  async getManifest() {
    const res = await fetch(`${this.baseUrl}/api/telos/manifest`);
    return await res.json();
  }

  async validateKernel(n_v, n, h, graph = "cycle") {
    const res = await fetch(`${this.baseUrl}/api/telos/kernel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph, n_v, n, h })
    });
    return await res.json();
  }

  async validateBerry(n_v, n, k, h) {
    const res = await fetch(`${this.baseUrl}/api/telos/berry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n_v, n, k, h })
    });
    return await res.json();
  }

  async getContinuumMetrics(curvature = 0.8) {
    const res = await fetch(`${this.baseUrl}/api/telos/continuum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curvature })
    });
    return await res.json();
  }

  async runMission(options = {}) {
    const res = await fetch(`${this.baseUrl}/api/telos/mission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    return await res.json();
  }

  async runMantle(n_v, n, h, c) {
    const res = await fetch(`${this.baseUrl}/api/telos/mantle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n_v, n, h, c })
    });
    return await res.json();
  }
}
