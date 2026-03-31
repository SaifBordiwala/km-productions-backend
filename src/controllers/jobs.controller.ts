import type { Request, Response } from "express";
import path from "path";
import {
  createJobInputSchema,
  getJobParamsSchema,
} from "../schemas/job.schema";
import { HttpError } from "../lib/httpErrors";
import { jobService } from "../services/job.service";
import { processJob } from "../workers/job.worker";

type RequestWithImageFile = Request & { file?: Express.Multer.File };

export async function createJob(req: Request, res: Response): Promise<void> {
  const requestWithFile = req as RequestWithImageFile;
  const file = requestWithFile.file;

  if (!file) {
    throw new HttpError(400, "Image file is required");
  }

  const imagePath = path.posix.join("uploads", file.filename);
  const input = createJobInputSchema.parse({ imagePath });

  const jobId = await jobService.createJob(input);

  // Fire-and-forget async processing (non-blocking).
  void processJob(jobId);

  res.status(201).json({ jobId });
}

export async function getJobById(req: Request, res: Response): Promise<void> {
  const { id } = getJobParamsSchema.parse(req.params);

  const job = await jobService.getJobById(id);
  if (!job) {
    throw new HttpError(404, "Job not found");
  }

  res.json({
    id: job.id,
    status: job.status,
    resultUrl: job.resultUrl,
    error: job.error,
  });
}
