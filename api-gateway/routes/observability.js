const express = require("express");
const router = express.Router();

let redisSubscriber = null;
let wsManager = null;
let startTime = Date.now();

function init(deps) {
    redisSubscriber = deps.redisSubscriber;
    wsManager = deps.wsManager;
    startTime = deps.startTime;
}

router.get("/metrics", (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    const wsMetrics = wsManager ? wsManager.metrics : {};
    const redisMetrics = redisSubscriber ? redisSubscriber.getStats() : {};

    const metrics = {
        system: {
            uptime_seconds: uptime,
            memory_usage: process.memoryUsage(),
            node_version: process.version,
        },
        websocket: {
            connected_clients: wsManager ? wsManager.clients.size : 0,
            total_messages_sent: wsMetrics.messagesSent || 0,
            fanout_efficiency: wsMetrics.fanoutEfficiency || 0,
            spatial_partition_hits: wsMetrics.spatialFilterHits || 0,
            active_tiles: wsManager ? wsManager.tiles.size : 0,
        },
        redis: {
            connected: redisMetrics.connected,
            events_processed: redisMetrics.eventsProcessed,
        },
        intelligence: {
            trace_p95_ms: wsMetrics.p95Latency || 0,
            forensic_buffer_size: wsMetrics.sampledForensics.length,
            adaptive_sampling_rate: Math.min(0.2, 0.05 + ((wsManager ? wsManager.metrics.droppedEvents : 0) / 1000 * 0.1))
        }
    };

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics
    });
});

module.exports = { router, init };
