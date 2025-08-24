import { sleep, waitForModalOpen, waitForModalClose } from "./utils.js";
import {
  saveImageToFolder,
  stripByteRangeParams,
  saveVideoToFolder,
} from "./mediaDownloader.js";
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

export async function openClickAndScrapeModal(
  page,
  { cellSelector, slug, options = { media: true, metadata: false } }
) {
  let index = 1;
  const folderPath = path.join(process.cwd(), "downloads", slug);
  const metadata = {
    slug,
    items: [],
    caption: null,
    likes: null,
    postUrl: null,
  };

  // Open modal
  await page.click(cellSelector, { delay: 10 });
  await waitForModalOpen(page);
  // postInfo may be populated from DOM evaluation inside the loop; declare outer so we can use after loop
  let postInfo = null;

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
    // Try to extract caption (ONLY using the selector you specified), like count and post URL from the modal DOM
    postInfo = await page.evaluate(() => {
      const dlg = document.querySelector('div[role="dialog"]');
      const hrefEl = dlg ? dlg.querySelector('a[href*="/p/"], a[href*="/reel/"]') : null;
      const postUrl = hrefEl ? hrefEl.href : (location.origin + location.pathname);

      // Use only the selector provided by the user for caption extraction
      const captionSel = 'div[role="dialog"] article div.html-div>div:nth-child(2) ul li:first-child';
      const capEl = document.querySelector(captionSel);
      const caption = capEl ? capEl.textContent.trim() : null;

      function findLikes() {
        const text = dlg ? dlg.innerText : document.body.innerText;
        if (!text) return null;
        // Try common patterns: "123 likes", "123 likes, 45 comments", "Liked by X and 123 others", or views
        const m1 = text.match(/([0-9,\.]+)\s+likes?/i);
        if (m1) return parseInt(m1[1].replace(/[,.]/g, ''), 10);
        const m2 = text.match(/Liked by[\s\S]*?([0-9,\.]+)\s+others/i);
        if (m2) return parseInt(m2[1].replace(/[,.]/g, ''), 10);
        const m3 = text.match(/([0-9,\.]+)\s+views?/i);
        if (m3) return parseInt(m3[1].replace(/[,.]/g, ''), 10);
        return null;
      }

      return { postUrl, caption, like_count: findLikes() };
    });
    const capturedMp4Urls = new Set();
    const graphqlVideoUrls = new Set();
    let graphqlCaption = null;
    let graphqlLikes = null;

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

            // Try to capture caption and like count from GraphQL node
            try {
              if (!graphqlCaption) {
                const cap =
                  node.edge_media_to_caption?.edges?.[0]?.node?.text ||
                  node.caption ||
                  node.title ||
                  null;
                if (cap && typeof cap === "string") graphqlCaption = cap;
              }
              if (!graphqlLikes) {
                const likes =
                  node.edge_media_preview_like?.count ||
                  node.edge_media_preview_like ||
                  node.edge_liked_by?.count ||
                  node.likes?.count ||
                  null;
                if (
                  typeof likes === "number" ||
                  (typeof likes === "string" && /\d+/.test(likes))
                )
                  graphqlLikes = Number(likes);
              }
            } catch {}
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

    // Extract caption, likes and post URL from DOM when possible
    try {
      const domMeta = await page.evaluate(() => {
        const sel = "article div.html-div ul>li:first-child";
        const el = document.querySelector(sel);
        const caption = el ? el.textContent.trim() : null;

        // Try to determine likes text (varies by layout)
        let likes = null;
        // look for buttons/sections that contain the likes number
        const likeSelectors = [
          'article section a[href*="/liked_by/"]',
          "article section span",
          'article div[role="presentation"] section span',
        ];
        for (const s of likeSelectors) {
          const n = document.querySelector(s);
          if (n && /\d/.test(n.textContent)) {
            const m = n.textContent.replace(/[^0-9]/g, "");
            if (m) {
              likes = Number(m);
              break;
            }
          }
        }

        // Post URL: prefer canonical link inside modal or location
        const dlg = document.querySelector('div[role="dialog"]');
        let postUrl = null;
        if (dlg) {
          const a = dlg.querySelector('a[href*="/p/"] , a[href*="/reel/"]');
          if (a) postUrl = a.href;
        }
        if (!postUrl) postUrl = location.href;

        return { caption, likes, postUrl };
      });

      if (domMeta.caption && !metadata.caption)
        metadata.caption = domMeta.caption;
      if (domMeta.likes && !metadata.likes) metadata.likes = domMeta.likes;
      if (domMeta.postUrl && !metadata.postUrl)
        metadata.postUrl = domMeta.postUrl;
    } catch (e) {}

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
        let filename = null;
        if (options.media)
          filename = await saveImageToFolder(page, slug, media.src, index);
        metadata.items.push({ type: "image", src: media.src, filename });
        index++;
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
          console.log(`🎯 Chosen video for ${slug}: ${finalUrl}`);
          let filename = null;
          if (options.media) {
            // prefer saveVideoToFolder which uses node-fetch and saves reliably
            filename = await saveVideoToFolder(page, slug, finalUrl, index);
          }
          metadata.items.push({ type: "video", src: finalUrl, filename });
          index++;
        } else {
          console.log(
            "⚠️ No confidently associated video URL found for this slide."
          );
          metadata.items.push({ type: "video", src: null, filename: null });
        }
      }
    }

    // Cleanup listeners for this slide
    page.off("request", onRequest);
    page.off("response", onResponse);

    // If GraphQL provided metadata, prefer it when we don't have DOM results
    if (!metadata.caption && graphqlCaption) metadata.caption = graphqlCaption;
    if (!metadata.likes && graphqlLikes != null) metadata.likes = graphqlLikes;
    // Ensure postUrl is set from shortcode when available
    if (!metadata.postUrl && shortcode) {
      const kind = /reel/i.test(
        (await page.evaluate(() => location.pathname)) || ""
      )
        ? "reel"
        : "p";
      metadata.postUrl = `https://www.instagram.com/${kind}/${shortcode}/`;
    }

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

  // Merge post-level info into metadata (prefer DOM/GraphQL values we already populated)
  if (postInfo) {
    // primary camelCase fields
    if (postInfo.postUrl) metadata.postUrl = postInfo.postUrl;
    if (postInfo.caption) metadata.caption = postInfo.caption;
    if (typeof postInfo.like_count === "number")
      metadata.likes = postInfo.like_count;

    // legacy keys for backward compatibility
    metadata.post_url = metadata.postUrl || postInfo.postUrl || null;
    metadata.like_count =
      typeof metadata.likes === "number"
        ? metadata.likes
        : typeof postInfo.like_count === "number"
        ? postInfo.like_count
        : null;
  }

  if (options.metadata) {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, "metadata.json"),
        JSON.stringify(metadata, null, 2)
      );
      console.log(
        `🗂 Wrote metadata → ${path.join(folderPath, "metadata.json")}`
      );
    } catch (err) {
      console.warn(`⚠️ Failed to write metadata for ${slug}: ${err.message}`);
    }
  }
}
