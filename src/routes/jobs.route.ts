import { Router, Request, Response, NextFunction } from "express";

import { createTranscriptJob, getTranscriptJob } from "../services/job.service";

const router = Router();

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transcript } = req.body as { transcript: string };

      if (typeof transcript !== "string" || transcript.trim().length === 0) {
        res.status(400).json({ message: "Field 'transcript' is required." });
        return;
      }

      const job = createTranscriptJob(transcript);

      res.status(job.status === "done" ? 200 : 202).json(serializeJob(job));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:jobId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params as { jobId: string };

      if (!jobId) {
        res.status(400).json({ message: "Job ID is required." });
        return;
      }

      const job = getTranscriptJob(jobId);

      if (!job) {
        res.status(404).json({ message: "Job not found." });
        return;
      }

      res.status(200).json(serializeJob(job));
    } catch (err) {
      next(err);
    }
  }
);

function serializeJob(
  job: ReturnType<typeof getTranscriptJob>
): Record<string, unknown> {
  if (!job) return {};

  return {
    jobId: job.id,
    hash: job.hash,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result
      ? {
          hash: job.result.hash,
          createdAt: job.result.createdAt,
          tasks: job.result.tasks,
        }
      : undefined,
    error: job.error,
  };
}

export default router;
