import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import logger from "./utils/logger";
import jobsRouter from "./routes/jobs.routes";
import { ensureUploadsDir } from "./lib/uploads";
import { HttpError } from "./lib/httpErrors";
import { ZodError } from "zod";

const app = express();

// Parse cookies
app.use(cookieParser());

// Use morgan for logging requests
app.use(morgan("dev"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Use helmet for setting various HTTP headers
app.use(
  helmet({
    frameguard: { action: "deny" },
    hsts: { maxAge: 15552000 },
    dnsPrefetchControl: { allow: false },
    referrerPolicy: { policy: "same-origin" },
  }),
);
app.use(helmet.xssFilter());
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());

// Enable CORS with specific configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(","), // Allow all origins, adjust this in production
    optionsSuccessStatus: 200,
    methods: ["GET", "PUT", "PATCH", "POST", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

app.get("/", (req, res) => {
  return res.send({
    message: "Welcome to K$M Productions Services",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

app.get("/health-check", (req, res) => {
  return res.send({
    message: "Health check passed",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

// Serve uploaded files from local disk.
const uploadsDir = ensureUploadsDir();
app.use("/uploads", express.static(uploadsDir));

app.use("/api/jobs", jobsRouter);

// Catch almost all errors (place this after routes and other middlewares)
function isMulterError(e: unknown): e is { message?: string; code?: string } {
  return (
    e instanceof Error && typeof (e as { code?: unknown }).code === "string"
  );
}

const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error("Request handler error", err);

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.flatten().formErrors.join(", ") || "Invalid request";
    res.status(400).json({ message });
    return;
  }

  if (isMulterError(err)) {
    res.status(400).json({ message: err.message ?? "Invalid upload" });
    return;
  }

  res.status(500).json({ message: "Server error" });
};

// Apply error-handling middleware
app.use(errorHandler);

// Handle uncaught promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled Rejection", reason);
});

export default app;
