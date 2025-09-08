const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

// Ensure upload directory exists
const uploadDir = "uploads/avatars";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create a default avatar if it doesn't exist
const createDefaultAvatar = async () => {
  const defaultAvatarPath = path.join(uploadDir, "default_avatar.jpg");
  if (!fs.existsSync(defaultAvatarPath)) {
    // Create a simple default avatar
    const svgBuffer = Buffer.from(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="95" fill="#7b68ee"/>
        <text x="100" y="110" text-anchor="middle" fill="white" font-size="40">👤</text>
      </svg>
    `);

    await sharp(svgBuffer)
      .jpeg({ quality: 80, progressive: true })
      .toFile(defaultAvatarPath);
  }
};

createDefaultAvatar().catch(console.error);

// Configure multer for file upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Process and save avatar
const processAvatar = async (fileBuffer, userId) => {
  try {
    const filename = `avatar_${userId}_${uuidv4()}.jpg`;
    const filepath = path.join(uploadDir, filename);

    // Process image: resize, convert to JPEG, and save
    await sharp(fileBuffer)
      .resize(200, 200) // Resize to 200x200
      .jpeg({
        quality: 80,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(filepath);

    return filename;
  } catch (error) {
    throw new Error("Failed to process avatar: " + error.message);
  }
};

// Delete avatar file
const deleteAvatar = (filename) => {
  if (filename && filename !== "default_avatar.jpg") {
    const filepath = path.join(uploadDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
  }
  return false;
};

// Get avatar URL
const getAvatarUrl = (filename) => {
  if (!filename) return "/api/avatars/default_avatar.jpg";
  return `/api/avatars/${filename}`;
};

// Get avatar file path
const getAvatarPath = (filename) => {
  return path.join(uploadDir, filename || "default_avatar.jpg");
};

module.exports = {
  upload,
  processAvatar,
  deleteAvatar,
  getAvatarUrl,
  getAvatarPath,
};
