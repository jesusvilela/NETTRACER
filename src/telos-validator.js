import { TelosClient } from "./telos-client.js";

/**
 * High-level validator for SLANG packets using the TELOS engine.
 */
export class TelosValidator {
  constructor(baseUrl = process.env.TELOS_BASE_URL || "http://127.0.0.1:8001") {
    this.client = new TelosClient(baseUrl);
  }

  /**
   * Validates a packet's topological claim (n_v, n, h).
   * @param {Object} payload The packet payload (sigma, h, n, etc.)      
   * @returns {Promise<{ ok: boolean, reason?: string, metrics?: Object }>}
   */
  async validatePacket(payload) {
    const { n_v = 4, n = 6, h = 2, graph = "cycle" } = payload;

    try {
      // 1. Check Cech Gluing
      const cech = await this.client.validateCech(n_v, n, h, graph);     
      if (!cech.output.gluable_via_2patch_witness) {
        return { ok: false, reason: "topological_obstruction_cech", evidence: cech.evidence_class };
      }

      // 2. Validate Kernel dimension
      const kernel = await this.client.validateKernel(n_v, n, h, graph); 
      if (payload.claimed_cover_dim && kernel.output.cover_kernel_dim !== payload.claimed_cover_dim) {
         return { ok: false, reason: "dimension_mismatch_kernel", expected: kernel.output.cover_kernel_dim };
      }

      return {
        ok: true,
        metrics: {
          cover_dim: kernel.output.cover_kernel_dim,
          evidence: kernel.evidence_class
        }
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async getAmbientCurvature(curvature = 0.8) {
    return await this.client.getContinuumMetrics(curvature);
  }

  async getNonAbelianMetrics(group = "S3", subgroup = "C2") {
    return await this.client.getNonAbelianMetrics(group, subgroup);
  }
}
