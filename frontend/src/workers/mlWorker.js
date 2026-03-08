/**
 * Browser-side ML Worker using Transformers.js
 * Runs NLP inference off the main thread for:
 *   - Sentiment analysis on news headlines
 *   - Zero-shot threat classification
 *   - Named entity recognition (NER)
 */

import { pipeline, env } from "@xenova/transformers";

// Configure Transformers.js for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let sentimentPipeline = null;
let nerPipeline = null;
let classificationPipeline = null;

const THREAT_LABELS = [
  "military conflict", "terrorism", "nuclear threat", "cyber attack",
  "political crisis", "economic crisis", "natural disaster",
  "humanitarian crisis", "diplomatic tension", "civil unrest",
];

async function getSentimentPipeline() {
  if (!sentimentPipeline) {
    self.postMessage({ type: "status", message: "Loading sentiment model..." });
    sentimentPipeline = await pipeline(
      "sentiment-analysis",
      "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
      { quantized: true }
    );
    self.postMessage({ type: "status", message: "Sentiment model ready" });
  }
  return sentimentPipeline;
}

async function getClassificationPipeline() {
  if (!classificationPipeline) {
    self.postMessage({ type: "status", message: "Loading classification model..." });
    classificationPipeline = await pipeline(
      "zero-shot-classification",
      "Xenova/mobilebert-uncased-mnli",
      { quantized: true }
    );
    self.postMessage({ type: "status", message: "Classification model ready" });
  }
  return classificationPipeline;
}

async function getNERPipeline() {
  if (!nerPipeline) {
    self.postMessage({ type: "status", message: "Loading NER model..." });
    nerPipeline = await pipeline(
      "token-classification",
      "Xenova/bert-base-NER",
      { quantized: true }
    );
    self.postMessage({ type: "status", message: "NER model ready" });
  }
  return nerPipeline;
}

// ── Message Handler ──
self.addEventListener("message", async (event) => {
  const { type, payload, requestId } = event.data;

  try {
    switch (type) {
      case "sentiment": {
        const pipe = await getSentimentPipeline();
        const texts = Array.isArray(payload.texts) ? payload.texts : [payload.texts];
        const results = await pipe(texts.slice(0, 20));
        self.postMessage({
          type: "sentiment_result",
          requestId,
          results: Array.isArray(results) ? results : [results],
        });
        break;
      }

      case "classify": {
        const pipe = await getClassificationPipeline();
        const text = payload.text || "";
        const labels = payload.labels || THREAT_LABELS;
        const result = await pipe(text, labels, { multi_label: true });
        self.postMessage({
          type: "classify_result",
          requestId,
          result: {
            text,
            labels: result.labels,
            scores: result.scores,
          },
        });
        break;
      }

      case "ner": {
        const pipe = await getNERPipeline();
        const text = payload.text || "";
        const entities = await pipe(text);
        // Group consecutive same-type entities
        const grouped = [];
        for (const ent of entities) {
          const prev = grouped[grouped.length - 1];
          if (prev && prev.entity_group === ent.entity_group && ent.index === prev.end_index + 1) {
            prev.word += ent.word.startsWith("##") ? ent.word.slice(2) : " " + ent.word;
            prev.end_index = ent.index;
            prev.score = Math.max(prev.score, ent.score);
          } else {
            grouped.push({
              word: ent.word,
              entity_group: ent.entity_group,
              score: ent.score,
              start_index: ent.index,
              end_index: ent.index,
            });
          }
        }
        self.postMessage({
          type: "ner_result",
          requestId,
          entities: grouped.filter((e) => e.score > 0.5),
        });
        break;
      }

      case "batch_analyze": {
        // Full analysis: sentiment + classification + NER
        const text = payload.text || "";
        const [sentPipe, classPipe, nerPipe2] = await Promise.all([
          getSentimentPipeline(),
          getClassificationPipeline(),
          getNERPipeline(),
        ]);

        const [sentResult, classResult, nerResult] = await Promise.all([
          sentPipe(text),
          classPipe(text, THREAT_LABELS, { multi_label: true }),
          nerPipe2(text),
        ]);

        const sentiment = Array.isArray(sentResult) ? sentResult[0] : sentResult;
        const entities = nerResult.filter((e) => e.score > 0.5);

        self.postMessage({
          type: "batch_result",
          requestId,
          result: {
            text,
            sentiment: { label: sentiment.label, score: sentiment.score },
            threat_classification: {
              top_label: classResult.labels[0],
              top_score: classResult.scores[0],
              labels: classResult.labels.slice(0, 5),
              scores: classResult.scores.slice(0, 5),
            },
            entities: entities.map((e) => ({
              word: e.word,
              type: e.entity_group,
              confidence: e.score,
            })),
          },
        });
        break;
      }

      case "warmup": {
        // Pre-load models
        await getSentimentPipeline();
        self.postMessage({ type: "warmup_complete", requestId });
        break;
      }

      default:
        self.postMessage({ type: "error", requestId, error: `Unknown type: ${type}` });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      error: error.message || "ML inference failed",
    });
  }
});
