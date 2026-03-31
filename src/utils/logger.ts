import { createLogger, format, transports } from "winston";
import fs from "fs";

const { combine, timestamp, json, printf, errors, colorize } = format;

import settings from "./settings";

fs.mkdirSync(settings.logPath, { recursive: true });

const logFormat = combine(
  timestamp({ format: "YYYY-MM-DD[T]HH:mm:ss" }),
  json(),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    return `${ts}: [${level}] - ${stack || message} ${JSON.stringify(meta)}`;
  })
);

const fileTransport = new transports.File({
  level: "verbose",
  filename: `${settings?.logPath}/app.log`,
  handleExceptions: true,
  handleRejections: true,
  format: logFormat,
});

const consoleTransport = new transports.Console({
  level: "verbose",
  handleExceptions: true,
  handleRejections: true,
  format: logFormat,
});

const devConsoleTransport = new transports.Console({
  level: "debug",
  handleExceptions: true,
  handleRejections: true,
  format: combine(colorize(), logFormat),
});

const logger = createLogger();

switch (process.env.NODE_ENV) {
  case "development":
    logger.add(devConsoleTransport);
    break;
  case "test":
    logger.add(devConsoleTransport);
    break;
  case "staging":
    logger.add(fileTransport);
    logger.add(consoleTransport);
    break;
  case "production":
    logger.add(fileTransport);
    break;
  default:
    logger.add(fileTransport);
    break;
}

logger.on("error", (err: unknown) => {
  // eslint-disable-next-line no-console
  console.log("Logging error: ", err);
});

export default logger;
