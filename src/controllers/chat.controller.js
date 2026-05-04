import asyncHandler from "../utils/asyncHandler.js";
import chatService from "../services/chat.service.js";
import ApiResponse from "../utils/apiResponse.js";

const createChat = asyncHandler(async (req, res) => {
  const { recieverId } = req.body;
  const senderId = req.userId;
  const result = await chatService.createChat({ senderId, recieverId });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const createGroup = asyncHandler(async (req, res) => {
  const creatorId = req.userId;
  const {
    groupName,
    memberIds = [],
    groupPrivacy,
    groupDescription,
    groupInviteLink,
  } = req.body;

  // Get uploaded files from multer
  const groupImageFile = req.files?.groupImage?.[0];
  const groupCoverImageFile = req.files?.groupCoverImage?.[0];

  // Parse memberIds if it's a JSON string
  let parsedMemberIds = memberIds;
  if (typeof memberIds === "string") {
    try {
      parsedMemberIds = JSON.parse(memberIds);
    } catch (e) {
      parsedMemberIds = [];
    }
  }

  const result = await chatService.createGroup({
    creatorId,
    groupName,
    memberIds: parsedMemberIds,
    groupPrivacy,
    groupDescription,
    groupImage: groupImageFile,
    groupCoverImage: groupCoverImageFile,
    groupInviteLink,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const getAllChats = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const result = await chatService.getAllChats(req.userId, page, limit);

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chats: result.chats,
      pagination: result.pagination,
    }),
  );
});

const getUnreadMessageCount = asyncHandler(async (req, res) => {
  const count = await chatService.getUnreadMessageCount(req.userId);

  return res.status(200).json(
    new ApiResponse(true, "Unread message count fetched", 200, {
      unreadMessageCount: count,
    }),
  );
});

const getSingleChat = asyncHandler(async (req, res) => {
  const result = await chatService.getSingleChat({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const getChatDetail = asyncHandler(async (req, res) => {
  const result = await chatService.getChatDetail({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      detail: result.detail,
    }),
  );
});

const deleteChat = asyncHandler(async (req, res) => {
  const result = await chatService.deleteChat({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res
    .status(result.statusCode)
    .json(new ApiResponse(true, result.message, result.statusCode, null));
});

const archiveChat = asyncHandler(async (req, res) => {
  const result = await chatService.archiveChat({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const clearChat = asyncHandler(async (req, res) => {
  const result = await chatService.clearChatForUser({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res
    .status(result.statusCode)
    .json(new ApiResponse(true, result.message, result.statusCode, null));
});

const getArchivedChats = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const result = await chatService.getArchivedChats(req.userId, page, limit);

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chats: result.chats,
      pagination: result.pagination,
    }),
  );
});

const muteChat = asyncHandler(async (req, res) => {
  const result = await chatService.muteChat({
    userId: req.userId,
    chatId: req.params.chatId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const joinGroup = asyncHandler(async (req, res) => {
  const { inviteLink } = req.body;
  const result = await chatService.joinGroup({
    userId: req.userId,
    groupId: req.params.groupId,
    inviteLink,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const requestJoinGroup = asyncHandler(async (req, res) => {
  const result = await chatService.requestJoinGroup({
    userId: req.userId,
    groupId: req.params.groupId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const approveRequest = asyncHandler(async (req, res) => {
  const { requestUserId } = req.body;
  const result = await chatService.approveRequest({
    userId: req.userId,
    groupId: req.params.groupId,
    requestUserId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const rejectRequest = asyncHandler(async (req, res) => {
  const { requestUserId } = req.body;
  const result = await chatService.rejectRequest({
    userId: req.userId,
    groupId: req.params.groupId,
    requestUserId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const leaveGroup = asyncHandler(async (req, res) => {
  const result = await chatService.leaveGroup({
    userId: req.userId,
    groupId: req.params.groupId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const updateGroupInfo = asyncHandler(async (req, res) => {
  const updates = {
    groupName: req.body.groupName,
    groupDescription: req.body.groupDescription,
    groupPrivacy: req.body.groupPrivacy,
    groupInviteLink: req.body.groupInviteLink,
    groupImage: req.files?.groupImage?.[0],
    groupCoverImage: req.files?.groupCoverImage?.[0],
  };

  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const result = await chatService.updateGroupInfo({
    userId: req.userId,
    groupId: req.params.groupId,
    updates,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const makeAdmin = asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  const result = await chatService.makeAdmin({
    userId: req.userId,
    groupId: req.params.groupId,
    memberId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const removeAdmin = asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  const result = await chatService.removeAdmin({
    userId: req.userId,
    groupId: req.params.groupId,
    memberId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const removeMember = asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  const result = await chatService.removeMember({
    userId: req.userId,
    groupId: req.params.groupId,
    memberId,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

const addMembers = asyncHandler(async (req, res) => {
  let { memberIds = [] } = req.body;
  if (typeof memberIds === "string") {
    try {
      memberIds = JSON.parse(memberIds);
    } catch (e) {
      memberIds = [];
    }
  }

  const result = await chatService.addMembersToGroup({
    userId: req.userId,
    groupId: req.params.groupId,
    memberIds,
  });

  return res.status(result.statusCode).json(
    new ApiResponse(true, result.message, result.statusCode, {
      chat: result.chat,
    }),
  );
});

export {
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
};
