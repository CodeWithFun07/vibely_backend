import chatModel from "../models/chat.model.js";
import userModel from "../models/user.model.js";
import messageModel from "../models/message.model.js";
import Follow from "../models/follow.model.js";
import Block from "../models/block.model.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { emitChatCreated } from "../socket/socketEmitter.js";
import ApiError from "../utils/apiError.js";
import getDataUri from "../config/datauri.config.js";

class ChatService {
  async createChat({ senderId, recieverId }) {
    if (!senderId) {
      throw new ApiError(400, "Sender ID is required");
    }

    if (!recieverId) {
      throw new ApiError(400, "Receiver ID is required");
    }

    if (senderId.toString() === recieverId.toString()) {
      throw new ApiError(400, "Cannot create a chat with yourself");
    }

    const receiver = await userModel
      .findOne({
        _id: recieverId,
        isDeleted: false,
        is_active: true,
        is_verified: true,
        is_banned: false,
      })
      .select("message_privacy");

    if (!receiver) {
      throw new ApiError(404, "Receiver not found or cannot receive messages");
    }

    if (receiver.message_privacy === "no_one") {
      throw new ApiError(403, "This user does not accept direct messages");
    }

    if (receiver.message_privacy === "followers") {
      const isFollower = await Follow.findOne({
        followed_by: senderId,
        following: recieverId,
      });

      if (!isFollower) {
        throw new ApiError(
          403,
          "Only followers can start a chat with this user",
        );
      }
    }

    const blockedRecord = await Block.findOne({
      $or: [
        { blocked_by: senderId, blocked_user: recieverId, isActive: true },
        { blocked_by: recieverId, blocked_user: senderId, isActive: true },
      ],
    });

    if (blockedRecord) {
      throw new ApiError(
        403,
        "Chat cannot be created because one of the users has blocked the other",
      );
    }

    const existingChat = await chatModel.findOne({
      isGroup: false,
      isDeleted: false,
      participants: { $all: [senderId, recieverId] },
    });

    if (existingChat) {
      return {
        statusCode: 200,
        message: "Chat already exists",
        chat: existingChat,
      };
    }

    const newChat = await chatModel.create({
      participants: [senderId, recieverId],
      isGroup: false,
    });

    emitChatCreated([recieverId], newChat);

    return {
      statusCode: 201,
      message: "Chat created successfully",
      chat: newChat,
    };
  }

  async createGroup({
    creatorId,
    groupName,
    memberIds = [],
    groupPrivacy = "public",
    groupDescription = null,
    groupImage = null,
    groupCoverImage = null,
    groupInviteLink = null,
  }) {
    if (!creatorId) {
      throw new ApiError(400, "Creator ID is required");
    }

    if (!groupName || typeof groupName !== "string") {
      throw new ApiError(400, "Group name is required");
    }

    const validPrivacy = ["public", "private_link", "approval_required"];
    if (!validPrivacy.includes(groupPrivacy)) {
      groupPrivacy = "public";
    }

    const participantIds = Array.from(
      new Set([
        creatorId.toString(),
        ...(memberIds || []).map((id) => id.toString()),
      ]),
    );

    const members = participantIds.map((id) => ({
      user: id,
      role: id.toString() === creatorId.toString() ? "admin" : "member",
      joined_at: new Date(),
    }));

    // Upload group image if provided
    let uploadedGroupImage = null;
    let uploadedGroupImage_public_id = null;
    if (groupImage) {
      const uploadedGroupImageUrl = await uploadToCloudinary(
        groupImage,
        "vibely/groups",
      );
      uploadedGroupImage = uploadedGroupImageUrl.url;
      uploadedGroupImage_public_id = uploadedGroupImageUrl.public_id;
    }

    // Upload group cover image if provided
    let uploadedGroupCoverImage = null;
    let uploadedGroupCoverImage_public_id = null;
    if (groupCoverImage) {
      const uploadedGroupCoverImageUrl = await uploadToCloudinary(
        groupCoverImage,
        "vibely/groups",
      );
      uploadedGroupCoverImage = uploadedGroupCoverImageUrl.url;
      uploadedGroupCoverImage_public_id = uploadedGroupCoverImageUrl.public_id;
    }

    const newGroup = await chatModel.create({
      participants: participantIds,
      isGroup: true,
      groupName,
      groupDescription,
      groupImage: uploadedGroupImage || null,
      groupImage_public_id: uploadedGroupImage_public_id || null,
      groupCoverImage: uploadedGroupCoverImage || null,
      groupCoverImage_public_id: uploadedGroupCoverImage_public_id || null,
      groupPrivacy,
      groupInviteLink,
      groupAdmin: creatorId,
      members,
    });

    const notifyUserIds = participantIds.filter(
      (id) => id.toString() !== creatorId.toString(),
    );
    if (notifyUserIds.length > 0) {
      emitChatCreated(notifyUserIds, newGroup);
    }

    return {
      statusCode: 201,
      message: "Group chat created successfully",
      chat: newGroup,
    };
  }

  async getAllChats(userId, page = 1, limit = 20) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    const skip = Math.max(0, page - 1) * limit;
    const query = { 
      participants: userId, 
      isDeleted: false,
      archived_by: { $ne: userId },
      is_archived: { $ne: true } // Backward compatibility
    };

    const [chats, totalChats] = await Promise.all([
      chatModel
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          "participants",
          "_id username profile.profile_picture profile.full_name is_online last_seen",
        )
        .populate("lastMessage")
        .populate({
          path: "groupAdmin",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .populate({
          path: "members.user",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .populate({
          path: "joinRequests.user",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .lean(),
      chatModel.countDocuments(query),
    ]);

    // Calculate unread count for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await messageModel.countDocuments({
          chat_id: chat._id,
          sender: { $ne: userId },
          deleted_for_everyone: false,
          "seenBy.user": { $ne: userId },
        });
        return { ...chat, unread_count: unreadCount };
      }),
    );

    return {
      statusCode: 200,
      message: "Chats fetched successfully",
      chats: chatsWithUnread,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalChats / limit) || 1,
        totalChats,
        perPage: limit,
        hasNextPage: page * limit < totalChats,
        hasPrevPage: page > 1,
      },
    };
  }

  async getArchivedChats(userId, page = 1, limit = 20) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    const skip = Math.max(0, page - 1) * limit;
    const query = { 
      participants: userId, 
      isDeleted: false,
      $or: [
        { archived_by: userId },
        { is_archived: true } // Backward compatibility
      ]
    };

    const [chats, totalChats] = await Promise.all([
      chatModel
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          "participants",
          "_id username profile.profile_picture profile.full_name is_online last_seen",
        )
        .populate("lastMessage")
        .populate({
          path: "groupAdmin",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .populate({
          path: "members.user",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .populate({
          path: "joinRequests.user",
          select: "_id username profile.profile_picture profile.full_name email",
        })
        .lean(),
      chatModel.countDocuments(query),
    ]);

    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await messageModel.countDocuments({
          chat_id: chat._id,
          sender: { $ne: userId },
          deleted_for_everyone: false,
          "seenBy.user": { $ne: userId },
        });
        return { ...chat, unread_count: unreadCount };
      }),
    );

    return {
      statusCode: 200,
      message: "Archived chats fetched successfully",
      chats: chatsWithUnread,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalChats / limit) || 1,
        totalChats,
        perPage: limit,
        hasNextPage: page * limit < totalChats,
        hasPrevPage: page > 1,
      },
    };
  }

  async getUnreadMessageCount(userId) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    const chats = await chatModel.find({
      participants: userId,
      isDeleted: false,
    }).select("_id");

    const chatIds = chats.map(chat => chat._id);

    const totalUnread = await messageModel.countDocuments({
      chat_id: { $in: chatIds },
      sender: { $ne: userId },
      deleted_for_everyone: false,
      "seenBy.user": { $ne: userId },
    });

    return totalUnread;
  }

  async getSingleChat({ userId, chatId }) {
    const chat = await this.findChatForUser(userId, chatId);

    const populatedChat = await chatModel
      .findById(chat._id)
      .populate(
        "participants",
        "_id username profile.profile_picture profile.full_name is_online last_seen",
      )
      .populate("lastMessage")
      .populate({
        path: "groupAdmin",
        select: "_id username profile.profile_picture profile.full_name email",
      })
      .populate({
        path: "members.user",
        select: "_id username profile.profile_picture profile.full_name email",
      })
      .populate({
        path: "joinRequests.user",
        select: "_id username profile.profile_picture profile.full_name email",
      })
      .lean();

    return {
      statusCode: 200,
      message: "Chat fetched successfully",
      chat: populatedChat,
    };
  }

  async getChatDetail({ userId, chatId }) {
    await this.findChatForUser(userId, chatId);

    const messages = await messageModel
      .find({ chat_id: chatId })
      .select("content media")
      .lean();

    let mediaList = [];
    let linkList = [];
    let totalMediaMessages = 0;
    let totalMediaFiles = 0;
    let totalImageFiles = 0;
    let totalVideoFiles = 0;
    let totalLinkMessages = 0;
    let totalLinks = 0;
    const urlRegex = /https?:\/\/[^\s"]+/gi;

    for (const message of messages) {
      if (Array.isArray(message.media) && message.media.length > 0) {
        totalMediaMessages += 1;
        totalMediaFiles += message.media.length;
        for (const file of message.media) {
          mediaList.push({
            url: file.url,
            type: file.type,
            messageId: message._id,
          });
          if (file.type === "image") totalImageFiles += 1;
          if (file.type === "video") totalVideoFiles += 1;
        }
      }

      const foundLinks = (message.content || "").match(urlRegex);
      if (foundLinks?.length) {
        totalLinkMessages += 1;
        totalLinks += foundLinks.length;
        foundLinks.forEach(link => {
          linkList.push({
            url: link,
            messageId: message._id
          });
        });
      }
    }

    return {
      statusCode: 200,
      message: "Chat detail fetched successfully",
      detail: {
        chatId,
        totalMessages: messages.length,
        totalMediaMessages,
        totalMediaFiles,
        totalImageFiles,
        totalVideoFiles,
        totalLinkMessages,
        totalLinks,
        media: mediaList,
        links: linkList
      },
    };
  }

  async deleteChat({ userId, chatId }) {
    const chat = await this.findChatForUser(userId, chatId);
    chat.isDeleted = true;
    await chat.save();

    return {
      statusCode: 200,
      message: "Chat deleted successfully",
    };
  }

  async archiveChat({ userId, chatId }) {
    const chat = await this.findChatForUser(userId, chatId);
    
    // Ensure archived_by is an array
    if (!Array.isArray(chat.archived_by)) {
      chat.archived_by = [];
    }

    // Check if user has already archived this chat
    const isArchived = chat.archived_by.some(id => id.toString() === userId.toString()) || chat.is_archived === true;
    
    if (isArchived) {
      chat.archived_by = chat.archived_by.filter(id => id.toString() !== userId.toString());
      chat.is_archived = false; // Reset old field
    } else {
      chat.archived_by.push(userId);
    }
    
    await chat.save();

    return {
      statusCode: 200,
      message: isArchived ? "Chat unarchived successfully" : "Chat archived successfully",
      chat,
    };
  }

  /**
   * Hide all messages in this chat for the current user only (same as Delete for me on each message).
   */
  async clearChatForUser({ userId, chatId }) {
    await this.findChatForUser(userId, chatId);

    await messageModel.updateMany(
      {
        chat_id: chatId,
        deleted_for_everyone: false,
        $nor: [{ deleted_for: { $elemMatch: { user: userId } } }],
      },
      {
        $push: {
          deleted_for: {
            user: userId,
            deleted_at: new Date(),
          },
        },
      },
    );

    const lastVisible = await messageModel
      .findOne({
        chat_id: chatId,
        deleted_for_everyone: false,
        $nor: [{ deleted_for: { $elemMatch: { user: userId } } }],
      })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    await chatModel.findByIdAndUpdate(chatId, {
      lastMessage: lastVisible?._id ?? null,
    });

    return {
      statusCode: 200,
      message: "Chat cleared for you",
    };
  }

  async muteChat({ userId, chatId }) {
    const chat = await this.findChatForUser(userId, chatId);
    const participantId = userId.toString();
    const mutedBy = chat.muted_by.map((id) => id.toString());
    const isMuted = mutedBy.includes(participantId);

    if (isMuted) {
      chat.muted_by = chat.muted_by.filter(
        (id) => id.toString() !== participantId,
      );
    } else {
      chat.muted_by.push(userId);
    }

    await chat.save();

    return {
      statusCode: 200,
      message: isMuted ? "Chat unmuted" : "Chat muted",
      chat,
    };
  }

  async joinGroup({ userId, groupId, inviteLink = null }) {
    const chat = await this.findGroupChat(groupId);
    if (this._isParticipant(chat, userId)) {
      return {
        statusCode: 200,
        message: "Already a group member",
        chat,
      };
    }

    if (chat.groupPrivacy === "private_link") {
      if (!inviteLink || inviteLink !== chat.groupInviteLink) {
        throw new ApiError(
          403,
          "Valid invite link required to join this group",
        );
      }
    }

    if (chat.groupPrivacy === "approval_required") {
      const existingRequest = chat.joinRequests.find(
        (request) => request.user.toString() === userId.toString(),
      );

      if (existingRequest) {
        if (existingRequest.status === "pending") {
          throw new ApiError(400, "Join request already pending");
        }

        existingRequest.status = "pending";
        await chat.save();

        return {
          statusCode: 200,
          message: "Join request resubmitted",
          chat,
        };
      }

      chat.joinRequests.push({ user: userId, status: "pending" });
      await chat.save();

      return {
        statusCode: 200,
        message: "Join request submitted",
        chat,
      };
    }

    chat.participants.push(userId);
    chat.members.push({ user: userId, role: "member", joined_at: new Date() });
    await chat.save();

    return {
      statusCode: 200,
      message: "Joined group successfully",
      chat,
    };
  }

  async requestJoinGroup({ userId, groupId }) {
    const chat = await this.findGroupChat(groupId);

    if (this._isParticipant(chat, userId)) {
      throw new ApiError(400, "You are already a member of this group");
    }

    if (chat.groupPrivacy !== "approval_required") {
      throw new ApiError(400, "This group does not require join approval");
    }

    const existingRequest = chat.joinRequests.find(
      (request) => request.user.toString() === userId.toString(),
    );

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        throw new ApiError(400, "Join request already pending");
      }

      existingRequest.status = "pending";
      await chat.save();

      return {
        statusCode: 200,
        message: "Join request resubmitted",
        chat,
      };
    }

    chat.joinRequests.push({ user: userId, status: "pending" });
    await chat.save();

    return {
      statusCode: 200,
      message: "Join request submitted",
      chat,
    };
  }

  async approveRequest({ userId, groupId, requestUserId }) {
    if (!requestUserId) {
      throw new ApiError(400, "Request user ID is required");
    }

    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can approve requests");
    }

    const request = chat.joinRequests.find(
      (item) => item.user.toString() === requestUserId.toString(),
    );

    if (!request || request.status !== "pending") {
      throw new ApiError(404, "No pending join request found for this user");
    }

    let addedAsMember = false;
    if (!this._isParticipant(chat, requestUserId)) {
      chat.participants.push(requestUserId);
      chat.members.push({
        user: requestUserId,
        role: "member",
        joined_at: new Date(),
      });
      addedAsMember = true;
    }

    request.status = "approved";
    await chat.save();

    if (addedAsMember) {
      emitChatCreated([requestUserId.toString()], chat);
    }

    return {
      statusCode: 200,
      message: "Join request approved",
      chat,
    };
  }

  async rejectRequest({ userId, groupId, requestUserId }) {
    if (!requestUserId) {
      throw new ApiError(400, "Request user ID is required");
    }

    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can reject requests");
    }

    const request = chat.joinRequests.find(
      (item) => item.user.toString() === requestUserId.toString(),
    );

    if (!request || request.status !== "pending") {
      throw new ApiError(404, "No pending join request found for this user");
    }

    request.status = "rejected";
    await chat.save();

    return {
      statusCode: 200,
      message: "Join request rejected",
      chat,
    };
  }

  async leaveGroup({ userId, groupId }) {
    const chat = await this.findGroupChat(groupId);

    if (!this._isParticipant(chat, userId)) {
      throw new ApiError(403, "You are not a member of this group");
    }

    const memberIndex = chat.members.findIndex(
      (member) => member.user.toString() === userId.toString(),
    );

    chat.participants = chat.participants.filter(
      (participant) => participant.toString() !== userId.toString(),
    );
    if (memberIndex !== -1) {
      chat.members.splice(memberIndex, 1);
    }

    if (chat.groupAdmin?.toString() === userId.toString()) {
      const nextMember = chat.members[0];
      if (!nextMember) {
        chat.isDeleted = true;
        await chat.save();

        return {
          statusCode: 200,
          message: "Group closed because the admin left",
        };
      }

      chat.groupAdmin = nextMember.user;
      nextMember.role = "admin";
    }

    await chat.save();

    return {
      statusCode: 200,
      message: "Left group successfully",
      chat,
    };
  }

  async updateGroupInfo({ userId, groupId, updates = {} }) {
    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can update group info");
    }

    const allowedUpdates = [
      "groupName",
      "groupDescription",
      "groupPrivacy",
      "groupImage",
      "groupCoverImage",
      "groupInviteLink",
    ];

    // Handle image uploads
    if (updates.groupImage) {
      const uploadedImage = await uploadToCloudinary(
        updates.groupImage,
        "vibely/groups",
      );
      if (uploadedImage) {
        // Delete old image if exists
        if (chat.groupImage_public_id) {
          await deleteFromCloudinary(chat.groupImage_public_id);
        }
        chat.groupImage = uploadedImage.url;
        chat.groupImage_public_id = uploadedImage.public_id;
      }
      delete updates.groupImage;
    }

    if (updates.groupCoverImage) {
      const uploadedCover = await uploadToCloudinary(
        updates.groupCoverImage,
        "vibely/groups",
      );
      if (uploadedCover) {
        // Delete old cover if exists
        if (chat.groupCoverImage_public_id) {
          await deleteFromCloudinary(chat.groupCoverImage_public_id);
        }
        chat.groupCoverImage = uploadedCover.url;
        chat.groupCoverImage_public_id = uploadedCover.public_id;
      }
      delete updates.groupCoverImage;
    }

    for (const key of Object.keys(updates)) {
      if (!allowedUpdates.includes(key)) {
        continue;
      }

      chat[key] = updates[key];
    }

    if (
      updates.groupPrivacy &&
      !["public", "private_link", "approval_required"].includes(
        updates.groupPrivacy,
      )
    ) {
      chat.groupPrivacy = "public";
    }

    await chat.save();

    return {
      statusCode: 200,
      message: "Group info updated successfully",
      chat,
    };
  }

  async makeAdmin({ userId, groupId, memberId }) {
    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can change member roles");
    }

    const member = chat.members.find(
      (item) => item.user.toString() === memberId.toString(),
    );

    if (!member) {
      throw new ApiError(404, "Member not found in group");
    }

    member.role = "admin";
    await chat.save();

    return {
      statusCode: 200,
      message: "Member promoted to admin",
      chat,
    };
  }

  async removeAdmin({ userId, groupId, memberId }) {
    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can change member roles");
    }

    if (chat.groupAdmin?.toString() === memberId.toString()) {
      throw new ApiError(400, "Cannot remove admin role from group owner");
    }

    const member = chat.members.find(
      (item) => item.user.toString() === memberId.toString(),
    );

    if (!member) {
      throw new ApiError(404, "Member not found in group");
    }

    member.role = "member";
    await chat.save();

    return {
      statusCode: 200,
      message: "Member demoted from admin",
      chat,
    };
  }

  async removeMember({ userId, groupId, memberId }) {
    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can remove members");
    }

    if (chat.groupAdmin?.toString() === memberId.toString()) {
      throw new ApiError(400, "Cannot remove the group owner");
    }

    chat.participants = chat.participants.filter(
      (participant) => participant.toString() !== memberId.toString(),
    );
    chat.members = chat.members.filter(
      (member) => member.user.toString() !== memberId.toString(),
    );
    chat.joinRequests = chat.joinRequests.filter(
      (request) => request.user.toString() !== memberId.toString(),
    );

    await chat.save();

    return {
      statusCode: 200,
      message: "Member removed from group",
      chat,
    };
  }

  async addMembersToGroup({ userId, groupId, memberIds = [] }) {
    const chat = await this.findGroupChat(groupId);
    if (!this._isGroupAdmin(chat, userId)) {
      throw new ApiError(403, "Only group admins can add members");
    }

    let ids = Array.isArray(memberIds)
      ? memberIds
      : typeof memberIds === "string"
        ? (() => {
            try {
              return JSON.parse(memberIds);
            } catch {
              return [];
            }
          })()
        : [];

    ids = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))].filter(
      (id) => id !== userId.toString(),
    );

    const added = [];

    for (const rawId of ids) {
      if (chat.participants.some((p) => p.toString() === rawId)) {
        continue;
      }

      const candidate = await userModel.findOne({
        _id: rawId,
        isDeleted: false,
        is_active: true,
        is_banned: false,
      });

      if (!candidate) {
        continue;
      }

      chat.participants.push(candidate._id);
      chat.members.push({
        user: candidate._id,
        role: "member",
        joined_at: new Date(),
      });
      added.push(candidate._id.toString());
    }

    if (added.length === 0) {
      throw new ApiError(
        400,
        "No new members were added. They may already be in the group or the accounts could not be used.",
      );
    }

    await chat.save();

    emitChatCreated(added, chat);

    return {
      statusCode: 200,
      message: `${added.length} member(s) added`,
      chat,
    };
  }

  async findChatForUser(userId, chatId) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (!chatId) {
      throw new ApiError(400, "Chat ID is required");
    }

    const chat = await chatModel.findOne({
      _id: chatId,
      participants: userId,
      isDeleted: false,
    });

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    return chat;
  }

  async findGroupChat(groupId) {
    if (!groupId) {
      throw new ApiError(400, "Group ID is required");
    }

    const chat = await chatModel.findOne({
      _id: groupId,
      isDeleted: false,
      isGroup: true,
    });

    if (!chat) {
      throw new ApiError(404, "Group not found");
    }

    return chat;
  }

  _isParticipant(chat, userId) {
    return chat.participants.some(
      (participant) => participant.toString() === userId.toString(),
    );
  }

  _getMember(chat, userId) {
    return chat.members?.find(
      (member) => member.user?.toString() === userId.toString(),
    );
  }

  _isGroupAdmin(chat, userId) {
    return (
      chat.groupAdmin?.toString() === userId.toString() ||
      this._getMember(chat, userId)?.role === "admin"
    );
  }
}

const chatService = new ChatService();

export default chatService;
