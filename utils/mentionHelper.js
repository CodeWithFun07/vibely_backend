import User from "../models/user.model.js";

/**
 * Extracts mentions from text (e.g., @username)
 * @param {string} text - The text to parse
 * @returns {Array<string>} - Array of usernames found in mentions
 */
export const extractMentions = (text) => {
  if (!text) return [];
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = new Set();
  for (const match of matches) {
    usernames.add(match[1]);
  }
  return Array.from(usernames);
};

/**
 * Finds user IDs for a list of usernames
 * @param {Array<string>} usernames - List of usernames
 * @returns {Array<string>} - Array of user IDs
 */
export const getUserIdsFromUsernames = async (usernames) => {
  if (!usernames || usernames.length === 0) return [];
  const lowercasedUsernames = usernames.map((u) => u.toLowerCase());
  const users = await User.find({ username: { $in: lowercasedUsernames } }).select("_id");
  return users.map((user) => user._id.toString());
};
