import { Router } from "express";
import isAuthenticated, { isAccountActive } from "../middlewares/auth.middleware.js";
import { uploadMultipleFiles } from "../middlewares/multer.js";
import {
  sendMessage,
  getMessages,
  searchMessages,
  editMessage,
  replyMessage,
  forwardMessage,
  markAsSeen,
  deleteForMe,
  deleteForEveryone,
  reactToMessage,
  removeReaction,
  pinMessage,
  unpinMessage,
  adminDeleteMessage,
  adminPinMessage,
} from "../controllers/message.controller.js";


const router = Router();

/**
 * Send + Fetch Messages
 */

router.route("/send-message").post(isAuthenticated, isAccountActive, uploadMultipleFiles("media", 10), sendMessage);

router.route("/:chatId").get(isAuthenticated, isAccountActive, getMessages);

router.route("/search-messages/:chatId").get(isAuthenticated, isAccountActive, searchMessages);

/**
 * Message Actions
 */

router.route("/edit-message/:messageId").put(isAuthenticated, isAccountActive, editMessage);

router.route("/reply-message/:messageId").post(isAuthenticated, isAccountActive, uploadMultipleFiles("media", 10), replyMessage);

router
  .route("/forward-message/:messageId")
  .post(isAuthenticated, isAccountActive, forwardMessage);

router.route("/mark-seen/:chatId").put(isAuthenticated, isAccountActive, markAsSeen);

/**
 * Delete System
 */

router.route("/delete-for-me/:messageId").put(isAuthenticated, isAccountActive, deleteForMe);

router
  .route("/delete-for-everyone/:messageId")
  .put(isAuthenticated, isAccountActive, deleteForEveryone);

/**
 * Reactions
 */

router.route("/react-message/:messageId").post(isAuthenticated, isAccountActive, reactToMessage);

router
  .route("/remove-reaction/:messageId")
  .delete(isAuthenticated, isAccountActive, removeReaction);

/**
 * Pin / Unpin
 */

router.route("/pin-message/:messageId").put(isAuthenticated, isAccountActive, pinMessage);

router.route("/unpin-message/:messageId").put(isAuthenticated, isAccountActive, unpinMessage);

/**
 * Admin Controls
 */

router
  .route("/admin-delete-message/:messageId")
  .delete(isAuthenticated, isAccountActive, adminDeleteMessage);

router
  .route("/admin-pin-message/:messageId")
  .put(isAuthenticated, isAccountActive, adminPinMessage);

export default router;
