import messageModel from "../models/message.model.js";
import chatModel from "../models/chat.model.js";
import chatService from "./chat.service.js";
import ApiError from "../utils/apiError.js";
import { uploadMultipleToCloudinary } from "../utils/cloudinaryUpload.js";
import { extractMentions, getUserIdsFromUsernames } from "../utils/mentionHelper.js";
import {
  emitMessageToChat,
  emitMessageSeen,
  emitChatMessageMutation,
} from "../socket/socketEmitter.js";

const validReactions = new Set(["like", "love", "haha", "wow", "sad", "angry"]);

class MessageService {
  async sendMessage({ chatId, senderId, content, mediaFiles = [], type, replyTo = null }) {
    if (!chatId) {
      throw new ApiError(400, "Chat ID is required");
    }

    if (!senderId) {
      throw new ApiError(401, "User authentication required");
    }

    await chatService.findChatForUser(senderId, chatId);

    const hasText = typeof content === "string" && content.trim().length > 0;
    const hasMedia = Array.isArray(mediaFiles) && mediaFiles.length > 0;

    if (!hasText && !hasMedia) {
      throw new ApiError(400, "Message content or media is required");
    }

    let media = [];
    if (hasMedia) {
      const uploadedMedia = await uploadMultipleToCloudinary(mediaFiles, "vibely/messages");
      media = uploadedMedia.map((file) => ({
        url: file.url,
        url_public_id: file.public_id,
        type: file.type === "video" ? "video" : "image",
      }));
    }

    const mentions = await this._resolveMentions(content);
    const messageType = type || (hasMedia ? media[0].type : "text");

    const message = await messageModel.create({
      chat_id: chatId,
      sender: senderId,
      content: hasText ? content.trim() : "",
      type: messageType,
      media,
      reply_to: replyTo,
      mentions,
    });

    await chatModel.findByIdAndUpdate(chatId, { lastMessage: message._id });

    // Populate for real-time emission
    const populatedMessage = await messageModel
      .findById(message._id)
      .populate("sender", "_id username profile.profile_picture profile.full_name")
      .populate({
        path: "reply_to",
        populate: {
          path: "sender",
          select: "_id username profile.profile_picture profile.full_name",
        },
      })
      .lean();

    // Fire socket emission without blocking response
    setImmediate(() => {
      emitMessageToChat(chatId, populatedMessage);
    });
    
    return populatedMessage;
  }

  async getMessages(chatId, userId, page = 1, limit = 50) {
    await chatService.findChatForUser(userId, chatId);

    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {
      chat_id: chatId,
      "deleted_for.user": { $ne: userId },
    };

    const [messages, totalMessages] = await Promise.all([
      messageModel
        .find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate("sender", "_id username profile.profile_picture profile.full_name")
        .populate({
          path: "reply_to",
          populate: {
            path: "sender",
            select: "_id username profile.profile_picture profile.full_name",
          },
        }),
      messageModel.countDocuments(query),
    ]);

    return {
      messages,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalMessages / parsedLimit) || 1,
        totalMessages,
        perPage: parsedLimit,
        hasNextPage: parsedPage * parsedLimit < totalMessages,
        hasPrevPage: parsedPage > 1,
      },
    };
  }

  async searchMessages(chatId, userId, searchTerm, page = 1, limit = 50) {
    if (!searchTerm || !searchTerm.trim()) {
      return this.getMessages(chatId, userId, page, limit);
    }

    await chatService.findChatForUser(userId, chatId);

    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (parsedPage - 1) * parsedLimit;
    const regex = new RegExp(searchTerm.trim(), "i");

    const query = {
      chat_id: chatId,
      "deleted_for.user": { $ne: userId },
      content: { $regex: regex },
    };

    const [messages, totalMessages] = await Promise.all([
      messageModel
        .find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate("sender", "_id username profile.profile_picture profile.full_name")
        .populate({
          path: "reply_to",
          populate: {
            path: "sender",
            select: "_id username profile.profile_picture profile.full_name",
          },
        }),
      messageModel.countDocuments(query),
    ]);

    return {
      messages,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalMessages / parsedLimit) || 1,
        totalMessages,
        perPage: parsedLimit,
        hasNextPage: parsedPage * parsedLimit < totalMessages,
        hasPrevPage: parsedPage > 1,
      },
    };
  }

  async editMessage(messageId, userId, content) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    if (!content || !content.trim()) {
      throw new ApiError(400, "Message content is required");
    }

    const message = await messageModel.findOne({
      _id: messageId,
      sender: userId,
      deleted_for_everyone: false,
    });

    if (!message) {
      throw new ApiError(404, "Message not found or cannot be edited");
    }

    message.content = content.trim();
    message.is_edited = true;
    message.edited_at = new Date();

    await message.save();

    const populated = await messageModel
      .findById(message._id)
      .populate("sender", "_id username profile.profile_picture profile.full_name")
      .populate({
        path: "reply_to",
        populate: {
          path: "sender",
          select: "_id username profile.profile_picture profile.full_name",
        },
      })
      .lean();

    emitChatMessageMutation(populated.chat_id, {
      type: "message_edited",
      message: populated,
    });

    return populated;
  }

  async replyMessage(messageId, userId, content, mediaFiles = []) {
    if (!messageId) {
      throw new ApiError(400, "Original message ID is required");
    }

    const originalMessage = await messageModel.findById(messageId);
    if (!originalMessage || originalMessage.deleted_for_everyone) {
      throw new ApiError(404, "Original message not found");
    }

    return this.sendMessage({
      chatId: originalMessage.chat_id,
      senderId: userId,
      content,
      mediaFiles,
      replyTo: originalMessage._id,
    });
  }

  async forwardMessage(messageId, userId, targetChatIds = []) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    const chatIds = Array.isArray(targetChatIds) ? targetChatIds : [targetChatIds];
    if (chatIds.length === 0) {
      throw new ApiError(400, "At least one target chat ID is required");
    }

    const originalMessage = await messageModel.findById(messageId);
    if (!originalMessage || originalMessage.deleted_for_everyone) {
      throw new ApiError(404, "Original message not found");
    }

    const results = [];
    for (const targetChatId of chatIds) {
      try {
        await chatService.findChatForUser(userId, targetChatId);

        const forwardedMessage = await messageModel.create({
          chat_id: targetChatId,
          sender: userId,
          content: originalMessage.content,
          type: originalMessage.type,
          media: originalMessage.media,
          mentions: originalMessage.mentions,
          reply_to: null,
          is_forwarded: true,
        });

        await chatModel.findByIdAndUpdate(targetChatId, { lastMessage: forwardedMessage._id });
        
        const populated = await messageModel
          .findById(forwardedMessage._id)
          .populate("sender", "_id username profile.profile_picture profile.full_name")
          .lean();

        // Fire socket emission without blocking response
        setImmediate(() => {
          emitMessageToChat(targetChatId, populated);
        });
        
        results.push(populated);
      } catch (error) {
        console.error(`Error forwarding to chat ${targetChatId}:`, error);
      }
    }

    return results;
  }

  async markAsSeen(chatId, userId) {
    if (!chatId) {
      throw new ApiError(400, "Chat ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    await chatService.findChatForUser(userId, chatId);

    const messages = await messageModel.find({
      chat_id: chatId,
      deleted_for_everyone: false,
      "deleted_for.user": { $ne: userId },
      "seenBy.user": { $ne: userId },
    });

    const now = new Date();
    await Promise.all(
      messages.map(async (message) => {
        message.seenBy.push({
          user: userId,
          seen_at: now,
        });
        await message.save();
      }),
    );

    const payload = {
      chatId,
      userId,
      marked: messages.length,
      seen_at: now,
    };

    emitMessageSeen(chatId, payload);
    return { marked: messages.length };
  }

  async deleteForMe(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    const alreadyDeleted = message.deleted_for.some(
      (entry) => entry.user.toString() === userId.toString(),
    );

    if (!alreadyDeleted) {
      message.deleted_for.push({
        user: userId,
        deleted_at: new Date(),
      });
      await message.save();
    }

    return message;
  }

  async deleteForEveryone(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    const sid = message.sender?._id ?? message.sender?.id ?? message.sender;
    const senderStr = String(sid ?? "").trim();

    if (!senderStr || senderStr !== String(userId).trim()) {
      throw new ApiError(403, "Only the sender can delete a message for everyone");
    }

    message.deleted_for_everyone = true;
    message.deleted_for_everyone_at = new Date();

    await message.save();

    emitChatMessageMutation(message.chat_id, {
      type: "deleted_for_everyone",
      chatId: message.chat_id?.toString?.() ?? String(message.chat_id),
      messageId: message._id?.toString?.() ?? String(message._id),
    });

    return message;
  }

  async reactToMessage(messageId, userId, reaction) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    if (!reaction) {
      throw new ApiError(400, "Reaction is required");
    }

    if (!validReactions.has(reaction)) {
      throw new ApiError(
        400,
        `Invalid reaction. Allowed values: ${Array.from(validReactions).join(", ")}`,
      );
    }

    const message = await messageModel.findById(messageId);

    if (!message || message.deleted_for_everyone) {
      throw new ApiError(404, "Message not found");
    }

    const existingReaction = message.reactions.find(
      (item) => item.user_id.toString() === userId.toString(),
    );

    if (existingReaction) {
      existingReaction.reaction = reaction;
    } else {
      message.reactions.push({
        user_id: userId,
        reaction,
      });
    }

    await message.save();
    
    const populated = await messageModel
      .findById(message._id)
      .populate("sender", "_id username profile.profile_picture profile.full_name")
      .populate({
        path: "reply_to",
        populate: {
          path: "sender",
          select: "_id username profile.profile_picture profile.full_name",
        },
      })
      .lean();

    emitChatMessageMutation(populated.chat_id, {
      type: "message_reaction_updated",
      message: populated,
    });

    return populated;
  }

  async removeReaction(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message || message.deleted_for_everyone) {
      throw new ApiError(404, "Message not found");
    }

    message.reactions = message.reactions.filter(
      (item) => item.user_id.toString() !== userId.toString(),
    );

    await message.save();
    
    const populated = await messageModel
      .findById(message._id)
      .populate("sender", "_id username profile.profile_picture profile.full_name")
      .populate({
        path: "reply_to",
        populate: {
          path: "sender",
          select: "_id username profile.profile_picture profile.full_name",
        },
      })
      .lean();

    emitChatMessageMutation(populated.chat_id, {
      type: "message_reaction_updated",
      message: populated,
    });

    return populated;
  }

  async pinMessage(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message || message.deleted_for_everyone) {
      throw new ApiError(404, "Message not found");
    }

    if (message.sender.toString() !== userId.toString()) {
      throw new ApiError(403, "Only the message sender can pin this message");
    }

    message.is_pinned = true;
    message.pinned_by = userId;
    message.pinned_at = new Date();

    await message.save();
    return message;
  }

  async unpinMessage(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message || message.deleted_for_everyone) {
      throw new ApiError(404, "Message not found");
    }

    if (
      message.sender.toString() !== userId.toString() &&
      message.pinned_by?.toString() !== userId.toString()
    ) {
      throw new ApiError(403, "Only the message sender or pin owner can unpin this message");
    }

    message.is_pinned = false;
    message.pinned_by = null;
    message.pinned_at = null;

    await message.save();
    return message;
  }

  async adminDeleteMessage(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message) {
      throw new ApiError(404, "Message not found");
    }

    const chat = await chatService.findChatForUser(userId, message.chat_id);

    if (!chat.isGroup || !chatService._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can perform this action");
    }

    message.deleted_for_everyone = true;
    message.deleted_for_everyone_at = new Date();

    await message.save();
    return message;
  }

  async adminPinMessage(messageId, userId) {
    if (!messageId) {
      throw new ApiError(400, "Message ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const message = await messageModel.findById(messageId);

    if (!message || message.deleted_for_everyone) {
      throw new ApiError(404, "Message not found");
    }

    const chat = await chatService.findChatForUser(userId, message.chat_id);

    if (!chat.isGroup || !chatService._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can perform this action");
    }

    message.is_pinned = true;
    message.pinned_by = userId;
    message.pinned_at = new Date();

    await message.save();
    return message;
  }

  async _resolveMentions(text) {
    if (!text || !text.trim()) {
      return [];
    }

    const usernames = extractMentions(text);
    if (!usernames.length) {
      return [];
    }

    return await getUserIdsFromUsernames(usernames);
  }
}

const messageService = new MessageService();
export default messageService;
