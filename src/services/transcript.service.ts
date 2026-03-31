import crypto from "crypto";

import { extractTasksFromTranscript, type MeetingTask } from "./llm.service";
import { aiTaskSchema, type AiTask } from "../utils/task.schema";
import { sanitizeTaskDependencies } from "../utils/sanitizeDependencies";
import { markCyclicTasks, type AiTaskWithStatus } from "../utils/detectCycles";
import logger from "../utils/logger";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TaskStatus, type Task } from "@prisma/client";

/**
 * Shape of a task returned by the end-to-end transcript pipeline.
 * Includes:
 * - core graph information (id, dependencies, priority)
 * - cycle status ("ok" | "error")
 * - human-readable description from the LLM
 */
export type ProcessedTask = AiTaskWithStatus & {
  description: string;
};

export interface TranscriptResult {
  hash: string;
  tasks: ProcessedTask[];
  transcript: string;
  createdAt: Date;
}

/**
 * In-process cache keyed by transcript hash.
 *
 * The source of truth is the Postgres database accessed via Prisma;
 * this map simply avoids repeated DB hits for very recent transcripts.
 */
const transcriptStore = new Map<string, TranscriptResult>();

// Single PrismaClient instance for the process (Prisma 7 requires adapter).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Compute a deterministic SHA-256 hash of the raw transcript text.
 */
export function hashTranscript(transcript: string): string {
  return crypto.createHash("sha256").update(transcript, "utf8").digest("hex");
}

/**
 * Convert raw LLM `MeetingTask` objects into validated `AiTask` objects
 * using the shared Zod schema.
 */
function validateTasksWithZod(rawTasks: MeetingTask[]): AiTask[] {
  return rawTasks.map((task, index) => {
    const candidate = {
      id: task.id,
      dependencies: task.dependencies ?? [],
      priority: task.priority,
    };

    const parsed = aiTaskSchema.parse(candidate);
    logger.debug?.("Validated AI task", { index, id: parsed.id });
    return parsed;
  });
}

/**
 * Join status information (from cycle detection) back with the original
 * LLM descriptions to build the final task graph.
 */
function mergeDescriptions(
  tasksWithStatus: AiTaskWithStatus[],
  rawTasks: MeetingTask[]
): ProcessedTask[] {
  const descriptionById = new Map<string, string>();

  for (const t of rawTasks) {
    descriptionById.set(t.id, t.description);
  }

  return tasksWithStatus.map((t) => ({
    ...t,
    description: descriptionById.get(t.id) ?? "",
  }));
}

/**
 * End-to-end processing of a meeting transcript into a task graph.
 *
 * Steps:
 * 1. Hash transcript (SHA-256)
 * 2. Check in-memory DB for existing transcript by hash
 * 3. If exists, return existing result
 * 4. Call LLM service to extract raw tasks
 * 5. Validate with Zod
 * 6. Sanitize dependencies
 * 7. Detect cycles and mark error tasks
 * 8. Persist transcript and tasks in Postgres via Prisma
 * 9. Cache in-memory
 * 10. Return final task graph
 */
export async function processTranscript(
  transcript: string
): Promise<TranscriptResult> {
  // 1. Hash transcript (SHA-256)
  const hash = hashTranscript(transcript);

  // 2. Check in-process cache for existing transcript by hash
  const existing = transcriptStore.get(hash);
  if (existing) {
    logger.info?.("Transcript cache hit", { hash });
    return existing;
  }

  // 3. Check persistent database for existing transcript by hash
  const dbExisting = await prisma.transcript.findUnique({
    where: { hash },
    include: { tasks: true },
  });

  if (dbExisting) {
    logger.info?.("Transcript found in database", { hash });

    const mapped: TranscriptResult = {
      hash: dbExisting.hash,
      transcript: dbExisting.content,
      createdAt: dbExisting.createdAt,
      tasks: dbExisting.tasks.map((task: Task) => ({
        id: task.id,
        // Dependencies are stored as JSON (string[])
        dependencies: (task.dependencies as string[]) ?? [],
        priority: task.priority,
        description: task.description,
        // Map DB status back to the in-memory status union.
        status: task.status === TaskStatus.error ? "error" : "ok",
      })),
    };

    transcriptStore.set(hash, mapped);
    return mapped;
  }

  logger.info?.("Processing new transcript", { hash });

  // 4. Call LLM service
  const rawTasks: MeetingTask[] = await extractTasksFromTranscript(transcript);

  // 5. Validate with Zod (shape-only validation; description is kept separately)
  const validatedTasks: AiTask[] = validateTasksWithZod(rawTasks);

  // 6. Sanitize dependencies (remove references to non-existent task ids)
  const sanitizedForGraph = sanitizeTaskDependencies(
    validatedTasks.map((t) => ({
      id: t.id,
      dependencies: t.dependencies ?? [],
    }))
  );

  const sanitizedTasks: AiTask[] = validatedTasks.map((task) => {
    const sanitized = sanitizedForGraph.find((t) => t.id === task.id);
    return {
      ...task,
      dependencies: sanitized?.dependencies ?? task.dependencies ?? [],
    };
  });

  // 7. Detect cycles and mark error tasks
  const tasksWithStatus: AiTaskWithStatus[] = markCyclicTasks(sanitizedTasks);

  // Re-attach descriptions from the original LLM output
  const finalTasks: ProcessedTask[] = mergeDescriptions(
    tasksWithStatus,
    rawTasks
  );

  // 8. Persist transcript and tasks in the database
  const dbCreated = await prisma.transcript.create({
    data: {
      content: transcript,
      hash,
      tasks: {
        create: finalTasks.map((task) => ({
          // Use LLM-generated id as the task id so it stays stable
          id: task.id,
          description: task.description,
          priority: task.priority,
          // Store dependencies as JSON string[] in Postgres
          dependencies: task.dependencies,
          // Map "ok" | "error" to TaskStatus enum.
          status: task.status === "error" ? TaskStatus.error : TaskStatus.ready,
        })),
      },
    },
    include: { tasks: true },
  });

  const result: TranscriptResult = {
    hash: dbCreated.hash,
    transcript: dbCreated.content,
    createdAt: dbCreated.createdAt,
    tasks: dbCreated.tasks.map((task: Task) => ({
      id: task.id,
      dependencies: (task.dependencies as string[]) ?? [],
      priority: task.priority,
      description: task.description,
      status: task.status === TaskStatus.error ? "error" : "ok",
    })),
  };

  // 9. Cache in-memory for fast subsequent access
  transcriptStore.set(hash, result);

  // 10. Return final task graph
  return result;
}
