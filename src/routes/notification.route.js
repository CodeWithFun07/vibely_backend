import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
} from "../controllers/notification.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * GET /api/v1/notifications?page=1&limit=10&status=unread
 * Get notifications for the current user
 * Status: unread, read, archived, all
 */
router.route("/").get(getNotifications);

/**
 * GET /api/v1/notifications/unreadCount
 * Get unread notification count
 */
router.route("/unreadCount").get(getUnreadCount);

/**
 * PUT /api/v1/notifications/read/:notificationId
 * Mark a notification as read
 */
router.route("/read/:notificationId").put(markAsRead);

/**
 * PUT /api/v1/notifications/readAll
 * Mark all notifications as read
 */
router.route("/readAll").put(markAllAsRead);

/**
 * DELETE /api/v1/notifications/delete/:notificationId
 * Delete a notification
 */
router.route("/delete/:notificationId").delete(deleteNotification);

/**
 * DELETE /api/v1/notifications/clearAll
 * Clear all notifications
 */
router.route("/clearAll").delete(clearAllNotifications);

export default router;
