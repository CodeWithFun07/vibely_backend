import { Router } from "express";
import {
  createReport,
  getAllReports,
  getReportsAgainstUser,
  getReportById,
  updateReportStatus,
  getReportStats,
} from "../controllers/report.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/v1/reports/create
 * Create a report against a user
 * Body: { reportedUserId, reason, reportedPost (optional), priority (optional) }
 */
router.route("/create").post(createReport);

/**
 * GET /api/v1/reports/stats
 * Get report statistics (admin only)
 */
router.route("/stats").get(getReportStats);

/**
 * GET /api/v1/reports/:reportId
 * Get single report details
 */
router.route("/:reportId").get(getReportById);

/**
 * GET /api/v1/reports/user/:userId?page=1&limit=10
 * Get reports against a specific user
 */
router.route("/user/:userId").get(getReportsAgainstUser);

/**
 * GET /api/v1/reports?page=1&limit=10&status=pending&priority=high
 * Get all reports (with optional filters)
 */
router.route("/").get(getAllReports);

/**
 * PUT /api/v1/reports/update/:reportId
 * Update report status and resolution (admin only)
 * Body: { status, resolutionAction, adminNotes }
 */
router.route("/update/:reportId").put(updateReportStatus);

export default router;
