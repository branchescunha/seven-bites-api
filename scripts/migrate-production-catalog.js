import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { config as loadEnv } from 'dotenv';
import { QueryTypes, Sequelize } from 'sequelize';

process.env.DOTENV_CONFIG_QUIET ??= 'true';
loadEnv({ quiet: true });

let databaseConfig;
let excludedSourceRecords = [];
let productionCategories = [];
let productionProducts = [];

export const parseMode = (args) => {
  if (args.includes('--check-cloudinary-config')) {
    return 'check-cloudinary-config';
  }

  return args.includes('--execute') ? 'execute' : 'dry-run';
};

const mode = parseMode(process.argv.slice(2));
const rootPath = process.cwd();
const uploadsPath = join(rootPath, 'uploads');
const now = () => new Date();
const allowedMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);

  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const makePlaceholderPng = (variant) => {
  const width = 960;
  const height = 640;
  const data = Buffer.alloc((width * 3 + 1) * height);
  const palette =
    variant === 'category'
      ? [
          [33, 89, 72],
          [235, 184, 92],
        ]
      : [
          [122, 43, 33],
          [242, 198, 114],
        ];

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 3 + 1);
    data[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const ratio = (x + y) / (width + height);
      const pixelOffset = rowOffset + 1 + x * 3;
      const stripe = Math.floor((x + y) / 64) % 2 === 0 ? 18 : 0;

      data[pixelOffset] = Math.round(
        palette[0][0] * (1 - ratio) + palette[1][0] * ratio + stripe,
      );
      data[pixelOffset + 1] = Math.round(
        palette[0][1] * (1 - ratio) + palette[1][1] * ratio + stripe,
      );
      data[pixelOffset + 2] = Math.round(
        palette[0][2] * (1 - ratio) + palette[1][2] * ratio + stripe,
      );
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makePngChunk('IHDR', header),
    makePngChunk('IDAT', deflateSync(data)),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const placeholderAssets = {
  category: {
    buffer: makePlaceholderPng('category'),
    extension: '.png',
    mime: 'image/png',
    publicId: 'seven-bites/placeholders/category-placeholder-v1',
  },
  product: {
    buffer: makePlaceholderPng('product'),
    extension: '.png',
    mime: 'image/png',
    publicId: 'seven-bites/placeholders/product-placeholder-v1',
  },
};

const sha256Buffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');

const makeSlug = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const makePublicId = (type, item) =>
  `seven-bites/${type}/${item.id}-${makeSlug(item.name)}`;

const hasMatchingOuterQuotes = (value) =>
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"));

export const normalizeEnvUrl = (value) => {
  const trimmed = value.trim();

  return hasMatchingOuterQuotes(trimmed)
    ? trimmed.slice(1, -1).trim()
    : trimmed;
};

export const inspectCloudinaryConfig = (value = process.env.CLOUDINARY_URL) => {
  const envPresent = Boolean(value);
  const trimmed = envPresent ? value.trim() : '';
  const outerQuotesDetected = envPresent && hasMatchingOuterQuotes(trimmed);
  const whitespaceDetected = envPresent && value !== trimmed;
  const normalized = envPresent ? normalizeEnvUrl(value) : '';
  const cloudinaryPrefix = 'cloudinary://';
  const authority = normalized.includes('://')
    ? normalized.slice(normalized.indexOf('://') + 3)
    : '';
  const atIndex = authority.lastIndexOf('@');
  const credentials = atIndex >= 0 ? authority.slice(0, atIndex) : authority;
  const host = atIndex >= 0 ? authority.slice(atIndex + 1) : '';
  const colonIndex = credentials.indexOf(':');
  let url = null;

  try {
    url = envPresent ? new URL(normalized) : null;
  } catch (_error) {
    url = null;
  }

  const protocolValid = url
    ? url.protocol === 'cloudinary:'
    : normalized.startsWith(cloudinaryPrefix);
  const hasUsername = url
    ? Boolean(url.username)
    : colonIndex > 0 && Boolean(credentials.slice(0, colonIndex));
  const hasPassword = url
    ? Boolean(url.password)
    : colonIndex >= 0 && Boolean(credentials.slice(colonIndex + 1));
  const hasHostname = url ? Boolean(url.hostname) : Boolean(host);
  const parseValid =
    envPresent && protocolValid && hasUsername && hasPassword && hasHostname;

  return {
    envPresent,
    outerQuotesDetected,
    whitespaceDetected,
    protocolValid,
    hasUsername,
    hasPassword,
    hasHostname,
    parseValid,
  };
};

export const parseCloudinaryUrl = (value = process.env.CLOUDINARY_URL) => {
  if (!value) {
    return null;
  }

  let url;

  try {
    url = new URL(normalizeEnvUrl(value));
  } catch (error) {
    const diagnostic = new Error('[Cloudinary] invalid configuration.');
    diagnostic.cause = error;
    throw diagnostic;
  }

  if (
    url.protocol !== 'cloudinary:' ||
    !url.username ||
    !url.password ||
    !url.hostname
  ) {
    throw new Error('[Cloudinary] invalid configuration.');
  }

  return {
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
    cloudName: url.hostname,
  };
};

const loadProductionCatalog = async () => {
  const productionCatalog = await import('./production-catalog-data.js');

  excludedSourceRecords = productionCatalog.excludedSourceRecords;
  productionCategories = productionCatalog.productionCategories;
  productionProducts = productionCatalog.productionProducts;
};

const loadDatabaseConfig = async () => {
  if (!databaseConfig) {
    const databaseConfigModule = await import('../src/config/database.cjs');
    databaseConfig = databaseConfigModule.default;
  }
};

const getNetworkErrorCode = (error) =>
  error?.code || error?.cause?.code || error?.errno || 'UNKNOWN';

const isRetryableNetworkError = (error) =>
  new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
  ]).has(getNetworkErrorCode(error));

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withReadRetry = async (operationName, operation) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = getNetworkErrorCode(error);
      const shouldRetry =
        isRetryableNetworkError(error) && attempt < maxAttempts;

      if (!shouldRetry) {
        const diagnostic = new Error(
          `[${operationName}] ${code} ${error.name}: ${error.message}`,
        );
        diagnostic.cause = error;
        throw diagnostic;
      }

      console.error(
        `[${operationName}] ${code}: retrying read-only operation (${attempt}/${maxAttempts})`,
      );
      await wait(attempt * 500);
    }
  }

  throw new Error(`[${operationName}] retry loop exited unexpectedly.`);
};

const createTargetSequelize = () => {
  if (!databaseConfig.use_env_variable) {
    throw new Error('[Neon] DATABASE_URL target configuration is not active.');
  }

  return new Sequelize(process.env[databaseConfig.use_env_variable], {
    define: databaseConfig.define,
    dialect: databaseConfig.dialect,
    dialectOptions: databaseConfig.dialectOptions,
    logging: false,
  });
};

const getMimeFromSignature = async (filePath) => {
  const buffer = await readFile(filePath);
  const signature = buffer.subarray(0, 12);

  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47
  ) {
    return 'image/png';
  }

  if (
    signature.toString('ascii', 0, 4) === 'RIFF' &&
    signature.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

const inspectAsset = async (item, type) => {
  const sourcePath = item.originalPath;
  const placeholder =
    placeholderAssets[type === 'categories' ? 'category' : 'product'];

  if (!sourcePath || /^https?:\/\//i.test(sourcePath)) {
    return {
      itemId: item.id,
      originalPath: sourcePath,
      reason: sourcePath ? 'remote-source-not-used' : 'missing-path',
      type,
      upload: placeholder,
      usesPlaceholder: true,
    };
  }

  const filePath = join(uploadsPath, basename(sourcePath));
  const extension = extname(filePath).toLowerCase();
  const expectedMime = allowedMimeTypes.get(extension);

  if (!expectedMime) {
    return {
      extension,
      itemId: item.id,
      originalPath: sourcePath,
      reason: 'unsupported-extension',
      type,
      upload: placeholder,
      usesPlaceholder: true,
    };
  }

  try {
    const fileStat = await stat(filePath);
    const mime = await getMimeFromSignature(filePath);

    if (mime !== expectedMime) {
      return {
        extension,
        itemId: item.id,
        mime,
        originalPath: sourcePath,
        reason: 'invalid-mime',
        type,
        upload: placeholder,
        usesPlaceholder: true,
      };
    }

    const buffer = await readFile(filePath);

    return {
      extension,
      filePath,
      hash: sha256Buffer(buffer),
      itemId: item.id,
      mime,
      originalPath: sourcePath,
      publicId: makePublicId(type, item),
      size: fileStat.size,
      type,
      upload: {
        buffer,
        extension,
        mime,
        publicId: makePublicId(type, item),
      },
      usesPlaceholder: false,
    };
  } catch (_error) {
    return {
      extension,
      itemId: item.id,
      originalPath: sourcePath,
      reason: 'missing-file',
      type,
      upload: placeholder,
      usesPlaceholder: true,
    };
  }
};

const loadTargetSnapshot = async () => {
  if (!process.env.DATABASE_URL) {
    return {
      categories: [],
      checked: false,
      products: [],
    };
  }

  return withReadRetry('Neon production catalog read', async () => {
    const sequelize = createTargetSequelize();

    try {
      console.error('[Neon] connecting');
      await sequelize.authenticate();
      console.error('[Neon] connected');

      const categories = await sequelize.query(
        'select id, name, path from categories order by id',
        { type: QueryTypes.SELECT },
      );
      console.error('[Neon] categories snapshot loaded');

      const products = await sequelize.query(
        'select id, name, price, offer, category_id, path from products order by id',
        { type: QueryTypes.SELECT },
      );
      console.error('[Neon] products snapshot loaded');

      return {
        categories,
        checked: true,
        products,
      };
    } finally {
      await sequelize.close().catch(() => {});
      console.error('[Neon] connection closed');
    }
  });
};

const assertProductionTarget = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for --execute.');
  }

  const targetUrl = new URL(process.env.DATABASE_URL);
  const hostname = targetUrl.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local')
  ) {
    throw new Error('DATABASE_URL points to a local database.');
  }

  if (!hostname.includes('neon.tech')) {
    throw new Error(
      'DATABASE_URL does not look like a Neon production target.',
    );
  }

  if (!process.env.CLOUDINARY_URL) {
    throw new Error('CLOUDINARY_URL is required for --execute.');
  }
};

const findCategoryConflicts = (targetCategories) => {
  const targetById = new Map(targetCategories.map((item) => [item.id, item]));
  const targetByName = new Map(
    targetCategories.map((item) => [item.name.toLowerCase(), item]),
  );

  return productionCategories.flatMap((category) => {
    const conflicts = [];
    const sameId = targetById.get(category.id);
    const sameName = targetByName.get(category.name.toLowerCase());

    if (sameId && sameId.name !== category.name) {
      conflicts.push({ id: category.id, reason: 'id-name-mismatch', sameId });
    }

    if (sameName && sameName.id !== category.id) {
      conflicts.push({
        id: category.id,
        reason: 'name-used-by-different-id',
        sameName,
      });
    }

    return conflicts;
  });
};

const findProductConflicts = (targetProducts) => {
  const targetById = new Map(targetProducts.map((item) => [item.id, item]));

  return productionProducts.flatMap((product) => {
    const sameId = targetById.get(product.id);

    if (!sameId) {
      return [];
    }

    const fields = [
      ['name', product.name, sameId.name],
      ['price', product.price, Number(sameId.price)],
      ['offer', product.offer, sameId.offer],
      ['category_id', product.categoryId, sameId.category_id],
    ].filter(([, expected, actual]) => expected !== actual);

    return fields.length
      ? [{ fields: fields.map(([field]) => field), id: product.id, sameId }]
      : [];
  });
};

const getCloudinaryResource = async (cloudinary, publicId) => {
  const credentials = Buffer.from(
    `${cloudinary.apiKey}:${cloudinary.apiSecret}`,
  ).toString('base64');
  const encodedPublicId = publicId.split('/').map(encodeURIComponent).join('/');
  let response;

  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/resources/image/upload/${encodedPublicId}`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    );
  } catch (error) {
    const diagnostic = new Error('[Cloudinary] placeholder lookup failed.');
    diagnostic.cause = error;
    throw diagnostic;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('[Cloudinary] placeholder lookup failed.');
  }

  return response.json();
};

const uploadCloudinaryAsset = async (cloudinary, asset) => {
  const existing = await getCloudinaryResource(cloudinary, asset.publicId);

  if (existing) {
    if (!/^https:\/\//i.test(existing.secure_url || '')) {
      throw new Error('[Cloudinary] placeholder lookup failed.');
    }

    return {
      action: 'reused',
      publicId: asset.publicId,
      secureUrl: existing.secure_url,
    };
  }

  const credentials = Buffer.from(
    `${cloudinary.apiKey}:${cloudinary.apiSecret}`,
  ).toString('base64');
  const formData = new FormData();

  formData.append(
    'file',
    new Blob([asset.buffer], { type: asset.mime }),
    `${basename(asset.publicId)}${asset.extension}`,
  );
  formData.append('public_id', asset.publicId);
  formData.append('overwrite', 'false');

  let response;

  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
      {
        body: formData,
        headers: { Authorization: `Basic ${credentials}` },
        method: 'POST',
      },
    );
  } catch (error) {
    const diagnostic = new Error('[Cloudinary] placeholder upload failed.');
    diagnostic.cause = error;
    throw diagnostic;
  }

  if (!response.ok) {
    throw new Error('[Cloudinary] placeholder upload failed.');
  }

  const upload = await response.json();

  if (!/^https:\/\//i.test(upload.secure_url || '')) {
    throw new Error('[Cloudinary] placeholder upload failed.');
  }

  return {
    action: 'uploaded',
    publicId: asset.publicId,
    secureUrl: upload.secure_url,
  };
};

const uploadMedia = async (assetPlans) => {
  const cloudinary = parseCloudinaryUrl();
  const uploadsByPublicId = new Map();

  for (const assetPlan of assetPlans) {
    const publicId = assetPlan.upload.publicId;

    if (!uploadsByPublicId.has(publicId)) {
      uploadsByPublicId.set(
        publicId,
        await uploadCloudinaryAsset(cloudinary, assetPlan.upload),
      );
    }
  }

  return assetPlans.map((assetPlan) => ({
    ...assetPlan,
    cloudinary: uploadsByPublicId.get(assetPlan.upload.publicId),
  }));
};

export const summarizeCloudinaryExecution = (mediaItems) => {
  const operationsByPublicId = new Map();

  for (const item of mediaItems) {
    if (!operationsByPublicId.has(item.cloudinary.publicId)) {
      operationsByPublicId.set(item.cloudinary.publicId, {
        action: item.cloudinary.action,
        affectedItems: 0,
        publicId: item.cloudinary.publicId,
      });
    }

    operationsByPublicId.get(item.cloudinary.publicId).affectedItems += 1;
  }

  return {
    itemMappings: mediaItems.map(
      ({ cloudinary, itemId, type, usesPlaceholder }) => ({
        itemId,
        publicId: cloudinary.publicId,
        type,
        usesPlaceholder,
      }),
    ),
    operations: [...operationsByPublicId.values()],
  };
};

const insertCatalog = async ({ categoryMedia, productMedia }) => {
  const sequelize = createTargetSequelize();
  const categoryUrlById = new Map(
    categoryMedia.map((item) => [item.itemId, item.cloudinary.secureUrl]),
  );
  const productUrlById = new Map(
    productMedia.map((item) => [item.itemId, item.cloudinary.secureUrl]),
  );
  const timestamp = now();
  const transaction = await sequelize.transaction();

  try {
    for (const category of productionCategories) {
      await sequelize.query(
        `insert into categories (id, name, path, created_at, updated_at)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        {
          bind: [
            category.id,
            category.name,
            categoryUrlById.get(category.id),
            timestamp,
            timestamp,
          ],
          transaction,
        },
      );
    }

    for (const product of productionProducts) {
      await sequelize.query(
        `insert into products (id, name, price, path, offer, category_id, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do nothing`,
        {
          bind: [
            product.id,
            product.name,
            product.price,
            productUrlById.get(product.id),
            product.offer,
            product.categoryId,
            timestamp,
            timestamp,
          ],
          transaction,
        },
      );
    }

    await sequelize.query(
      `select setval(pg_get_serial_sequence('categories', 'id'), greatest((select max(id) from categories), 1), true)`,
      { transaction },
    );
    await sequelize.query(
      `select setval(pg_get_serial_sequence('products', 'id'), greatest((select max(id) from products), 1), true)`,
      { transaction },
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
};

const validateDataset = () => {
  const categoryIds = new Set(
    productionCategories.map((category) => category.id),
  );
  const brokenRefs = productionProducts.filter(
    (product) => !categoryIds.has(product.categoryId),
  );
  const testRecords = [
    ...productionCategories.filter((category) =>
      /integrated|cors|stripe final/i.test(category.name),
    ),
    ...productionProducts.filter((product) =>
      /integrated|cors|stripe final/i.test(product.name),
    ),
  ];

  return {
    brokenRefs,
    testRecords,
  };
};

const makeReport = ({
  categoryAssets,
  categoryConflicts,
  datasetValidation,
  productAssets,
  productConflicts,
  target,
}) => {
  const allAssets = [...categoryAssets, ...productAssets];
  const realAssets = allAssets.filter((asset) => !asset.usesPlaceholder);
  const placeholderAssetsUsed = allAssets.filter(
    (asset) => asset.usesPlaceholder,
  );
  const uniqueCloudinaryPublicIds = [
    ...new Set(allAssets.map((asset) => asset.upload.publicId)),
  ];
  const summarizeAsset = (asset) => ({
    extension: asset.extension,
    hash: asset.hash,
    itemId: asset.itemId,
    mime: asset.mime,
    originalPath: asset.originalPath,
    plannedPublicId: asset.upload.publicId,
    reason: asset.reason,
    size: asset.size,
    type: asset.type,
    usesPlaceholder: asset.usesPlaceholder,
  });

  return {
    cloudinary: {
      configured: Boolean(process.env.CLOUDINARY_URL),
      plannedOperations: uniqueCloudinaryPublicIds.map((publicId) => ({
        publicId,
        action:
          mode === 'execute' ? 'upload-or-reuse' : 'planned-upload-or-reuse',
      })),
    },
    dataset: {
      categories: productionCategories,
      categoryCount: productionCategories.length,
      excludedSourceRecords,
      productCount: productionProducts.length,
      products: productionProducts,
      validation: datasetValidation,
    },
    duplicates: [
      {
        decision: 'keep-both',
        name: 'X-Tudo Duplo Frango',
        reason:
          'IDs 10 and 16 have different prices and different original image paths; both are commercial burger records.',
        records: productionProducts.filter(
          (product) => product.name === 'X-Tudo Duplo Frango',
        ),
      },
      {
        decision: 'keep-both',
        name: 'Duplo X-Salada Picante',
        reason:
          'IDs 12 and 18 have different prices, offer flags and original image paths; both are commercial burger records.',
        records: productionProducts.filter(
          (product) => product.name === 'Duplo X-Salada Picante',
        ),
      },
    ],
    media: {
      categoryAssets: categoryAssets.map(summarizeAsset),
      productAssets: productAssets.map(summarizeAsset),
      realAssetCount: realAssets.length,
      placeholderCount: placeholderAssetsUsed.length,
      placeholderPublicIds: {
        category: placeholderAssets.category.publicId,
        product: placeholderAssets.product.publicId,
      },
    },
    mode,
    plannedDatabase: {
      categoryConflicts,
      productConflicts,
      targetChecked: target.checked,
      targetCounts: {
        categories: target.checked ? target.categories.length : null,
        products: target.checked ? target.products.length : null,
      },
      toInsert: {
        categories: target.checked
          ? productionCategories.filter(
              (category) =>
                !target.categories.some(
                  (targetCategory) => targetCategory.id === category.id,
                ),
            ).length
          : productionCategories.length,
        products: target.checked
          ? productionProducts.filter(
              (product) =>
                !target.products.some(
                  (targetProduct) => targetProduct.id === product.id,
                ),
            ).length
          : productionProducts.length,
      },
    },
    requiredEnv: {
      CLOUDINARY_URL: process.env.CLOUDINARY_URL ? 'set' : 'missing',
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
    },
  };
};

const main = async () => {
  if (mode === 'check-cloudinary-config') {
    const cloudinaryConfig = inspectCloudinaryConfig();

    console.log(JSON.stringify(cloudinaryConfig, null, 2));

    if (!cloudinaryConfig.parseValid) {
      process.exitCode = 1;
    }

    return;
  }

  await loadProductionCatalog();
  await loadDatabaseConfig();

  if (mode === 'execute') {
    assertProductionTarget();
  }

  const datasetValidation = validateDataset();
  const target = await loadTargetSnapshot();
  const categoryAssets = await Promise.all(
    productionCategories.map((category) =>
      inspectAsset(category, 'categories'),
    ),
  );
  const productAssets = await Promise.all(
    productionProducts.map((product) => inspectAsset(product, 'products')),
  );
  const categoryConflicts = target.checked
    ? findCategoryConflicts(target.categories)
    : [];
  const productConflicts = target.checked
    ? findProductConflicts(target.products)
    : [];
  const report = makeReport({
    categoryAssets,
    categoryConflicts,
    datasetValidation,
    productAssets,
    productConflicts,
    target,
  });

  console.log(JSON.stringify(report, null, 2));

  if (
    datasetValidation.brokenRefs.length > 0 ||
    datasetValidation.testRecords.length > 0 ||
    categoryConflicts.length > 0 ||
    productConflicts.length > 0
  ) {
    throw new Error('Migration blocked by dataset or target conflicts.');
  }

  if (mode !== 'execute') {
    return;
  }

  const categoryMedia = await uploadMedia(categoryAssets);
  const productMedia = await uploadMedia(productAssets);

  await insertCatalog({ categoryMedia, productMedia });

  const cloudinaryExecution = summarizeCloudinaryExecution([
    ...categoryMedia,
    ...productMedia,
  ]);

  console.log(
    JSON.stringify(
      {
        cloudinary: cloudinaryExecution,
        execution: 'completed',
      },
      null,
      2,
    ),
  );
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
