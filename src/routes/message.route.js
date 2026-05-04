import { Router } from "express";
import isAuthenticated from "../middlewares/auth.middleware.js";
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

router.route("/send-message").post(isAuthenticated, uploadMultipleFiles("media", 10), sendMessage);

router.route("/:chatId").get(isAuthenticated, getMessages);

router.route("/search-messages/:chatId").get(isAuthenticated, searchMessages);

/**
 * Message Actions
 */

router.route("/edit-message/:messageId").put(isAuthenticated, editMessage);

router.route("/reply-message/:messageId").post(isAuthenticated, uploadMultipleFiles("media", 10), replyMessage);

router
  .route("/forward-message/:messageId")
  .post(isAuthenticated, forwardMessage);

router.route("/mark-seen/:chatId").put(isAuthenticated, markAsSeen);

/**
 * Delete System
 */

router.route("/delete-for-me/:messageId").put(isAuthenticated, deleteForMe);

router
  .route("/delete-for-everyone/:messageId")
  .put(isAuthenticated, deleteForEveryone);

/**
 * Reactions
 */

router.route("/react-message/:messageId").post(isAuthenticated, reactToMessage);

router
  .route("/remove-reaction/:messageId")
  .delete(isAuthenticated, removeReaction);

/**
 * Pin / Unpin
 */

router.route("/pin-message/:messageId").put(isAuthenticated, pinMessage);

router.route("/unpin-message/:messageId").put(isAuthenticated, unpinMessage);

/**
 * Admin Controls
 */

router
  .route("/admin-delete-message/:messageId")
  .delete(isAuthenticated, adminDeleteMessage);

router
  .route("/admin-pin-message/:messageId")
  .put(isAuthenticated, adminPinMessage);

export default router;
