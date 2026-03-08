const express = require("express");
const router = express.Router();
const axios = require("axios");

const INTEL_ENGINE_URL = process.env.INTEL_ENGINE_URL || "http://localhost:8000";

// ── News Feed Aggregation ──

router.get("/news", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/news`, { params: req.query });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/news/breaking", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/news/breaking`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/news/search", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/news/search`, { params: req.query });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

// ── Country Instability Index (CII) ──

router.get("/cii", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/cii`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/cii/top", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/cii/top`, { params: req.query });
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

// ── Finance & Market Data ──

router.get("/finance/crypto", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/finance/crypto`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/finance/fear-greed", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/finance/fear-greed`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

router.get("/finance/overview", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/finance/overview`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

// ── Generic proxy helper ──
function proxyGet(path) {
    router.get(path, async (req, res) => {
        try {
            const response = await axios.get(`${INTEL_ENGINE_URL}${path}`, { params: req.query, timeout: 20000 });
            res.json(response.data);
        } catch (err) {
            res.status(err.response?.status || 500).json({
                success: false, error: err.response?.data?.detail || err.message
            });
        }
    });
}

// ── Telegram OSINT ──
proxyGet("/telegram");
proxyGet("/telegram/critical");
proxyGet("/telegram/search");

// ── OREF Rocket Alerts ──
proxyGet("/oref/alerts");
proxyGet("/oref/history");
proxyGet("/oref/zones");

// ── GNSS Jamming ──
proxyGet("/gnss/jamming");
router.get("/gnss/jamming/region/:region", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/gnss/jamming/region/${req.params.region}`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

// ── Travel Advisories ──
proxyGet("/travel-advisories");
proxyGet("/travel-advisories/high-risk");
router.get("/travel-advisories/:country_code", async (req, res) => {
    try {
        const response = await axios.get(`${INTEL_ENGINE_URL}/travel-advisories/${req.params.country_code}`);
        res.json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            success: false, error: err.response?.data?.detail || err.message
        });
    }
});

// ── ACLED/GDELT Conflicts ──
proxyGet("/conflicts");
proxyGet("/conflicts/protests");
proxyGet("/conflicts/hotspots");

// ── Infrastructure & Undersea Cables ──
proxyGet("/infrastructure/cables");
proxyGet("/infrastructure/outages");
proxyGet("/infrastructure/overview");

// ── Polymarket Predictions ──
proxyGet("/predictions");
proxyGet("/predictions/conflicts");
proxyGet("/predictions/elections");

// ── Fleet Intelligence ──
proxyGet("/fleet");
proxyGet("/fleet/carriers");
proxyGet("/fleet/deployed");

// ── Airport Status ──
proxyGet("/airports");
proxyGet("/airports/delays");
proxyGet("/airports/airspace");

module.exports = { router };
