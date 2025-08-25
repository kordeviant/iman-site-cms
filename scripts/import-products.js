// save as import-products.js
const fs = require("fs");
const path = require("path");

const downloadsDir = path.join(__dirname, "..", "downloads");
const contentDir = path.join(__dirname, "..", "content", "products");
const staticDir = path.join(__dirname, "..", "static", "uploads", "products");
fs.readdirSync(downloadsDir).forEach((slug) => {
  const folder = path.join(downloadsDir, slug);
  const metadataPath = path.join(folder, "metadata.json");
  if (!fs.existsSync(metadataPath)) return;

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

  // Ensure output dirs
  const productContentDir = path.join(contentDir, slug);
  const productStaticDir = path.join(staticDir, slug);
  fs.mkdirSync(productContentDir, { recursive: true });
  fs.mkdirSync(productStaticDir, { recursive: true });

  // Copy media files
  const gallery = [];
  let primaryImage = "";

  fs.readdirSync(folder).forEach((file) => {
    if (file.startsWith("media") || file.startsWith("video")) {
      const srcPath = path.join(folder, file);
      const ext = path.extname(file).toLowerCase();

      // Skip large MP4s (> 1 MB)
      if (ext === ".mp4") {
        const stats = fs.statSync(srcPath);
        const sizeInMB = stats.size / (1024 * 1024);
        if (sizeInMB > 1) {
          console.log(
            `Skipping large video: ${file} (${sizeInMB.toFixed(2)} MB)`
          );
          return; // skip this file
        }
      }

      // Copy file to static/uploads/products/<slug>/
      const destPath = path.join(productStaticDir, file);
      fs.copyFileSync(srcPath, destPath);

      const publicPath = `/uploads/products/${slug}/${file}`;

      if (
        !primaryImage &&
        [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)
      ) {
        primaryImage = publicPath;
      } else {
        gallery.push({
          type: [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image",
          src: publicPath,
        });
      }
    }
  });

  function yamlEscape(str) {
    return (str || "")
      .replace(/"/g, '\\"') // escape quotes
      .replace(/\n/g, "\\n"); // escape newlines
  }

  const frontMatter = `---
title: "${yamlEscape(metadata.caption?.split("\n")[0] || slug)}"
date: ${new Date().toISOString()}
description: "${yamlEscape(metadata.caption || "")}"
image: "${primaryImage}"
gallery:
${gallery.map((g) => `  - type: "${g.type}"\n    src: "${g.src}"`).join("\n")}
price: 0
category: "Jewelry"
in_stock: true
featured: false
instagram_post: "${metadata.post_url || ""}"
instagram_id: "${metadata.slug || ""}"
instagram_account: ""
body: |
  ${(metadata.caption || "").replace(/\n/g, "\n  ")}
---
`;

  fs.writeFileSync(
    path.join(productContentDir, "index.md"),
    frontMatter,
    "utf8"
  );
  console.log(`Imported product: ${slug}`);
});
