// modalScraper.js
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

/**
 * Scrolls the page down a number of times with a delay
 */
async function scrollAndWait(page, scrollCount = 3, delayMs = 1500) {
  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(delayMs);
  }
}

/**
 * Save a blob or buffer to disk with a given base name + extension
 */
function saveBuffer(destBase, ext, bytes) {
  const destPath = `${destBase}.${ext}`;
  if (!fs.existsSync(destPath)) {
    fs.writeFileSync(destPath, Buffer.from(bytes));
    console.log(
      `   💾 Saved ${path.basename(destPath)} (${bytes.length} bytes)`
    );
  } else {
    console.log(`   ⏭️ Skipped existing ${path.basename(destPath)}`);
  }
}

/**
 * Main scraper — accepts either a selector or a direct URL
 */
export async function modalScraper(page, target, outputDir) {
  // Handle target as URL or selector
  if (typeof target === "string" && target.startsWith("http")) {
    await page.goto(target, { waitUntil: "networkidle2" });
  } else if (typeof target === "string") {
    await page.click(target);
  } else {
    throw new Error("Target must be a selector string or a URL string");
  }

  // Wait for modal video
  await page.waitForSelector('div[role="dialog"] video');

  // Intercept manifest URLs
  let manifestUrl = null;
  const respHandler = (res) => {
    const url = res.url();
    if ((url.endsWith(".m3u8") || url.endsWith(".mpd")) && !manifestUrl) {
      manifestUrl = url;
    }
  };
  page.on("response", respHandler);

  const vidHandle = await page.$('div[role="dialog"] video');

  // Ensure playback starts
  await page.evaluate((vid) => {
    if (vid && vid.paused) vid.play().catch(() => {});
  }, vidHandle);

  // Wait until video ended (fully buffered)
  await page.evaluate(
    (vid) =>
      new Promise((res) => {
        vid.onended = res;
      }),
    vidHandle
  );

  // Try direct blob or progressive URL fetch
  const blobData = await page.evaluate(async (vid) => {
    if (!vid) return null;
    const src = vid.currentSrc || vid.src;
    if (!src) return null;

    const grab = async (link) => {
      const resp = await fetch(link);
      const ab = await resp.arrayBuffer();
      return { bytes: Array.from(new Uint8Array(ab)), type: resp.type || "" };
    };

    if (src.startsWith("blob:")) return await grab(src);
    if (!src.includes("bytestart") && !src.includes("byteend"))
      return await grab(src);
    return null;
  }, vidHandle);

  // Output path
  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = `video_${Date.now()}`;
  const destBase = path.join(outputDir, baseName);

  if (blobData) {
    const ext = blobData.type.includes("mp4") ? "mp4" : "bin";
    saveBuffer(destBase, ext, blobData.bytes);
  } else if (manifestUrl) {
    console.log(`🎯 Found manifest: ${manifestUrl}`);
    await new Promise((resolve, reject) => {
      const ff = spawn(
        "ffmpeg",
        ["-i", manifestUrl, "-c", "copy", `${destBase}.mp4`],
        { stdio: "inherit" }
      );
      ff.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
      );
    });
    console.log(`✅ Saved via ffmpeg: ${destBase}.mp4`);
  } else {
    console.warn("❌ No usable blob or manifest found");
  }

  // Remove listener and close modal
  page.off("response", respHandler);
  await page.keyboard.press("Escape");
}

// Optional: re-export with legacy name for compatibility
export const clickPostAndScrape = modalScraper;

// Export scroll helper if other modules want it
export { scrollAndWait };
