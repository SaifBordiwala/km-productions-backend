import { Router } from "express";
import { uploadImage } from "../middleware/uploadImage";
import { createJob, getJobById } from "../controllers/jobs.controller";

const router = Router();

router.post("/", uploadImage.single("image"), createJob);
router.get("/:id", getJobById);

export default router;

