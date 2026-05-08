import asyncHandler from "../utils/asyncHandler.js";
import bookmarkService from "../services/bookmark.service.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Toggle bookmark on a post
 * POST /api/v1/bookmarks/toggle/:postId
 */
const toggleBookmark = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  const result = await bookmarkService.toggleBookmark(postId, userId);

  return res.status(200).json(
    new ApiResponse(
      true,
      result.isBookmarked ? "Post bookmarked" : "Post unbookmarked",
      200,
      result,
    ),
  );
});

/**
 * Get user's bookmarked posts
 * GET /api/v1/bookmarks?page=1&limit=10
 */
const getBookmarks = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  console.log(userId)

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await bookmarkService.getBookmarks(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Bookmarks fetched successfully", 200, {
      bookmarks: result.bookmarks,
      pagination: result.pagination,
    }),
  );
});

/**
 * Check if post is bookmarked
 * GET /api/v1/bookmarks/isBookmarked/:postId
 */
const isBookmarked = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  const result = await bookmarkService.isBookmarked(postId, userId);

  return res.status(200).json(
    new ApiResponse(true, "Bookmark status fetched", 200, result),
  );
});

export { toggleBookmark, getBookmarks, isBookmarked };
