-- Adjust Task primary key to allow reusing LLM task ids across transcripts

-- Drop existing single-column primary key
ALTER TABLE "Task" DROP CONSTRAINT "Task_pkey";

-- Add composite primary key on (transcriptId, id)
ALTER TABLE "Task" ADD CONSTRAINT "Task_pkey" PRIMARY KEY ("transcriptId", "id");
