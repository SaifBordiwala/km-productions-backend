import "./loadEnv"; // must be first so process.env is set before app and services load
import http from "http";
import app from "./app";
import logger from "./utils/logger";

function normalizePort(p: string): string | number | false {
  const n = parseInt(p, 10);
  if (Number.isNaN(n)) {
    return p; // named Pipe
  }
  if (n >= 0) {
    return n; // port number
  }
  return false;
}

const port = normalizePort(process.env.PORT || "3000");

// create express server
const server = http.createServer(app).listen(port);

server.on("listening", () => {
  const address = server.address();
  const port = typeof address === "string" ? address : address?.port;

  logger.info("Server running", {
    Application: "K$M Productions Form APIs",
    Environment: process.env.NODE_ENV,
    Port: port,
    Platform: process.platform,
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;
  switch (error.code) {
    case "EACCES":
      logger.error(`${bind} requires elevated privileges`, error);
      process.exit(1);
    case "EADDRINUSE":
      logger.error(`${bind} is already in use`, error);
      process.exit(1);
    default:
      throw error;
  }
});
