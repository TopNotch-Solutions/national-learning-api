const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadsRoot);
  },
  filename(_req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Only PDF or Word documents are allowed'));
      return;
    }
    cb(null, true);
  },
});

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const uploadImage = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!imageMimeTypes.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadImage, uploadsRoot };
