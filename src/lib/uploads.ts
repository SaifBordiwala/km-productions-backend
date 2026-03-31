import fs from "fs";
import path from "path";

const DEFAULT_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export function getUploadsDir(): string {
  const fromEnv = process.env.UPLOAD_DIR;
  return fromEnv ? path.resolve(fromEnv) : DEFAULT_UPLOAD_DIR;
}

export function ensureUploadsDir(): string {
  const dir = getUploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

