import { prisma } from "../lib/prisma";
import logger from "../utils/logger";
import type { CreateJobInput } from "../schemas/job.schema";

const JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export const jobService = {
  async createJob(input: CreateJobInput): Promise<string> {
    const job = await prisma.job.create({
      data: {
        imagePath: input.imagePath,
      },
      select: {
        id: true,
      },
    });

    logger.info("Job status progress", {
      jobId: job.id,
      phase: "created",
      status: JOB_STATUS.PENDING,
      message: "Job created; waiting for worker (PENDING)",
    });

    return job.id;
  },

  async getJobById(id: string) {
    return prisma.job.findUnique({
      where: { id },
    });
  },

  async startProcessing(jobId: string): Promise<boolean> {
    const result = await prisma.job.updateMany({
      where: {
        id: jobId,
        status: { in: [JOB_STATUS.PENDING, JOB_STATUS.FAILED] },
      },
      data: {
        status: JOB_STATUS.PROCESSING,
        error: null,
      },
    });

    if (result.count > 0) {
      logger.info("Job status progress", {
        jobId,
        phase: "processing_started",
        from: "PENDING|FAILED",
        to: JOB_STATUS.PROCESSING,
        message: "Status shifted to PROCESSING (video generation in progress)",
      });
    }

    return result.count > 0;
  },

  async completeJob(jobId: string, resultUrl: string): Promise<void> {
    const result = await prisma.job.updateMany({
      where: {
        id: jobId,
        status: JOB_STATUS.PROCESSING,
      },
      data: {
        status: JOB_STATUS.COMPLETED,
        resultUrl,
        error: null,
      },
    });

    if (result.count > 0) {
      logger.info("Job status progress", {
        jobId,
        phase: "completed",
        from: JOB_STATUS.PROCESSING,
        to: JOB_STATUS.COMPLETED,
        resultUrl,
        message: "Status shifted to COMPLETED",
      });
    }
  },

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const result = await prisma.job.updateMany({
      where: {
        id: jobId,
        status: { in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING, JOB_STATUS.FAILED] },
      },
      data: {
        status: JOB_STATUS.FAILED,
        error: errorMessage,
        resultUrl: null,
      },
    });

    if (result.count > 0) {
      logger.warn("Job status progress", {
        jobId,
        phase: "failed",
        to: JOB_STATUS.FAILED,
        error: errorMessage,
        message: "Status shifted to FAILED",
      });
    }
  },
};

