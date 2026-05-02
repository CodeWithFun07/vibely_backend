import multer from "multer";

// Configure multer storage
const storage = multer.memoryStorage();

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

const uploadSingleFile = (fieldName) => {
  return upload.single(fieldName);
};

// Accepts either:
//   uploadMultipleFiles("media", 10)              → single field
//   uploadMultipleFiles([{name,maxCount}, ...])   → multiple distinct fields
const uploadMultipleFiles = (fieldNameOrFields, maxCount) => {
  if (Array.isArray(fieldNameOrFields)) {
    return upload.fields(fieldNameOrFields);
  }
  return upload.fields([{ name: fieldNameOrFields, maxCount: maxCount || 10 }]);
};

export { uploadSingleFile, uploadMultipleFiles };
