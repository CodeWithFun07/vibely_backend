import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import messageService from "../services/message.service.js";

const sendMessage = asyncHandler(async (req, res) => {
  const { chatId, content, type, reply_to } = req.body;
  const mediaFiles = req.files?.media || [];

  const result = await messageService.sendMessage({
    chatId,
    senderId: req.userId,
    content,
    type,
    replyTo: reply_to || null,
    mediaFiles,
  });

  return res.status(201).json(new ApiResponse(true, "Message sent successfully", 201, result));
});

const getMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { page, limit } = req.query;

  const result = await messageService.getMessages(chatId, req.userId, page, limit);

  return res.status(200).json(new ApiResponse(true, "Messages fetched successfully", 200, result));
});

const searchMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { q, page, limit } = req.query;

  const result = await messageService.searchMessages(chatId, req.userId, q, page, limit);

  return res.status(200).json(new ApiResponse(true, "Messages search results", 200, result));
});

const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const result = await messageService.editMessage(messageId, req.userId, content);

  return res.status(200).json(new ApiResponse(true, "Message edited successfully", 200, result));
});

const replyMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const mediaFiles = req.files?.media || [];

  const result = await messageService.replyMessage(messageId, req.userId, content, mediaFiles);

  return res.status(201).json(new ApiResponse(true, "Reply sent successfully", 201, result));
});

const forwardMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { targetChats } = req.body;

  const result = await messageService.forwardMessage(messageId, req.userId, targetChats);

  return res.status(201).json(new ApiResponse(true, "Message forwarded successfully", 201, result));
});

const markAsSeen = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const result = await messageService.markAsSeen(chatId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Messages marked as seen", 200, result));
});

const deleteForMe = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.deleteForMe(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message deleted for you", 200, result));
});

const deleteForEveryone = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.deleteForEveryone(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message deleted for everyone", 200, result));
});

const reactToMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { reaction } = req.body;

  const result = await messageService.reactToMessage(messageId, req.userId, reaction);

  return res.status(200).json(new ApiResponse(true, "Reaction saved", 200, result));
});

const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.removeReaction(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Reaction removed", 200, result));
});

const pinMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.pinMessage(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message pinned", 200, result));
});

const unpinMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.unpinMessage(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message unpinned", 200, result));
});

const adminDeleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.adminDeleteMessage(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message deleted by admin", 200, result));
});

const adminPinMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await messageService.adminPinMessage(messageId, req.userId);

  return res.status(200).json(new ApiResponse(true, "Message pinned by admin", 200, result));
});

export {
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
};
