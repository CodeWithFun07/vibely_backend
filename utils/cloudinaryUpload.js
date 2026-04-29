import cloudinary from "../config/cloudinary.config.js";
import getDataUri from "../config/datauri.config.js";
import ApiError from "./apiError.js";

/**
 * Upload media file to Cloudinary
 * @param {Object} file - File object from multer (req.files)
 * @param {string} folder - Cloudinary folder path
 * @returns {Object} - { url, public_id, resource_type }
 */
const uploadToCloudinary = async (file, folder = "vibely/posts") => {
  try {
    if (!file) {
      throw new ApiError(400, "No file provided");
    }

    // Get data URI from file buffer
    const dataUri = getDataUri(file);

    if (!dataUri) {
      throw new ApiError(400, "Failed to process file");
    }

    // Determine resource type based on MIME type
    let resourceType = "auto"; // auto detects image or video

    if (file.mimetype && file.mimetype.startsWith("video")) {
      resourceType = "video";
    } else if (file.mimetype && file.mimetype.startsWith("image")) {
      resourceType = "image";
    }

    // Upload to Cloudinary with resource type
    const result = await cloudinary.uploader.upload(dataUri.content, {
      folder: folder,
      resource_type: resourceType,
      type: "upload",
      quality: "auto", // Auto optimize quality
      eager: resourceType === "video" ? [{ quality: "auto" }] : undefined,
    });

    return {
      url: result.secure_url,
      public_id: result.public_id,
      type: resourceType === "video" ? "video" : "image",
      resource_type: resourceType,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new ApiError(500, `Failed to upload media: ${error.message}`);
  }
};

/**
 * Upload multiple media files to Cloudinary
 * @param {Array} files - Array of file objects from multer
 * @param {string} folder - Cloudinary folder path
 * @returns {Array} - Array of { url, public_id, type }
 */
const uploadMultipleToCloudinary = async (
  files,
  folder = "vibely/posts"
) => {
  try {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file, folder)
    );

    const uploadedMedia = await Promise.all(uploadPromises);

    return uploadedMedia;
  } catch (error) {
    console.error("Multiple file upload error:", error);
    throw error;
  }
};

/**
 * Delete media from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Type: image or video
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    if (!publicId) {
      throw new ApiError(400, "Public ID required");
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new ApiError(500, `Failed to delete media: ${error.message}`);
  }
};

export {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
};
