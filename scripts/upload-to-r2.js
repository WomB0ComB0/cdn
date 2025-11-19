const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

// Configuration
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

const STATIC_DIR = path.join(__dirname, '..', 'static');
const MANIFEST_FILE = path.join(__dirname, '..', 'asset-manifest.json');

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function uploadFile(localPath, remotePath, contentType) {
  const fileContent = fs.readFileSync(localPath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  try {
    await r2Client.send(command);
    console.log(`✓ Uploaded: ${remotePath}`);
  } catch (error) {
    console.error(`✗ Failed to upload ${remotePath}:`, error.message);
    throw error;
  }
}

async function main() {
  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));

  // Upload each file with its hashed name
  for (const [original, info] of Object.entries(manifest)) {
    const localPath = path.join(STATIC_DIR, original);
    const remotePath = `assets/${info.hashed}`;
    const contentType = mime.lookup(original) || 'application/octet-stream';

    await uploadFile(localPath, remotePath, contentType);
  }

  console.log('\n✓ All assets uploaded successfully!');
}

main().catch(error => {
  console.error('Upload failed:', error);
  process.exit(1);
});
