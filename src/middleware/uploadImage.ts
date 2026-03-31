import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";
import crypto from "crypto";
import path from "path";
import { ensureUploadsDir } from "../lib/uploads";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
    return;
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const extFromOriginal = path.extname(file.originalname).toLowerCase();
    const ext = extFromOriginal.length > 1 ? extFromOriginal : "";
    cb(null, `image-${uniqueId}${ext}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: imageFileFilter,
});

