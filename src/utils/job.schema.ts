import { z } from "zod";

export const createJobSchema = z.object({
  imageUrl: z.string().url(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
