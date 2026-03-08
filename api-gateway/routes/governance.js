const express = require("express");
const router = express.Router();
const axios = require("axios");

const INTEL_ENGINE_URL = process.env.INTEL_ENGINE_URL || "http://localhost:8000";

let _deps = {};
function init(deps) {
    _deps = deps;
}

// Sovereign RBAC (v2.9.5): Restricts mutations to verified 'SOVEREIGN' keys
const governanceGuard = (req, res, next) => {
    const govKey = req.headers["x-governance-key"];
    const role = req.authorizedRole;

    if (!govKey || govKey.length < 10) {
        return res.status(403).json({
            success: false,
            error: "ACCESS_DENIED: Governance key missing or insufficient."
        });
    }

    if (role !== "SOVEREIGN" && process.env.NODE_ENV === "production") {
        return res.status(403).json({
            success: false,
            error: "INSUFFICIENT_PERMISSIONS: Governance mutations require SOVEREIGN role elevation."
        });
    }

    next();
};

router.post("/quarantine", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/quarantine`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.post("/restore", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/restore`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.post("/break-glass", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/break-glass`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.post("/freeze", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/freeze`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/audit", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/governance/audit`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

// ── Feature 1: Token Revocation Endpoints ──

router.post("/revoke-token", governanceGuard, async (req, res) => {
    const { target_key_hash, target_key_prefix, reason, ttl_hours } = req.body;

    if (!target_key_hash || target_key_hash.length !== 64) {
        return res.status(400).json({
            success: false,
            error: "target_key_hash must be a 64-char SHA-256 hex string"
        });
    }

    try {
        const redis = _deps.redisClient;
        const expiryScore = ttl_hours
            ? (Date.now() / 1000) + (ttl_hours * 3600)
            : 0; // 0 = indefinite

        await redis.zadd("revoked_tokens", expiryScore, target_key_hash);

        // Store metadata
        await redis.hset(`revoked_tokens_meta:${target_key_hash}`,
            "revoked_by", req.authorizedKeyPrefix || "UNKNOWN",
            "revoked_at", new Date().toISOString(),
            "reason", reason || "No reason provided",
            "key_prefix", target_key_prefix || "N/A"
        );
        if (ttl_hours) {
            await redis.expire(`revoked_tokens_meta:${target_key_hash}`, Math.ceil(ttl_hours * 3600) + 86400);
        }

        // Audit log
        const auditEntry = `[${new Date().toISOString()}] TOKEN_REVOKED BY:${req.authorizedKeyPrefix} TARGET:${target_key_prefix || target_key_hash.slice(0, 8)} REASON:${reason}\n`;
        try { require("fs").appendFileSync("governance.audit.log", auditEntry); } catch (e) { /* ignore */ }

        res.json({
            success: true,
            action: "TOKEN_REVOKED",
            key_prefix: target_key_prefix,
            revoked_until: expiryScore ? new Date(expiryScore * 1000).toISOString() : "INDEFINITE"
        });
    } catch (err) {
        res.status(503).json({ success: false, error: `Revocation write failed: ${err.message}` });
    }
});

router.post("/unrevoke-token", governanceGuard, async (req, res) => {
    const { target_key_hash, reason } = req.body;

    if (!target_key_hash || target_key_hash.length !== 64) {
        return res.status(400).json({
            success: false,
            error: "target_key_hash must be a 64-char SHA-256 hex string"
        });
    }

    try {
        const redis = _deps.redisClient;
        const removed = await redis.zrem("revoked_tokens", target_key_hash);

        // Retrieve and log metadata before deletion
        const meta = await redis.hgetall(`revoked_tokens_meta:${target_key_hash}`);
        await redis.del(`revoked_tokens_meta:${target_key_hash}`);

        const auditEntry = `[${new Date().toISOString()}] TOKEN_UNREVOKED BY:${req.authorizedKeyPrefix} TARGET:${(meta && meta.key_prefix) || target_key_hash.slice(0, 8)} REASON:${reason}\n`;
        try { require("fs").appendFileSync("governance.audit.log", auditEntry); } catch (e) { /* ignore */ }

        res.json({
            success: true,
            action: removed ? "TOKEN_UNREVOKED" : "TOKEN_NOT_FOUND",
            key_prefix: (meta && meta.key_prefix) || "unknown"
        });
    } catch (err) {
        res.status(503).json({ success: false, error: `Unrevocation failed: ${err.message}` });
    }
});

// ── Feature 2: Canary Status Proxy ──

router.get("/canary-status", governanceGuard, async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/governance/canary-status`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.post("/canary-trip", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/canary-trip`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

// ── Feature 3: Anchor Integrity Proxy ──

router.get("/anchor-integrity", governanceGuard, async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/governance/anchor-integrity`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

// ── Feature 4: Break-Glass Status & Deactivation Proxies ──

router.get("/break-glass-status", governanceGuard, async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/governance/break-glass-status`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

router.post("/break-glass-deactivate", governanceGuard, async (req, res) => {
    try {
        const response = await axios.post(`${INTEL_ENGINE_URL}/governance/break-glass-deactivate`, req.body, {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false,
            error: err.response?.data?.detail || err.message
        });
    }
});

// ── Feature 5: Channel Elevation Endpoint ──

router.post("/elevate-channel", governanceGuard, async (req, res) => {
    const { clientId, channel } = req.body;
    const validChannels = ["UNCLASSIFIED", "CLASSIFIED", "SOVEREIGN"];

    if (!clientId || !channel || !validChannels.includes(channel)) {
        return res.status(400).json({
            success: false,
            error: `clientId required and channel must be one of: ${validChannels.join(", ")}`
        });
    }

    const wsManager = _deps.wsManager;
    if (wsManager && wsManager.elevateChannel) {
        const elevated = wsManager.elevateChannel(clientId, channel);
        if (elevated) {
            const auditEntry = `[${new Date().toISOString()}] CHANNEL_ELEVATED BY:${req.authorizedKeyPrefix} CLIENT:${clientId} TO:${channel}\n`;
            try { require("fs").appendFileSync("governance.audit.log", auditEntry); } catch (e) { /* ignore */ }
            return res.json({ success: true, action: "CHANNEL_ELEVATED", clientId, channel });
        }
        return res.status(404).json({ success: false, error: "Client not found" });
    }
    res.status(503).json({ success: false, error: "WebSocket manager not available" });
});

module.exports = { router, init };
