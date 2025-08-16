/* eslint-env node, es2020 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  MEDIA_ROOT,
  ensureDir,
  sanitizeSegment,
  keyToFolderName,
  guessExtFromUrl,
  extFromContentType,
} = require("./utils");

async function downloadWithBrowser(page, url, destBase, initialGuess) {
  const fs = require("fs");
  const path = require("path");
  const { extFromContentType } = require("./utils");

  if (initialGuess && fs.existsSync(`${destBase}.${initialGuess}`)) return;

  // Skip unsupported schemes quickly
  if (/^(data:|ws:)/i.test(url)) {
    console.log(`   ⏭️ Skip unsupported URL: ${url}`);
    return;
  }

  // Handle blob: URLs inside the page context
  if (url.startsWith("blob:")) {
    console.log(`   🌐 Fetching blob in page context: ${url}`);
    try {
      const result = await page.evaluate(async (blobUrl) => {
        const blob = await fetch(blobUrl);
        const buffer = await blob.arrayBuffer();
        return {
          bytes: Array.from(new Uint8Array(buffer)),
          ct: blob.type || "",
        };
      }, url);

      const ext = initialGuess || extFromContentType(result.ct) || "mp4";

      const destPath = `${destBase}.${ext}`;
      if (!fs.existsSync(destPath)) {
        fs.writeFileSync(destPath, Buffer.from(result.bytes));
        console.log(
          `   💾 Saved blob video as ${path.basename(destPath)} (${
            result.bytes.length
          } bytes)`
        );
      }
    } catch (err) {
      console.log(`   ❌ Failed blob fetch: ${err.message}`);
    }
    return;
  }

  // Standard http(s) fetch in a new tab
  const p2 = await page.browser().newPage();
  try {
    // Set UA if available
    if (typeof page.userAgent === "function") {
      try {
        await p2.setUserAgent(await page.userAgent());
      } catch {
        /* ignore if not supported */
      }
    } else if (page.context && typeof page.context === "function") {
      try {
        await p2.setUserAgent(await page.context().userAgent());
      } catch {
        /* ignore */
      }
    }

    // Always send a valid Referer for Instagram
    if (typeof p2.setExtraHTTPHeaders === "function") {
      await p2.setExtraHTTPHeaders({ Referer: "https://www.instagram.com/" });
    }

    console.log(`   ↪ Fetching: ${url}`);
    const resp = await p2.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    if (!resp) throw new Error("No response from server");

    const ct = (resp.headers()["content-type"] || "").toLowerCase();
    const ext =
      initialGuess ||
      extFromContentType(ct) ||
      (url.toLowerCase().includes(".mp4") ? "mp4" : "bin");

    const destPath = `${destBase}.${ext}`;
    if (fs.existsSync(destPath)) return;

    const buf = await resp.buffer();
    fs.writeFileSync(destPath, buf);
    console.log(`   💾 Saved ${path.basename(destPath)} (${buf.length} bytes)`);
  } catch (e) {
    console.log(`   ❌ Download failed: ${e.message}`);
  } finally {
    await p2.close();
  }
}

async function downloadPostMedia(page, keyObj, mediaUrls) {
  const folder = path.join(
    MEDIA_ROOT,
    sanitizeSegment(keyToFolderName(keyObj))
  );
  ensureDir(folder);

  for (let i = 0; i < mediaUrls.length; i++) {
    const url = mediaUrls[i];
    if (!/^https?:/i.test(url)) {
      // Skip blob:, data:, etc.
      console.log(`   ⏭️ Skip non-http URL: ${url}`);
      continue;
    }
    if (/\.m3u8(\?|$)|\.mpd(\?|$)/i.test(url)) {
      console.log(`   ⏭️ Skip HLS/DASH manifest: ${url}`);
      continue;
    }
    const baseName = `media ${i + 1}`;
    const destBase = path.join(folder, baseName);
    const guess = guessExtFromUrl(url);
    // inside downloadPostMedia loop
    try {
      await Promise.race([
        downloadWithBrowser(page, url, destBase, guess),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("per-file timeout")), 40000)
        ),
      ]);
    } catch (e) {
      console.log(`   ❌ Failed ${baseName}: ${e.message}`);
    }
  }
}

module.exports = {
  downloadPostMedia,
};
