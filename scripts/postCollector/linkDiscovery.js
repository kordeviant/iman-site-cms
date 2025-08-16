// linkDiscovery.js
export async function discoverVisiblePosts(page, { includeReels = true } = {}) {
  const selector = 'a._a6hd[href*="/p/"], a._a6hd[href*="/reel/"]';

  return await page.evaluate((selector, includeReels) => {
    const anchors = Array.from(document.querySelectorAll(selector))
      .filter(a => includeReels || !a.href.includes('/reel/'));

    return anchors.map((a, idx) => {
      const url = a.href.split('?')[0];
      const slug = url.split('/').filter(Boolean).pop();
      a.dataset.scrapeId = slug; // tag for click targeting
      return {
        key: slug,
        url,
        selector: `a[data-scrape-id="${slug}"]`,
      };
    });
  }, selector, includeReels);
}