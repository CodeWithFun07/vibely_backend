import Report from "../models/report.model.js";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import ApiError from "../utils/apiError.js";

class ReportService {
  /**
   * Create a report against a user
   * @param {string} reportedById - User reporting
   * @param {string} reportedUserId - User being reported
   * @param {string} reason - Report reason
   * @param {Object} options - Additional options { reportedPost, priority }
   * @returns {Object} - Created report
   */
  async createReport(reportedById, reportedUserId, reason, options = {}) {
    if (!reportedById || !reportedUserId || !reason) {
      throw new ApiError(400, "All fields are required");
    }

    if (reportedById === reportedUserId) {
      throw new ApiError(400, "You cannot report yourself");
    }

    if (reason.trim().length === 0 || reason.trim().length < 10) {
      throw new ApiError(400, "Reason must be at least 10 characters");
    }

    try {
      // Check if user already reported this user
      const existingReport = await Report.findOne({
        reported_by: reportedById,
        reported_user: reportedUserId,
      });

      if (existingReport && existingReport.status === "pending") {
        throw new ApiError(400, "You have already reported this user");
      }

      const report = await Report.create({
        reported_by: reportedById,
        reported_user: reportedUserId,
        reason: reason.trim(),
        reported_post: options.reportedPost || null,
        priority: options.priority || "medium",
      });

      const populatedReport = await report.populate([
        { path: "reported_by", select: "_id username email profile.full_name" },
        {
          path: "reported_user",
          select: "_id username email profile.full_name",
        },
        { path: "reported_post", select: "_id caption" },
      ]);

      return populatedReport;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to create report: ${error.message}`);
    }
  }

  /**
   * Get all reports (admin only)
   * @param {number} page - Page number
   * @param {number} limit - Reports per page
   * @param {Object} filters - Filter options { status, priority, reportedUser }
   * @returns {Object} - { reports, pagination }
   */
  async getAllReports(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;

      // Build query
      const query = {};
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.priority) {
        query.priority = filters.priority;
      }
      if (filters.reportedUser) {
        query.reported_user = filters.reportedUser;
      }

      const reports = await Report.find(query)
        .populate([
          { path: "reported_by", select: "_id username email profile.full_name" },
          {
            path: "reported_user",
            select: "_id username email profile.full_name followers_count",
          },
          { path: "reported_post", select: "_id caption" },
          {
            path: "reviewed_by",
            select: "_id username email profile.full_name",
          },
        ])
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalReports = await Report.countDocuments(query);
      const totalPages = Math.ceil(totalReports / limit);

      return {
        reports,
        pagination: {
          currentPage: page,
          totalPages,
          totalReports,
          reportsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch reports: ${error.message}`);
    }
  }

  /**
   * Get reports for a specific user
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Reports per page
   * @returns {Object} - { reports, pagination }
   */
  async getReportsAgainstUser(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      const reports = await Report.find({ reported_user: userId })
        .populate([
          { path: "reported_by", select: "_id username email profile.full_name" },
          {
            path: "reported_user",
            select: "_id username email profile.full_name",
          },
          { path: "reported_post", select: "_id caption" },
          {
            path: "reviewed_by",
            select: "_id username email profile.full_name",
          },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalReports = await Report.countDocuments({
        reported_user: userId,
      });
      const totalPages = Math.ceil(totalReports / limit);

      return {
        reports,
        pagination: {
          currentPage: page,
          totalPages,
          totalReports,
          reportsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to fetch reports against user: ${error.message}`,
      );
    }
  }

  /**
   * Update report status (admin only)
   * @param {string} reportId - Report ID
   * @param {string} status - New status (pending, under_review, resolved, rejected)
   * @param {string} resolutionAction - Action taken
   * @param {string} adminNotes - Admin notes
   * @param {string} reviewedById - Admin user ID
   * @returns {Object} - Updated report
   */
  async updateReportStatus(
    reportId,
    status,
    resolutionAction,
    adminNotes,
    reviewedById,
  ) {
    if (!reportId || !status) {
      throw new ApiError(400, "Report ID and Status are required");
    }

    const validStatuses = ["pending", "under_review", "resolved", "rejected"];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, "Invalid status");
    }

    const validActions = [
      "none",
      "warning",
      "suspended",
      "banned",
      "content_removed",
    ];
    if (resolutionAction && !validActions.includes(resolutionAction)) {
      throw new ApiError(400, "Invalid resolution action");
    }

    try {
      const report = await Report.findById(reportId);

      if (!report) {
        throw new ApiError(404, "Report not found");
      }

      report.status = status;
      if (resolutionAction) {
        report.resolution_action = resolutionAction;
      }
      if (adminNotes) {
        report.admin_notes = adminNotes;
      }
      report.reviewed_by = reviewedById;
      report.reviewed_at = new Date();

      await report.save();

      const populatedReport = await report.populate([
        { path: "reported_by", select: "_id username email profile.full_name" },
        {
          path: "reported_user",
          select: "_id username email profile.full_name",
        },
        { path: "reported_post", select: "_id caption" },
        {
          path: "reviewed_by",
          select: "_id username email profile.full_name",
        },
      ]);

      return populatedReport;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to update report status: ${error.message}`,
      );
    }
  }

  /**
   * Get report statistics (admin only)
   * @returns {Object} - { totalReports, byStatus, byPriority, recentReports }
   */
  async getReportStats() {
    try {
      const totalReports = await Report.countDocuments();

      const byStatus = await Report.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const byPriority = await Report.aggregate([
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]);

      const recentReports = await Report.find()
        .populate([
          { path: "reported_by", select: "_id username" },
          { path: "reported_user", select: "_id username" },
        ])
        .sort({ createdAt: -1 })
        .limit(5);

      return {
        totalReports,
        byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
        byPriority: Object.fromEntries(byPriority.map((p) => [p._id, p.count])),
        recentReports,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch report stats: ${error.message}`);
    }
  }

  /**
   * Get single report details
   * @param {string} reportId - Report ID
   * @returns {Object} - Report details
   */
  async getReportById(reportId) {
    if (!reportId) {
      throw new ApiError(400, "Report ID is required");
    }

    try {
      const report = await Report.findById(reportId).populate([
        { path: "reported_by", select: "_id username email profile.full_name" },
        {
          path: "reported_user",
          select: "_id username email profile.full_name followers_count",
        },
        { path: "reported_post", select: "_id caption createdAt" },
        {
          path: "reviewed_by",
          select: "_id username email profile.full_name",
        },
      ]);

      if (!report) {
        throw new ApiError(404, "Report not found");
      }

      return report;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch report: ${error.message}`);
    }
  }
}

const reportService = new ReportService();
export default reportService;
