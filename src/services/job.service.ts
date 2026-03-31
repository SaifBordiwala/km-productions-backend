import { randomUUID } from "crypto";

import logger from "../utils/logger";
import {
  hashTranscript,
  processTranscript,
  type TranscriptResult,
} from "./transcript.service";

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface TranscriptJob {
  id: string;
  hash: string;
  transcript: string;
  status: JobStatus;
  result?: TranscriptResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory stores for async jobs.
 * - jobStore: jobId -> job metadata
 * - hashToJobId: transcript hash -> jobId (enforces idempotency)
 */
const jobStore = new Map<string, TranscriptJob>();
const hashToJobId = new Map<string, string>();

function persist(job: TranscriptJob): void {
  job.updatedAt = new Date();
  jobStore.set(job.id, job);
}

async function runJob(jobId: string, transcript: string): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = "processing";
  persist(job);

  try {
    const result = await processTranscript(transcript);
    job.status = "done";
    job.result = result;
    delete job.error;
    logger.info?.("Job completed", { jobId, hash: job.hash });
  } catch (err) {
    job.status = "error";
    job.error =
      err instanceof Error ? err.message : "Unknown error during processing";
    logger.error?.("Job failed", { jobId, error: job.error });
  } finally {
    persist(job);
  }
}

/**
 * Enqueue a transcript for async processing. Idempotent by transcript hash:
 * - If a job already exists for the same transcript hash, return it.
 * - Otherwise, create a new pending job and start background processing.
 */
export function createTranscriptJob(transcript: string): TranscriptJob {
  const hash = hashTranscript(transcript);

  const existingJobId = hashToJobId.get(hash);
  if (existingJobId) {
    const existing = jobStore.get(existingJobId);
    if (existing) {
      return existing;
    }
  }

  const job: TranscriptJob = {
    id: randomUUID(),
    hash,
    transcript,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobStore.set(job.id, job);
  hashToJobId.set(hash, job.id);

  // Kick off async processing without blocking the HTTP request.
  queueMicrotask(() => runJob(job.id, transcript));

  return job;
}

export function getTranscriptJob(jobId: string): TranscriptJob | undefined {
  return jobStore.get(jobId);
}
