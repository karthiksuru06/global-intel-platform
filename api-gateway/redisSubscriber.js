const Redis = require("ioredis");
const EventEmitter = require("events");

class RedisSubscriber extends EventEmitter {
  constructor(config) {
    super();
    this.redisUrl = config.redisUrl || "redis://127.0.0.1:6379";
    this.streamName = config.streamName || "geo_events";
    this.groupName = config.groupName || "gateway_group";
    this.consumerName = config.consumerName || "gateway_1";
    this.client = null;
    this.running = false;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.eventsProcessed = 0;

    // ── Resiliency (v2.9.7) ──
    this.reconnectCount = 0;
    this.lastReconnect = null;
    this.isReady = false;
  }

  async start() {
    await this._connect();
    await this._ensureConsumerGroup();
    await this._ensureInsightsGroup();
    this.running = true;
    this._readLoop();
    this._readInsightsLoop();
    console.log(
      `[RedisSubscriber] Started consuming stream "${this.streamName}" + intel_insights`
    );
  }

  async _connect() {
    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 30000);
        return delay;
      },
    });

    this.client.on("error", (err) => {
      console.error("[RedisSubscriber] Redis error:", err.message);
      this.isReady = false;
    });

    this.client.on("connect", () => {
      console.log("[RedisSubscriber] Connected to Redis");
      this.reconnectDelay = 1000;
      this.isReady = true;
    });

    this.client.on("reconnecting", () => {
      this.reconnectCount++;
      this.lastReconnect = new Date().toISOString();
      console.warn(`[RedisSubscriber] Reconnecting to Redis (Attempt ${this.reconnectCount})...`);
    });

    this.client.on("error", (err) => {
      console.error("[RedisSubscriber] Client Error:", err.message);
    });

    try {
      await this.client.ping();
    } catch (e) {
      console.warn("[RedisSubscriber] Initial Ping failed, client will retry transparently.");
    }
  }

  async _ensureConsumerGroup() {
    try {
      await this.client.xgroup(
        "CREATE",
        this.streamName,
        this.groupName,
        "0",
        "MKSTREAM"
      );
      console.log(
        `[RedisSubscriber] Created consumer group "${this.groupName}"`
      );
    } catch (err) {
      if (err.message && err.message.includes("BUSYGROUP")) {
        console.log(
          `[RedisSubscriber] Consumer group "${this.groupName}" already exists`
        );
      } else {
        console.warn(`[RedisSubscriber] Could not create group "${this.groupName}":`, err.message);
      }
    }
  }

  async _readLoop() {
    while (this.running) {
      try {
        const results = await this.client.xreadgroup(
          "GROUP",
          this.groupName,
          this.consumerName,
          "COUNT",
          50,
          "BLOCK",
          2000,
          "STREAMS",
          this.streamName,
          ">"
        );

        if (results) {
          for (const [stream, messages] of results) {
            for (const [msgId, fields] of messages) {
              try {
                const data = this._parseFields(fields);
                if (data) {
                  this.eventsProcessed++;
                  if (this.eventsProcessed % 50 === 1) {
                    console.log(
                      `[RedisSubscriber] Received event #${this.eventsProcessed} from Redis stream (type=${data.type}, id=${data.id?.slice(0, 8)})`
                    );
                  }
                  this.emit("event", data);
                  await this.client.xack(
                    this.streamName,
                    this.groupName,
                    msgId
                  );
                }
              } catch (parseErr) {
                console.error(
                  "[RedisSubscriber] Parse error:",
                  parseErr.message
                );
              }
            }
          }
        }
      } catch (err) {
        if (!this.running) break;
        console.error("[RedisSubscriber] Read error:", err.message);
        await this._sleep(this.reconnectDelay);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
      }
    }
  }

  async _ensureInsightsGroup() {
    try {
      await this.client.xgroup(
        "CREATE",
        "intel_insights",
        "gateway_insights_group",
        "0",
        "MKSTREAM"
      );
      console.log(`[RedisSubscriber] Created consumer group for intel_insights`);
    } catch (err) {
      if (err.message && err.message.includes("BUSYGROUP")) {
        console.log(`[RedisSubscriber] intel_insights group already exists`);
      } else {
        console.warn("[RedisSubscriber] intel_insights group creation warning:", err.message);
      }
    }
  }

  async _readInsightsLoop() {
    while (this.running) {
      try {
        const results = await this.client.xreadgroup(
          "GROUP",
          "gateway_insights_group",
          "gateway_insights_1",
          "COUNT",
          20,
          "BLOCK",
          5000,
          "STREAMS",
          "intel_insights",
          ">"
        );

        if (results) {
          for (const [stream, messages] of results) {
            for (const [msgId, fields] of messages) {
              try {
                const data = this._parseFields(fields);
                if (data) {
                  console.log(`[RedisSubscriber] Received insight: ${data.title || data.description?.slice(0, 50) || "unknown"}`);
                  this.emit("insight", data);
                  await this.client.xack("intel_insights", "gateway_insights_group", msgId);
                }
              } catch (parseErr) {
                console.error("[RedisSubscriber] Insight parse error:", parseErr.message);
              }
            }
          }
        }
      } catch (err) {
        if (!this.running) break;
        console.error("[RedisSubscriber] Insights read error:", err.message);
        await this._sleep(5000);
      }
    }
  }

  _parseFields(fields) {
    // fields is a flat array: [key1, val1, key2, val2, ...]
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    if (obj.data) {
      try {
        return JSON.parse(obj.data);
      } catch {
        return null;
      }
    }
    return null;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop() {
    this.running = false;
    if (this.client) {
      await this.client.quit();
    }
    console.log("[RedisSubscriber] Stopped");
  }

  getStats() {
    return {
      eventsProcessed: this.eventsProcessed,
      connected: this.client ? this.client.status === "ready" : false,
      stream: this.streamName,
      group: this.groupName,
    };
  }
}

module.exports = RedisSubscriber;
