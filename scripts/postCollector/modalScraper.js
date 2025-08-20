import { sleep, waitForModalOpen, waitForModalClose } from "./utils.js";
import { saveImageToFolder, stripByteRangeParams } from "./mediaDownloader.js";
import path from "path";
import fs from "fs";

// Browser-context download: preserves session headers/cookies
async function browserDownload(page, url, folderPath, filename) {
  const bytes = await page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: "include" });
    if (!r.ok) throw new Error(`Fetch ${r.status} for ${u}`);
    const buf = await r.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, url);
  const fullPath = path.join(folderPath, filename);
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(fullPath, Buffer.from(bytes));
  console.log(`💾 Saved → ${fullPath}`);
}

function pickBestVideo(urls) {
  // Prefer non-audio tracks and likely higher-quality variants
  const clean = Array.from(urls)
    .filter((u) => !u.includes("/t16/")) // skip audio-only
    .map(stripByteRangeParams);
  if (clean.length === 0) return null;

  // Heuristics: favor paths with m3xx/m36x markers or t2/t51, then by length
  clean.sort((a, b) => {
    const score = (u) =>
      (u.includes("/t2/") || u.includes("/t51/") ? 2 : 0) +
      (/\/m3\d{2}\//.test(u) ? 1 : 0) +
      u.length / 10000; // tie-breaker
    return score(b) - score(a);
  });
  return clean[0];
}

async function getModalShortcode(page) {
  // Instagram updates the path when modal opens: /reel/<shortcode>/ or /p/<shortcode>/
  const p = await page.evaluate(() => location.pathname);
  const m = p.match(/\/(?:reel|p)\/([^\/?#]+)/);
  if (m) return m[1];

  // Fallback: find link inside modal
  return await page.evaluate(() => {
    const dlg = document.querySelector('div[role="dialog"]');
    if (!dlg) return null;
    const a = dlg.querySelector('a[href*="/reel/"], a[href*="/p/"]');
    const mm = a?.getAttribute("href")?.match(/\/(?:reel|p)\/([^\/?#]+)/);
    return mm ? mm[1] : null;
  });
}

export async function openClickAndScrapeModal(page, { cellSelector, slug }) {
  let index = 1;
  const folderPath = path.join(process.cwd(), "downloads", slug);

  // Open modal
  await page.click(cellSelector, { delay: 10 });
  await waitForModalOpen(page);

  while (true) {
    // Kill background noise: pause all non-modal videos
    await page.evaluate(() => {
      const dlg = document.querySelector('div[role="dialog"]');
      const inModal = (el) => dlg && dlg.contains(el);
      document.querySelectorAll("video").forEach((v) => {
        if (!inModal(v)) {
          try {
            v.pause();
            v.muted = true;
            v.removeAttribute("src");
            v.load();
          } catch {}
        }
      });
    });

    const shortcode = await getModalShortcode(page);
    const capturedMp4Urls = new Set();
    const graphqlVideoUrls = new Set();

    // Fallback network capture: scoped and filtered
    const onRequest = (req) => {
      const url = req.url();
      if (url.startsWith("http") && url.includes(".mp4")) {
        if (url.includes("/t16/")) return; // audio-only
        capturedMp4Urls.add(stripByteRangeParams(url));
      }
    };

    // Strong association: parse JSON GraphQL/XDT responses for this shortcode
    const onResponse = async (res) => {
      try {
        const ct = res.headers()["content-type"] || "";
        if (!ct.includes("application/json")) return;
        const u = res.url();
        if (!/graphql|xdt|clips|reels|feed|media/i.test(u)) return;

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        // Crawl response for matching media and extract video URLs
        const stack = [data];
        while (stack.length) {
          const node = stack.pop();
          if (!node || typeof node !== "object") continue;

          // Match current reel by shortcode if available
          const sc = node.shortcode || node.code; // code sometimes used
          if (!shortcode || sc === shortcode) {
            // Common fields: video_url or video_versions[{url}]
            if (typeof node.video_url === "string") {
              if (!node.video_url.includes("/t16/"))
                graphqlVideoUrls.add(node.video_url);
            }
            if (Array.isArray(node.video_versions)) {
              node.video_versions.forEach((v) => {
                if (v?.url && !v.url.includes("/t16/"))
                  graphqlVideoUrls.add(v.url);
              });
            }
            // Carousel items
            if (Array.isArray(node.carousel_media)) {
              node.carousel_media.forEach((m) => {
                if (m?.video_versions) {
                  m.video_versions.forEach((v) => {
                    if (v?.url && !v.url.includes("/t16/"))
                      graphqlVideoUrls.add(v.url);
                  });
                }
              });
            }
          }

          // DFS
          for (const k in node) {
            const val = node[k];
            if (val && typeof val === "object") stack.push(val);
          }
        }
      } catch {}
    };

    page.on("request", onRequest);
    page.on("response", onResponse);

    // Detect media on current slide
    const mediaList = await page.evaluate(() => {
      const results = [];
      const img = document.querySelector(
        'article[role="presentation"] div[role="presentation"] > div > ul li img'
      );
      if (img) results.push({ type: "image", src: img.currentSrc || img.src });

      const vid = document.querySelector('article[role="presentation"] video');
      if (vid) results.push({ type: "video" });

      return results;
    });

    for (const media of mediaList) {
      if (media.type === "image") {
        await saveImageToFolder(page, slug, media.src, index++);
      } else if (media.type === "video") {
        // Nudge the modal video so requests fire
        await page.evaluate(() => {
          const v = document.querySelector(
            'article[role="presentation"] video'
          );
          if (v) {
            try {
              v.muted = true;
              v.play().catch(() => {});
            } catch {}
          }
        });

        // Tight window to capture only this slide’s traffic
        await new Promise((r) => setTimeout(r, 1200));

        // Prefer strongly-associated GraphQL URLs; fallback to direct .mp4
        const preferred = pickBestVideo(graphqlVideoUrls);
        const fallback = pickBestVideo(capturedMp4Urls);
        const finalUrl = preferred || fallback;

        if (finalUrl) {
          const name = `video_${String(index++).padStart(2, "0")}.mp4`;
          console.log(`🎯 Chosen video for ${slug}: ${finalUrl}`);
          await browserDownload(page, finalUrl, folderPath, name);
        } else {
          console.log(
            "⚠️ No confidently associated video URL found for this slide."
          );
        }
      }
    }

    // Cleanup listeners for this slide
    page.off("request", onRequest);
    page.off("response", onResponse);

    // Next slide or exit
    const nextBtn = await page.$(
      'article[role="presentation"] button[aria-label="Next"]'
    );
    if (!nextBtn) break;
    await nextBtn.click();
    await sleep(350);
  }

  // Close modal
  const closeBtn = await page.$('div[role="dialog"] [aria-label="Close"]');
  if (closeBtn) {
    await closeBtn.click();
    await waitForModalClose(page);
  } else {
    await page.keyboard.press("Escape");
    await sleep(400);
  }
}
