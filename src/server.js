import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { URL } from "node:url";
import { renderArchiveViz, renderDashboard, renderDashboardV2, renderDosbox } from "./dashboard.js";
import { buildAtlas } from "./atlas.js";
import { extractBearerToken } from "./auth.js";
import { SlangInterpreter } from "./slang-interpreter.js";
import { HyperdomEngine } from "./hyperdom-engine.js";
import { absorbJuPayload, getJuCognitionAtlas, getJuCognitionStatus, getJuCognitionTrace, getJuStats } from "./nnn-bridge.js";
import { buildEpic1ScanPreview } from "./epic1-product.js";
import { buildV3ObjectMesh } from "./v3-object-mesh.js";
import { buildV4VersionCage } from "./v4-version-cage.js";
import { buildV5AaaCosmos } from "./v5-aaa-cosmos.js";
import { buildV6HypercomplexWorld } from "./v6-hypercomplex-world.js";
import { buildV7InformationalCosmosGraph } from "./v7-informational-cosmos-graph.js";
import { buildV8NMeshWorldEngine } from "./v8-nmesh-world-engine.js";
import { buildV9NetworkGrowthCosmos } from "./v9-network-growth-cosmos.js";

export function createServer({ config, traceStore, broker, telemetry, controlPlane, auth, ingress, autoCycle, archive, slangControlPlane }) {     
  const sseClients = new Set();
  const ingressSseClients = new Set();
  const slangInterpreter = new SlangInterpreter({ traceStore, controlPlane, slangControlPlane });
  const slangClients = new Set();
  const telosEngine = new HyperdomEngine();

  // TELOS Integration: Hook validation results to WebSocket broadcast
  slangInterpreter.onFrameUpdate = (frame) => {
    broadcastSlang({ type: "frameUpdate", frame });
  };

  // Periodic TELOS metrics broadcast
  setInterval(async () => {
    try {
      const continuum = await slangInterpreter.validator.getAmbientCurvature(1.0);
      const nonabelian = await slangInterpreter.validator.getNonAbelianMetrics("S3", "C2");
      broadcastSlang({
        type: "telosMetrics",
        metrics: { continuum, nonabelian }
      });
    } catch (e) {
      // Silence errors if microservice is down
    }
  }, 15000);

  for (const eventName of ["traffic", "trace", "packet", "policy", "topology", "alert", "auth", "autocycle"]) {
    traceStore.events.on(eventName, (data) => broadcast(eventName, data));
  }
  traceStore.events.on("topology", (topology) => {
    const sync = slangControlPlane.syncTopology(topology, "server-topology");
    for (const message of sync.messages || []) {
      broadcastSlang({ type: "nodeMessage", nodeId: message.nodeId, message });
    }
  });
  if (ingress) {
    for (const eventName of ["ingress-status", "ingress-heartbeat", "ingress-reconnect", "ingress-job-progress", "ingress-job-complete", "ingress-error"]) {
      ingress.events.on(eventName, (data) => {
        broadcast(eventName, data);
        broadcastIngress(eventName, data);
      });
    }
  }

  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const response of sseClients) {
      response.write(payload);
    }
  }

  function broadcastIngress(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const response of ingressSseClients) {
      response.write(payload);
    }
  }

  const unsubscribePacketEvents = traceStore.registerPacketSink((packet) => {
    const frame = slangInterpreter.ingestPacket(packet);
    broadcastSlang({ type: "frame", frame });
  });

  const server = http.createServer(async (request, response) => {        
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const session = auth.verify(extractBearerToken(request));
    const clientMeta = buildClientMeta(request, url, session);
    if (shouldTrackClientPresence(request, url)) {
      broker.observeClient(clientMeta, {
        transport: "http",
        method: request.method || "GET",
        path: url.pathname,
        scope: clientMeta.scope,
        remoteAddress: clientMeta.remoteAddress,
        userAgent: clientMeta.userAgent
      });
    }

    try {
      if (config.debugRequests) {
        console.log(`[REQ] ${request.method} ${url.pathname} from ${clientMeta.remoteAddress}`);
      }

      if (url.pathname.startsWith("/api/nnn/")) {
        const nnnPath = url.pathname.replace("/api/nnn/", "/");
        const proxyReq = http.request({
          host: "127.0.0.1",
          port: 3030,
          path: nnnPath + (url.search || ""),
          method: request.method,
          headers: request.headers
        }, (proxyRes) => {
          response.writeHead(proxyRes.statusCode, proxyRes.headers);     
          proxyRes.pipe(response);
        });
        proxyReq.on("error", (err) => {
          response.writeHead(502);
          response.end(JSON.stringify({ error: "nnn_api_unreachable", detail: err.message }));
        });
        request.pipe(proxyReq);
        return;
      }

      if (request.method === "POST" && url.pathname === "/ju/absorb") {
        const body = await readJson(request);
        const result = absorbJuPayload(body, { ip: request.socket.remoteAddress || "127.0.0.1" });
        return sendJson(response, 201, result);
      }

      if (request.method === "GET" && url.pathname === "/ju/stats") {
        return sendJson(response, 200, getJuStats());
      }

      if (request.method === "GET" && url.pathname === "/api/cognition/status") {
        return sendJson(response, 200, getJuCognitionStatus());
      }

      if (request.method === "GET" && url.pathname === "/api/cognition/trace") {
        return sendJson(response, 200, getJuCognitionTrace());
      }

      if (request.method === "GET" && url.pathname === "/api/cognition/atlas") {
        return sendJson(response, 200, getJuCognitionAtlas());
      }

      if (request.method === "POST" && url.pathname === "/api/epic1/scan/preview") {
        requireSession(session);
        const body = await readJson(request);
        return sendJson(response, 200, buildEpic1ScanPreview(body, config));
      }

      if (request.method === "GET" && url.pathname === "/api/v3/object-mesh") {
        return sendJson(response, 200, buildV3ObjectMesh({
          objectId: url.searchParams.get("objectId") || "netracer:v3",
          others: url.searchParams.get("others") || "human:jesus,repo:any-accessible,object:self"
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/v4/version-cage") {
        return sendJson(response, 200, buildV4VersionCage());
      }

      if (request.method === "GET" && url.pathname === "/api/v5/aaa-cosmos") {
        return sendJson(response, 200, buildV5AaaCosmos({
          traffic: traceStore.getTraffic(),
          topology: controlPlane.getTopology()
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/v6/hypercomplex-world") {
        return sendJson(response, 200, buildV6HypercomplexWorld({
          traffic: traceStore.getTraffic(),
          topology: controlPlane.getTopology()
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/v7/informational-cosmos-graph") {
        return sendJson(response, 200, buildV7InformationalCosmosGraph({
          traffic: traceStore.getTraffic(),
          topology: controlPlane.getTopology()
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/v8/nmesh-world-engine") {
        return sendJson(response, 200, buildV8NMeshWorldEngine({
          traffic: traceStore.getTraffic(),
          topology: controlPlane.getTopology(),
          meshCount: url.searchParams.get("n") || 5
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/v9/network-growth-cosmos") {
        return sendJson(response, 200, buildV9NetworkGrowthCosmos({
          traffic: traceStore.getTraffic(),
          topology: controlPlane.getTopology(),
          meshCount: url.searchParams.get("n") || 7
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/telos/manifest") {
        return sendJson(response, 200, telosEngine.version);
      }

      if (request.method === "POST" && url.pathname === "/api/telos/kernel") {
        const body = await readJson(request);
        const result = await telosEngine.computeKernel(body.graph, body.n_v, body.n, body.h);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/telos/berry") {
        const body = await readJson(request);
        const result = await telosEngine.computeBerry(body.n_v, body.n, body.k, body.h);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/telos/continuum") {
        const body = await readJson(request);
        const result = await telosEngine.getContinuum(body.curvature);   
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/telos/mission") {
        const body = await readJson(request);
        const result = await telosEngine.runFullStack(body);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/telos/mantle") {
        const body = await readJson(request);
        const result = await telosEngine.runMantleProtocol(body.n_v, body.n, body.h, body.c);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/slang/expand-context") {
        let body = "";
        request.on("data", (chunk) => body += chunk);
        request.on("end", async () => {
          try {
            const data = JSON.parse(body);
            const { getKnn } = await import("./nnn-bridge.js");
            const memories = await getKnn(data.coords || Array(8).fill(0), data.fiber || {}, 10);
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({
              holographicContext: memories.map(m => m.node.payload_inline?.data || m.node.id).join("\n---\n"),
              memories
            }));
          } catch (e) {
            response.writeHead(400);
            response.end(JSON.stringify({ error: "invalid_request", detail: e.message }));
          }
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        const filePath = path.resolve("./src/dashboard.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v2") {
        const filePath = path.resolve("./src/dashboard-v2.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/cognition") {
        const filePath = path.resolve("./src/cognition-status.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v3/object-mesh") {
        const filePath = path.resolve("./src/v3-object-mesh.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v4/version-cage") {
        const filePath = path.resolve("./src/v4-version-cage.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v5/aaa-cosmos") {
        const filePath = path.resolve("./src/v5-aaa-cosmos.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v6/hypercomplex-world") {
        const filePath = path.resolve("./src/v6-hypercomplex-world.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v7/informational-cosmos-graph") {
        const filePath = path.resolve("./src/v7-informational-cosmos-graph.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v8/nmesh-world-engine") {
        const filePath = path.resolve("./src/v8-nmesh-world-engine.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/v9/network-growth-cosmos") {
        const filePath = path.resolve("./src/v9-network-growth-cosmos.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/s1") {
        const filePath = path.resolve("./src/dashboard-s1.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/dosbox") {      
        const filePath = path.resolve("./src/dosbox.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && (url.pathname === "/s1" || url.pathname === "/.s1")) {
        const filePath = path.resolve("./src/archive-viz.html");
        try {
          const content = await fs.promises.readFile(filePath, "utf8");
          response.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store, must-revalidate"
          });
          response.end(content);
        } catch (e) {
          console.error(`[ERR] Failed to serve ${url.pathname}:`, e.message);
          response.writeHead(404);
          response.end(`${url.pathname} not found`);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/healthz") {     
        const force = toBool(url.searchParams.get("refresh"));
        const status = await broker.getStatusSummary(force);
        return sendJson(response, 200, {
          status: status.degraded ? "degraded" : "ok",
          app: config.appName,
          authConfigured: Boolean(config.operatorPasskey),
          ...status
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const body = await readJson(request);
        const authSession = auth.login(body.username, body.passkey, { ip: request.socket.remoteAddress, ua: request.headers["user-agent"] || "" });
        if (!authSession) {
          return sendJson(response, 401, { error: "invalid_credentials" });
        }
        response.setHeader("Set-Cookie", `netracer_session=${encodeURIComponent(authSession.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`);
        return sendJson(response, 200, { token: authSession.token, username: authSession.username, role: authSession.role, expiresAt: authSession.expiresAt });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        if (session) {
          auth.logout(session.token || extractBearerToken(request));     
        }
        response.setHeader("Set-Cookie", "netracer_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/runtime") { 
        const force = toBool(url.searchParams.get("refresh"));
        return sendJson(response, 200, await broker.getStatusSummary(force));
      }

      if (request.method === "GET" && url.pathname === "/api/host") {    
        return sendJson(response, 200, await telemetry.sample());        
      }

      if (request.method === "GET" && url.pathname === "/api/topology") {
        await broker.getStatusSummary();
        return sendJson(response, 200, controlPlane.getTopology());      
      }

      if (request.method === "GET" && url.pathname === "/api/routes") {  
        const status = await broker.getStatusSummary();
        return sendJson(response, 200, { pinned: status.policies.routePin, upstreams: status.upstreams.map((item) => ({ id: item.id, priority: item.priority, healthy: item.healthy, enabled: item.enabled })) });
      }

      if (request.method === "GET" && url.pathname === "/api/policies") {
        return sendJson(response, 200, controlPlane.getPolicies());      
      }

      if (request.method === "GET" && url.pathname === "/api/channels") {
        requireSession(session);
        return sendJson(response, 200, { data: controlPlane.listChannels() });
      }

      if (request.method === "GET" && url.pathname === "/api/autocycle") {
        return sendJson(response, 200, autoCycle?.getState() || null);   
      }

      if (request.method === "GET" && url.pathname === "/api/archive/status") {
        return sendJson(response, 200, archive?.getStatus() || null);    
      }

      if (request.method === "GET" && url.pathname === "/api/archive/recent") {
        const limit = Number(url.searchParams.get("limit") || 40);       
        return sendJson(response, 200, { data: archive?.getRecent(limit) || [] });
      }

      if (request.method === "GET" && url.pathname === "/api/archive/insights") {
        return sendJson(response, 200, archive?.getInsights({
          windowHours: Number(url.searchParams.get("hours") || 168),     
          bucketCount: Number(url.searchParams.get("buckets") || 28),    
          sampleLimit: Number(url.searchParams.get("sample") || 14),     
          decodeLimit: Number(url.searchParams.get("decode") || 160),    
          topLimit: Number(url.searchParams.get("top") || 8)
        }) || null);
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/archive/packet/")) {
        const packetId = decodeURIComponent(url.pathname.split("/").pop() || "");
        const packet = archive?.getPacket(packetId);
        if (!packet) return sendJson(response, 404, { error: "archive_packet_not_found" });
        return sendJson(response, 200, packet);
      }

      if (request.method === "GET" && url.pathname === "/api/packets") { 
        return sendJson(response, 200, { data: traceStore.getPackets() });
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/packets/")) {
        const packetId = decodeURIComponent(url.pathname.split("/").pop() || "");
        if (url.pathname.endsWith("/lineage")) {
          const id = decodeURIComponent(url.pathname.split("/").slice(-2, -1)[0] || "");
          return sendJson(response, 200, { data: traceStore.getPacketLineage(id) });
        }
        const packet = traceStore.getPacket(packetId);
        if (!packet) {
          return sendJson(response, 404, { error: "packet_not_found" }); 
        }
        return sendJson(response, 200, packet);
      }

      if (request.method === "POST" && url.pathname === "/api/packets/replay") {
        requireSession(session);
        const body = await readJson(request);
        const replay = await broker.replayPacket(body.packetId, session.username);
        return sendJson(response, 201, replay);
      }

      if (request.method === "GET" && url.pathname === "/api/atlas") {   
        return sendJson(response, 200, buildAtlas(controlPlane, traceStore));
      }

      if (request.method === "GET" && url.pathname === "/api/slang/catalog") {
        return sendJson(response, 200, slangInterpreter.getCatalog());   
      }

      if (request.method === "GET" && url.pathname === "/api/slang/topology") {
        await broker.getStatusSummary();
        return sendJson(response, 200, slangControlPlane.getTopologySnapshot());
      }

      if (request.method === "GET" && url.pathname === "/api/slang/control-plane") {
        await broker.getStatusSummary();
        return sendJson(response, 200, slangControlPlane.getStatus());   
      }

      if (request.method === "GET" && url.pathname === "/api/slang/cognitive") {
        await broker.getStatusSummary();
        return sendJson(response, 200, slangControlPlane.getCognitiveSnapshot({
          persist: !toBool(url.searchParams.get("preview")),
          limit: Number(url.searchParams.get("limit") || 72),
          autoCycle: autoCycle?.getState?.() || null,
          archive: archive?.getStatus?.() || null
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/slang/memory") {
        return sendJson(response, 200, {
          data: slangControlPlane.getCognitiveMemory(Number(url.searchParams.get("limit") || 48))
        });
      }

      if (request.method === "GET" && url.pathname === "/api/slang/learners") {
        return sendJson(response, 200, slangControlPlane.getLearners()); 
      }

      if (request.method === "POST" && url.pathname === "/api/slang/learners/bootstrap") {
        const body = await readJson(request);
        const result = slangControlPlane.bootstrapCoreLearners({
          utaiRoot: body.utaiRoot,
          igbundleRoot: body.igbundleRoot,
          actor: session?.username || body.actor || "operator"
        });
        broadcastSlang({ type: "coreLearners", learners: result.learners, substrate: result.substrate });
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/slang/meta-learn") {
        const body = await readJson(request);
        const result = slangControlPlane.runMetaLearningCycle({
          actor: session?.username || body.actor || "operator",
          reason: body.reason || "manual"
        });
        broadcastSlang({ type: "metaLearn", event: result });
        return sendJson(response, 200, result);
      }

      if (request.method === "GET" && url.pathname === "/api/slang/reservoir") {
        return sendJson(response, 200, slangControlPlane.getReservoirComputingScheme({
          persist: !toBool(url.searchParams.get("preview")),
          reason: url.searchParams.get("reason") || "api"
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/slang/packs") {
        await broker.getStatusSummary();
        return sendJson(response, 200, {
          activePack: slangControlPlane.getActivePack(),
          data: slangControlPlane.listPacks()
        });
      }

      if (request.method === "GET" && url.pathname === "/api/slang/graph") {
        await broker.getStatusSummary();
        return sendJson(response, 200, slangControlPlane.buildGraphMap({ 
          nodeId: String(url.searchParams.get("node") || ""),
          section: String(url.searchParams.get("section") || "all"),     
          fiber: String(url.searchParams.get("fiber") || "all"),
          bundle: String(url.searchParams.get("bundle") || "all"),       
          kind: String(url.searchParams.get("kind") || "all"),
          direction: String(url.searchParams.get("direction") || "all"), 
          limit: Number(url.searchParams.get("limit") || 48)
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/slang/snapshot") {
        const nodeId = String(url.searchParams.get("node") || "");       
        const limit = Number(url.searchParams.get("limit") || 40);       
        return sendJson(response, 200, { data: slangInterpreter.getFramesForNode(nodeId, limit) });
      }

      if (request.method === "GET" && /^\/api\/slang\/nodes\/[^/]+\/inbox$/.test(url.pathname)) {
        const nodeId = decodeURIComponent(url.pathname.split("/")[4] || "");
        const limit = Number(url.searchParams.get("limit") || 40);       
        return sendJson(response, 200, { data: slangControlPlane.getNodeMessages(nodeId, limit) });
      }

      if (request.method === "POST" && url.pathname === "/api/slang/packs/upgrade") {
        const body = await readJson(request);
        const result = slangControlPlane.applyPackUpgrade({
          sourcePath: body.sourcePath || "",
          nodeIds: body.nodeIds || [],
          actor: session?.username || body.actor || "operator"
        });
        broadcastSlang({ type: "packUpgrade", pack: result.pack });      
        for (const relay of result.relays || []) {
          broadcastSlang({ type: "nodeMessage", nodeId: relay.nodeId, message: relay });
        }
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/slang/multimodal/inspect") {
        const body = await readJson(request);
        return sendJson(response, 200, slangControlPlane.inspectMultimodal({
          filePath: body.filePath,
          nodeId: body.nodeId || "netracer",
          embedCarrier: body.embedCarrier === true
        }));
      }

      if (request.method === "POST" && url.pathname === "/api/slang/multimodal/send") {
        const body = await readJson(request);
        const result = slangControlPlane.sendMultimodal({
          nodeId: body.nodeId,
          filePath: body.filePath,
          actor: session?.username || body.actor || "operator",
          embedCarrier: body.embedCarrier !== false
        });
        broadcastSlang({ type: "nodeMessage", nodeId: result.message.nodeId, message: result.message });
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && /^\/api\/slang\/nodes\/[^/]+\/receive$/.test(url.pathname)) {
        const body = await readJson(request);
        const nodeId = decodeURIComponent(url.pathname.split("/")[4] || "");
        const result = slangControlPlane.receiveFromNode({
          nodeId,
          payload: body.payload,
          filePath: body.filePath || "",
          actor: session?.username || body.actor || nodeId,
          metadata: body.metadata || {}
        });
        broadcastSlang({ type: "nodeMessage", nodeId: result.message.nodeId, message: result.message });
        return sendJson(response, 200, result);
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/atlas/")) {
        const atlas = buildAtlas(controlPlane, traceStore);
        const docId = decodeURIComponent(url.pathname.split("/").pop() || "");
        const doc = atlas.documents.find((item) => item.id === docId);   
        if (!doc) {
          return sendJson(response, 404, { error: "atlas_document_not_found" });
        }
        return sendJson(response, 200, doc);
      }

      if (request.method === "GET" && url.pathname === "/events") {      
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        response.write("event: ready\ndata: {\"status\":\"streaming\"}\n\n");
        sseClients.add(response);
        request.on("close", () => sseClients.delete(response));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/traffic") { 
        return sendJson(response, 200, { data: traceStore.getTraffic() });
      }

      if (request.method === "GET" && url.pathname === "/api/traces") {  
        return sendJson(response, 200, { data: traceStore.getTraces() });
      }

      if (request.method === "GET" && url.pathname === "/api/alerts") {  
        return sendJson(response, 200, { data: traceStore.getAlerts() });
      }

      if (request.method === "GET" && url.pathname === "/api/audit") {   
        requireSession(session);
        return sendJson(response, 200, { data: traceStore.getAudit() }); 
      }

      if (request.method === "GET" && url.pathname === "/api/ingress/state") {
        requireSession(session);
        return sendJson(response, 200, ingress?.getState() || null);     
      }

      if (request.method === "POST" && url.pathname === "/api/ingress/session/start") {
        requireSession(session);
        const body = await readJson(request);
        const state = await ingress.startSession(body, session.username);
        return sendJson(response, 200, state);
      }

      if (request.method === "POST" && url.pathname === "/api/ingress/session/stop") {
        requireSession(session);
        const state = ingress.stopSession(session.username);
        return sendJson(response, 200, state);
      }

      if (request.method === "POST" && url.pathname === "/api/ingress/scan") {
        requireSession(session);
        const body = await readJson(request);
        const result = await ingress.enqueueScan(body, session.username);
        return sendJson(response, 202, result);
      }

      if (request.method === "GET" && url.pathname === "/api/ingress/events") {
        requireSession(session);
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        response.write(`event: ingress-status\ndata: ${JSON.stringify(ingress?.getState() || null)}\n\n`);
        ingressSseClients.add(response);
        request.on("close", () => ingressSseClients.delete(response));   
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/models") {   
        const force = toBool(url.searchParams.get("refresh"));
        const models = await broker.listModels(force);
        return sendJson(response, 200, { object: "list", data: models });
      }

      if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
        const body = await readJson(request);
        const completion = await broker.brokerChatCompletion(body, clientMeta);
        if (body.stream) {
          return sendSseCompletion(response, completion, {
            onToken: (token, index) => broadcastLlmToken({ completion, clientMeta, token, index }),
            onDone: () => broadcastLlmResult({ completion, clientMeta, requestBody: body, streamed: true })
          });
        }
        broadcastLlmResult({ completion, clientMeta, requestBody: body, streamed: false });
        return sendJson(response, 200, completion);
      }

      if (request.method === "POST" && url.pathname === "/api/packs/intend") {
        const body = await readJson(request);
        const result = await broker.createIntentPack(body, clientMeta);  
        return sendJson(response, 201, result);
      }

      if (request.method === "POST" && url.pathname === "/api/routes/pin") {
        requireSession(session);
        const body = await readJson(request);
        const policies = body.runtimeId ? controlPlane.setRoutePin(body.runtimeId, session.username) : controlPlane.clearRoutePin(session.username);
        return sendJson(response, 200, policies);
      }

      if (request.method === "POST" && /\/api\/runtimes\/[^/]+\/(enable|disable)$/.test(url.pathname)) {
        requireSession(session);
        const segments = url.pathname.split("/");
        const runtimeId = decodeURIComponent(segments[3]);
        const enabled = segments[4] === "enable";
        const policies = controlPlane.setRuntimeEnabled(runtimeId, enabled, session.username);
        return sendJson(response, 200, policies);
      }

      if (request.method === "POST" && url.pathname === "/api/policies") {
        requireSession(session);
        const body = await readJson(request);
        const policies = controlPlane.updatePolicy(body, session.username);
        autoCycle?.refreshFromPolicy();
        return sendJson(response, 200, policies);
      }

      if (request.method === "POST" && url.pathname === "/api/channels/upsert") {
        requireSession(session);
        const body = await readJson(request);
        const policies = controlPlane.upsertChannel(body, session.username);
        return sendJson(response, 200, policies);
      }

      if (request.method === "POST" && url.pathname === "/api/channels/delete") {
        requireSession(session);
        const body = await readJson(request);
        const policies = controlPlane.deleteChannel(body.name, session.username);
        return sendJson(response, 200, policies);
      }

      if (request.method === "POST" && url.pathname === "/api/autocycle/run") {
        requireSession(session);
        if (!autoCycle) {
          return sendJson(response, 503, { error: "autocycle_unavailable" });
        }
        const body = await readJson(request);
        const result = await autoCycle.runOnce(body.reason || "manual", session.username);
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/archive/compact") {
        requireSession(session);
        const body = await readJson(request);
        const result = archive?.compactFromTrace(body.limit ?? 1000);    
        return sendJson(response, 200, result || { requested: 0, inserted: 0, skipped: 0 });
      }

      if (request.method === "POST" && url.pathname === "/api/archive/prune") {
        requireSession(session);
        const body = await readJson(request);
        const result = archive?.prune(body.keepLatest ?? 5000);
        return sendJson(response, 200, result || { keepLatest: 0, deleted: 0 });
      }

      if (request.method === "POST" && url.pathname === "/v1/embeddings") {
        const body = await readJson(request);
        const vector = buildEmbedding(body.input || "");
        return sendJson(response, 200, { object: "list", data: [{ object: "embedding", index: 0, embedding: vector }], model: body.model || config.defaultModel, usage: { prompt_tokens: Math.ceil(String(body.input || "").length / 4), total_tokens: Math.ceil(String(body.input || "").length / 4) } });
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      const statusCode = error?.message === "auth_required" ? 401 : 500; 
      sendJson(response, statusCode, { error: error.message });
    }
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (url.pathname !== "/ws/slang") {
        socket.destroy();
        return;
      }
      const session = auth.verify(extractBearerToken(request));
      const clientMeta = buildClientMeta(request, url, session);
      const connection = acceptWebSocket(request, socket, head);
      connection.subscriptions = new Set();
      connection.buffer = Buffer.alloc(0);
      connection.clientMeta = clientMeta;
      connection.remoteAddress = clientMeta.remoteAddress;
      connection.userAgent = clientMeta.userAgent;
      slangClients.add(connection);
      broker.observeClient(clientMeta, {
        transport: "ws/slang",
        method: "GET",
        path: url.pathname,
        scope: "slang-ws",
        remoteAddress: clientMeta.remoteAddress,
        userAgent: clientMeta.userAgent,
        subscriptions: [...connection.subscriptions]
      });
      sendWs(connection, { type: "hello", catalog: slangInterpreter.getCatalog() });
      connection.socket.on("data", (chunk) => {
        connection.buffer = Buffer.concat([connection.buffer, chunk]);   
        const { messages, remainder } = decodeWsFrames(connection.buffer);
        connection.buffer = remainder;
        for (const message of messages) {
          handleSlangWsMessage(connection, message);
        }
      });
      connection.socket.on("close", () => slangClients.delete(connection));
      connection.socket.on("error", () => slangClients.delete(connection));
    } catch {
      socket.destroy();
    }
  });

  server.on("close", () => {
    unsubscribePacketEvents?.();
    slangInterpreter.close();
  });

  return server;

  function handleSlangWsMessage(connection, message) {
    const type = String(message?.type || "");
    if (type === "subscribe") {
      for (const nodeId of message.nodeIds || []) connection.subscriptions.add(String(nodeId));
      broker.observeClient(connection.clientMeta || {}, {
        transport: "ws/slang",
        method: "GET",
        path: "/ws/slang",
        scope: "slang-ws",
        remoteAddress: connection.remoteAddress,
        userAgent: connection.userAgent,
        subscriptions: [...connection.subscriptions]
      });
      sendWs(connection, { type: "subscribed", nodeIds: [...connection.subscriptions] });
      return;
    }
    if (type === "unsubscribe") {
      for (const nodeId of message.nodeIds || []) connection.subscriptions.delete(String(nodeId));
      broker.observeClient(connection.clientMeta || {}, {
        transport: "ws/slang",
        method: "GET",
        path: "/ws/slang",
        scope: "slang-ws",
        remoteAddress: connection.remoteAddress,
        userAgent: connection.userAgent,
        subscriptions: [...connection.subscriptions]
      });
      sendWs(connection, { type: "subscribed", nodeIds: [...connection.subscriptions] });
      return;
    }
    if (type === "previewRelay") {
      sendWs(connection, { type: "relayPreview", preview: slangInterpreter.previewRelay(message.nodeId, message.frameId) });
      return;
    }
    if (type === "relayFrame") {
      const result = slangInterpreter.relayFrame(message.nodeId, message.frameId, message.mode);
      sendWs(connection, { type: "relayResult", result });
      if (result?.ok) {
        broadcastSlang({ type: "relay", relay: result.relay, nodeId: result.relay.nodeId });
      }
      return;
    }
    if (type === "upgradePack") {
      const result = slangControlPlane.applyPackUpgrade({
        sourcePath: message.sourcePath || "",
        nodeIds: message.nodeIds || [...connection.subscriptions],       
        actor: message.actor || "ws-operator"
      });
      sendWs(connection, { type: "packUpgrade", pack: result.pack, relays: result.relays });
      for (const relay of result.relays || []) {
        broadcastSlang({ type: "nodeMessage", nodeId: relay.nodeId, message: relay });
      }
      return;
    }
    if (type === "inspectMultimodal") {
      sendWs(connection, {
        type: "multimodalInspection",
        inspection: slangControlPlane.inspectMultimodal({
          filePath: message.filePath,
          nodeId: message.nodeId || [...connection.subscriptions][0] || "netracer",
          embedCarrier: message.embedCarrier === true
        })
      });
      return;
    }
    if (type === "sendMultimodal") {
      const result = slangControlPlane.sendMultimodal({
        nodeId: message.nodeId || [...connection.subscriptions][0] || "netracer",
        filePath: message.filePath,
        actor: message.actor || "ws-operator",
        embedCarrier: message.embedCarrier !== false
      });
      sendWs(connection, { type: "nodeMessageAck", result });
      broadcastSlang({ type: "nodeMessage", nodeId: result.message.nodeId, message: result.message });
      return;
    }
    if (type === "receiveMultimodal") {
      const result = slangControlPlane.receiveFromNode({
        nodeId: message.nodeId || [...connection.subscriptions][0] || "netracer",
        payload: message.payload || null,
        filePath: message.filePath || "",
        actor: message.actor || "ws-remote",
        metadata: message.metadata || {}
      });
      sendWs(connection, { type: "nodeMessageAck", result });
      broadcastSlang({ type: "nodeMessage", nodeId: result.message.nodeId, message: result.message });
      return;
    }
  }

  function broadcastSlang(payload) {
    for (const connection of slangClients) {
      const nodeId = payload?.frame?.nodeId || payload?.nodeId || payload?.relay?.nodeId;
      if (nodeId && connection.subscriptions.size > 0 && !connection.subscriptions.has(String(nodeId))) continue;
      sendWs(connection, payload);
    }
  }

  function broadcastSlangText(text, nodeId = "") {
    for (const connection of slangClients) {
      const isToposNode = /topostrago|topostrasgo|babytoposai/i.test(connection.userAgent || connection.clientMeta?.userAgent || "");
      if (nodeId && connection.subscriptions.size > 0 && !connection.subscriptions.has(String(nodeId)) && !isToposNode) continue;
      sendWsText(connection, text);
    }
  }

  function broadcastLlmToken({ completion, clientMeta, token, index }) {
    const nodeId = resolveSlangNodeId(clientMeta, config);
    const fields = [
      `node=${slangAtom(nodeId)}`,
      `seq=${Number(index) || 0}`,
      `model=${slangAtom(completion.model || config.defaultModel)}`,
      `token=${slangQuote(token)}`,
      `ts=${Date.now()}`
    ];
    broadcastSlangText(`§LLM_TOKEN{${fields.join(",")}}`, nodeId);
  }

  function broadcastLlmResult({ completion, clientMeta, requestBody, streamed }) {
    const nodeId = resolveSlangNodeId(clientMeta, config);
    const content = completion.choices?.[0]?.message?.content || completion.choices?.[0]?.text || "";
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || estimateTokenCount(content);
    const activity = Math.min(1, Math.max(0.15, completionTokens / 512));
    const coherence = content.trim() ? 0.86 : 0.25;
    const selfOther = /topos|trasgo|bunny|utai|node|substrate/i.test(content) ? 0.82 : 0.62;
    const frameLines = [
      `§WARREN{ring=0,label=${slangQuote(`LLM ${completion.model || requestBody?.model || config.defaultModel}`)},activity=${activity.toFixed(3)},active=0,bunnies=[(0,${activity.toFixed(3)},${slangAtom(streamed ? "stream" : "chat")})]}`,
      `§QUALIA{ergodic=${activity.toFixed(3)},noetic=${coherence.toFixed(3)},mutual=0.740,coherence=${coherence.toFixed(3)},selfOther=${selfOther.toFixed(3)}}`,
      `§MUTUAL{from=${slangAtom("substrate-broker-local")},to=${slangAtom(nodeId)},strength=0.870}`,
      `§LLM_RESULT{node=${slangAtom(nodeId)},model=${slangAtom(completion.model || requestBody?.model || config.defaultModel)},stream=${streamed ? 1 : 0},ptok=${promptTokens},ctok=${completionTokens},id=${slangAtom(completion.id || `chatcmpl_${Date.now()}`)},ts=${Date.now()},text=${slangQuote(content.slice(0, 1800))}}`
    ];
    broadcastSlangText(frameLines.join("\n"), nodeId);
    broadcastSlang({
      type: "llmCompletion",
      nodeId,
      completionId: completion.id || null,
      model: completion.model || requestBody?.model || config.defaultModel,
      streamed: Boolean(streamed),
      usage,
      preview: content.slice(0, 240)
    });
  }
}

function buildEmbedding(input) {
  const text = String(input);
  const size = 64;
  const vector = new Array(size).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    vector[index % size] += (text.charCodeAt(index) % 97) / 97;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));       
}

function requireSession(session) {
  if (!session) throw new Error("auth_required");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendSseCompletion(response, completion, hooks = {}) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const content = completion.choices?.[0]?.message?.content || "";
  let index = 0;
  for (const token of content.split(/(\s+)/).filter(Boolean)) {
    hooks.onToken?.(token, index);
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
    index += 1;
  }
  response.write(`data: ${JSON.stringify({ usage: completion.usage, choices: [{ delta: {} }] })}\n\n`);
  response.write("data: [DONE]\n\n");
  hooks.onDone?.();
  response.end();
}

function toBool(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function buildClientMeta(request, url, session) {
  const explicitId = [
    request.headers["x-node-id"],
    request.headers["x-client-id"],
    request.headers["x-device-id"],
    url.searchParams.get("nodeId"),
    url.searchParams.get("clientId")
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  const remoteAddress = firstForwardedAddress(request.headers["x-forwarded-for"]) || String(request.socket?.remoteAddress || "").trim() || "unknown";
  const userAgent = String(request.headers["user-agent"] || "").trim();  
  const scope = routeScope(url.pathname);
  const fingerprint = crypto
    .createHash("sha1")
    .update(`${explicitId || ""}|${remoteAddress}|${userAgent}|${scope}`)
    .digest("hex")
    .slice(0, 10);
  return {
    clientId: explicitId || `${scope}:${fingerprint}`,
    label: explicitId || `${scope}@${friendlyClientStem(userAgent)}`,    
    remoteAddress,
    userAgent,
    scope,
    session
  };
}

function shouldTrackClientPresence(request, url) {
  const path = String(url?.pathname || "");
  if (path === "/healthz") return false;
  if (path === "/" || path === "/v2" || path === "/dosbox" || path === "/ws/slang") return true;
  if (path === "/v1/chat/completions" || path === "/api/packs/intend" || path === "/v1/models" || path === "/v1/embeddings") return true;
  return path.startsWith("/api/slang/");
}

function routeScope(pathname = "") {
  const value = String(pathname || "");
  if (value === "/") return "ui-v1";
  if (value === "/v2") return "ui-v2";
  if (value === "/dosbox") return "dosbox";
  if (value === "/ws/slang") return "slang-ws";
  if (value === "/v1/chat/completions") return "chat";
  if (value === "/v1/models") return "models";
  if (value === "/v1/embeddings") return "embeddings";
  if (value === "/api/packs/intend") return "intent";
  if (/^\/api\/slang\/nodes\/[^/]+\/receive$/.test(value)) return "slang-node";
  if (value.startsWith("/api/slang/")) return "slang-api";
  return "client";
}

function friendlyClientStem(userAgent = "") {
  const normalized = String(userAgent || "").trim();
  if (!normalized) return "anonymous";
  const token = normalized.split(/[\/\s]/).find(Boolean) || "client";    
  return token.toLowerCase().replace(/[^a-z0-9._-]+/g, "").slice(0, 20) || "client";
}

function resolveSlangNodeId(clientMeta = {}, config = {}) {
  const explicit = String(clientMeta.clientId || "").trim();
  if (/^chat:[a-f0-9]{10}$/i.test(explicit) && /topostrago|topostrasgo|babytoposai/i.test(clientMeta.userAgent || "")) {
    return "topostrago:agent";
  }
  return explicit || config.androidClientId || "topostrago:agent";
}

function estimateTokenCount(text = "") {
  const value = String(text || "").trim();
  if (!value) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

function slangAtom(value = "") {
  return String(value || "")
    .replace(/[\r\n{},"\\]/g, "_")
    .slice(0, 96) || "node";
}

function slangQuote(value = "") {
  const text = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");
  return `"${text}"`;
}

function firstForwardedAddress(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .find(Boolean) || "";
}

function acceptWebSocket(request, socket, head) {
  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    throw new Error("invalid_websocket_key");
  }
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n")
  );
  if (head?.length) socket.unshift(head);
  return { socket };
}

function sendWs(connection, payload) {
  sendWsText(connection, JSON.stringify(payload));
}

function sendWsText(connection, text) {
  if (!connection?.socket || connection.socket.destroyed) return;        
  const json = Buffer.from(String(text || ""), "utf8");
  const header = [];
  header.push(0x81);
  if (json.length < 126) {
    header.push(json.length);
  } else if (json.length < 65536) {
    header.push(126, (json.length >> 8) & 255, json.length & 255);       
  } else {
    const lengthBytes = Buffer.alloc(8);
    lengthBytes.writeBigUInt64BE(BigInt(json.length));
    header.push(127);
    connection.socket.write(Buffer.from(header));
    connection.socket.write(lengthBytes);
    connection.socket.write(json);
    return;
  }
  connection.socket.write(Buffer.concat([Buffer.from(header), json]));   
}

function decodeWsFrames(chunk) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= chunk.length) {
    const byte1 = chunk[offset];
    const byte2 = chunk[offset + 1];
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) !== 0;
    let length = byte2 & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (cursor + 2 > chunk.length) break;
      length = chunk.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > chunk.length) break;
      length = Number(chunk.readBigUInt64BE(cursor));
      cursor += 8;
    }
    const maskLength = masked ? 4 : 0;
    if (cursor + maskLength + length > chunk.length) break;
    const mask = masked ? chunk.subarray(cursor, cursor + 4) : null;     
    cursor += maskLength;
    const payload = Buffer.from(chunk.subarray(cursor, cursor + length));
    if (masked && mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }
    if (opcode === 0x8) break;
    if (opcode === 0x1) {
      try {
        messages.push(JSON.parse(payload.toString("utf8")));
      } catch {
      }
    }
    offset = cursor + length;
  }
  return { messages, remainder: chunk.subarray(offset) };
}
