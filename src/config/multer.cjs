const multer = require('multer');
const { extname, resolve } = require('node:path');
const { v4 } = require('uuid');

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

module.exports = {
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const isAllowedFile =
      allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype);

    if (!isAllowedFile) {
      const error = new Error('Only JPG, PNG and WebP images are allowed.');
      error.statusCode = 400;

      return callback(error);
    }

    return callback(null, true);
  },
  storage: multer.diskStorage({
    destination: resolve(__dirname, '..', '..', 'uploads'),
    filename: (_request, file, callback) => {
      const uniqueName = v4().concat(extname(file.originalname).toLowerCase());
      return callback(null, uniqueName);
    },
  }),
};
