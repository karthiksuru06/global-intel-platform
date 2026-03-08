const express = require("express");
const router = express.Router();

let _deps = {};

function init(deps) {
  _deps = deps;
}

router.get("/health", (req, res) => {
  const { redisSubscriber, wsManager, startTime } = _deps;

  const redisStats = redisSubscriber ? redisSubscriber.getStats() : {};
  const wsStats = wsManager ? wsManager.getStats() : {};

  res.json({
    status: redisStats.connected ? "healthy" : "degraded",
    service: "api-gateway",
    uptime: Math.floor((Date.now() - (startTime || Date.now())) / 1000),
    timestamp: new Date().toISOString(),
    redis: {
      connected: redisStats.connected || false,
      eventsProcessed: redisStats.eventsProcessed || 0,
      stream: redisStats.stream,
    },
    websocket: {
      connectedClients: wsStats.connectedClients || 0,
    },
  });
});

module.exports = { router, init };
