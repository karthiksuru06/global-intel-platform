import { create } from "zustand";
import { useCallback, useEffect, useRef } from "react";

let worker = null;
let requestCounter = 0;
const pendingRequests = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../workers/mlWorker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event) => {
      const { type, requestId, ...data } = event.data;

      // Status updates
      if (type === "status") {
        useMLStore.getState().setStatus(data.message);
        return;
      }

      // Resolve pending requests
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        if (type === "error") {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data);
        }
      }
    });
  }
  return worker;
}

function sendRequest(type, payload) {
  return new Promise((resolve, reject) => {
    const requestId = `req_${++requestCounter}`;
    pendingRequests.set(requestId, { resolve, reject });
    getWorker().postMessage({ type, payload, requestId });

    // Timeout after 60s
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("ML inference timeout"));
      }
    }, 60000);
  });
}

// Zustand store for ML state
const useMLStore = create((set, get) => ({
  ready: false,
  loading: false,
  status: "Idle",
  lastResults: null,
  analysisCache: new Map(),

  setStatus: (status) => set({ status }),
  setReady: (ready) => set({ ready }),
  setLoading: (loading) => set({ loading }),
  setLastResults: (lastResults) => set({ lastResults }),

  analyzeSentiment: async (texts) => {
    set({ loading: true });
    try {
      const result = await sendRequest("sentiment", { texts });
      set({ loading: false, lastResults: result });
      return result.results;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  classifyThreat: async (text, labels) => {
    set({ loading: true });
    try {
      const result = await sendRequest("classify", { text, labels });
      set({ loading: false });
      return result.result;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  extractEntities: async (text) => {
    set({ loading: true });
    try {
      const result = await sendRequest("ner", { text });
      set({ loading: false });
      return result.entities;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  fullAnalysis: async (text) => {
    // Check cache
    const cache = get().analysisCache;
    const cacheKey = text.slice(0, 100);
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    set({ loading: true });
    try {
      const result = await sendRequest("batch_analyze", { text });
      const analysis = result.result;
      // Cache result
      const newCache = new Map(cache);
      newCache.set(cacheKey, analysis);
      // Limit cache size
      if (newCache.size > 100) {
        const firstKey = newCache.keys().next().value;
        newCache.delete(firstKey);
      }
      set({ loading: false, lastResults: analysis, analysisCache: newCache });
      return analysis;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  warmup: async () => {
    set({ loading: true, status: "Warming up models..." });
    try {
      await sendRequest("warmup", {});
      set({ ready: true, loading: false, status: "Models ready" });
    } catch (e) {
      set({ loading: false, status: "Warmup failed" });
    }
  },
}));

export default useMLStore;
