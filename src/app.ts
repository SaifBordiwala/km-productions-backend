import express, {
  NextFunction,
  Request,
  Response,
  ErrorRequestHandler,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import logger from "./utils/logger";
import transcriptsRouter from "./routes/transcripts.route";
import jobsRouter from "./routes/jobs.route";

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
  })
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
  })
);

// Routes
app.use("/jobs", jobsRouter);
app.use("/transcripts", transcriptsRouter);

app.get("/", (req, res) => {
  return res.send({
    message: "Welcome to Insightboard Services",
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

// Catch almost all errors (place this after routes and other middlewares)
const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error(err);

  // Set up locals for error message and details
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV === "production" ? {} : err;

  // Send error response
  res.status(err.status || 500);
  res.send("Server error");
};

// Apply error-handling middleware
app.use(errorHandler);

// Handle uncaught promise rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection", error);
});

export default app;
