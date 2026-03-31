# InsightBoard Dependency Engine – Backend

Backend implementation for the InsightBoard **"Dependency Engine"** take‑home assignment.  
It converts raw meeting transcripts into a validated dependency graph of tasks, detects cycles, and persists results in PostgreSQL.

---

## Assignment Levels

- **Level 1 – Robust Backend**: ✅ Completed  
  - Strict output schema (`id`, `description`, `priority`, `dependencies[]`)
  - Validation and sanitization of dependencies
  - Cycle detection and non‑crashing error handling
  - Data persistence in PostgreSQL via Prisma
- **Level 2 – Async & Idempotency**: ✅ Completed  
  - Idempotent processing for identical transcripts (no repeated LLM calls) ✅  
  - Async job / polling API pattern (jobId + status endpoint) ✅
- **Level 3 – Visualization & UI**: ❌ Not implemented in this repo (backend only)

---

## Tech Stack

- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (via Prisma ORM)
- **LLM Provider**: Groq (OpenAI‑compatible API)
  - `LLM_MODEL`: `llama-3.3-70b-versatile`
  - `LLM_API_URL`: `https://api.groq.com/openai/v1/chat/completions`
- **Other**:
  - Validation: Zod
  - Logging: Winston

---

## High‑Level Architecture

1. **Input**: Client sends a raw meeting transcript to `POST /transcripts`.
2. **Idempotency**:
   - Compute a **SHA‑256 hash** of the transcript.
   - Check a small in‑memory cache by `hash`.
   - If not cached, check PostgreSQL for an existing `Transcript` row by `hash`.
3. **LLM Extraction** (for new transcripts only):
   - Call the LLM with a strict system prompt to return **JSON only**:
     - Array of tasks with `id`, `description`, `priority`, `dependencies[]`.
4. **Validation & Sanitization**:
   - Validate each task using **Zod**:
     - `id: string`
     - `priority: "low" | "medium" | "high"`
     - `dependencies: string[]`
   - Sanitize dependencies:
     - Remove any dependency IDs that do **not** correspond to a known task ID.
5. **Cycle Detection**:
   - Build a directed graph (task ID → dependency IDs).
   - Run a DFS‑based cycle detection algorithm.
   - Mark tasks in cycles with `status: "error"`; others as `"ok"`.
6. **Persistence**:
   - Store the original transcript and its tasks in PostgreSQL.
   - Cache the resulting `TranscriptResult` in memory keyed by `hash` for fast re‑reads.
7. **Output**:
   - Return a structured dependency graph of tasks, including their cycle status.

---

## API

### `POST /transcripts`

**Request body:**

```json
{
  "transcript": "Full meeting transcript text here..."
}
```

- `transcript` (string, required): raw meeting transcript.

**Response (200 OK):**

```json
{
  "hash": "6a9f... (sha256 of transcript)",
  "createdAt": "2025-02-04T13:25:42.000Z",
  "tasks": [
    {
      "id": "task-1",
      "description": "Set up CI pipeline",
      "priority": "high",
      "dependencies": ["task-2"],
      "status": "ok"
    }
  ]
}
```

- **Idempotent behavior**:
  - If the same transcript is submitted again, the backend **does not re‑call the LLM**.
  - It returns the existing result from in‑memory cache or PostgreSQL based on the SHA‑256 `hash`.

---

### `POST /jobs`

- Asynchronous submission that immediately returns a `jobId`.
- Idempotent by transcript hash: submitting the same transcript returns the existing job instead of re‑calling the LLM.

**Request body:**

```json
{
  "transcript": "Full meeting transcript text here..."
}
```

**Response (202 Accepted or 200 if already done):**

```json
{
  "jobId": "09c2e9b1-...-4d7c",
  "hash": "6a9f...",
  "status": "pending" | "processing" | "done" | "error",
  "result": {
    "hash": "6a9f...",
    "createdAt": "2025-02-04T13:25:42.000Z",
    "tasks": [
      {
        "id": "task-1",
        "description": "Set up CI pipeline",
        "priority": "high",
        "dependencies": ["task-2"],
        "status": "ok"
      }
    ]
  },
  "error": "error message if status=error"
}
```

### `GET /jobs/:jobId`

Poll a job created via `POST /jobs` to check its status or retrieve the final tasks.

**Response (200 OK):**

```json
{
  "jobId": "09c2e9b1-...-4d7c",
  "hash": "6a9f...",
  "status": "pending" | "processing" | "done" | "error",
  "result": {
    "hash": "6a9f...",
    "createdAt": "2025-02-04T13:25:42.000Z",
    "tasks": [
      {
        "id": "task-1",
        "description": "Set up CI pipeline",
        "priority": "high",
        "dependencies": ["task-2"],
        "status": "ok"
      }
    ]
  },
  "error": "error message if status=error"
}
```

---

## Data Model (Prisma)

### `Transcript`

- `id: String @id @default(uuid())`
- `content: String` – original transcript text
- `hash: String @unique` – SHA‑256 of the transcript for idempotency
- `createdAt: DateTime @default(now())`
- `tasks: Task[]` – relation to tasks

### `Task`

- `id: String` – LLM-provided task id (e.g., "task-1")
- `transcriptId: String` – FK to `Transcript` (composite primary key with `id`)
- `description: String`
- `priority: TaskPriority` (`low | medium | high`)
- `dependencies: Json` – stored as `string[]` of task IDs
- `status: TaskStatus` (`ready | blocked | error`)
  - In the current implementation:
    - Tasks participating in cycles are saved as `error`.
    - Non‑cyclic tasks are saved as `ready`.

---

## Cycle Detection Algorithm

- **Goal**: Detect circular dependencies (e.g. `A → B → A`) and mark those tasks as problematic without crashing the app.
- **Approach**: Depth‑First Search (DFS) with color marking:
  - Each task is a node; dependencies are directed edges.
  - Nodes have three colors:
    - **WHITE**: unvisited
    - **GRAY**: in current recursion stack
    - **BLACK**: fully explored
  - During DFS:
    - When we see an edge from a GRAY node to another GRAY node, we found a **back edge** → a cycle.
    - All nodes between the first occurrence of that node on the stack and the top of the stack are marked as **part of the cycle**.
- **Result**:
  - Tasks are returned as `{ ...task, status: "ok" | "error" }`.
  - These statuses are persisted to the DB and returned to the client.
  - The API **never throws** on cycles; it annotates tasks instead.

---

## Idempotency Logic

- Compute a **deterministic SHA‑256 hash** of each transcript.
- On `POST /transcripts`:
  1. Check an in‑memory map (`Map<string, TranscriptResult>`) by `hash`.
  2. If not found, query PostgreSQL for a `Transcript` row with that `hash`.
  3. Only if no existing record is found:
     - Call the LLM.
     - Validate, sanitize, and detect cycles.
     - Persist `Transcript` + `Task` rows.
     - Cache the result in memory.

This ensures **duplicate submissions of the same transcript are cheap** (no extra LLM calls or duplicated work).

> **Async Level 2 Note**  
> To fully implement Level 2, this design can be extended with a `Job` or `status` field on `Transcript` and separate endpoints:
> - `POST /jobs` → accept transcript, return `jobId` immediately.
> - `GET /jobs/:jobId` → poll status (`pending | processing | done | error`) and return tasks when done.

---

## Running Locally

1. **Install dependencies**

```bash
npm install
```

2. **Environment variables**

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

LLM_API_KEY="your_groq_api_key"
LLM_MODEL="llama-3.3-70b-versatile"
LLM_API_URL="https://api.groq.com/openai/v1/chat/completions"
```

3. **Database setup (Prisma)**

```bash
npx prisma migrate deploy   # or `prisma migrate dev` during development
npx prisma generate
```

4. **Start the server**

```bash
npm run dev   # e.g. ts-node-dev src/server.ts
```

The API will be available at `http://localhost:3000`.

---

## Deployment

- Deploy the service to a host such as **Render**, **Railway**, or similar.
- Configure environment variables (`DATABASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_API_URL`, `PORT`) in the platform UI.
- Example production URL:

```text
https://your-app-hostname/transcripts
```

You can then test the deployed instance with:

```bash
curl -X POST https://your-app-hostname/transcripts \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Meeting notes go here..."}'
```

