import asyncHandler from "../utils/asyncHandler.js";
import reportService from "../services/report.service.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Create a report against a user
 * POST /api/v1/reports/create
 * Body: { reportedUserId, reason, reportedPost (optional), priority (optional) }
 */
const createReport = asyncHandler(async (req, res) => {
  const { reportedUserId, reason, reportedPost, priority } = req.body;
  const reportedById = req.userId;

  const result = await reportService.createReport(
    reportedById,
    reportedUserId,
    reason,
    { reportedPost, priority },
  );

  return res.status(201).json(
    new ApiResponse(true, "Report created successfully", 201, result),
  );
});

/**
 * Get all reports (admin only)
 * GET /api/v1/reports?page=1&limit=10&status=pending&priority=high&reportedUser=userId
 */
const getAllReports = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { status, priority, reportedUser } = req.query;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const filters = {};
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (reportedUser) filters.reportedUser = reportedUser;

  const result = await reportService.getAllReports(page, limit, filters);

  return res.status(200).json(
    new ApiResponse(true, "Reports fetched successfully", 200, {
      reports: result.reports,
      pagination: result.pagination,
    }),
  );
});

/**
 * Get reports against a specific user (admin only)
 * GET /api/v1/reports/user/:userId?page=1&limit=10
 */
const getReportsAgainstUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await reportService.getReportsAgainstUser(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Reports fetched successfully", 200, {
      reports: result.reports,
      pagination: result.pagination,
    }),
  );
});

/**
 * Get single report details (admin only)
 * GET /api/v1/reports/:reportId
 */
const getReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const result = await reportService.getReportById(reportId);

  return res.status(200).json(
    new ApiResponse(true, "Report fetched successfully", 200, result),
  );
});

/**
 * Update report status and resolution (admin only)
 * PUT /api/v1/reports/update/:reportId
 * Body: { status, resolutionAction, adminNotes }
 */
const updateReportStatus = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status, resolutionAction, adminNotes } = req.body;
  const adminId = req.userId;

  const result = await reportService.updateReportStatus(
    reportId,
    status,
    resolutionAction,
    adminNotes,
    adminId,
  );

  return res.status(200).json(
    new ApiResponse(true, "Report updated successfully", 200, result),
  );
});

/**
 * Get report statistics (admin only)
 * GET /api/v1/reports/stats
 */
const getReportStats = asyncHandler(async (req, res) => {
  const result = await reportService.getReportStats();

  return res.status(200).json(
    new ApiResponse(true, "Report statistics fetched", 200, result),
  );
});

export {
  createReport,
  getAllReports,
  getReportsAgainstUser,
  getReportById,
  updateReportStatus,
  getReportStats,
};
