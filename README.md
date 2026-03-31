# K&M Productions - Async Job Processing Backend

Production-ready Node.js + TypeScript backend for async job processing (Image -> Video simulation).

## Submission Links

- GitHub Repository: `<ADD_YOUR_GITHUB_REPO_LINK_HERE>`
- Demo Link: `<ADD_YOUR_DEMO_LINK_HERE>`

## Tech Stack

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (NeonDB compatible)
- Multer (file upload)
- Zod (validation)

## Project Structure

```text
src/
  controllers/   # HTTP handlers (request/response)
  services/      # business logic + DB operations
  workers/       # async processing logic
  routes/        # route wiring
  middleware/    # upload middleware (multer)
  lib/           # prisma client, helpers, shared utilities
  schemas/       # zod schemas
  utils/         # logger/settings
```

## Setup Instructions

### 1) Prerequisites

- Node.js 20+ (22 recommended)
- npm 10+
- PostgreSQL database URL (Neon or local)

### 2) Clone and install

```bash
git clone <your-repo-url>
cd km-productions-backend
npm install
```

### 3) Configure environment

Create or update `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JOB_SIMULATION_DELAY_MS = 5000
```

### 4) Generate/apply database migration

```bash
npm run prisma:local
```

### 5) Start development server

```bash
npm run dev:watch
```

For production-like run:

```bash
npm run build
npm start
```

## API Endpoints

### POST `/api/jobs`

Upload image and create job.

- Content-Type: `multipart/form-data`
- Field name: `image`
- Response:

```json
{ "jobId": "uuid" }
```

### GET `/api/jobs/:id`

Fetch job status/result.

- Response:

```json
{
  "id": "uuid",
  "status": "PENDING|PROCESSING|COMPLETED|FAILED",
  "resultUrl": "https://example.com/videos/{jobId}.mp4",
  "error": null
}
```

## Demo / Verification Steps

1. Start server with `npm run dev:watch`
2. Create a job:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "image=@./sample.jpg"
```

3. Copy `jobId` from response.
4. Poll status:

```bash
curl http://localhost:3000/api/jobs/<jobId>
```

Expected lifecycle: `PENDING -> PROCESSING -> COMPLETED` (or `FAILED` on error).

## Key Decisions and Tradeoffs

- **Simple async worker without queue**  
  Fire-and-forget worker keeps implementation lightweight and matches assignment constraints.  
  Tradeoff: no durable retry scheduling across process restarts.

- **Prisma service layer + controller separation**  
  Clean architecture keeps HTTP concerns out of business logic and makes testing easier.  
  Tradeoff: slightly more boilerplate for a small service.

- **Local disk upload (`/uploads`)**  
  Easy local development and reproducible behavior.  
  Tradeoff: not horizontally scalable compared to object storage.

- **Idempotent-ish status transitions**  
  Update guards reduce double-processing race issues.  
  Tradeoff: still process-memory based; multi-instance concurrency needs a queue/lock strategy.

- **Strict request validation and centralized error mapping**  
  Better API reliability with predictable 400/404/500 responses.  
  Tradeoff: extra schema/middleware code.

## What I Would Improve With More Time

- Add automated tests (unit + integration + API contract tests).
- Add OpenAPI/Swagger docs.
- Replace simulated worker with real queue system (BullMQ/SQS) and retry policies.
- Add authentication/authorization and rate limiting.
- Move uploads to cloud storage (S3/GCS) with signed URLs.
- Add observability: metrics, tracing, structured request IDs, dashboards.
- Add CI pipeline for lint/typecheck/test/build/migrate checks.

