import { Router } from "express";
import { apiLimiter } from "../middleware/rateLimit.js";
import healthRoutes from "./health.js";
import authRoutes from "./auth/index.js";
import userRoutes from "./users/index.js";
import workspaceRoutes from "./workspaces/index.js";
import inviteRoutes from "./invites/index.js";
import noteRoutes from "./notes/index.js";
import codeFileRoutes from "./codefiles/index.js";
import whiteboardRoutes from "./whiteboards/index.js";
import activityRoutes from "./activity/index.js";
import adminRoutes from "./admin/index.js";

const router = Router();

router.use(apiLimiter);
router.use(healthRoutes);
router.use(authRoutes);
router.use(userRoutes);
router.use(workspaceRoutes);
router.use(inviteRoutes);
router.use(noteRoutes);
router.use(codeFileRoutes);
router.use(whiteboardRoutes);
router.use(activityRoutes);
router.use(adminRoutes);

export default router;
