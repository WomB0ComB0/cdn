const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATIC_DIR = path.join(__dirname, '..', 'static');
const manifest = {};

function generateHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function walkDirectory(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath, baseDir);
    } else {
      const relativePath = path.relative(baseDir, filePath);
      const hash = generateHash(filePath);
      const ext = path.extname(file);
      const name = path.basename(file, ext);
      const dirName = path.dirname(relativePath);
      
      const hashedFileName = `${name}.${hash}${ext}`;
      const hashedPath = path.join(dirName, hashedFileName);

      manifest[relativePath] = {
        original: relativePath,
        hashed: hashedPath.replace(/\\/g, '/'),
        hash: hash,
        size: stat.size,
      };
    }
  });
}

if (fs.existsSync(STATIC_DIR)) {
  walkDirectory(STATIC_DIR);
}

console.log(JSON.stringify(manifest, null, 2));
