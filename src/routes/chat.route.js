import { Router } from "express";
import isAuthenticated from "../middlewares/auth.middleware.js";
import { uploadMultipleFiles } from "../middlewares/multer.js";
import {
  createChat,
  createGroup,
  getAllChats,
  getArchivedChats,
  getUnreadMessageCount,
  getSingleChat,
  getChatDetail,
  deleteChat,
  archiveChat,
  clearChat,
  muteChat,
  joinGroup,
  requestJoinGroup,
  approveRequest,
  rejectRequest,
  leaveGroup,
  updateGroupInfo,
  makeAdmin,
  removeAdmin,
  removeMember,
  addMembers,
} from "../controllers/chat.controller.js";

const router = Router();

/**
 * Personal Chat + Group Chat
 */

router.route("/create-chat").post(isAuthenticated, createChat);

router.route("/create-group").post(isAuthenticated, uploadMultipleFiles([
  { name: "groupImage", maxCount: 1 },
  { name: "groupCoverImage", maxCount: 1 }
]), createGroup);

router.route("/all-chats").get(isAuthenticated, getAllChats);
router.route("/archived-chats").get(isAuthenticated, getArchivedChats);
router.route("/unread-count").get(isAuthenticated, getUnreadMessageCount);

router.route("/single-chat/:chatId").get(isAuthenticated, getSingleChat);

router.route("/chat-detail/:chatId").get(isAuthenticated, getChatDetail);

router.route("/delete-chat/:chatId").delete(isAuthenticated, deleteChat);

router.route("/archive-chat/:chatId").put(isAuthenticated, archiveChat);

router.route("/clear-chat/:chatId").delete(isAuthenticated, clearChat);

router.route("/mute-chat/:chatId").put(isAuthenticated, muteChat);

/**
 * Group Management
 */

router.route("/join-group/:groupId").put(isAuthenticated, joinGroup);

router.route("/request-join/:groupId").post(isAuthenticated, requestJoinGroup);

router.route("/approve-request/:groupId").post(isAuthenticated, approveRequest);

router.route("/reject-request/:groupId").post(isAuthenticated, rejectRequest);

router.route("/leave-group/:groupId").delete(isAuthenticated, leaveGroup);

router
  .route("/update-group-info/:groupId")
  .put(
    isAuthenticated,
    uploadMultipleFiles([
      { name: "groupImage", maxCount: 1 },
      { name: "groupCoverImage", maxCount: 1 },
    ]),
    updateGroupInfo,
  );

/**
 * Admin Controls
 */

router.route("/make-admin/:groupId").post(isAuthenticated, makeAdmin);

router.route("/remove-admin/:groupId").post(isAuthenticated, removeAdmin);

router.route("/remove-member/:groupId").delete(isAuthenticated, removeMember);

router.route("/add-members/:groupId").post(isAuthenticated, addMembers);

export default router;
