// Upstash Redis Queue Abstraction
// Uses REST API for serverless compatibility

interface QueueJob<T = any> {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  error?: string;
}

interface UpstashResponse {
  result?: any;
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

  async enqueue<T>(queueName: string, payload: T, maxAttempts: number = 3): Promise<string> {
    const job: QueueJob<T> = {
      id: `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: queueName,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };

    const queueKey = this.getQueueKey(queueName);

    await this.execute(["RPUSH", queueKey, JSON.stringify(job)]);

    return job.id;
  }

  async dequeue(queueName: string, timeoutSeconds: number = 5): Promise<QueueJob | null> {
    const queueKey = this.getQueueKey(queueName);
    const processingKey = this.getProcessingKey(queueName);

    // Use BRPOPLPUSH for atomic move from queue to processing
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
      const job = JSON.parse(response.result) as QueueJob;
      return job;
    } catch (error) {
      console.error("Failed to parse job:", error);
      return null;
    }
  }

  async complete(queueName: string, jobId: string): Promise<void> {
    const processingKey = this.getProcessingKey(queueName);

    // Remove from processing list
    // We need to scan and remove the matching job
    const response = await this.execute(["LRANGE", processingKey, "0", "-1"]);

    if (response.result && Array.isArray(response.result)) {
      for (const item of response.result) {
        try {
          const job = JSON.parse(item);
          if (job.id === jobId) {
            await this.execute(["LREM", processingKey, "1", item]);
            break;
          }
        } catch (e) {
          // Skip invalid items
        }
      }
    }
  }

  async fail(queueName: string, job: QueueJob, error: string): Promise<void> {
    const processingKey = this.getProcessingKey(queueName);
    const queueKey = this.getQueueKey(queueName);

    job.attempts += 1;
    job.error = error;

    // Remove from processing
    await this.execute(["LREM", processingKey, "1", JSON.stringify({
      ...job,
      attempts: job.attempts - 1, // Match the old version
    })]);

    if (job.attempts < job.maxAttempts) {
      // Re-queue with exponential backoff
      const delayMs = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s
      console.log(`Re-queuing job ${job.id} after ${delayMs}ms (attempt ${job.attempts}/${job.maxAttempts})`);

      // For simplicity, just push back to queue immediately
      // In production, consider using Redis ZADD with timestamp for delayed jobs
      await this.execute(["RPUSH", queueKey, JSON.stringify(job)]);
    } else {
      console.error(`Job ${job.id} failed after ${job.attempts} attempts:`, error);
      // Job permanently failed - could store in a dead letter queue
      const dlqKey = `dlq:${queueName}`;
      await this.execute(["RPUSH", dlqKey, JSON.stringify(job)]);
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    const queueKey = this.getQueueKey(queueName);
    const response = await this.execute(["LLEN", queueKey]);
    return response.result || 0;
  }

  async getProcessingLength(queueName: string): Promise<number> {
    const processingKey = this.getProcessingKey(queueName);
    const response = await this.execute(["LLEN", processingKey]);
    return response.result || 0;
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

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job payloads
export interface IngestCreatorJob {
  creatorId: string;
  handle: string;
}

export interface ProcessVideoJob {
  videoId: string;
}
