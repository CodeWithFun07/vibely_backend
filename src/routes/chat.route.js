import { Router } from "express";
import isAuthenticated, { isAccountActive } from "../middlewares/auth.middleware.js";
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

router.route("/create-chat").post(isAuthenticated, isAccountActive, createChat);

router.route("/create-group").post(isAuthenticated, isAccountActive, uploadMultipleFiles([
  { name: "groupImage", maxCount: 1 },
  { name: "groupCoverImage", maxCount: 1 }
]), createGroup);

router.route("/all-chats").get(isAuthenticated, isAccountActive, getAllChats);
router.route("/archived-chats").get(isAuthenticated, isAccountActive, getArchivedChats);
router.route("/unread-count").get(isAuthenticated, isAccountActive, getUnreadMessageCount);

router.route("/single-chat/:chatId").get(isAuthenticated, isAccountActive, getSingleChat);

router.route("/chat-detail/:chatId").get(isAuthenticated, isAccountActive, getChatDetail);

router.route("/delete-chat/:chatId").delete(isAuthenticated, isAccountActive, deleteChat);

router.route("/archive-chat/:chatId").put(isAuthenticated, isAccountActive, archiveChat);

router.route("/clear-chat/:chatId").delete(isAuthenticated, isAccountActive, clearChat);

router.route("/mute-chat/:chatId").put(isAuthenticated, isAccountActive, muteChat);

/**
 * Group Management
 */

router.route("/join-group/:groupId").put(isAuthenticated, isAccountActive, joinGroup);

router.route("/request-join/:groupId").post(isAuthenticated, isAccountActive, requestJoinGroup);

router.route("/approve-request/:groupId").post(isAuthenticated, isAccountActive, approveRequest);

router.route("/reject-request/:groupId").post(isAuthenticated, isAccountActive, rejectRequest);

router.route("/leave-group/:groupId").delete(isAuthenticated, isAccountActive, leaveGroup);

router
  .route("/update-group-info/:groupId")
  .put(
    isAuthenticated,
    isAccountActive,
    uploadMultipleFiles([
      { name: "groupImage", maxCount: 1 },
      { name: "groupCoverImage", maxCount: 1 },
    ]),
    updateGroupInfo,
  );

/**
 * Admin Controls
 */

router.route("/make-admin/:groupId").post(isAuthenticated, isAccountActive, makeAdmin);

router.route("/remove-admin/:groupId").post(isAuthenticated, isAccountActive, removeAdmin);

router.route("/remove-member/:groupId").delete(isAuthenticated, isAccountActive, removeMember);

router.route("/add-members/:groupId").post(isAuthenticated, isAccountActive, addMembers);

export default router;
