// processPosts.js
import { discoverVisiblePosts } from "./linkDiscovery.js";
import { openClickAndScrapeModal } from "./modalScraper.js";
import { sleep, scrollIntoViewIfNeeded } from "./utils.js";

export async function processPosts(page, options = { media: true, metadata: false }) {
  const seen = new Set();
  let processed = 0;
  const gridSelector = 'article a[href*="/p/"], article a[href*="/reel/"]';
  let consecutiveNoNew = 0;

  while (true) {
    const items = await discoverVisiblePosts(page, { includeReels: true });
    const allFresh = items.filter((item) => !seen.has(item.key));

    // Process only fresh photo posts
    for (const item of allFresh) {
      seen.add(item.key);
      console.log(`▶️ START ${item.url}`);
        try {
          await scrollIntoViewIfNeeded(page, item.selector);
          await openClickAndScrapeModal(page, {
            cellSelector: item.selector,
            slug: item.key,
            options,
          });
          console.log(`✅ DONE ${item.url}`);
        } catch (e) {
          console.error(`❌ Error on ${item.url}: ${e.message}`);
        }
      processed++;
    }

    // Mark all fresh items (photos or reels) as seen so scroll logic stays alive
    for (const f of allFresh) seen.add(f.key);

    if (allFresh.length === 0) {
      consecutiveNoNew++;
      if (consecutiveNoNew >= 3) {
        console.log("ℹ️ No new posts after multiple scrolls — stopping.");
        break;
      }
    } else {
      consecutiveNoNew = 0;
    }

    // Always scroll to try to reveal more
    await page.evaluate(() =>
      window.scrollBy(0, Math.round(window.innerHeight * 0.9))
    );
    await sleep(400);
  }

  console.log(`🎉 Done. Scraped ${processed} photo post(s).`);
}
