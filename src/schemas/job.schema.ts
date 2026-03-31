import { z } from "zod";

export const createJobInputSchema = z.object({
  imagePath: z.string().min(1),
});

export type CreateJobInput = z.infer<typeof createJobInputSchema>;

export const getJobParamsSchema = z.object({
  id: z.string().min(1),
});

