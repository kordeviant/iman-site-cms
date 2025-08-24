/* eslint-env node, es2020 */
const fs = require("fs");
const path = require("path");

const workspace = path.resolve(__dirname, "..");
const downloadsDir = path.join(workspace, "downloads");
const outDir = path.join(workspace, "site", "static", "downloads-images");
const indexFile = path.join(workspace, "site", "static", "downloads-index.json");

const imageExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

ensureDir(outDir);

const entries = fs.readdirSync(downloadsDir, { withFileTypes: true });
const urls = [];

entries.forEach(dirent => {
  if (!dirent.isDirectory()) return;
  const folder = path.join(downloadsDir, dirent.name);
  const files = fs.readdirSync(folder, { withFileTypes: true });
  files.forEach(f => {
    if (!f.isFile()) return;
    const ext = path.extname(f.name).toLowerCase();
    if (!imageExt.has(ext)) return;
    const src = path.join(folder, f.name);
    const destName = sanitizeFilename(dirent.name + '---' + f.name);
    const dest = path.join(outDir, destName);
    fs.copyFileSync(src, dest);
    urls.push('/downloads-images/' + destName);
  });
});

fs.writeFileSync(indexFile, JSON.stringify(urls, null, 2), 'utf8');
console.log('Copied', urls.length, 'images to', outDir);
console.log('Wrote index to', indexFile);
