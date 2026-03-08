const express = require("express");
const router = express.Router();

let _deps = {};

function init(deps) {
  _deps = deps;
}

// Parse relative time strings like "1h", "30m", "24h", "7d" into ISO timestamps
function parseSince(since) {
  if (!since) return null;
  const match = since.match(/^(\d+)([smhd])$/);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
    return new Date(Date.now() - val * ms).toISOString();
  }
  // Assume ISO string if not relative
  return since;
}

// GET /api/events - query cached events with filters
// Supports: ?type=aircraft&severity=2&since=1h&limit=100&bbox=lamin,lomin,lamax,lomax
router.get("/", (req, res) => {
  const { eventCache } = _deps;
  const { type, severity, since, limit = 200, bbox } = req.query;

  let events = eventCache ? eventCache.getAll() : [];

  if (type) {
    events = events.filter((e) => e.type === type);
  }
  if (severity) {
    const minSev = parseInt(severity, 10);
    events = events.filter((e) => (e.severity || 0) >= minSev);
  }
  if (since) {
    const sinceISO = parseSince(since);
    if (sinceISO) {
      events = events.filter((e) => e.timestamp >= sinceISO);
    }
  }
  if (bbox) {
    try {
      const [lamin, lomin, lamax, lomax] = bbox.split(",").map(Number);
      events = events.filter(
        (e) => e.lat >= lamin && e.lat <= lamax && e.lon >= lomin && e.lon <= lomax
      );
    } catch {
      // ignore invalid bbox
    }
  }

  const limitNum = Math.min(parseInt(limit, 10) || 200, 1000);
  events = events.slice(0, limitNum);

  res.json({ success: true, count: events.length, data: events });
});

// GET /api/events/bbox — PostGIS spatial query via intelligence engine
router.get("/bbox", async (req, res) => {
  const { lamin, lomin, lamax, lomax, type, limit } = req.query;
  if (!lamin || !lomin || !lamax || !lomax) {
    return res.status(400).json({
      success: false,
      error: "lamin, lomin, lamax, lomax are required",
    });
  }

  // First try from in-memory cache for speed
  const { eventCache } = _deps;
  const events = eventCache ? eventCache.getAll() : [];
  const la1 = Number(lamin), lo1 = Number(lomin);
  const la2 = Number(lamax), lo2 = Number(lomax);
  let filtered = events.filter(
    (e) => e.lat >= la1 && e.lat <= la2 && e.lon >= lo1 && e.lon <= lo2
  );
  if (type) {
    filtered = filtered.filter((e) => e.type === type);
  }
  const lim = Math.min(parseInt(limit, 10) || 500, 2000);
  filtered = filtered.slice(0, lim);

  res.json({ success: true, count: filtered.length, data: filtered });
});

// GET /api/events/stats
router.get("/stats", (req, res) => {
  const { eventCache } = _deps;
  const events = eventCache ? eventCache.getAll() : [];

  const typeCounts = {};
  let totalSeverity = 0;
  let severityCount = 0;

  for (const ev of events) {
    typeCounts[ev.type] = (typeCounts[ev.type] || 0) + 1;
    if (ev.severity) {
      totalSeverity += ev.severity;
      severityCount++;
    }
  }

  // Events per minute (based on last 60 seconds of data)
  const oneMinAgo = new Date(Date.now() - 60000).toISOString();
  const recentCount = events.filter((e) => e.timestamp >= oneMinAgo).length;

  res.json({
    success: true,
    data: {
      totalCached: events.length,
      byType: typeCounts,
      averageSeverity: severityCount > 0 ? (totalSeverity / severityCount).toFixed(2) : 0,
      eventsPerMinute: recentCount,
    },
  });
});

// GET /api/events/:id
router.get("/:id", (req, res) => {
  const { eventCache } = _deps;
  const event = eventCache ? eventCache.get(req.params.id) : null;

  if (!event) {
    return res
      .status(404)
      .json({ success: false, error: "Event not found" });
  }

  res.json({ success: true, data: event });
});

// POST /api/events - forward manual event to Redis
router.post("/", async (req, res) => {
  const { redisSubscriber } = _deps;

  try {
    const event = {
      id: require("uuid").v4(),
      type: req.body.type || "custom",
      lat: req.body.lat,
      lon: req.body.lon,
      altitude: req.body.altitude || null,
      severity: req.body.severity || 1,
      metadata: req.body.metadata || {},
      timestamp: new Date().toISOString(),
      source: req.body.source || "manual",
    };

    if (event.lat == null || event.lon == null) {
      return res
        .status(400)
        .json({ success: false, error: "lat and lon are required" });
    }

    // Add to local cache immediately
    const { eventCache } = _deps;
    if (eventCache) {
      eventCache.add(event);
    }

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    console.error("[Events] POST error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = { router, init };
