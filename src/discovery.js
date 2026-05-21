import dgram from "node:dgram";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const discoveryPort = Number(process.env.DISCOVERY_PORT || 8786);

/**
 * UDP Discovery Service for Topos Trasgo nodes.
 * Listen on UDP port 8786 for DISCOVER_NETTRACER messages
 * and respond with the current active LAN IP and port.
 */
export function startDiscoveryService(config, traceStore) {
  const server = dgram.createSocket("udp4");

  server.on("error", (err) => {
    console.error(`Discovery Service Error:\n${err.stack}`);
    server.close();
  });

  server.on("message", (msg, rinfo) => {
    const payload = msg.toString().trim();
    if (payload === "DISCOVER_NETTRACER") {
      const response = `NETTRACER_OK:${config.network.preferredLanIp}:${config.port}`;
      server.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error("Discovery response failed", err);
        }
      });
    }
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`Discovery Service listening on ${address.address}:${address.port} (UDP)`);
  });

  try {
    server.bind(discoveryPort);
  } catch (err) {
    traceStore.addAlert({
      id: `alert_discovery_bind_failed_${Date.now()}`,
      title: "Discovery service failed to bind",
      type: "discovery-error",
      detail: err.message,
      timestamp: Date.now()
    });
  }

  // Active Background Scanner for Direct-to-LM Nodes
  const scanInterval = setInterval(async () => {
    try {
      const upstreamPorts = config.upstreams
        .map(u => {
          try { return new URL(u.baseUrl).port; } catch { return null; }
        })
        .filter(Boolean);
      
      if (upstreamPorts.length === 0) return;

      const { stdout } = await execAsync(`netstat -ano | findstr "ESTABLISHED"`);
      const lines = stdout.split('\n');
      const activeTargets = new Map();

      for (const line of lines) {
        if (!line.includes("TCP")) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        
        const localAddr = parts[1];
        const foreignAddr = parts[2];
        
        const localPort = localAddr.split(':').pop();
        const foreignIp = foreignAddr.split(':')[0];
        
        // Ignore localhost connections
        if (foreignIp === "127.0.0.1" || foreignIp === "0.0.0.0" || foreignIp.includes("::1") || foreignIp.startsWith("169.254.")) {
          continue;
        }

        if (upstreamPorts.includes(localPort)) {
          const upstream = config.upstreams.find(u => {
            try { return new URL(u.baseUrl).port === localPort; } catch { return false; }
          });
          const substrateId = upstream ? upstream.id : "unknown";
          activeTargets.set(foreignIp, substrateId);
        }
      }

      for (const [targetIp, substrateId] of activeTargets.entries()) {
        const offer = `NETTRACER_BRIDGE_OFFER:${config.network.preferredLanIp}:${config.port}:${substrateId}`;
        server.send(offer, discoveryPort, targetIp, (err) => {
          if (!err) {
            console.log(`Negotiating bridge transition with direct LM node at ${targetIp} (Substrate: ${substrateId})`);
            traceStore.addAudit({
              type: "bridge-negotiation",
              timestamp: Date.now(),
              target: targetIp,
              substrate: substrateId
            });
          }
        });
      }
    } catch (e) {
      // Silent catch to prevent background crash
    }
  }, 10000);

  return () => {
    clearInterval(scanInterval);
    server.close();
  };
}
