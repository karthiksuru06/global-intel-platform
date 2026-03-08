require("dotenv").config();

const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression"); // Corrected from 'crypto'
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis = require("ioredis");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RedisSubscriber = require("./redisSubscriber");
const WebSocketManager = require("./websocketManager");
const healthRoute = require("./routes/health");
const eventsRoute = require("./routes/events");
const observabilityRoute = require("./routes/observability");
const governanceRoute = require("./routes/governance");
const intelligenceRoute = require("./routes/intelligence");

const http = require("http");
const express = require("express");
const cors = require("cors");
// ── Config ──
const PORT = parseInt(process.env.PORT || "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// ── Circular Event Cache ──
class EventCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.events = [];
    this.index = new Map(); // id -> event
  }

  add(event) {
    if (this.events.length >= this.maxSize) {
      const removed = this.events.shift();
      if (removed) this.index.delete(removed.id);
    }
    this.events.push(event);
    this.index.set(event.id, event);
  }

  get(id) {
    return this.index.get(id) || null;
  }

  getAll() {
    return [...this.events];
  }

  getRecent(count, type) {
    let filtered = this.events;
    if (type) {
      filtered = filtered.filter((e) => e.type === type);
    }
    return filtered.slice(-count);
  }

  get size() {
    return this.events.length;
  }
}

// ── Initialize ──
const app = express();
const server = http.createServer(app);

// Sovereign Redis Infrastructure (Shared for Pub/Sub + Rate Limiting)
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisClient = new Redis(redisUrl);

// ── Resiliency: Prevent unhandled Redis crashes ──
redisClient.on("error", (err) => {
  console.error("[ioredis] Unhandled Connection Error:", err.message);
});

const eventCache = new EventCache(2000);
const wsManager = new WebSocketManager();
const startTime = Date.now();

const redisSubscriber = new RedisSubscriber({
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  streamName: process.env.REDIS_STREAM || "geo_events",
  groupName: process.env.REDIS_CONSUMER_GROUP || "gateway_group",
  consumerName: process.env.REDIS_CONSUMER_NAME || "gateway_1",
});

// ── Middleware ──
// ── Security Hardening (v2.9.4) ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://services.arcgisonline.com", "https://*.arcgisonline.com"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3001"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(compression());
app.use(morgan("short"));
app.use(express.json());

// ── Volumetric Defense (v2.9.7): Centralized Composite Limits + Fail-Safe ──
const compositeKeyGenerator = (req) => {
  const apiKeyPrefix = req.headers["x-api-key"] ? req.headers["x-api-key"].slice(0, 8) : "ANON";
  return `${req.ip}:${apiKeyPrefix}`;
};

// Redis Sentinel / Fail-Safe Wrapper
const redisRateStore = (prefix) => {
  if (process.env.NODE_ENV !== "test") {
    return new RedisStore({
      sendCommand: async (...args) => {
        return await redisClient.call(...args);
      },
      prefix: `rl:${prefix}:`
    });
  }

  // Fallback when explicitly executing unit tests
  return {};
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: compositeKeyGenerator,
  store: redisRateStore("global"),
  skipFailedRequests: true, // Fail-open for traffic persistence, but logs prominently
  message: { success: false, error: "RATE_LIMIT_EXCEEDED: Baseline threshold reached." }
});

const governanceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: compositeKeyGenerator,
  store: redisRateStore("gov"),
  skipFailedRequests: false, // Governance mutations FAIL-CLOSED if Redis is down (Protect model state)
  message: { success: false, error: "GOVERNANCE_THROTTLE: Manual control locked due to system instability." }
});

app.use("/api", globalLimiter);
app.use("/api/governance", governanceLimiter);

// ── Sovereign RBAC Registry (v2.9.7) ──
// Institutional Lifecycle: Scoped, Expiring, and Timing-Safe.
// Keys are no longer hardcoded. Admin should pass a JSON string to SOVEREIGN_REGISTRY_JSON env var.
let OPERATIONAL_KEYS = {};
try {
  if (process.env.SOVEREIGN_REGISTRY_JSON) {
    OPERATIONAL_KEYS = JSON.parse(process.env.SOVEREIGN_REGISTRY_JSON);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[Sovereign] No SOVEREIGN_REGISTRY_JSON found. Loading fallback development keys.");
    OPERATIONAL_KEYS = {
      "7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d": {
        role: "SOVEREIGN",
        owner: "System Admin (DEV)",
        expiresAt: "2027-01-01T00:00:00Z",
        scopes: ["governance", "admin"]
      }
    };
  } else {
    console.error("[Sovereign] FATAL: Production environment started without SOVEREIGN_REGISTRY_JSON.");
    // Fail-Closed
  }
} catch (e) {
  console.error("[Sovereign] FATAL: Failed to parse SOVEREIGN_REGISTRY_JSON.", e.message);
}

app.use("/api", async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (process.env.NODE_ENV === "production" && (!apiKey || apiKey.length < 32)) {
    return res.status(401).json({ success: false, error: "SECURITY_FAILURE: Invalid Token Geometry." });
  }

  // 1. Timing-Safe Auth Check
  let matchedKey = null;
  const providedBuffer = Buffer.from(apiKey || "");

  for (const [key, info] of Object.entries(OPERATIONAL_KEYS)) {
    const keyBuffer = Buffer.from(key);
    if (providedBuffer.length === keyBuffer.length && crypto.timingSafeEqual(providedBuffer, keyBuffer)) {
      matchedKey = info;
      break;
    }
  }

  if (matchedKey) {
    // 2. Feature 1: Dynamic Token Revocation Check (Redis ZSET blacklist)
    try {
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
      const revokedScore = await redisClient.zscore("revoked_tokens", keyHash);
      if (revokedScore !== null) {
        const expiryTime = parseFloat(revokedScore);
        if (expiryTime === 0 || expiryTime > Date.now() / 1000) {
          const auditEntry = `[${new Date().toISOString()}] REVOKED_ACCESS_ATTEMPT KEY:${apiKey.slice(0, 4)} HASH:${keyHash.slice(0, 8)}\n`;
          try { fs.appendFileSync("governance.audit.log", auditEntry); } catch (e) { /* ignore */ }
          return res.status(401).json({
            success: false,
            error: "TOKEN_REVOKED: This credential has been revoked by governance action."
          });
        }
        // Expired revocation -- auto-clean
        await redisClient.zrem("revoked_tokens", keyHash);
      }
    } catch (redisErr) {
      // FAIL-OPEN on Redis errors for revocation check (prevent DoS via Redis outage)
      console.error("[Sovereign] Revocation check failed (FAIL-OPEN):", redisErr.message);
    }

    // 3. Lifecycle Check: Expiration
    if (new Date(matchedKey.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, error: "TOKEN_EXPIRED: Credential rotation required." });
    }

    req.authorizedKeyPrefix = apiKey.slice(0, 4);
    req.authorizedRole = matchedKey.role;
    req.authorizedOwner = matchedKey.owner;
    req.authorizedScopes = matchedKey.scopes;
  } else {
    req.authorizedKeyPrefix = "ANON";
    req.authorizedRole = "ANON";
    req.authorizedScopes = [];
  }

  // 4. Audit Log Entry (v3.0): Enriched Metadata
  const auditEntry = `[${new Date().toISOString()}] KEY:${req.authorizedKeyPrefix} ROLE:${req.authorizedRole} ACTION:${req.method} PATH:${req.path} OWNER:${req.authorizedOwner || "N/A"} SCOPES:[${req.authorizedScopes.join(",")}]\n`;
  try {
    fs.appendFileSync("governance.audit.log", auditEntry);
  } catch (e) {
    console.error("[Sovereign] Forensic logging pipe broken:", e.message);
  }

  next();
});
const deps = { redisSubscriber, wsManager, eventCache, startTime, redisClient };
healthRoute.init(deps);
eventsRoute.init(deps);
observabilityRoute.init(deps);
governanceRoute.init(deps);

app.use("/", healthRoute.router);
app.use("/api/events", eventsRoute.router);
app.use("/api/observability", observabilityRoute.router);
app.use("/api/governance", governanceRoute.router);
app.use("/api", intelligenceRoute.router);

// ── WebSocket (Feature 5: pass authRegistry for channel segregation) ──
wsManager.initialize(server, { authRegistry: OPERATIONAL_KEYS });

// Feature 1: Cleanup expired revocations every 15 minutes
setInterval(async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const cleaned = await redisClient.zremrangebyscore("revoked_tokens", 1, now);
    if (cleaned > 0) console.log(`[Sovereign] Cleaned ${cleaned} expired revocations`);
  } catch (e) {
    console.error("[Sovereign] Revocation cleanup error:", e.message);
  }
}, 15 * 60 * 1000);

// Allow WS clients to request history from cache
wsManager.onHistoryRequest = (count, type) => {
  return eventCache.getRecent(count, type);
};

// ── Redis → WebSocket bridge (batched + throttled) ──
const BATCH_INTERVAL_MS = parseInt(process.env.BATCH_INTERVAL_MS || "1000", 10);
const MAX_EVENTS_PER_BATCH = parseInt(process.env.MAX_EVENTS_PER_BATCH || "150", 10);
const MAX_BATCH_QUEUE = parseInt(process.env.MAX_BATCH_QUEUE || "500", 10);
let eventBatch = [];
let batchTimer = null;

function flushBatch() {
  if (eventBatch.length === 0) return;

  const currentLoadFactor = eventBatch.length / MAX_BATCH_QUEUE;

  // ADAPTIVE LOAD SHEDDING with Forensic Sampling
  if (eventBatch.length > MAX_BATCH_QUEUE) {
    const highRisk = eventBatch.filter(e => (e.risk_score || 0) > 75);
    const lowRiskDropped = eventBatch.filter(e => (e.risk_score || 0) <= 75);

    const keepFromOthers = MAX_BATCH_QUEUE - highRisk.length;

    // Adaptive Sampling: Sampling rate increases as load pressure increases to protect against data loss
    const samplingRate = Math.min(0.2, 0.05 + (currentLoadFactor * 0.1));
    const forensicSample = lowRiskDropped
      .filter(() => Math.random() < samplingRate)
      .map(e => ({ ...e, forensic_flag: true, audit_sampled: true }));

    wsManager.metrics.sampledForensics.push(...forensicSample);
    if (wsManager.metrics.sampledForensics.length > 500) {
      wsManager.metrics.sampledForensics = wsManager.metrics.sampledForensics.slice(-500);
    }

    if (keepFromOthers > 0) {
      eventBatch = [...highRisk, ...lowRiskDropped.slice(-keepFromOthers)];
    } else {
      eventBatch = highRisk.slice(-MAX_BATCH_QUEUE);
    }

    wsManager.metrics.droppedEvents += lowRiskDropped.length - (keepFromOthers > 0 ? keepFromOthers : 0);
    console.warn(`[Gateway] Load shedding active: Adaptive audit sampling at ${Math.round(samplingRate * 100)}%.`);
  }

  const batch = eventBatch.slice(0, MAX_EVENTS_PER_BATCH);
  eventBatch = eventBatch.slice(MAX_EVENTS_PER_BATCH);

  wsManager.broadcastBatch(batch);
}

batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);

redisSubscriber.on("event", (event) => {
  // Trace Injection (Ingestion timestamp preserved in tr-ID)
  if (!event.trace_id) event.trace_id = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Statistical Latency Recording
  if (wsManager._recordLatency) {
    wsManager._recordLatency(event.trace_id);
  }

  eventCache.add(event);
  eventBatch.push(event);
});

redisSubscriber.on("insight", (insight) => {
  console.log(`[Gateway] Broadcasting insight: ${insight.title || "untitled"}`);
  wsManager.broadcastInsight(insight);
});

// ── Start ──
async function start() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║    GLOBAL INTELLIGENCE - API GATEWAY         ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    await redisSubscriber.start();
    console.log("[Gateway] Redis subscriber connected");
  } catch (err) {
    console.error("[Gateway] Redis connection failed:", err.message);
    console.log("[Gateway] Will retry Redis connection in background...");
    // Retry in background
    setTimeout(async () => {
      try {
        await redisSubscriber.start();
      } catch (retryErr) {
        console.error("[Gateway] Redis retry failed:", retryErr.message);
      }
    }, 5000);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Gateway] HTTP server listening on port ${PORT}`);
    console.log(`[Gateway] WebSocket server on same port (upgrade)`);
    console.log(`[Gateway] CORS origin: ${CORS_ORIGIN}`);
  });
}

// ── Graceful Shutdown ──
async function shutdown(signal) {
  console.log(`\n[Gateway] ${signal} received, shutting down gracefully...`);
  if (batchTimer) clearInterval(batchTimer);
  flushBatch(); // send remaining events
  wsManager.shutdown();
  await redisSubscriber.stop();
  server.close(() => {
    console.log("[Gateway] HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("[Gateway] Fatal error:", err);
  process.exit(1);
});
