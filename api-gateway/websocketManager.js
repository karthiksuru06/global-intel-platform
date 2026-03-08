const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

// Feature 5: Channel Classification Constants
const CHANNELS = {
  UNCLASSIFIED: "UNCLASSIFIED",
  CLASSIFIED: "CLASSIFIED",
  SOVEREIGN: "SOVEREIGN",
};

const ROLE_TO_CHANNEL = {
  OPERATOR: CHANNELS.UNCLASSIFIED,
  ANALYST: CHANNELS.CLASSIFIED,
  SOVEREIGN: CHANNELS.SOVEREIGN,
  ANON: CHANNELS.UNCLASSIFIED,
};

// Security-class event types (require CLASSIFIED+ for severity 4-5)
const SECURITY_EVENT_TYPES = new Set([
  "conflict", "bases", "military", "nuclear", "sanctions", "cyberThreats",
]);

// SOVEREIGN-only event types
const SOVEREIGN_ONLY_TYPES = new Set(["canary", "governance", "system_metric", "break_glass_alert"]);

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // clientId -> clientInfo
    this.heartbeatInterval = null;

    // Spatial Partitioning: "lat_lon" -> Set of clientId
    this.tiles = new Map();
    this.TILE_SIZE = 5; // degrees (Precision increased from 10)

    // Operational & Forensic Metrics
    this.metrics = {
      messagesSent: 0,
      fanoutEfficiency: 1.0,
      droppedEvents: 0,
      sampledForensics: [], // Forensic Reconstruction Buffer
      spatialFilterHits: 0,
      latencyBuffer: [], // Buffer for recent trace latencies
      p95Latency: 0,
    };
  }

  initialize(server, deps = {}) {
    // ── Sovereign Channel Origin Validation ──
    const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
    const authRegistry = deps.authRegistry || {};

    this.wss = new WebSocket.Server({
      server,
      // 1. Origin Verification: Defend against cross-origin WebSocket hijacking
      verifyClient: (info, callback) => {
        const origin = info.origin;
        if (origin !== ALLOWED_ORIGIN && process.env.NODE_ENV === "production") {
          console.warn(`[WS] Connection rejected: Invalid Origin ${origin}`);
          return callback(false, 403, "ORIGIN_DEVIATION: Unauthorized Origin");
        }

        // 2. Handshake Authentication (Hardened v2.9.6)
        // Prefer Headers (more secure) over Query Params
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const apiKey = info.req.headers["x-api-key"] || url.searchParams.get("token");

        if (!apiKey) {
          console.warn("[WS] Handshake rejected: Authentication missing.");
          return callback(false, 401, "AUTHENTICATION_REQUIRED: Handshake must include valid token.");
        }

        // 3. Cryptographic Registry Lookup
        const keyInfo = authRegistry[apiKey];
        if (!keyInfo && process.env.NODE_ENV === "production") {
          console.warn(`[WS] Handshake rejected: Invalid Token ${apiKey.slice(0, 4)}...`);
          return callback(false, 401, "SECURITY_FAILURE: Token not recognized by Sovereign Registry.");
        }

        // Entropy check (Ensure > 128 bits equivalent in production)
        if (process.env.NODE_ENV === "production" && apiKey.length < 30) {
          return callback(false, 401, "SECURITY_FAILURE: Insufficient token entropy (v2.9.6 requirement).");
        }

        callback(true);
      }
    });

    this.wss.on("connection", (ws, req) => {
      const clientId = uuidv4();

      // Feature 5: Resolve role and channel from API key used during handshake
      const url = new URL(req.url, `http://${req.headers.host}`);
      const apiKey = req.headers["x-api-key"] || url.searchParams.get("token");
      const keyInfo = apiKey ? authRegistry[apiKey] : null;
      const clientRole = keyInfo?.role || "ANON";
      const clientChannel = ROLE_TO_CHANNEL[clientRole] || CHANNELS.UNCLASSIFIED;

      const clientInfo = {
        ws,
        id: clientId,
        role: clientRole,
        channel: clientChannel,
        connectedAt: new Date().toISOString(),
        subscriptions: new Set(), // empty = all events
        alive: true,
        ip: req.socket.remoteAddress,
        lastSendTime: 0,
        sendCount: 0,
        viewport: null, // {lamin, lomin, lamax, lomax} if client sends viewport
      };

      this.clients.set(clientId, clientInfo);
      console.log(
        `[WS] Client connected: ${clientId} role=${clientRole} channel=${clientChannel} (total: ${this.clients.size})`
      );

      // Send welcome + channel info (Feature 5)
      this._send(ws, {
        type: "connected",
        clientId,
        message: "Connected to Global Intelligence Platform",
        timestamp: new Date().toISOString(),
      });

      this._send(ws, {
        type: "channel_info",
        channel: clientChannel,
        role: clientRole,
        permissions: this._getChannelPermissions(clientChannel),
      });

      ws.on("message", (raw) => {
        this._handleMessage(clientId, raw);
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(
          `[WS] Client disconnected: ${clientId} (total: ${this.clients.size})`
        );
      });

      ws.on("pong", () => {
        if (this.clients.has(clientId)) {
          this.clients.get(clientId).alive = true;
        }
      });

      ws.on("error", (err) => {
        console.error(`[WS] Client ${clientId} error:`, err.message);
      });
    });

    // Heartbeat every 30s
    this.heartbeatInterval = setInterval(() => this._heartbeat(), 30000);

    console.log("[WS] WebSocket manager initialized");
  }

  _handleMessage(clientId, raw) {
    const client = this.clients.get(clientId);
    if (!client) return;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this._send(client.ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    switch (msg.action) {
      case "subscribe":
        if (Array.isArray(msg.types)) {
          msg.types.forEach((t) => client.subscriptions.add(t));
          this._send(client.ws, {
            type: "subscribed",
            subscriptions: [...client.subscriptions],
          });
        }
        break;

      case "unsubscribe":
        if (Array.isArray(msg.types)) {
          msg.types.forEach((t) => client.subscriptions.delete(t));
        } else {
          client.subscriptions.clear();
        }
        this._send(client.ws, {
          type: "unsubscribed",
          subscriptions: [...client.subscriptions],
        });
        break;

      case "get_history":
        if (typeof this.onHistoryRequest === "function") {
          const count = msg.count || 100;
          const events = this.onHistoryRequest(count, msg.type);
          this._send(client.ws, {
            type: "history",
            events,
            count: events.length,
          });
        }
        break;

      case "set_viewport":
        if (msg.bbox && typeof msg.bbox === "object") {
          const oldViewport = client.viewport;
          client.viewport = {
            lamin: msg.bbox.lamin,
            lomin: msg.bbox.lomin,
            lamax: msg.bbox.lamax,
            lomax: msg.bbox.lomax,
          };
          this._updateClientTiles(clientId, oldViewport, client.viewport);
          this._send(client.ws, {
            type: "viewport_set",
            bbox: client.viewport,
          });
        }
        break;

      case "clear_viewport":
        this._updateClientTiles(clientId, client.viewport, null);
        client.viewport = null;
        this._send(client.ws, { type: "viewport_cleared" });
        break;

      case "ping":
        this._send(client.ws, { type: "pong", timestamp: new Date().toISOString() });
        break;

      default:
        this._send(client.ws, {
          type: "error",
          message: `Unknown action: ${msg.action}`,
        });
    }
  }

  broadcast(event) {
    for (const [, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Feature 5: Channel-based filtering
      if (!this._eventPassesChannel(event, client.channel)) continue;

      // If client has subscriptions, only send matching types
      if (
        client.subscriptions.size > 0 &&
        !client.subscriptions.has(event.type)
      ) {
        continue;
      }

      // Feature 2: Strip canary metadata from non-SOVEREIGN clients
      const cleanedEvent = this._cleanEventForChannel(event, client.channel);
      const payload = JSON.stringify({ type: "event", data: cleanedEvent });

      try {
        client.ws.send(payload);
      } catch (err) {
        console.error(`[WS] Send error to ${client.id}:`, err.message);
      }
    }
  }

  broadcastBatch(events) {
    if (events.length === 0) return;

    const now = Date.now();
    let totalClientChecks = 0;
    let totalDispatches = 0;

    // Use spatial partitioning to avoid O(N_clients) checks
    const tileEvents = new Map(); // "tileKey" -> [events]
    for (const event of events) {
      const tileKey = this._getTileKey(event.lat, event.lon);
      if (!tileEvents.has(tileKey)) tileEvents.set(tileKey, []);
      tileEvents.get(tileKey).push(event);
    }

    // Clients interested in specific tiles
    const targetClients = new Set();
    for (const tileKey of tileEvents.keys()) {
      const clientIds = this.tiles.get(tileKey);
      if (clientIds) {
        for (const cid of clientIds) targetClients.add(cid);
      }
    }

    // Also include clients with NO viewport (global view)
    for (const [cid, client] of this.clients) {
      if (!client.viewport) targetClients.add(cid);
    }

    for (const clientId of targetClients) {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) continue;

      totalClientChecks++;
      if (now - client.lastSendTime < 500) continue;

      // Filter events for THIS client
      let filtered = events;

      // 1. Spatial Partitioning Optimization
      if (client.viewport) {
        filtered = [];
        const v = client.viewport;
        // Only check events in tiles this client is subscribed to
        for (const [tileKey, evs] of tileEvents.entries()) {
          const [tLat, tLon] = tileKey.split("_").map(Number);
          // Simple overlap check for tile vs viewport
          if (tLat * this.TILE_SIZE + this.TILE_SIZE >= v.lamin &&
            tLat * this.TILE_SIZE <= v.lamax &&
            tLon * this.TILE_SIZE + this.TILE_SIZE >= v.lomin &&
            tLon * this.TILE_SIZE <= v.lomax) {

            // Refine with exact lat/lon
            for (const e of evs) {
              if (e.lat >= v.lamin && e.lat <= v.lamax && e.lon >= v.lomin && e.lon <= v.lomax) {
                filtered.push(e);
              }
            }
          }
        }
      }

      // 2. Type Filter
      if (client.subscriptions.size > 0 && filtered.length > 0) {
        filtered = filtered.filter((e) => client.subscriptions.has(e.type));
      }

      // 3. Feature 5: Channel-based classification filter
      if (filtered.length > 0) {
        filtered = filtered.filter((e) => this._eventPassesChannel(e, client.channel));
      }

      // 4. Feature 2: Clean canary metadata from non-SOVEREIGN clients
      if (client.channel !== CHANNELS.SOVEREIGN && filtered.length > 0) {
        filtered = filtered.map((e) => this._cleanEventForChannel(e, client.channel));
      }

      if (filtered.length === 0) continue;

      try {
        const payload = JSON.stringify({ type: "event_batch", data: filtered });

        // Distributed Tracing: Trace the first message's trace_id if present
        const primaryTraceId = filtered[0].trace_id || "gen-trace";

        client.ws.send(payload);
        client.lastSendTime = now;
        totalDispatches++;
        this.metrics.messagesSent++;
      } catch (err) {
        console.error(`[WS] Batch send error:`, err.message);
      }
    }

    // Update operational metrics
    const totalPossible = this.clients.size * events.length;
    this.metrics.fanoutEfficiency = totalPossible > 0 ? totalDispatches / this.clients.size : 1.0;
    this.metrics.spatialFilterHits += (this.clients.size - totalClientChecks);
  }

  _getTileKey(lat, lon) {
    const tLat = Math.floor(lat / this.TILE_SIZE);
    const tLon = Math.floor(lon / this.TILE_SIZE);
    return `${tLat}_${tLon}`;
  }

  _updateClientTiles(clientId, oldBbox, newBbox) {
    if (oldBbox) {
      const tiles = this._getTilesForBbox(oldBbox);
      for (const t of tiles) {
        const set = this.tiles.get(t);
        if (set) set.delete(clientId);
      }
    }
    if (newBbox) {
      const tiles = this._getTilesForBbox(newBbox);
      for (const t of tiles) {
        if (!this.tiles.has(t)) this.tiles.set(t, new Set());
        this.tiles.get(t).add(clientId);
      }
    }
  }

  _getTilesForBbox(v) {
    const tiles = [];
    const minLat = Math.floor(v.lamin / this.TILE_SIZE);
    const maxLat = Math.floor(v.lamax / this.TILE_SIZE);
    const minLon = Math.floor(v.lomin / this.TILE_SIZE);
    const maxLon = Math.floor(v.lomax / this.TILE_SIZE);

    for (let lt = minLat; lt <= maxLat; lt++) {
      for (let ln = minLon; ln <= maxLon; ln++) {
        tiles.push(`${lt}_${ln}`);
      }
    }
    return tiles;
  }

  broadcastInsight(insight) {
    const payload = JSON.stringify({ type: "insight", data: insight });
    for (const [, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      // Feature 5: Insights require CLASSIFIED or SOVEREIGN channel
      if (client.channel === CHANNELS.UNCLASSIFIED) continue;
      try {
        client.ws.send(payload);
      } catch (err) {
        console.error(`[WS] Insight send error:`, err.message);
      }
    }
  }

  sendTo(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      this._send(client.ws, message);
    }
  }

  _send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error("[WS] Send error:", err.message);
    }
  }

  _heartbeat() {
    for (const [clientId, client] of this.clients) {
      if (!client.alive) {
        console.log(`[WS] Terminating stale client: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
        continue;
      }
      client.alive = false;
      try {
        client.ws.ping();
      } catch {
        // client already dead
      }
    }
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      clients: [...this.clients.values()].map((c) => ({
        id: c.id,
        role: c.role,
        channel: c.channel,
        connectedAt: c.connectedAt,
        subscriptions: [...c.subscriptions],
        ip: c.ip,
      })),
    };
  }

  // ── Feature 5: Channel Segregation Helpers ──

  _eventPassesChannel(event, channel) {
    const eventType = event.type;
    const severity = event.severity || 0;

    // SOVEREIGN-only types (canary, governance, system_metric, break_glass_alert)
    if (SOVEREIGN_ONLY_TYPES.has(eventType)) {
      return channel === CHANNELS.SOVEREIGN;
    }

    // Insights and correlations require CLASSIFIED+
    if (eventType === "insight" || eventType === "correlation") {
      return channel !== CHANNELS.UNCLASSIFIED;
    }

    // Security events with severity 4-5 require CLASSIFIED+
    if (SECURITY_EVENT_TYPES.has(eventType) && severity >= 4) {
      return channel !== CHANNELS.UNCLASSIFIED;
    }

    // All other events pass through to all channels
    return true;
  }

  _cleanEventForChannel(event, channel) {
    if (channel === CHANNELS.SOVEREIGN) return event;

    // Strip canary metadata from non-SOVEREIGN clients
    if (event.metadata && (event.metadata._canary_id || event.metadata._canary_sig)) {
      const { _canary_id, _canary_sig, ...cleanMeta } = event.metadata;
      return { ...event, metadata: cleanMeta };
    }
    return event;
  }

  _getChannelPermissions(channel) {
    switch (channel) {
      case CHANNELS.SOVEREIGN:
        return ["events", "insights", "correlations", "canary", "governance", "system_metrics", "break_glass"];
      case CHANNELS.CLASSIFIED:
        return ["events", "insights", "correlations", "high_severity"];
      case CHANNELS.UNCLASSIFIED:
      default:
        return ["events"];
    }
  }

  elevateChannel(clientId, newChannel) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    const oldChannel = client.channel;
    client.channel = newChannel;
    console.log(`[WS] Channel elevated: ${clientId} ${oldChannel} -> ${newChannel}`);
    this._send(client.ws, {
      type: "channel_info",
      channel: newChannel,
      role: client.role,
      permissions: this._getChannelPermissions(newChannel),
      elevated: true,
    });
    return true;
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const [, client] of this.clients) {
      client.ws.close(1001, "Server shutting down");
    }
    if (this.wss) {
      this.wss.close();
    }
    console.log("[WS] WebSocket manager shut down");
  }

  _recordLatency(traceId) {
    if (!traceId || !traceId.startsWith("tr-")) return;
    try {
      const ts = parseInt(traceId.split("-")[1], 10);
      const lat = Date.now() - ts;
      if (isNaN(lat)) return;

      this.metrics.latencyBuffer.push(lat);
      if (this.metrics.latencyBuffer.length > 500) {
        this.metrics.latencyBuffer.shift();
      }

      // Statistical Recalculation (p95) every 50 samples
      if (this.metrics.latencyBuffer.length % 50 === 0) {
        const sorted = [...this.metrics.latencyBuffer].sort((a, b) => a - b);
        this.metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0;
      }
    } catch (e) {
      // Ignore malformed trace IDs
    }
  }
}

module.exports = WebSocketManager;
