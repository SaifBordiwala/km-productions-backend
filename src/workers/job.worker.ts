import { jobService } from "../services/job.service";
import logger from "../utils/logger";

function getSimulationDelayMs(): number {
  const raw = process.env.JOB_SIMULATION_DELAY_MS ?? "5000";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
}

export async function processJob(jobId: string): Promise<void> {
  const delayMs = getSimulationDelayMs();

  const started = await jobService.startProcessing(jobId);
  if (!started) {
    // Another worker already progressed the job; still keep it idempotent.
    const job = await jobService.getJobById(jobId);
    if (job?.status === "COMPLETED") return;
    return;
  }

  try {
    logger.info("Job status progress", {
      jobId,
      phase: "simulation",
      status: "PROCESSING",
      message: `Still PROCESSING; simulating video generation (${delayMs}ms)…`,
    });

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), delayMs);
    });

    const resultUrl = `https://example.com/videos/${jobId}.mp4`;
    await jobService.completeJob(jobId, resultUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job processing failed";
    await jobService.failJob(jobId, message);
    logger.error("Job worker failed", {
      jobId,
      error: message,
    });
  }
}

