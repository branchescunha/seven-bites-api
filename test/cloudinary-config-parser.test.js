import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectCloudinaryConfig,
  parseCloudinaryUrl,
  summarizeCloudinaryExecution,
} from '../scripts/migrate-production-catalog.js';

test('cloudinary config parser accepts a valid value', () => {
  assert.deepEqual(
    inspectCloudinaryConfig('cloudinary://api-key:api-secret@cloud-name'),
    {
      envPresent: true,
      outerQuotesDetected: false,
      whitespaceDetected: false,
      protocolValid: true,
      hasUsername: true,
      hasPassword: true,
      hasHostname: true,
      parseValid: true,
    },
  );
});

test('cloudinary config parser detects external quotes', () => {
  const result = inspectCloudinaryConfig(
    '"cloudinary://api-key:api-secret@cloud-name"',
  );

  assert.equal(result.outerQuotesDetected, true);
  assert.equal(result.parseValid, true);
});

test('cloudinary config parser detects external whitespace', () => {
  const result = inspectCloudinaryConfig(
    '  cloudinary://api-key:api-secret@cloud-name  ',
  );

  assert.equal(result.whitespaceDetected, true);
  assert.equal(result.parseValid, true);
});

test('cloudinary config parser accepts API secret with hyphen', () => {
  const result = inspectCloudinaryConfig(
    'cloudinary://api-key:secret-one@cloud',
  );

  assert.equal(result.hasPassword, true);
  assert.equal(result.parseValid, true);
});

test('cloudinary config parser accepts API secret with underscore', () => {
  const result = inspectCloudinaryConfig(
    'cloudinary://api-key:secret_one@cloud',
  );

  assert.equal(result.hasPassword, true);
  assert.equal(result.parseValid, true);
});

test('cloudinary config parser decodes percent-encoded credentials', () => {
  const parsed = parseCloudinaryUrl(
    'cloudinary://api%40key:secret%2Fone@cloud',
  );

  assert.equal(parsed.apiKey, 'api@key');
  assert.equal(parsed.apiSecret, 'secret/one');
  assert.equal(parsed.cloudName, 'cloud');
});

test('cloudinary config parser rejects wrong protocol', () => {
  const result = inspectCloudinaryConfig('https://api-key:api-secret@cloud');

  assert.equal(result.protocolValid, false);
  assert.equal(result.parseValid, false);
});

test('cloudinary config parser rejects missing username', () => {
  const result = inspectCloudinaryConfig('cloudinary://:api-secret@cloud');

  assert.equal(result.hasUsername, false);
  assert.equal(result.parseValid, false);
});

test('cloudinary config parser rejects missing password', () => {
  const result = inspectCloudinaryConfig('cloudinary://api-key@cloud');

  assert.equal(result.hasPassword, false);
  assert.equal(result.parseValid, false);
});

test('cloudinary config parser rejects missing hostname', () => {
  const result = inspectCloudinaryConfig('cloudinary://api-key:api-secret@');

  assert.equal(result.protocolValid, true);
  assert.equal(result.hasUsername, true);
  assert.equal(result.hasPassword, true);
  assert.equal(result.hasHostname, false);
  assert.equal(result.parseValid, false);
});

test('cloudinary execution summary groups repeated placeholder public ids', () => {
  const result = summarizeCloudinaryExecution([
    {
      cloudinary: {
        action: 'uploaded',
        publicId: 'seven-bites/placeholders/product-placeholder-v1',
      },
      itemId: 1,
      type: 'products',
      usesPlaceholder: true,
    },
    {
      cloudinary: {
        action: 'uploaded',
        publicId: 'seven-bites/placeholders/product-placeholder-v1',
      },
      itemId: 2,
      type: 'products',
      usesPlaceholder: true,
    },
  ]);

  assert.deepEqual(result.operations, [
    {
      action: 'uploaded',
      affectedItems: 2,
      publicId: 'seven-bites/placeholders/product-placeholder-v1',
    },
  ]);
  assert.equal(result.itemMappings.length, 2);
});
