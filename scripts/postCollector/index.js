/* eslint-env node, es2020 */
"use strict";

import { modalScraper, scrollAndWait } from "./modalScraper.js";
const { discoverLinks } = require("./linkDiscovery");
const { downloadPostMedia } = require("./mediaDownloader");
const { ensureDir, MEDIA_ROOT } = require("./utils");

const INCLUDE_REELS = true;
const MAX_EMPTY_SCROLLS = 3;

/**
 * Discover post URLs by scrolling the feed
 */
async function collectPostUrls(
  page,
  {
    max = 20,
    scrollBatches = 6,
    pauseMs = 1200,
    anchorSelector = 'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
  } = {}
) {
  const urls = new Set();

  const collect = async () => {
    const found = await page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel))
        .map((a) => a.href)
        .filter(Boolean);
    }, anchorSelector);
    found.forEach((u) => urls.add(u));
  };

  await collect();

  for (let i = 0; urls.size < max && i < scrollBatches; i++) {
    await scrollAndWait(page, 1, pauseMs);
    await collect();
  }

  return Array.from(urls).slice(0, max);
}

export async function processPostsSamePage(
  page,
  {
    max = 20,
    outputDir = "./media",
    scrollBatches = 6,
    pauseMs = 1200,
    anchorSelector = 'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
  } = {}
) {
  const urls = await collectPostUrls(page, {
    max,
    scrollBatches,
    pauseMs,
    anchorSelector,
  });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // Create a fresh selector each loop to avoid stale handles
    const safeHref = url.replace(/"/g, '\\"');
    const sel = `${anchorSelector
      .split(",")
      .map((s) => `${s.trim()}[href="${safeHref}"]`)
      .join(", ")}`;

    try {
      // Re-find the element (DOM changes after scrolling)
      await page.waitForSelector(sel, { timeout: 4000 });
      await modalScraper(page, sel, outputDir);
      console.log(`✅ [${i + 1}/${urls.length}] Done: ${url}`);
    } catch (err) {
      console.warn(
        `⚠️  [${i + 1}/${urls.length}] Failed: ${url}\n   ${err.message}`
      );
    }
    await page.waitForTimeout(350);
  }
}

module.exports = { processPosts };
