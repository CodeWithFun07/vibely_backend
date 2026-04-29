import asyncHandler from "../utils/asyncHandler.js";
import notificationService from "../services/notification.service.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Get notifications for a user
 * GET /api/v1/notifications?page=1&limit=10&status=unread
 * Status: unread, read, archived, all
 */
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status || "unread";

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await notificationService.getNotifications(
    userId,
    page,
    limit,
    status,
  );

  return res.status(200).json(
    new ApiResponse(true, "Notifications fetched successfully", 200, {
      notifications: result.notifications,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    }),
  );
});

/**
 * Mark a notification as read
 * PUT /api/v1/notifications/read/:notificationId
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.userId;

  const result = await notificationService.markAsRead(notificationId, userId);

  return res.status(200).json(
    new ApiResponse(true, "Notification marked as read", 200, result),
  );
});

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/readAll
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await notificationService.markAllAsRead(userId);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, result),
  );
});

/**
 * Delete a notification
 * DELETE /api/v1/notifications/delete/:notificationId
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.userId;

  const result = await notificationService.deleteNotification(
    notificationId,
    userId,
  );

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, result),
  );
});

/**
 * Clear all notifications
 * DELETE /api/v1/notifications/clearAll
 */
const clearAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await notificationService.clearAllNotifications(userId);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, result),
  );
});

/**
 * Get unread notification count
 * GET /api/v1/notifications/unreadCount
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await notificationService.getUnreadCount(userId);

  return res.status(200).json(
    new ApiResponse(true, "Unread count fetched", 200, result),
  );
});

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
};
