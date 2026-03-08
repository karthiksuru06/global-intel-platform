require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(xss());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Load Forensic Library (Tier 1)
let forensicLibrary = {};
try {
  const libPath = path.join(__dirname, 'forensicLibrary.json');
  if (fs.existsSync(libPath)) {
    forensicLibrary = JSON.parse(fs.readFileSync(libPath, 'utf8'));
    console.log(`Forensic Library Loaded: ${Object.keys(forensicLibrary).length} entries.`);
  } else {
    console.warn("forensicLibrary.json not found.");
  }
} catch (err) {
  console.error("Failed to load forensicLibrary.json", err);
}

// Initialize Gemini Client (Tier 2 Fallback)
// Use a safe fallback for initialization to prevent crash if key is missing, handle in function
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "mock-key");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Generate AI Report using Gemini
 */
async function generateGeminiReport(attackCat, features) {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return {
      summary: "AI Analysis Unavailable (Missing API Key). Using heuristic fallbacks.",
      remediation: [
        "Isolate the source IP immediately.",
        "Capture traffic for manual PCAP analysis.",
        "Review recent firewall changes."
      ]
    };
  }

  try {
    const prompt = `
        You are a Lead Security Engineer. A network breach has been detected with category: "${attackCat}".
        
        Network Features:
        ${JSON.stringify(features, null, 2)}
        
        Provide a JSON response with exactly two fields:
        1. "summary": A 2-sentence technical explanation of why this is a threat.
        2. "remediation": An array of 3 specific technical remediation steps.
        
        Do not include markdown formatting, just raw JSON.
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    return {
      summary: `Automated analysis failed for ${attackCat}. Suspected anomaly based on heuristic features.`,
      remediation: ["Isolate affected host.", "Capture traffic for manual PCAP analysis.", "Review firewall logs."]
    };
  }
}

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok', librarySize: Object.keys(forensicLibrary).length }));

// Hybrid Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { attack_cat, features } = req.body;

    // Normalize input
    const category = attack_cat || "Generic";
    const isBreach = category !== "Normal" && category !== "Clear";

    if (!isBreach) {
      return res.json({
        isBreach: false,
        source: 'System',
        report: null
      });
    }

    // Tier 1: Local Library Lookup
    // Check for direct match or partial match (e.g. "Fuzzers" matching "Fuzzers-HTTP")
    let match = forensicLibrary[category];
    if (!match) {
      // Try finding base category (e.g. from "DoS-TCP" find "DoS")
      const baseCat = Object.keys(forensicLibrary).find(k => category.includes(k));
      if (baseCat) match = forensicLibrary[baseCat];
    }

    if (match) {
      return res.json({
        isBreach: true,
        source: 'Local Library',
        report: match
      });
    }

    // Tier 2: AI Fallback
    console.log(`Unknown category '${category}'. Engaging Gemini 1.5 Flash...`);
    const aiReport = await generateGeminiReport(category, features);

    res.json({
      isBreach: true,
      source: 'Gemini AI',
      report: aiReport
    });

  } catch (error) {
    console.log("Server Error", error);
    res.status(500).json({ error: "Analysis Failed" });
  }
});

app.listen(PORT, () => {
  console.log(`SentinelAI SOC Server running on port ${PORT}`);
});
