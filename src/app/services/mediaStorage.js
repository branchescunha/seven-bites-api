import { extname } from 'node:path';
import { env } from '../../config/env.js';

const storageFolders = {
  categories: 'seven-bites/categories',
  products: 'seven-bites/products',
};

const isUrl = (value) => /^https?:\/\//i.test(value || '');

const parseCloudinaryUrl = () => {
  if (!env.cloudinaryUrl) {
    return null;
  }

  const url = new URL(env.cloudinaryUrl);

  return {
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
    cloudName: url.hostname,
  };
};

export const isCloudinaryConfigured = () => Boolean(parseCloudinaryUrl());

export const resolveMediaUrl = (path, routeName) => {
  if (!path) {
    return null;
  }

  if (isUrl(path)) {
    return path;
  }

  return `${env.appUrl}/${routeName}-file/${path}`;
};

export const saveMediaFile = async (file, mediaType) => {
  if (!file) {
    return null;
  }

  const cloudinaryConfig = parseCloudinaryUrl();

  if (!cloudinaryConfig) {
    return file.filename;
  }

  if (!file.buffer) {
    const error = new Error('Cloudinary uploads require memory storage.');
    error.statusCode = 500;
    throw error;
  }

  const formData = new FormData();
  const extension = extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `seven-bites-upload${extension}`;

  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    filename,
  );
  formData.append('folder', storageFolders[mediaType]);

  const credentials = Buffer.from(
    `${cloudinaryConfig.apiKey}:${cloudinaryConfig.apiSecret}`,
  ).toString('base64');

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
    {
      body: formData,
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      method: 'POST',
    },
  );

  if (!uploadResponse.ok) {
    const error = new Error('Image storage upload failed.');
    error.statusCode = 502;
    throw error;
  }

  const upload = await uploadResponse.json();

  return upload.secure_url;
};
