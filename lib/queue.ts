// Upstash Redis Queue Abstraction
// Uses REST API for serverless compatibility
// Includes: deduplication, reliable fail(), stuck job recovery, distributed locks

import { MAX_RETRIES } from "@/lib/config";

interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  dedupId?: string;
  error?: string;
}

interface UpstashResponse {
  result?: unknown;
  error?: string;
}

export class UpstashQueue {
  private restUrl: string;
  private restToken: string;

  constructor() {
    this.restUrl = process.env.UPSTASH_REDIS_REST_URL!;
    this.restToken = process.env.UPSTASH_REDIS_REST_TOKEN!;

    if (!this.restUrl || !this.restToken) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
    }

    // Remove trailing slash from URL
    this.restUrl = this.restUrl.replace(/\/$/, "");
  }

  private async execute(command: string[]): Promise<UpstashResponse> {
    const response = await fetch(this.restUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.restToken}`,
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  private getQueueKey(queueName: string): string {
    return `queue:${queueName}`;
  }

  private getProcessingKey(queueName: string): string {
    return `queue:${queueName}:processing`;
  }

  private getDedupKey(queueName: string): string {
    return `queue:${queueName}:dedup`;
  }

  // ──────────────────────────────────────────
  // Enqueue with deduplication
  // ──────────────────────────────────────────

  async enqueue<T>(queueName: string, payload: T, maxAttempts: number = MAX_RETRIES): Promise<string | null> {
    // Extract a dedup key from the payload
    const dedupId = (payload as Record<string, unknown>).videoId as string
      || (payload as Record<string, unknown>).creatorId as string
      || "";

    if (dedupId) {
      const existing = await this.execute(["SISMEMBER", this.getDedupKey(queueName), dedupId]);
      if (existing.result === 1) {
        console.log(`[Queue] Skipping duplicate: ${dedupId} already in ${queueName}`);
        return null;
      }
      await this.execute(["SADD", this.getDedupKey(queueName), dedupId]);
    }

    const job: QueueJob<T> = {
      id: `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: queueName,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
      dedupId,
    };

    await this.execute(["RPUSH", this.getQueueKey(queueName), JSON.stringify(job)]);
    return job.id;
  }

  // ──────────────────────────────────────────
  // Check if a dedup ID is already queued
  // ──────────────────────────────────────────

  async isEnqueued(queueName: string, dedupId: string): Promise<boolean> {
    const result = await this.execute(["SISMEMBER", this.getDedupKey(queueName), dedupId]);
    return result.result === 1;
  }

  // ──────────────────────────────────────────
  // Dequeue (atomic move to processing list)
  // ──────────────────────────────────────────

  async dequeue(queueName: string, timeoutSeconds: number = 5): Promise<QueueJob | null> {
    const queueKey = this.getQueueKey(queueName);
    const processingKey = this.getProcessingKey(queueName);

    const response = await this.execute([
      "BRPOPLPUSH",
      queueKey,
      processingKey,
      timeoutSeconds.toString(),
    ]);

    if (!response.result) {
      return null;
    }

    try {
      const job = JSON.parse(response.result as string) as QueueJob;
      return job;
    } catch (error) {
      console.error("Failed to parse job:", error);
      return null;
    }
  }

  // ──────────────────────────────────────────
  // Complete: remove from processing + dedup
  // ──────────────────────────────────────────

  async complete(queueName: string, jobId: string): Promise<void> {
    const processingKey = this.getProcessingKey(queueName);

    const response = await this.execute(["LRANGE", processingKey, "0", "-1"]);

    if (response.result && Array.isArray(response.result)) {
      for (const item of response.result) {
        try {
          const job = JSON.parse(item as string);
          if (job.id === jobId) {
            await this.execute(["LREM", processingKey, "1", item as string]);
            // Remove from dedup set so the same item can be enqueued again in the future
            if (job.dedupId) {
              await this.execute(["SREM", this.getDedupKey(queueName), job.dedupId]);
            }
            break;
          }
        } catch (e) {
          // Skip invalid items
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // Fail: scan by jobId (not fragile JSON match)
  // ──────────────────────────────────────────

  async fail(queueName: string, job: QueueJob, error: string): Promise<void> {
    const processingKey = this.getProcessingKey(queueName);
    const queueKey = this.getQueueKey(queueName);

    // Remove from processing list by scanning for matching job ID
    const response = await this.execute(["LRANGE", processingKey, "0", "-1"]);
    if (response.result && Array.isArray(response.result)) {
      for (const item of response.result) {
        try {
          const parsed = JSON.parse(item as string);
          if (parsed.id === job.id) {
            await this.execute(["LREM", processingKey, "1", item as string]);
            break;
          }
        } catch (e) {
          // Skip invalid items
        }
      }
    }

    job.attempts += 1;
    job.error = error;

    if (job.attempts < job.maxAttempts) {
      console.log(`[Queue] Re-queuing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      // Re-queue for retry (dedup set entry stays so no new enqueue for same item)
      await this.execute(["RPUSH", queueKey, JSON.stringify(job)]);
    } else {
      console.error(`[Queue] Job ${job.id} failed after ${job.attempts} attempts:`, error);
      // Permanently failed — move to DLQ
      const dlqKey = `dlq:${queueName}`;
      await this.execute(["RPUSH", dlqKey, JSON.stringify(job)]);
      // Remove from dedup so it can be manually re-enqueued
      if (job.dedupId) {
        await this.execute(["SREM", this.getDedupKey(queueName), job.dedupId]);
      }
    }
  }

  // ──────────────────────────────────────────
  // Stuck job recovery
  // ──────────────────────────────────────────

  async recoverStuckJobs(queueName: string, maxAgeMs: number = 10 * 60 * 1000): Promise<number> {
    const processingKey = this.getProcessingKey(queueName);
    const queueKey = this.getQueueKey(queueName);
    const response = await this.execute(["LRANGE", processingKey, "0", "-1"]);

    let recovered = 0;
    if (response.result && Array.isArray(response.result)) {
      const now = Date.now();
      for (const item of response.result) {
        try {
          const job = JSON.parse(item as string) as QueueJob;
          if (now - job.createdAt > maxAgeMs) {
            await this.execute(["LREM", processingKey, "1", item as string]);
            job.attempts += 1;
            job.error = "Recovered from stuck state";

            if (job.attempts < job.maxAttempts) {
              await this.execute(["RPUSH", queueKey, JSON.stringify(job)]);
            } else {
              await this.execute(["RPUSH", `dlq:${queueName}`, JSON.stringify(job)]);
              if (job.dedupId) {
                await this.execute(["SREM", this.getDedupKey(queueName), job.dedupId]);
              }
            }
            recovered++;
          }
        } catch (e) {
          // Skip corrupt entries
        }
      }
    }
    return recovered;
  }

  // ──────────────────────────────────────────
  // Distributed lock (for ingest rate-limiting)
  // ──────────────────────────────────────────

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.execute(["SET", key, "1", "NX", "EX", ttlSeconds.toString()]);
    return result.result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.execute(["DEL", key]);
  }

  // ──────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────

  async getQueueLength(queueName: string): Promise<number> {
    const queueKey = this.getQueueKey(queueName);
    const response = await this.execute(["LLEN", queueKey]);
    return (response.result as number) || 0;
  }

  async getProcessingLength(queueName: string): Promise<number> {
    const processingKey = this.getProcessingKey(queueName);
    const response = await this.execute(["LLEN", processingKey]);
    return (response.result as number) || 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.execute(["PING"]);
      return response.result === "PONG";
    } catch (error) {
      console.error("Upstash health check failed:", error);
      return false;
    }
  }
}

// Singleton instance
let queueInstance: UpstashQueue | null = null;

export function getQueue(): UpstashQueue {
  if (!queueInstance) {
    queueInstance = new UpstashQueue();
  }
  return queueInstance;
}

// Queue names
export const QUEUE_NAMES = {
  INGEST_CREATOR: "ingest_creator",
  PROCESS_VIDEO: "process_video",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Job payloads
export interface IngestCreatorJob {
  creatorId: string;
  handle: string;
}

export interface ProcessVideoJob {
  videoId: string;
}
